import asyncio
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import sys
import threading
import time
import uuid

from fastapi.testclient import TestClient
import paho.mqtt.client as mqtt
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
from app.services.live_telemetry import (  # noqa: E402
    compute_variable_zscore,
    live_temperature_broadcaster,
)
from app.services.measurement_persistence import measurement_persister  # noqa: E402
from app.services.mqtt_ingest import mqtt_service  # noqa: E402


def _ensure_admin_and_login(client: TestClient) -> dict:
    email = "admin.rf09@simoa-ejemplo.org"
    pwd = "AdminPass123!"
    pwd_hash = hash_password(pwd)
    with db_cursor() as cursor:
        cursor.execute("SELECT id_usuario FROM usuarios WHERE correo = %s LIMIT 1", (email,))
        if cursor.fetchone() is None:
            cursor.execute(
                """
                INSERT INTO usuarios (nombre, correo, password_hash, rol, estado)
                VALUES (%s, %s, %s, 'Administrador', 'activo')
                """,
                ("Admin RF09", email, pwd_hash),
            )
        else:
            cursor.execute(
                "UPDATE usuarios SET password_hash = %s, rol = 'Administrador', estado = 'activo' WHERE correo = %s",
                (pwd_hash, email),
            )
    res = client.post("/api/auth/login", json={"correo": email, "password": pwd})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def _create_loc_dev_sensor(client: TestClient, headers: dict, suffix: str):
    loc_res = client.post(
        "/api/ubicaciones",
        headers=headers,
        json={
            "nombre": f"Recinto RF09 {suffix}",
            "codigo_area": f"RF09-{suffix}",
            "tipo": "Bioterio",
            "descripcion": "Recinto prueba RF-09",
        },
    )
    assert loc_res.status_code == 201, loc_res.text
    loc_id = loc_res.json()["ubicacion"]["ubicacion_id"]

    raw_mac = uuid.uuid4().bytes[:6]
    mac = ":".join(f"{b:02X}" for b in raw_mac)
    dev_res = client.post(
        "/api/dispositivos",
        headers=headers,
        json={
            "nombre": f"Nodo RF09 {suffix}",
            "tipo": "ESP32",
            "firmware_version": "v2.4.1",
            "mac_address": mac,
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
            "identificador": f"SEN-RF09-{suffix}",
            "modelo": "DHT22",
            "variables": ["temperatura", "humedad"],
            "fecha_instalacion": "2026-02-01",
            "ultima_calibracion": "2026-02-05",
            "estado": "ACTIVO",
        },
    )
    assert sen_res.status_code == 201, sen_res.text
    sen_id = sen_res.json()["sensor"]["id_sensor"]
    return loc_id, dev["id_dispositivo"], dev["codigo"], sen_id


def _wait_until(predicate, timeout: float = 6.0, interval: float = 0.05) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return False


def test_rf09_zscore_higrometrico_y_validacion_fisica_rf07():
    z_few, ok_few, _ = compute_variable_zscore(55.0, [50.0, 52.0, 54.0])
    assert z_few is None and ok_few is False

    z_zero, ok_zero, msg_zero = compute_variable_zscore(55.0, [55.0, 55.0, 55.0, 55.0, 55.0])
    assert z_zero is None and ok_zero is False and "cero" in msg_zero.lower()

    z_ok, ok_flag, _ = compute_variable_zscore(65.0, [45.0, 48.0, 50.0, 52.0, 55.0])
    assert ok_flag is True and z_ok is not None and z_ok > 2.0

    with pytest.raises(ValueError):
        measurement_persister.persist_event(
            {
                "dispositivo_id": "dev-x",
                "sensor_id": "sen-x",
                "magnitudes": {"humedad": -1.0},
                "captured_at": datetime.now(timezone.utc),
            }
        )
    with pytest.raises(ValueError):
        measurement_persister.persist_event(
            {
                "dispositivo_id": "dev-x",
                "sensor_id": "sen-x",
                "magnitudes": {"humedad": 101.5},
                "captured_at": datetime.now(timezone.utc),
            }
        )


def test_rf09_realtime_humedad_sincronizada_rf08_validaciones_y_seguridad():
    with TestClient(app) as client:
        assert _wait_until(
            lambda: mqtt_service.get_status()["connected"] and mqtt_service.get_status()["subscribed"]
        )

        # Seguridad: sin token debe rechazar con 401
        assert client.get("/api/mediciones/ubicacion/ubi-lab-01/humedad-actual").status_code == 401

        headers = _ensure_admin_and_login(client)
        assert client.get("/api/mediciones/ubicacion/ubi-no-existe/humedad-actual", headers=headers).status_code == 404

        uid1 = uuid.uuid4().hex[:4].upper()
        uid2 = uuid.uuid4().hex[:4].upper()
        loc1, dev1, code1, sen1 = _create_loc_dev_sensor(client, headers, uid1)
        loc2, dev2, code2, sen2 = _create_loc_dev_sensor(client, headers, uid2)
        mqtt_service.invalidate_cache()

        # Sin lecturas recientes -> ESPERANDO_DATOS y humedad_actual=None (-- %RH)
        empty_snap = client.get(f"/api/mediciones/ubicacion/{loc1}/humedad-actual", headers=headers).json()
        assert empty_snap["humedad_actual"] is None
        assert empty_snap["unidad"] == "%RH"
        assert empty_snap["estado_humedad"] == "ESPERANDO_DATOS"
        assert empty_snap["hum_min"] == 40.0 and empty_snap["hum_max"] == 70.0

        loop = asyncio.new_event_loop()
        loop_thread = threading.Thread(target=loop.run_forever, daemon=True)
        loop_thread.start()
        q = live_temperature_broadcaster.subscribe_queue({sen1}, loop)
        try:
            pub = mqtt.Client(
                callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
                client_id=f"simoa-rf09-pub-{uuid.uuid4().hex[:6]}",
            )
            pub.connect("127.0.0.1", 1883, keepalive=30)
            pub.loop_start()
            try:
                now_ts = int(time.time()) - 12
                # Publicar lectura combinada (temperatura + humedad NOMINAL) -> actualiza RF-08 y RF-09
                pub.publish(
                    f"simoa/dispositivos/{code1}/telemetria",
                    json.dumps({"codigo": code1, "temperatura": 22.0, "humedad": 55.4, "timestamp": now_ts}),
                    qos=1,
                ).wait_for_publish()
                assert _wait_until(lambda: not q.empty(), timeout=6.0)
                pushed_1 = q.get_nowait()
                assert pushed_1["temperatura_actual"] == 22.0
                assert pushed_1["humedad_snapshot"]["humedad_actual"] == 55.4
                assert pushed_1["humedad_snapshot"]["estado_humedad"] == "NOMINAL"
                assert pushed_1["humedad_snapshot"]["unidad"] == "%RH"

                # Publicar humedad FUERA DE RANGO por encima (> 70.0)
                pub.publish(
                    f"simoa/dispositivos/{code1}/telemetria",
                    json.dumps({"codigo": code1, "temperatura": 22.1, "humedad": 78.5, "timestamp": now_ts + 1}),
                    qos=1,
                ).wait_for_publish()
                assert _wait_until(lambda: not q.empty(), timeout=6.0)
                pushed_high = q.get_nowait()
                assert pushed_high["humedad_snapshot"]["humedad_actual"] == 78.5
                assert pushed_high["humedad_snapshot"]["estado_humedad"] == "FUERA DE RANGO"

                # Publicar humedad físicamente inválida (-5 y 108) -> rechazada en RF-06, NO modifica tarjeta ni genera medición
                pub.publish(
                    f"simoa/dispositivos/{code1}/telemetria",
                    json.dumps({"codigo": code1, "temperatura": 22.2, "humedad": -5.0, "timestamp": now_ts + 2}),
                    qos=1,
                ).wait_for_publish()
                pub.publish(
                    f"simoa/dispositivos/{code1}/telemetria",
                    json.dumps({"codigo": code1, "temperatura": 22.3, "humedad": 108.0, "timestamp": now_ts + 3}),
                    qos=1,
                ).wait_for_publish()
                assert _wait_until(
                    lambda: any(
                        r["motivo"] == "LECTURA_FISICA_INVALIDA" and r["codigo_dispositivo"] == code1
                        for r in client.get("/api/mqtt/rechazos?limit=20", headers=headers).json()["items"]
                    ),
                    timeout=5.0,
                )
                after_corrupt = client.get(f"/api/mediciones/ubicacion/{loc1}/humedad-actual", headers=headers).json()
                assert after_corrupt["humedad_actual"] == 78.5

                # Publicar en loc2 (32.0 < 40.0 -> FUERA DE RANGO) y verificar aislamiento entre ubicaciones
                pub.publish(
                    f"simoa/dispositivos/{code2}/telemetria",
                    json.dumps({"codigo": code2, "temperatura": 21.0, "humedad": 32.0, "timestamp": now_ts + 4}),
                    qos=1,
                ).wait_for_publish()
                assert _wait_until(
                    lambda: client.get(f"/api/mediciones/ubicacion/{loc2}/humedad-actual", headers=headers).json()["humedad_actual"] == 32.0,
                    timeout=6.0,
                )
                assert client.get(f"/api/mediciones/ubicacion/{loc1}/humedad-actual", headers=headers).json()["humedad_actual"] == 78.5
            finally:
                pub.loop_stop()
                pub.disconnect()
        finally:
            live_temperature_broadcaster.unsubscribe_queue({sen1}, loop, q)
            loop.call_soon_threadsafe(loop.stop)
            loop_thread.join(timeout=2.0)
            loop.close()

        # Límites exactos (40.0 y 70.0 -> NOMINAL) + Z-Score disponible
        base_dt = datetime.now(timezone.utc) - timedelta(seconds=6)
        for idx, hum_val in enumerate([50.0, 52.0, 54.0, 40.0, 70.0]):
            measurement_persister.persist_event(
                {
                    "dispositivo_id": dev1,
                    "sensor_id": sen1,
                    "ubicacion_id": loc1,
                    "magnitudes": {"temperatura": 22.0, "humedad": hum_val},
                    "captured_at": base_dt + timedelta(seconds=idx + 1),
                }
            )
        snap_limit = client.get(f"/api/mediciones/ubicacion/{loc1}/humedad-actual", headers=headers).json()
        assert snap_limit["humedad_actual"] == 70.0
        assert snap_limit["estado_humedad"] == "NOMINAL"
        assert snap_limit["z_score_disponible"] is True
        assert snap_limit["z_score"] is not None

        # Sin límites configurados -> SIN_CONFIGURACION
        with db_cursor() as cursor:
            cursor.execute("DELETE FROM umbrales_alerta WHERE sensor_id = %s", (sen1,))
        snap_nocfg = client.get(f"/api/mediciones/ubicacion/{loc1}/humedad-actual", headers=headers).json()
        assert snap_nocfg["estado_humedad"] == "SIN_CONFIGURACION"

        # Sensor desconectado (INACTIVO) -> ESPERANDO_DATOS y -- %RH (None)
        assert client.patch(f"/api/sensores/{sen1}/estado", headers=headers, json={"estado": "INACTIVO"}).status_code == 200
        snap_inact = client.get(f"/api/mediciones/ubicacion/{loc1}/humedad-actual", headers=headers).json()
        assert snap_inact["humedad_actual"] is None
        assert snap_inact["estado_humedad"] == "ESPERANDO_DATOS"
