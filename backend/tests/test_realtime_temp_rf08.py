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
    compute_temperature_zscore,
    live_temperature_broadcaster,
)
from app.services.measurement_persistence import measurement_persister  # noqa: E402
from app.services.mqtt_ingest import mqtt_service  # noqa: E402


def _ensure_admin_and_login(client: TestClient) -> dict:
    email = "admin.rf08@simoa-ejemplo.org"
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
                ("Admin RF08", email, pwd_hash),
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
            "nombre": f"Recinto RF08 {suffix}",
            "codigo_area": f"RF08-{suffix}",
            "tipo": "Laboratorio",
            "descripcion": "Recinto prueba RF-08",
        },
    )
    assert loc_res.status_code == 201, loc_res.text
    loc_id = loc_res.json()["ubicacion"]["ubicacion_id"]

    b, c = int(suffix[:2], 16), int(suffix[2:], 16)
    dev_res = client.post(
        "/api/dispositivos",
        headers=headers,
        json={
            "nombre": f"Nodo RF08 {suffix}",
            "tipo": "ESP32",
            "firmware_version": "v2.4.1",
            "mac_address": f"DD:EE:{b:02X}:{c:02X}:30:01",
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
            "identificador": f"SEN-RF08-{suffix}",
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


def test_rf08_zscore_casos_borde():
    z_few, ok_few, _ = compute_temperature_zscore(22.0, [20.0, 21.0, 22.0])
    assert z_few is None and ok_few is False

    z_zero, ok_zero, msg_zero = compute_temperature_zscore(20.0, [20.0, 20.0, 20.0, 20.0, 20.0])
    assert z_zero is None and ok_zero is False and "cero" in msg_zero.lower()

    z_ok, ok_flag, _ = compute_temperature_zscore(25.0, [20.0, 21.0, 22.0, 23.0, 24.0])
    assert ok_flag is True and z_ok is not None and z_ok > 2.0


def test_rf08_realtime_mqtt_sse_evaluacion_ubicaciones_y_seguridad():
    with TestClient(app) as client:
        assert _wait_until(
            lambda: mqtt_service.get_status()["connected"] and mqtt_service.get_status()["subscribed"]
        )

        # Seguridad: sin token debe rechazar con 401
        assert client.get("/api/mediciones/ubicacion/ubi-lab-01/temperatura-actual").status_code == 401
        assert client.get("/api/mediciones/stream/temperatura?ubicacion_id=ubi-lab-01").status_code == 401

        headers = _ensure_admin_and_login(client)
        assert client.get("/api/mediciones/ubicacion/ubi-no-existe/temperatura-actual", headers=headers).status_code == 404

        uid1 = uuid.uuid4().hex[:4].upper()
        uid2 = uuid.uuid4().hex[:4].upper()
        loc1, dev1, code1, sen1 = _create_loc_dev_sensor(client, headers, uid1)
        loc2, dev2, code2, sen2 = _create_loc_dev_sensor(client, headers, uid2)
        mqtt_service.invalidate_cache()

        # Sin lecturas recientes -> ESPERANDO_DATOS y temperatura_actual=None (-- °C)
        empty_snap = client.get(f"/api/mediciones/ubicacion/{loc1}/temperatura-actual", headers=headers).json()
        assert empty_snap["temperatura_actual"] is None
        assert empty_snap["estado_termico"] == "ESPERANDO_DATOS"
        assert empty_snap["temp_min"] == 18.0 and empty_snap["temp_max"] == 25.0

        # Suscriptor en vivo simulando SSE queue sobre sen1 con event loop activo
        loop = asyncio.new_event_loop()
        loop_thread = threading.Thread(target=loop.run_forever, daemon=True)
        loop_thread.start()
        q = live_temperature_broadcaster.subscribe(sen1, loop)
        try:
            pub = mqtt.Client(
                callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
                client_id=f"simoa-rf08-pub-{uuid.uuid4().hex[:6]}",
            )
            pub.connect("127.0.0.1", 1883, keepalive=30)
            pub.loop_start()
            try:
                now_ts = int(time.time()) - 12
                # Publicar lectura NOMINAL real por MQTT para loc1
                pub.publish(
                    f"simoa/dispositivos/{code1}/telemetria",
                    json.dumps({"codigo": code1, "temperatura": 21.5, "humedad": 55.0, "timestamp": now_ts}),
                    qos=1,
                ).wait_for_publish()
                assert _wait_until(lambda: not q.empty(), timeout=6.0)
                pushed_1 = q.get_nowait()
                assert pushed_1["ubicacion_id"] == loc1
                assert pushed_1["sensor_id"] == sen1
                assert pushed_1["temperatura_actual"] == 21.5
                assert pushed_1["estado_termico"] == "NOMINAL"

                # Publicar lectura FUERA DE RANGO (> 25.0) para loc1 y verificar cambio inmediato
                pub.publish(
                    f"simoa/dispositivos/{code1}/telemetria",
                    json.dumps({"codigo": code1, "temperatura": 26.8, "humedad": 55.0, "timestamp": now_ts + 1}),
                    qos=1,
                ).wait_for_publish()
                assert _wait_until(lambda: not q.empty(), timeout=6.0)
                pushed_2 = q.get_nowait()
                assert pushed_2["temperatura_actual"] == 26.8
                assert pushed_2["estado_termico"] == "FUERA DE RANGO"

                # Publicar lectura en loc2 (17.2 < 18.0 -> FUERA DE RANGO) y verificar aislamiento entre ubicaciones
                pub.publish(
                    f"simoa/dispositivos/{code2}/telemetria",
                    json.dumps({"codigo": code2, "temperatura": 17.2, "humedad": 52.0, "timestamp": now_ts + 2}),
                    qos=1,
                ).wait_for_publish()
                assert _wait_until(
                    lambda: client.get(f"/api/mediciones/ubicacion/{loc2}/temperatura-actual", headers=headers).json()["temperatura_actual"] == 17.2,
                    timeout=6.0,
                )
                snap_loc1 = client.get(f"/api/mediciones/ubicacion/{loc1}/temperatura-actual", headers=headers).json()
                snap_loc2 = client.get(f"/api/mediciones/ubicacion/{loc2}/temperatura-actual", headers=headers).json()
                assert snap_loc1["sensor_id"] == sen1 and snap_loc1["temperatura_actual"] == 26.8
                assert snap_loc2["sensor_id"] == sen2 and snap_loc2["temperatura_actual"] == 17.2
                assert snap_loc2["estado_termico"] == "FUERA DE RANGO"
            finally:
                pub.loop_stop()
                pub.disconnect()
        finally:
            live_temperature_broadcaster.unsubscribe(sen1, loop, q)
            loop.call_soon_threadsafe(loop.stop)
            loop_thread.join(timeout=2.0)
            loop.close()

        # Comportamiento exacto en límites (18.0 y 25.0 -> NOMINAL) + Z-Score disponible tras >= 5 muestras
        base_dt = datetime.now(timezone.utc) - timedelta(seconds=6)
        for idx, temp_val in enumerate([20.0, 21.0, 22.0, 18.0, 25.0]):
            measurement_persister.persist_event(
                {
                    "dispositivo_id": dev1,
                    "sensor_id": sen1,
                    "ubicacion_id": loc1,
                    "magnitudes": {"temperatura": temp_val, "humedad": 50.0},
                    "captured_at": base_dt + timedelta(seconds=idx + 1),
                }
            )
        snap_limit = client.get(f"/api/mediciones/ubicacion/{loc1}/temperatura-actual", headers=headers).json()
        assert snap_limit["temperatura_actual"] == 25.0
        assert snap_limit["estado_termico"] == "NOMINAL"
        assert snap_limit["z_score_disponible"] is True
        assert snap_limit["z_score"] is not None

        # Sensor sin configuración de límites -> SIN_CONFIGURACION
        with db_cursor() as cursor:
            cursor.execute("DELETE FROM umbrales_alerta WHERE sensor_id = %s", (sen1,))
        snap_nocfg = client.get(f"/api/mediciones/ubicacion/{loc1}/temperatura-actual", headers=headers).json()
        assert snap_nocfg["estado_termico"] == "SIN_CONFIGURACION"

        # Sensor en FALLA -> ESPERANDO_DATOS y temperatura_actual=None (-- °C)
        assert client.patch(f"/api/sensores/{sen1}/estado", headers=headers, json={"estado": "FALLA"}).status_code == 200
        snap_falla = client.get(f"/api/mediciones/ubicacion/{loc1}/temperatura-actual", headers=headers).json()
        assert snap_falla["temperatura_actual"] is None
        assert snap_falla["estado_termico"] == "ESPERANDO_DATOS"
