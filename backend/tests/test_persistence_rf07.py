from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import uuid

from fastapi.testclient import TestClient
import paho.mqtt.client as mqtt
import pymysql
import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DB_HOST", "127.0.0.1")
os.environ.setdefault("DB_PORT", "3306")
os.environ.setdefault("DB_USER", "root")
os.environ.setdefault("DB_PASSWORD", "")
os.environ.setdefault("DB_NAME", "simoa")
os.environ.setdefault("MQTT_ENABLED", "true")
os.environ.setdefault("MQTT_BROKER_HOST", "127.0.0.1")
os.environ.setdefault("MQTT_BROKER_PORT", "1883")

from app.database import db_cursor  # noqa: E402
from app.main import app  # noqa: E402
from app.security import hash_password  # noqa: E402
from app.services.measurement_persistence import (  # noqa: E402
    MeasurementPersistenceService,
    measurement_persister,
)
from app.services.mqtt_ingest import NormalizedTelemetryEvent, mqtt_service  # noqa: E402


def _ensure_admin_and_login(client: TestClient) -> dict:
    email = "admin.rf07@simoa-ejemplo.org"
    pwd = "AdminPass123!"
    pwd_hash = hash_password(pwd)
    with db_cursor() as cursor:
        cursor.execute("SELECT id_usuario FROM usuarios WHERE correo = %s LIMIT 1", (email,))
        if cursor.fetchone() is None:
            cursor.execute(
                """
                INSERT INTO usuarios (id_usuario, nombre, correo, password_hash, rol, estado)
                VALUES (%s, %s, %s, %s, 'Administrador', 'activo')
                """,
                (f"usr-{uuid.uuid4().hex[:8]}", "Admin RF07", email, pwd_hash),
            )
        else:
            cursor.execute(
                "UPDATE usuarios SET password_hash = %s, rol = 'Administrador', estado = 'activo' WHERE correo = %s",
                (pwd_hash, email),
            )
    res = client.post("/api/auth/login", json={"correo": email, "password": pwd})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def _create_device_and_sensor(client: TestClient, headers: dict):
    loc_res = client.get("/api/ubicaciones", headers=headers)
    assert loc_res.status_code == 200
    loc_id = next(l for l in loc_res.json()["items"] if l["estado"] == "ACTIVA")["ubicacion_id"]

    uid = uuid.uuid4().hex[:4].upper()
    b, c = int(uid[:2], 16), int(uid[2:], 16)
    dev_res = client.post(
        "/api/dispositivos",
        headers=headers,
        json={
            "nombre": f"Nodo RF07 {uid}",
            "tipo": "ESP32",
            "firmware_version": "v2.4.1",
            "mac_address": f"CC:DD:{b:02X}:{c:02X}:20:01",
            "ubicacion_id": loc_id,
        },
    )
    assert dev_res.status_code == 201, dev_res.text
    dev = dev_res.json()["dispositivo"]

    sen_res = client.post(
        "/api/sensores",
        headers=headers,
        json={
            "dispositivo_id": dev["id_dispositivo"],
            "identificador": f"SEN-RF07-{uid}",
            "modelo": "DHT22",
            "variables": ["temperatura", "humedad"],
            "fecha_instalacion": "2026-02-01",
            "ultima_calibracion": "2026-02-05",
            "estado": "ACTIVO",
        },
    )
    assert sen_res.status_code == 201, sen_res.text
    sen = sen_res.json()["sensor"]
    return dev["id_dispositivo"], dev["codigo"], sen["id_sensor"], loc_id


def _wait_until(predicate, timeout: float = 6.0, interval: float = 0.05) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return False


def test_rf07_flujo_mqtt_persistencia_utc_umbrales_ia_inmutabilidad_indice_y_rendimiento():
    live_events: list[NormalizedTelemetryEvent] = []
    # Verificar que cuando se dispara _rf13_handlers (suscriptor en vivo), el registro YA existe en MySQL
    persisted_before_live: list[bool] = []

    def _live_subscriber(ev: NormalizedTelemetryEvent) -> None:
        live_events.append(ev)
        with db_cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) AS c FROM mediciones WHERE sensor_id = %s",
                (ev.sensor_id,),
            )
            persisted_before_live.append(int(cursor.fetchone()["c"]) >= 1)

    mqtt_service.register_rf13_handler(_live_subscriber)

    with TestClient(app) as client:
        assert _wait_until(
            lambda: mqtt_service.get_status()["connected"] and mqtt_service.get_status()["subscribed"]
        )
        headers = _ensure_admin_and_login(client)
        dev_id, code, sen_id, loc_id = _create_device_and_sensor(client, headers)
        mqtt_service.invalidate_cache()

        # 1. Flujo real MQTT (RF-06) -> RF-07 -> MySQL -> suscriptor en vivo
        pub = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=f"simoa-rf07-pub-{uuid.uuid4().hex[:6]}",
        )
        pub.connect("127.0.0.1", 1883, keepalive=30)
        pub.loop_start()
        try:
            ts_utc = int(datetime(2026, 11, 20, 12, 30, 0, tzinfo=timezone.utc).timestamp())
            pub.publish(
                f"simoa/dispositivos/{code}/telemetria",
                json.dumps({"codigo": code, "temperatura": 23.4, "humedad": 58.1, "timestamp": ts_utc}),
                qos=1,
            ).wait_for_publish()

            assert _wait_until(
                lambda: any(e.sensor_id == sen_id for e in live_events),
                timeout=6.0,
            )
            assert all(persisted_before_live), "El suscriptor en vivo recibió evento antes del COMMIT en MySQL"
        finally:
            pub.loop_stop()
            pub.disconnect()

        # 2. Verificar registro persistido, UTC, umbrales reales, score_anomalia_ia=None y consulta API
        list_res = client.get(f"/api/mediciones?sensor_id={sen_id}", headers=headers)
        assert list_res.status_code == 200, list_res.text
        body = list_res.json()
        assert body["zona_horaria"] == "UTC"
        assert body["total"] == 1
        m = body["items"][0]
        assert m["sensor_id"] == sen_id
        assert m["dispositivo_id"] == dev_id
        assert m["temperatura"] == 23.4
        assert m["humedad"] == 58.1
        assert m["fecha_hora_utc"] == "2026-11-20T12:30:00Z"
        assert m["es_fuera_de_umbral"] is False  # Dentro de límites predeterminados (18-25°C, 40-70%RH)
        assert m["score_anomalia_ia"] is None  # RF-18 pendiente: nunca inventar score IA

        # Consulta individual por ID
        detail_res = client.get(f"/api/mediciones/{m['id_medicion']}", headers=headers)
        assert detail_res.status_code == 200
        assert detail_res.json()["medicion"]["id_medicion"] == m["id_medicion"]

        # 3. Sensor sin umbrales configurados -> es_fuera_de_umbral debe ser NULL (sin inventar normal)
        with db_cursor() as cursor:
            cursor.execute("DELETE FROM umbrales_alerta WHERE sensor_id = %s", (sen_id,))
        ok_no_lim, id_no_lim, is_dup_no_lim = measurement_persister.persist_event(
            {
                "dispositivo_id": dev_id,
                "sensor_id": sen_id,
                "ubicacion_id": loc_id,
                "magnitudes": {"temperatura": 24.0, "humedad": 60.0},
                "captured_at": "2026-11-20T12:31:00Z",
            }
        )
        assert ok_no_lim is True and id_no_lim is not None and is_dup_no_lim is False
        no_lim_row = client.get(f"/api/mediciones/{id_no_lim}", headers=headers).json()["medicion"]
        assert no_lim_row["es_fuera_de_umbral"] is None

        # 4. Idempotencia ante reintentos (misma medición no duplica; distinta fecha sí inserta)
        ok_dup, id_dup, is_dup = measurement_persister.persist_event(
            {
                "dispositivo_id": dev_id,
                "sensor_id": sen_id,
                "ubicacion_id": loc_id,
                "magnitudes": {"temperatura": 24.0, "humedad": 60.0},
                "captured_at": "2026-11-20T12:31:00Z",
            }
        )
        assert ok_dup is True and is_dup is True and id_dup == id_no_lim
        assert client.get(f"/api/mediciones?sensor_id={sen_id}", headers=headers).json()["total"] == 2

        # 5. Integridad de claves y rollback (sensor inexistente rechazado)
        with pytest.raises(pymysql.err.IntegrityError):
            measurement_persister.persist_event(
                {
                    "dispositivo_id": dev_id,
                    "sensor_id": "sen-inexistente-999",
                    "ubicacion_id": loc_id,
                    "magnitudes": {"temperatura": 22.0},
                    "captured_at": "2026-11-20T12:32:00Z",
                }
            )

        # 6. Inmutabilidad RN-09 (sin PUT/PATCH/DELETE en API + trigger en MySQL)
        assert client.put(f"/api/mediciones/{id_no_lim}", headers=headers, json={"temperatura": 99.0}).status_code == 405
        assert client.patch(f"/api/mediciones/{id_no_lim}", headers=headers, json={"temperatura": 99.0}).status_code == 405
        assert client.delete(f"/api/mediciones/{id_no_lim}", headers=headers).status_code == 405

        with pytest.raises(pymysql.err.OperationalError):
            with db_cursor() as cursor:
                cursor.execute("UPDATE mediciones SET temperatura = 99.9 WHERE id_medicion = %s", (id_no_lim,))

        # 7. Verificar uso de índice compuesto (sensor_id, fecha_hora)
        with db_cursor() as cursor:
            cursor.execute(
                "EXPLAIN SELECT id_medicion FROM mediciones WHERE sensor_id = %s AND fecha_hora >= %s",
                (sen_id, datetime(2026, 11, 20, 12, 0, 0)),
            )
            explain_rows = cursor.fetchall()
        possible_keys = " ".join(str(r.get("possible_keys") or "") for r in explain_rows)
        assert "idx_mediciones_sensor_fecha" in possible_keys

        # 8. Prueba real de rendimiento (< 50 ms por inserción unitaria)
        perf_base = datetime.now(timezone.utc) - timedelta(seconds=30)
        for i in range(25):
            ok_p, _id_p, dup_p = measurement_persister.persist_event(
                {
                    "dispositivo_id": dev_id,
                    "sensor_id": sen_id,
                    "ubicacion_id": loc_id,
                    "magnitudes": {"temperatura": 20.0 + i * 0.05, "humedad": 50.0},
                    "captured_at": perf_base + timedelta(seconds=i),
                }
            )
            assert ok_p is True and dup_p is False

        rf07_status = client.get("/api/mediciones/rf07/status", headers=headers).json()
        metrics = rf07_status["metrics"]
        print(
            f"\n[RF-07 PERF] avg={metrics['avg_insert_ms']}ms, "
            f"p95={metrics['p95_insert_ms']}ms, max={metrics['max_insert_ms']}ms, "
            f"samples={metrics['samples_measured']}"
        )
        assert metrics["avg_insert_ms"] < 50.0
        assert metrics["p95_insert_ms"] < 50.0


def test_rf07_recuperacion_caida_mysql_backoff_y_reinicio(monkeypatch):
    with TestClient(app) as client:
        headers = _ensure_admin_and_login(client)
        dev_id, _code, sen_id, loc_id = _create_device_and_sensor(client, headers)

    with tempfile.TemporaryDirectory() as tmpdir:
        buf_path = Path(tmpdir) / "rf07_test_buffer.sqlite3"
        monkeypatch.setenv("RF07_BUFFER_PATH", str(buf_path))
        monkeypatch.setenv("RF07_BACKOFF_BASE_SECONDS", "0.1")
        monkeypatch.setenv("RF07_BACKOFF_MAX_SECONDS", "0.4")
        monkeypatch.setenv("RF07_MAX_INLINE_RETRIES", "1")

        persister_before_restart = MeasurementPersistenceService()

        def _simulate_mysql_down(_rec):
            raise pymysql.err.OperationalError(2003, "Can't connect to MySQL server (simulated outage)")

        monkeypatch.setattr(persister_before_restart, "_insert_atomic_mysql", _simulate_mysql_down)

        ts_pending = datetime(2026, 11, 20, 14, 15, 0, tzinfo=timezone.utc)
        ok, med_id, _dup = persister_before_restart.persist_event(
            {
                "dispositivo_id": dev_id,
                "sensor_id": sen_id,
                "ubicacion_id": loc_id,
                "magnitudes": {"temperatura": 22.7, "humedad": 51.3},
                "captured_at": ts_pending,
            }
        )
        assert ok is False and med_id is None
        assert persister_before_restart.get_status()["pending_buffer_count"] == 1
        assert persister_before_restart.get_status()["metrics"]["retry_attempts_count"] >= 2

        # Simular reinicio del proceso creando una nueva instancia apuntando al mismo buffer SQLite WAL
        persister_after_restart = MeasurementPersistenceService()
        assert persister_after_restart.get_status()["pending_buffer_count"] == 1
        persister_after_restart.start()
        try:
            assert _wait_until(
                lambda: persister_after_restart.get_status()["pending_buffer_count"] == 0,
                timeout=5.0,
            )
            assert persister_after_restart.get_status()["metrics"]["recovered_count"] == 1
        finally:
            persister_after_restart.stop()

        with db_cursor() as cursor:
            cursor.execute(
                "SELECT temperatura, humedad, fecha_hora FROM mediciones WHERE sensor_id = %s AND fecha_hora = %s",
                (sen_id, ts_pending.replace(tzinfo=None)),
            )
            row = cursor.fetchone()
        assert row is not None
        assert float(row["temperatura"]) == 22.7
        assert float(row["humedad"]) == 51.3
