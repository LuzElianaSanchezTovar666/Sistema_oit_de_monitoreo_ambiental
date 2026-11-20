from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import sys
import threading
import time
import uuid

from fastapi.testclient import TestClient
import paho.mqtt.client as mqtt_client
import pymysql

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DB_HOST", "127.0.0.1")
os.environ.setdefault("DB_PORT", "3306")
os.environ.setdefault("DB_USER", "root")
os.environ.setdefault("DB_PASSWORD", "")
os.environ.setdefault("DB_NAME", "simoa")

from app.database import db_cursor  # noqa: E402
from app.main import app  # noqa: E402
from app.security import hash_password  # noqa: E402
from app.services.alerts_service import (  # noqa: E402
    AlertsService,
    DurableAlertPendingBuffer,
    evaluate_variable_breach,
)
from app.services.mqtt_ingest import mqtt_service  # noqa: E402


def _ensure_user_and_login(client: TestClient, email: str, rol: str) -> dict:
    pwd = "TestPass123!"
    pwd_hash = hash_password(pwd)
    with db_cursor() as cursor:
        cursor.execute("SELECT id_usuario FROM usuarios WHERE correo = %s LIMIT 1", (email,))
        if cursor.fetchone() is None:
            cursor.execute(
                """
                INSERT INTO usuarios (nombre, correo, password_hash, rol, estado)
                VALUES (%s, %s, %s, %s, 'activo')
                """,
                (f"User {rol}", email, pwd_hash, rol),
            )
        else:
            cursor.execute(
                "UPDATE usuarios SET password_hash = %s, rol = %s, estado = 'activo' WHERE correo = %s",
                (pwd_hash, rol, email),
            )
    res = client.post("/api/auth/login", json={"correo": email, "password": pwd})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_rf13_evaluation_boundaries_and_physical_humidity():
    limits = {
        "temp_critico_min": 12.0,
        "temp_min": 18.0,
        "temp_max": 25.0,
        "temp_critico_max": 30.0,
        "hum_critico_min": 25.0,
        "hum_min": 40.0,
        "hum_max": 70.0,
        "hum_critico_max": 85.0,
    }
    # Exactamente en los límites -> sin alerta
    assert evaluate_variable_breach("temperatura", 18.0, limits) is None
    assert evaluate_variable_breach("temperatura", 25.0, limits) is None
    assert evaluate_variable_breach("humedad", 40.0, limits) is None
    assert evaluate_variable_breach("humedad", 70.0, limits) is None

    # Fuera de rango operacional -> ADVERTENCIA
    t_low = evaluate_variable_breach("temperatura", 17.9, limits)
    assert t_low is not None and t_low["severidad"] == "ADVERTENCIA" and t_low["condicion"] == "BAJO_MINIMO"
    t_high = evaluate_variable_breach("temperatura", 28.0, limits)
    assert t_high is not None and t_high["severidad"] == "ADVERTENCIA" and t_high["condicion"] == "SOBRE_MAXIMO"

    # Críticos -> CRITICA
    t_crit = evaluate_variable_breach("temperatura", 30.0, limits)
    assert t_crit is not None and t_crit["severidad"] == "CRITICA"
    h_crit = evaluate_variable_breach("humedad", 24.0, limits)
    assert h_crit is not None and h_crit["severidad"] == "CRITICA"

    # Humedad fuera de [0, 100] -> error de sensor, NO alerta ambiental
    assert evaluate_variable_breach("humedad", -5.0, limits) is None
    assert evaluate_variable_breach("humedad", 105.0, limits) is None

    # Sin umbrales -> no inventa ni clasifica
    assert evaluate_variable_breach("temperatura", 35.0, None) is None


def test_rf13_debouncing_escalation_concurrency_recovery_mqtt_latency_and_rbac(tmp_path):
    suffix = uuid.uuid4().hex[:6]
    loc_id = None
    dev_id = None
    sen_id = None
    tmp_buf = DurableAlertPendingBuffer(db_path=tmp_path / "rf13_test_buf.sqlite3")
    svc = AlertsService(buffer=tmp_buf)

    with TestClient(app) as client:
        admin_headers = _ensure_user_and_login(client, "admin.rf13@simoa-ejemplo.org", "Administrador")
        tec_headers = _ensure_user_and_login(client, "tec.rf13@simoa-ejemplo.org", "Técnico")
        op_headers = _ensure_user_and_login(client, "op.rf13@simoa-ejemplo.org", "Operador")

        try:
            # 1. Crear ubicación, dispositivo, sensor y umbrales RF-12
            loc_res = client.post(
                "/api/ubicaciones",
                headers=admin_headers,
                json={
                    "nombre": f"Lab RF13 {suffix}",
                    "codigo_area": f"AREA-{suffix.upper()}",
                    "tipo": "Laboratorio",
                    "estado": "ACTIVA",
                },
            )
            assert loc_res.status_code == 201, loc_res.text
            loc_id = loc_res.json()["ubicacion"]["ubicacion_id"]

            raw_mac = uuid.uuid4().bytes[:6]
            mac = ":".join(f"{b:02X}" for b in raw_mac)
            dev_res = client.post(
                "/api/dispositivos",
                headers=admin_headers,
                json={
                    "nombre": f"ESP32 RF13 {suffix}",
                    "tipo": "ESP32",
                    "firmware_version": "v2.4.1",
                    "mac_address": mac,
                    "ubicacion_id": loc_id,
                },
            )
            assert dev_res.status_code == 201, dev_res.text
            dev_json = dev_res.json()["dispositivo"]
            dev_id = dev_json["id_dispositivo"]
            mqtt_topic = dev_json["mqtt_topic"]

            sen_res = client.post(
                "/api/sensores",
                headers=admin_headers,
                json={
                    "dispositivo_id": dev_id,
                    "identificador": f"SEN-RF13-{suffix}",
                    "modelo": "DHT22",
                    "variables": ["temperatura", "humedad"],
                    "fecha_instalacion": "2026-02-01",
                    "ultima_calibracion": "2026-02-05",
                    "estado": "ACTIVO",
                },
            )
            assert sen_res.status_code == 201, sen_res.text
            sen_id = sen_res.json()["sensor"]["id_sensor"]

            cfg_res = client.put(
                f"/api/configuraciones/{sen_id}",
                headers=admin_headers,
                json={
                    "temp_critico_min": 12.0,
                    "temp_min": 18.0,
                    "temp_max": 25.0,
                    "temp_critico_max": 30.0,
                    "hum_critico_min": 25.0,
                    "hum_min": 40.0,
                    "hum_max": 70.0,
                    "hum_critico_max": 85.0,
                },
            )
            assert cfg_res.status_code == 200, cfg_res.text

            # 2. Seguridad RBAC
            assert TestClient(app).get("/api/alertas").status_code == 401
            assert client.get("/api/alertas", headers=tec_headers).status_code == 403
            assert client.get("/api/alertas", headers=op_headers).status_code == 200

            # 3. Debouncing RN-15 + independencia temperatura/humedad + escalamiento ADVERTENCIA -> CRITICA
            t0 = datetime.now(timezone.utc) - timedelta(minutes=10)
            ev_warn = {
                "sensor_id": sen_id,
                "dispositivo_id": dev_id,
                "ubicacion_id": loc_id,
                "magnitudes": {"temperatura": 27.5, "humedad": 55.0},
                "fecha_hora": t0,
            }
            created_1 = svc.process_event(ev_warn)
            assert len(created_1) == 1
            assert created_1[0]["severidad"] == "ADVERTENCIA"
            assert created_1[0]["estado"] == "PENDIENTE"
            assert "27.5 °C" in created_1[0]["mensaje"]

            # Segundo evento dentro de 300 s -> debe ser debounced (sin duplicar registro)
            ev_warn_2 = {
                **ev_warn,
                "magnitudes": {"temperatura": 28.0, "humedad": 75.0},  # humedad independiente sí debe generar!
                "fecha_hora": t0 + timedelta(seconds=60),
            }
            created_2 = svc.process_event(ev_warn_2)
            assert len(created_2) == 1
            assert created_2[0]["variable"] == "humedad"

            # Escalamiento a CRITICA dentro de 300 s -> NUNCA se suprime!
            ev_crit = {
                **ev_warn,
                "magnitudes": {"temperatura": 32.5, "humedad": 55.0},
                "fecha_hora": t0 + timedelta(seconds=120),
            }
            created_3 = svc.process_event(ev_crit)
            assert len(created_3) == 1
            assert created_3[0]["severidad"] == "CRITICA"
            assert created_3[0]["escalada"] is True

            # Evento fuera de la ventana (> 300 s desde la última alerta CRITICA) -> nueva alerta
            ev_after = {
                **ev_warn,
                "magnitudes": {"temperatura": 26.5, "humedad": 55.0},
                "fecha_hora": t0 + timedelta(seconds=450),
            }
            created_4 = svc.process_event(ev_after)
            assert len(created_4) == 1

            # 4. Concurrencia simultánea: dos hilos enviando mismo evento (fuera de ventana previa)
            t_conc = t0 + timedelta(seconds=800)
            conc_results = []
            def _worker(val: float):
                conc_results.extend(
                    svc.process_event(
                        {
                            "sensor_id": sen_id,
                            "dispositivo_id": dev_id,
                            "ubicacion_id": loc_id,
                            "magnitudes": {"temperatura": val},
                            "fecha_hora": t_conc,
                        }
                    )
                )
            th1 = threading.Thread(target=_worker, args=(26.0,))
            th2 = threading.Thread(target=_worker, args=(26.2,))
            th1.start(); th2.start(); th1.join(); th2.join()
            assert len(conc_results) == 1
            assert conc_results[0]["persistida"] and not conc_results[0]["provisional"]

            # 5. Tolerancia a fallo temporal de MySQL -> buffer durable + recuperación
            orig_get = svc._get_limits_and_context
            def _fail_mysql(_sid):
                raise pymysql.err.OperationalError(2003, "Simulated MySQL outage")
            svc._get_limits_and_context = _fail_mysql
            try:
                prov = svc.process_event(
                    {
                        "sensor_id": sen_id,
                        "dispositivo_id": dev_id,
                        "ubicacion_id": loc_id,
                        "magnitudes": {"temperatura": 33.5},
                        "fecha_hora": datetime.now(timezone.utc) + timedelta(seconds=2),
                    }
                )
                assert len(prov) == 1
                assert prov[0]["persistida"] is False
                assert prov[0]["provisional"] is True
                assert tmp_buf.count() == 1
            finally:
                svc._get_limits_and_context = orig_get

            drained = svc.flush_pending_alerts()
            assert drained == 1
            assert tmp_buf.count() == 0

            # 6. Prueba real MQTT (Mosquitto 1883 -> RF-06 -> RF-07 -> RF-13) midiendo latencia < 2.0 s
            # Esperar a que mqtt_service esté suscrito al broker real
            with db_cursor() as cursor:
                cursor.execute("DELETE FROM alertas WHERE sensor_id = %s", (sen_id,))
            mqtt_service.invalidate_cache()

            deadline_sub = time.monotonic() + 5.0
            while time.monotonic() < deadline_sub:
                st = mqtt_service.get_status()
                if st.get("connected") and st.get("subscribed"):
                    break
                time.sleep(0.05)
            assert st.get("connected") and st.get("subscribed"), st

            t_mqtt_start = time.perf_counter()
            pub = mqtt_client.Client(mqtt_client.CallbackAPIVersion.VERSION2, client_id=f"rf13-pub-{suffix}")
            pub.connect("127.0.0.1", 1883, 60)
            pub.loop_start()
            payload = {
                "codigo": dev_json["codigo"],
                "temperatura": 34.0,
                "humedad": 55.0,
                "timestamp": int(time.time()),
            }
            info = pub.publish(mqtt_topic, json.dumps(payload), qos=1)
            info.wait_for_publish(timeout=3.0)
            pub.loop_stop()
            pub.disconnect()

            found = None
            deadline = time.perf_counter() + 2.0
            while time.perf_counter() < deadline:
                res_list = client.get("/api/alertas", params={"ubicacion_id": loc_id}, headers=admin_headers)
                assert res_list.status_code == 200
                alerts_rows = res_list.json()["alertas"]
                if alerts_rows:
                    found = alerts_rows[0]
                    break
                time.sleep(0.05)
            latency_s = time.perf_counter() - t_mqtt_start
            assert found is not None, "La alerta MQTT RF-13 no se reflejó en < 2.0 s"
            assert latency_s < 2.0, f"Latencia excedió 2.0 s: {latency_s:.3f}s"
            assert found["severidad"] == "CRITICA"
            assert found["estado"] == "PENDIENTE"
        finally:
            with db_cursor() as cursor:
                if sen_id:
                    cursor.execute("DELETE FROM alertas WHERE sensor_id = %s", (sen_id,))
                    cursor.execute("DELETE FROM mediciones WHERE sensor_id = %s", (sen_id,))
                    cursor.execute("DELETE FROM historial_umbrales WHERE sensor_id = %s", (sen_id,))
                    cursor.execute("DELETE FROM umbrales_alerta WHERE sensor_id = %s", (sen_id,))
                    cursor.execute("DELETE FROM historial_configuracion_variables WHERE sensor_id = %s", (sen_id,))
                    cursor.execute("DELETE FROM configuracion_variables_sensor WHERE sensor_id = %s", (sen_id,))
                    cursor.execute("DELETE FROM sensores WHERE id_sensor = %s", (sen_id,))
                if dev_id:
                    cursor.execute("DELETE FROM historial_ubicaciones WHERE dispositivo_id = %s", (dev_id,))
                    cursor.execute("DELETE FROM dispositivos WHERE id_dispositivo = %s", (dev_id,))
                if loc_id:
                    cursor.execute("DELETE FROM ubicaciones WHERE ubicacion_id = %s", (loc_id,))
