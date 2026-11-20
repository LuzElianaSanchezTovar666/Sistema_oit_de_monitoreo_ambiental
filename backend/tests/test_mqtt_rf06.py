import json
import os
from pathlib import Path
import queue
import sys
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
from app.services.mqtt_ingest import NormalizedTelemetryEvent, mqtt_service  # noqa: E402


def _ensure_admin_and_login(client: TestClient) -> dict:
    email = "admin.rf06@simoa-ejemplo.org"
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
                (f"usr-{uuid.uuid4().hex[:8]}", "Admin RF06", email, pwd_hash),
            )
        else:
            cursor.execute(
                "UPDATE usuarios SET password_hash = %s, rol = 'Administrador', estado = 'activo' WHERE correo = %s",
                (pwd_hash, email),
            )
    res = client.post("/api/auth/login", json={"correo": email, "password": pwd})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def _create_device(client: TestClient, headers: dict, nombre: str, mac: str, loc_id: str) -> tuple[str, str]:
    res = client.post(
        "/api/dispositivos",
        headers=headers,
        json={
            "nombre": f"Nodo {nombre}",
            "tipo": "ESP32",
            "firmware_version": "v2.4.1",
            "mac_address": mac,
            "ubicacion_id": loc_id,
        },
    )
    assert res.status_code == 201, res.text
    disp = res.json()["dispositivo"]
    return disp["id_dispositivo"], disp["codigo"]


def _create_sensor(client: TestClient, headers: dict, dev_id: str, ident: str, modelo: str, variables: list) -> str:
    res = client.post(
        "/api/sensores",
        headers=headers,
        json={
            "dispositivo_id": dev_id,
            "identificador": ident,
            "modelo": modelo,
            "variables": variables,
            "fecha_instalacion": "2026-02-01",
            "ultima_calibracion": "2026-02-05",
            "estado": "ACTIVO",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["sensor"]["id_sensor"]


def _wait_until(predicate, timeout: float = 5.0, interval: float = 0.05) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return False


def _make_publisher() -> mqtt.Client:
    pub = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id=f"simoa-test-pub-{uuid.uuid4().hex[:6]}",
    )
    pub.connect("127.0.0.1", 1883, keepalive=30)
    pub.loop_start()
    return pub


def test_rf06_real_mosquitto_lifecycle_validaciones_enrutamiento_y_rendimiento():
    routed_rf07: list[NormalizedTelemetryEvent] = []
    routed_rf13: list[NormalizedTelemetryEvent] = []
    mqtt_service.register_rf07_handler(lambda ev: routed_rf07.append(ev))
    mqtt_service.register_rf13_handler(lambda ev: routed_rf13.append(ev))

    with TestClient(app) as client:
        assert _wait_until(
            lambda: mqtt_service.get_status()["connected"] and mqtt_service.get_status()["subscribed"],
            timeout=6.0,
        ), f"MQTT no conectó/suscribió a tiempo: {mqtt_service.get_status()}"

        headers = _ensure_admin_and_login(client)
        loc_res = client.get("/api/ubicaciones", headers=headers)
        assert loc_res.status_code == 200
        active_loc = next(l for l in loc_res.json()["items"] if l["estado"] == "ACTIVA")["ubicacion_id"]

        uid = uuid.uuid4().hex[:4].upper()
        b = int(uid[:2], 16)
        c = int(uid[2:], 16)

        dev1, code1 = _create_device(client, headers, f"RF06-{uid}-1", f"AA:BB:{b:02X}:{c:02X}:10:01", active_loc)
        dev2, code2 = _create_device(client, headers, f"RF06-{uid}-2", f"AA:BB:{b:02X}:{c:02X}:10:02", active_loc)
        dev_inact, code_inact = _create_device(client, headers, f"RF06-{uid}-3", f"AA:BB:{b:02X}:{c:02X}:10:03", active_loc)
        _dev_nosensor, code_nosensor = _create_device(client, headers, f"RF06-{uid}-4", f"AA:BB:{b:02X}:{c:02X}:10:04", active_loc)

        sen1 = _create_sensor(client, headers, dev1, f"SEN-RF06-{uid}-1", "DHT22", ["temperatura", "humedad"])
        sen2 = _create_sensor(client, headers, dev2, f"SEN-RF06-{uid}-2", "BME280", ["temperatura", "humedad", "presion"])
        _sen_inact = _create_sensor(client, headers, dev_inact, f"SEN-RF06-{uid}-3", "SHT31", ["temperatura", "humedad"])

        # Desactivar dev_inact
        res_inact = client.patch(f"/api/dispositivos/{dev_inact}/desactivar", headers=headers)
        assert res_inact.status_code == 200

        mqtt_service.invalidate_cache()
        pub = _make_publisher()

        try:
            # 1 & 2. Mensajes válidos simultáneos de múltiples dispositivos (DHT22 y BME280 extensible)
            base_routed = len(routed_rf07)
            now_ts = int(time.time())
            pub.publish(
                f"simoa/dispositivos/{code1}/telemetria",
                json.dumps({"codigo": code1, "temperatura": 24.5, "humedad": 65.2, "timestamp": now_ts}),
                qos=1,
            ).wait_for_publish()
            pub.publish(
                f"simoa/dispositivos/{code2}/telemetria",
                json.dumps({"codigo": code2, "temperatura": 21.8, "humedad": 54.0, "presion": 1012.4, "timestamp": now_ts}),
                qos=1,
            ).wait_for_publish()

            assert _wait_until(lambda: len(routed_rf07) >= base_routed + 2, timeout=5.0)
            assert len(routed_rf13) >= base_routed + 2
            ev_bme = next(e for e in routed_rf07[base_routed:] if e.codigo == code2)
            assert ev_bme.magnitudes["presion"] == 1012.4
            assert ev_bme.unidades["presion"] == "hPa"

            # 3. Rechazos obligatorios (JSON malformado, código inconsistente, dispositivo desconocido, inactivo, sin sensor, NaN/Inf, timestamp inválido, cruce sensor)
            pub.publish(f"simoa/dispositivos/{code1}/telemetria", "{json_malformado", qos=1).wait_for_publish()
            pub.publish(
                f"simoa/dispositivos/{code1}/telemetria",
                json.dumps({"codigo": code2, "temperatura": 24.0, "humedad": 50.0, "timestamp": now_ts}),
                qos=1,
            ).wait_for_publish()
            pub.publish(
                f"simoa/dispositivos/DESCONOCIDO-{uid}/telemetria",
                json.dumps({"codigo": f"DESCONOCIDO-{uid}", "temperatura": 24.0, "humedad": 50.0, "timestamp": now_ts}),
                qos=1,
            ).wait_for_publish()
            pub.publish(
                f"simoa/dispositivos/{code_inact}/telemetria",
                json.dumps({"codigo": code_inact, "temperatura": 24.0, "humedad": 50.0, "timestamp": now_ts}),
                qos=1,
            ).wait_for_publish()
            pub.publish(
                f"simoa/dispositivos/{code_nosensor}/telemetria",
                json.dumps({"codigo": code_nosensor, "temperatura": 24.0, "humedad": 50.0, "timestamp": now_ts}),
                qos=1,
            ).wait_for_publish()
            pub.publish(
                f"simoa/dispositivos/{code1}/telemetria",
                json.dumps({"codigo": code1, "sensor_id": sen2, "temperatura": 24.0, "humedad": 50.0, "timestamp": now_ts}),
                qos=1,
            ).wait_for_publish()
            pub.publish(
                f"simoa/dispositivos/{code1}/telemetria",
                f'{{"codigo": "{code1}", "temperatura": NaN, "humedad": 50.0, "timestamp": {now_ts}}}',
                qos=1,
            ).wait_for_publish()
            pub.publish(
                f"simoa/dispositivos/{code1}/telemetria",
                json.dumps({"codigo": code1, "temperatura": 24.0, "humedad": 50.0, "timestamp": "fecha-mala"}),
                qos=1,
            ).wait_for_publish()

            # Esperar a que DLQ persista los rechazos
            def _has_motivos() -> bool:
                dlq = client.get("/api/mqtt/rechazos?limit=50", headers=headers).json()["items"]
                motivos = {r["motivo"] for r in dlq}
                expected = {
                    "JSON_MALFORMADO",
                    "CODIGO_INCONSISTENTE",
                    "DISPOSITIVO_DESCONOCIDO",
                    "DISPOSITIVO_INACTIVO",
                    "SENSOR_NO_VINCULADO",
                    "VALOR_NUMERICO_INVALIDO",
                    "TIMESTAMP_INVALIDO",
                }
                return expected.issubset(motivos)

            assert _wait_until(_has_motivos, timeout=5.0), "No se registraron todos los motivos en DLQ"

            # Verificar que no se creó dispositivo desconocido automáticamente
            with db_cursor() as cursor:
                cursor.execute("SELECT COUNT(*) AS c FROM dispositivos WHERE codigo = %s", (f"DESCONOCIDO-{uid}",))
                assert cursor.fetchone()["c"] == 0

            # 4. Sensor en estado FALLA (RN-07) y validación de variables RF-05
            assert client.patch(f"/api/sensores/{sen1}/estado", headers=headers, json={"estado": "FALLA"}).status_code == 200
            mqtt_service.invalidate_cache()
            pub.publish(
                f"simoa/dispositivos/{code1}/telemetria",
                json.dumps({"codigo": code1, "temperatura": 25.0, "humedad": 60.0, "timestamp": now_ts}),
                qos=1,
            ).wait_for_publish()
            assert _wait_until(
                lambda: any(
                    r["motivo"] == "SENSOR_NO_OPERATIVO" and r["codigo_dispositivo"] == code1
                    for r in client.get("/api/mqtt/rechazos?limit=20", headers=headers).json()["items"]
                ),
                timeout=4.0,
            )

            # Reactivar sen1 pero deshabilitar humedad en RF-05 -> si llega humedad, rechaza con VARIABLE_NO_HABILITADA
            assert client.patch(f"/api/sensores/{sen1}/estado", headers=headers, json={"estado": "ACTIVO"}).status_code == 200
            assert (
                client.put(
                    f"/api/sensores/{sen1}/variables",
                    headers=headers,
                    json={
                        "temperatura_habilitada": True,
                        "humedad_habilitada": False,
                        "unidad_temperatura": "°C",
                        "unidad_humedad": "%RH",
                    },
                ).status_code
                == 200
            )
            mqtt_service.invalidate_cache()
            pub.publish(
                f"simoa/dispositivos/{code1}/telemetria",
                json.dumps({"codigo": code1, "temperatura": 25.0, "humedad": 60.0, "timestamp": now_ts}),
                qos=1,
            ).wait_for_publish()
            assert _wait_until(
                lambda: any(
                    r["motivo"] == "VARIABLE_NO_HABILITADA" and r["codigo_dispositivo"] == code1
                    for r in client.get("/api/mqtt/rechazos?limit=20", headers=headers).json()["items"]
                ),
                timeout=4.0,
            )

            # Restaurar ambas variables en sen1 y probar continuidad + carga (>= 1 msg/seg con múltiples dispositivos)
            assert (
                client.put(
                    f"/api/sensores/{sen1}/variables",
                    headers=headers,
                    json={
                        "temperatura_habilitada": True,
                        "humedad_habilitada": True,
                        "unidad_temperatura": "°C",
                        "unidad_humedad": "%RH",
                    },
                ).status_code
                == 200
            )
            mqtt_service.invalidate_cache()

            load_before = len(routed_rf07)
            total_load = 20  # 10 mensajes por cada dispositivo en ráfaga (<1s)
            for i in range(10):
                pub.publish(
                    f"simoa/dispositivos/{code1}/telemetria",
                    json.dumps({"codigo": code1, "temperatura": 22.0 + i * 0.1, "humedad": 50.0, "timestamp": now_ts + i}),
                    qos=1,
                )
                pub.publish(
                    f"simoa/dispositivos/{code2}/telemetria",
                    json.dumps(
                        {
                            "codigo": code2,
                            "temperatura": 20.0 + i * 0.1,
                            "humedad": 48.0,
                            "presion": 1010.0,
                            "timestamp": now_ts + i,
                        }
                    ),
                    qos=1,
                )
            assert _wait_until(lambda: len(routed_rf07) >= load_before + total_load, timeout=6.0)

            status_data = client.get("/api/mqtt/status", headers=headers).json()
            metrics = status_data["metrics"]
            print(
                f"\n[RF-06 PERF] avg={metrics['avg_processing_ms']}ms, "
                f"p95={metrics['p95_processing_ms']}ms, max={metrics['max_processing_ms']}ms, "
                f"samples={metrics['samples_measured']}"
            )
            assert metrics["avg_processing_ms"] < 100.0
            assert metrics["p95_processing_ms"] < 100.0
            assert metrics["max_processing_ms"] < 100.0

            # 5. Cola saturada sin bloqueo indefinido
            orig_queue = mqtt_service.telemetry_queue
            mqtt_service.telemetry_queue = queue.Queue(maxsize=1)
            mqtt_service.telemetry_queue.put_nowait(routed_rf07[-1])
            try:
                pub.publish(
                    f"simoa/dispositivos/{code1}/telemetria",
                    json.dumps({"codigo": code1, "temperatura": 23.0, "humedad": 52.0, "timestamp": now_ts + 99}),
                    qos=1,
                ).wait_for_publish()
                assert _wait_until(
                    lambda: any(
                        r["motivo"] == "COLA_SATURADA"
                        for r in client.get("/api/mqtt/rechazos?limit=20", headers=headers).json()["items"]
                    ),
                    timeout=4.0,
                )
            finally:
                mqtt_service.telemetry_queue = orig_queue

            # 6. Desconexión inesperada (caída de socket), reconexión automática y recuperación de suscripción
            sock = mqtt_service._client.socket()
            assert sock is not None
            sock.close()
            assert _wait_until(
                lambda: mqtt_service.get_status()["connected"] and mqtt_service.get_status()["subscribed"],
                timeout=8.0,
            )
            after_reconn_before = len(routed_rf07)
            pub.publish(
                f"simoa/dispositivos/{code1}/telemetria",
                json.dumps({"codigo": code1, "temperatura": 24.1, "humedad": 55.0, "timestamp": now_ts + 200}),
                qos=1,
            ).wait_for_publish()
            assert _wait_until(lambda: len(routed_rf07) >= after_reconn_before + 1, timeout=4.0)
        finally:
            pub.loop_stop()
            pub.disconnect()

    # 7. Cierre limpio al apagar FastAPI
    assert mqtt_service.get_status()["running"] is False
    assert mqtt_service.get_status()["connected"] is False
