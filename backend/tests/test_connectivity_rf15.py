import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import aclosing
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from types import SimpleNamespace
import uuid

import paho.mqtt.client as mqtt
import pytest
import pymysql
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("JWT_SECRET_KEY", "rf15-pytest-only-secret")

from app.config import get_settings
from app.database import db_cursor, run_migrations
from app.main import app
from app.routers.mediciones import _connectivity_events
from app.services import device_connectivity as connectivity
from app.services.live_telemetry import get_location_humidity_snapshot, get_location_temperature_snapshot
from app.services.mqtt_ingest import MqttIngestionService


@pytest.mark.parametrize("elapsed, expected", [
    (None, "PENDIENTE"), (0, "ONLINE"), (10, "ONLINE"), (10.000001, "ADVERTENCIA"),
    (60, "ADVERTENCIA"), (60.000001, "OFFLINE"),
])
def test_rf15_limites_sin_intervalos_ambiguos(elapsed, expected):
    now = datetime(2026, 1, 1)
    last = None if elapsed is None else now - timedelta(seconds=elapsed)
    assert connectivity.classify_contact(last, now, 10, 60) == expected


def inventory_row(device_id):
    with db_cursor() as cursor:
        cursor.execute("SELECT * FROM dispositivos WHERE id_dispositivo = %s", (device_id,))
        return cursor.fetchone()


def audit(device_id):
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT estado_nuevo, motivo, ultimo_ping FROM historial_conectividad_dispositivos
            WHERE dispositivo_id = %s ORDER BY id_evento
            """,
            (device_id,),
        )
        return cursor.fetchall()


@pytest.fixture
def rf15_nodes(monkeypatch):
    run_migrations()
    settings = get_settings()
    monkeypatch.setattr(settings, "rf15_mqtt_acl_enforced", True)
    monkeypatch.setattr(settings, "rf15_normal_seconds", 10)
    monkeypatch.setattr(settings, "rf15_max_silence_seconds", 60)
    tag = uuid.uuid4().hex[:8]
    location = f"qa-rf15-{tag}"
    nodes = [f"rf15-{tag}-{i}" for i in range(3)]
    with db_cursor() as cursor:
        cursor.execute(
            "INSERT INTO ubicaciones (ubicacion_id, nombre, codigo_area, tipo, estado) VALUES (%s, %s, %s, 'Laboratorio', 'ACTIVA')",
            (location, location, tag),
        )
        for i, device_id in enumerate(nodes):
            mac = "02:" + ":".join([tag[k:k + 2] for k in range(0, 8, 2)] + [f"{i:02X}"])
            cursor.execute(
                """
                INSERT INTO dispositivos (id_dispositivo, nombre, codigo, mac_address, ubicacion_id, mqtt_client_id, mqtt_topic)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (device_id, device_id, device_id, mac, location, f"client-{device_id}", f"simoa/dispositivos/{device_id}/telemetria"),
            )
        cursor.execute(
            """
            INSERT INTO sensores (id_sensor, dispositivo_id, identificador, modelo, variables_medidas, estado, fecha_instalacion, ultima_calibracion)
            VALUES (%s, %s, %s, 'DHT22', %s, 'ACTIVO', '2026-01-01', '2026-01-01')
            """,
            (nodes[0], nodes[0], nodes[0], json.dumps([{"variable": "temperatura"}, {"variable": "humedad"}])),
        )
    yield location, nodes
    with db_cursor() as cursor:
        cursor.execute("DELETE FROM mqtt_mensajes_rechazados WHERE codigo_dispositivo IN %s", (nodes,))
        cursor.execute("DELETE FROM historial_conectividad_dispositivos WHERE dispositivo_id IN %s", (nodes,))
        cursor.execute("DELETE FROM mediciones WHERE dispositivo_id IN %s", (nodes,))
        cursor.execute("DELETE FROM sensores WHERE dispositivo_id IN %s", (nodes,))
        cursor.execute("DELETE FROM dispositivos WHERE id_dispositivo IN %s", (nodes,))
        cursor.execute("DELETE FROM ubicaciones WHERE ubicacion_id = %s", (location,))


def packet(device_id, captured, *, heartbeat=False, retained=False, **overrides):
    data = {"codigo": device_id, "timestamp": captured.isoformat()}
    data.update({"mqtt_client_id": f"client-{device_id}"} if heartbeat else {"temperatura": 22.5, "humedad": 55.0})
    data.update(overrides)
    topic = f"simoa/dispositivos/{device_id}/" + ("heartbeat" if heartbeat else "telemetria")
    return SimpleNamespace(topic=topic, payload=json.dumps(data).encode(), retain=retained)


def ingest(service, message):
    service._on_message(None, None, message)
    service._stop_event.set()
    service._telemetry_worker_loop()


def test_rf15_persistencia_mqtt_microcortes_reinicio_y_recuperacion(rf15_nodes, monkeypatch):
    location, (node, second, pending) = rf15_nodes
    received = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=75)
    clock = [received]
    monkeypatch.setattr(connectivity, "utc_now", lambda: clock[0])
    monkeypatch.setattr("app.services.mqtt_ingest.utc_now", lambda: clock[0])
    service = MqttIngestionService()

    valid = packet(node, received - timedelta(seconds=1))
    for message in [
        SimpleNamespace(topic=valid.topic, payload=b"{", retain=False),
        packet(node, received, heartbeat=True, mqtt_client_id="incorrecto"),
        packet(pending, received, heartbeat=True, retained=True),
        packet("desconocido", received, heartbeat=True),
    ]:
        ingest(service, message)
    assert inventory_row(node)["ultimo_ping"] is None
    assert inventory_row(pending)["estado"] == "PENDIENTE"

    ingest(service, valid)
    ingest(service, packet(second, received, heartbeat=True))
    assert inventory_row(node)["ultimo_ping"] == received
    assert inventory_row(second)["ultimo_ping"] == received
    assert [row["motivo"] for row in audit(node)] == ["TELEMETRIA"]
    assert [row["motivo"] for row in audit(second)] == ["HEARTBEAT"]

    clock[0] = received + timedelta(seconds=11)
    monitor = connectivity.ConnectivityMonitor()
    monitor.scan()
    assert inventory_row(node)["estado"] == "ADVERTENCIA"
    ingest(service, packet(node, clock[0], heartbeat=True))
    assert inventory_row(node)["estado"] == "ONLINE"
    latest_ping = clock[0]

    clock[0] = latest_ping + timedelta(seconds=61)
    with ThreadPoolExecutor(2) as executor:
        list(executor.map(lambda _: connectivity.ConnectivityMonitor().scan(), range(2)))
    assert inventory_row(node)["estado"] == "OFFLINE"
    assert inventory_row(second)["estado"] == "OFFLINE"
    assert inventory_row(node)["ultimo_ping"] == latest_ping
    assert inventory_row(pending)["estado"] == "PENDIENTE"
    assert get_location_temperature_snapshot(location)["temperatura_actual"] is None
    assert get_location_humidity_snapshot(location)["humedad_actual"] is None
    ingest(service, valid)
    ingest(service, packet(node, received + timedelta(seconds=4), heartbeat=True))
    assert inventory_row(node)["estado"] == "OFFLINE"

    clock[0] += timedelta(seconds=1)
    restarted = MqttIngestionService()
    ingest(restarted, packet(node, clock[0], heartbeat=True))
    assert inventory_row(node)["estado"] == "ONLINE"
    assert get_location_temperature_snapshot(location)["temperatura_actual"] is None
    assert [row["estado_nuevo"] for row in audit(node)] == [
        "ONLINE", "ADVERTENCIA", "ONLINE", "OFFLINE", "ONLINE",
    ]
    assert connectivity.ConnectivityMonitor().scan() == 0
    clock[0] += timedelta(seconds=1)
    ingest(restarted, packet(node, clock[0]))
    assert get_location_temperature_snapshot(location)["temperatura_actual"] == 22.5
    assert get_location_humidity_snapshot(location)["humedad_actual"] == 55.0

    with db_cursor() as cursor:
        connectivity.deactivate_device(cursor, connectivity.lock_device(cursor, node))
    clock[0] += timedelta(seconds=1)
    ingest(restarted, packet(node, clock[0], heartbeat=True))
    row = inventory_row(node)
    assert row["estado"] == "INACTIVO" and not row["activo_administrativamente"]
    with db_cursor() as cursor:
        cursor.execute("SELECT COUNT(*) AS total FROM mediciones WHERE dispositivo_id = %s", (node,))
        assert cursor.fetchone()["total"] == 2


def test_rf15_sse_solo_publica_cambios_y_recupera_mysql(monkeypatch):
    states = iter([
        [{"estado": "ONLINE", "silencio_segundos": 0}],
        [{"estado": "ONLINE", "silencio_segundos": 1}],
        [{"estado": "OFFLINE", "silencio_segundos": 61}],
        None,
        [{"estado": "ONLINE", "silencio_segundos": 0}],
    ])

    def snapshot():
        result = next(states)
        if result is None:
            raise pymysql.OperationalError(2006, "Test DB temporarily unavailable")
        return result

    async def disconnect():
        return False

    async def scenario():
        with monkeypatch.context() as patch:
            patch.setattr("app.routers.mediciones.inventory_snapshot", snapshot)
            patch.setattr(get_settings(), "rf15_scan_seconds", 0)
            async with aclosing(_connectivity_events(SimpleNamespace(is_disconnected=disconnect))) as stream:
                assert '"ONLINE"' in await asyncio.wait_for(anext(stream), 2)
                assert '"OFFLINE"' in await asyncio.wait_for(anext(stream), 2)
                assert "conectividad_no_disponible" in await asyncio.wait_for(anext(stream), 2)
                assert '"ONLINE"' in await asyncio.wait_for(anext(stream), 2)

    asyncio.run(scenario())


def test_rf15_consulta_estado_requiere_autenticacion():
    client = TestClient(app)
    assert client.get("/api/mediciones/stream/temperatura?conectividad=true").status_code == 401
    assert client.get("/api/dispositivos").status_code == 401


def wait_for(predicate, timeout=5):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        if predicate():
            return
        time.sleep(0.05)
    assert predicate(), "No se recibió el estado esperado antes del límite."


def test_rf15_broker_autenticado_acl_y_reconexion(rf15_nodes, monkeypatch, tmp_path):
    exe = os.getenv("RF15_TEST_MOSQUITTO")
    if not exe:
        pytest.skip("RF15_TEST_MOSQUITTO debe apuntar al ejecutable de Mosquitto para esta integración.")

    _, (node, second, _) = rf15_nodes
    password = uuid.uuid4().hex
    passwd_tool = Path(exe).with_name("mosquitto_passwd" + Path(exe).suffix)
    password_file = tmp_path / "passwords"
    for index, user in enumerate(("backend", "node", "another-node")):
        flags = ["-c", "-b"] if index == 0 else ["-b"]
        result = subprocess.run([str(passwd_tool), *flags, str(password_file), user, password], capture_output=True)
        assert result.returncode == 0, result.stderr.decode(errors="replace")

    acl_file = tmp_path / "acl"
    acl_file.write_text(
        "user backend\ntopic read simoa/dispositivos/+/telemetria\ntopic read simoa/dispositivos/+/heartbeat\n"
        f"user node\ntopic write simoa/dispositivos/{node}/heartbeat\n"
        f"user another-node\ntopic write simoa/dispositivos/{second}/heartbeat\n",
        encoding="utf-8",
    )
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    config = tmp_path / "mosquitto.conf"
    config.write_text(
        f"listener {port} 127.0.0.1\nallow_anonymous false\n"
        f"password_file {password_file.as_posix()}\nacl_file {acl_file.as_posix()}\n",
        encoding="utf-8",
    )
    settings = get_settings()
    for attribute, value in {
        "mqtt_enabled": True, "mqtt_broker_host": "127.0.0.1", "mqtt_broker_port": port,
        "mqtt_username": "backend", "mqtt_password": password, "mqtt_tls_ca_file": "",
        "rf15_normal_seconds": 1, "rf15_max_silence_seconds": 2, "rf15_evidence_max_age_seconds": 1,
        "rf15_scan_seconds": 0.1,
    }.items():
        monkeypatch.setattr(settings, attribute, value)

    def listening():
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.1):
                return True
        except OSError:
            return False

    def start_broker():
        process = subprocess.Popen([exe, "-c", str(config)], stderr=subprocess.PIPE)
        try:
            wait_for(listening)
        except AssertionError:
            process.terminate()
            _, stderr = process.communicate(timeout=5)
            raise AssertionError(stderr.decode(errors="replace"))
        return process

    def publish(user, device, message):
        sender = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"client-{device}", protocol=mqtt.MQTTv5)
        sender.username_pw_set(user, password)
        outcomes = []
        sender.on_publish = lambda _client, _userdata, _mid, rc, _props: outcomes.append(rc)
        sender.connect("127.0.0.1", port)
        sender.loop_start()
        try:
            info = sender.publish(message.topic, message.payload, qos=1, retain=message.retain)
            info.wait_for_publish(timeout=3)
            wait_for(lambda: bool(outcomes), timeout=3)
            return outcomes[0]
        finally:
            sender.disconnect()
            sender.loop_stop()

    broker = start_broker()
    service = MqttIngestionService()
    monitor = connectivity.ConnectivityMonitor()
    try:
        service.start(wait_connect_seconds=3)
        wait_for(lambda: service.get_status()["subscribed"])
        assert publish("another-node", second, packet(node, connectivity.utc_now(), heartbeat=True)).is_failure
        assert inventory_row(node)["ultimo_ping"] is None
        assert not publish("node", node, packet(node, connectivity.utc_now(), heartbeat=True)).is_failure
        wait_for(lambda: inventory_row(node)["estado"] == "ONLINE")
        first_ping = inventory_row(node)["ultimo_ping"]

        monitor.start()
        broker.terminate()
        broker.wait(timeout=5)
        wait_for(lambda: not service.get_status()["connected"])
        wait_for(lambda: inventory_row(node)["estado"] == "OFFLINE")
        assert inventory_row(node)["ultimo_ping"] == first_ping

        broker = start_broker()
        wait_for(lambda: service.get_status()["subscribed"], timeout=10)
        assert not publish("node", node, packet(node, connectivity.utc_now(), heartbeat=True)).is_failure
        wait_for(lambda: inventory_row(node)["estado"] == "ONLINE")
        assert [entry["estado_nuevo"] for entry in audit(node)] == ["ONLINE", "ADVERTENCIA", "OFFLINE", "ONLINE"]
    finally:
        monitor.stop()
        service.stop()
        if broker.poll() is None:
            broker.terminate()
            broker.wait(timeout=5)
        if broker.stderr:
            broker.stderr.close()
