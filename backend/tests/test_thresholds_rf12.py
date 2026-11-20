from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
import uuid

from fastapi.testclient import TestClient

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
from app.services.measurement_persistence import measurement_persister  # noqa: E402
from app.services.thresholds_service import evaluate_measurement_thresholds  # noqa: E402


def _ensure_user_and_login(client: TestClient, email: str, rol: str) -> dict:
    pwd = "TestPass123!"
    pwd_hash = hash_password(pwd)
    with db_cursor() as cursor:
        cursor.execute("SELECT id_usuario FROM usuarios WHERE correo = %s LIMIT 1", (email,))
        if cursor.fetchone() is None:
            cursor.execute(
                """
                INSERT INTO usuarios (id_usuario, nombre, correo, password_hash, rol, estado)
                VALUES (%s, %s, %s, %s, %s, 'activo')
                """,
                (f"usr-{uuid.uuid4().hex[:8]}", f"User {rol}", email, pwd_hash, rol),
            )
        else:
            cursor.execute(
                "UPDATE usuarios SET password_hash = %s, rol = %s, estado = 'activo' WHERE correo = %s",
                (pwd_hash, rol, email),
            )
    login_res = client.post("/api/auth/login", json={"correo": email, "password": pwd})
    assert login_res.status_code == 200, login_res.text
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_rf12_thresholds_rbac_validations_concurrency_and_immediate_application():
    suffix = uuid.uuid4().hex[:6]
    loc_id = None
    dev_id = None
    sen_id = None
    sen_temp_only = None

    with TestClient(app) as client:
        admin_headers = _ensure_user_and_login(client, "admin.rf12@simoa-ejemplo.org", "Administrador")
        op_headers = _ensure_user_and_login(client, "operador.rf12@simoa-ejemplo.org", "Operador")

        try:
            loc_res = client.post(
                "/api/ubicaciones",
                headers=admin_headers,
                json={
                    "nombre": f"Lab RF12 {suffix}",
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
                    "nombre": f"ESP32 RF12 {suffix}",
                    "tipo": "ESP32",
                    "firmware_version": "v2.4.1",
                    "mac_address": mac,
                    "ubicacion_id": loc_id,
                },
            )
            assert dev_res.status_code == 201, dev_res.text
            dev_id = dev_res.json()["dispositivo"]["id_dispositivo"]

            sen_res = client.post(
                "/api/sensores",
                headers=admin_headers,
                json={
                    "dispositivo_id": dev_id,
                    "identificador": f"SEN-RF12-{suffix}",
                    "modelo": "DHT22",
                    "variables": ["temperatura", "humedad"],
                    "fecha_instalacion": "2026-02-01",
                    "ultima_calibracion": "2026-02-05",
                    "estado": "ACTIVO",
                },
            )
            assert sen_res.status_code == 201, sen_res.text
            sen_id = sen_res.json()["sensor"]["id_sensor"]

            sen_t_res = client.post(
                "/api/sensores",
                headers=admin_headers,
                json={
                    "dispositivo_id": dev_id,
                    "identificador": f"SEN-RF12T-{suffix}",
                    "modelo": "SHT31",
                    "variables": ["temperatura"],
                    "fecha_instalacion": "2026-02-01",
                    "ultima_calibracion": "2026-02-05",
                    "estado": "ACTIVO",
                },
            )
            assert sen_t_res.status_code == 201, sen_t_res.text
            sen_temp_only = sen_t_res.json()["sensor"]["id_sensor"]

            # 1. Seguridad: 401 sin token, 403 para Operador al modificar
            with TestClient(app) as anon_client:
                assert anon_client.get(f"/api/configuraciones/{sen_id}").status_code == 401
            assert client.put(
                f"/api/configuraciones/{sen_id}",
                headers=op_headers,
                json={"temp_min": 18, "temp_max": 25},
            ).status_code == 403
            assert client.get(f"/api/configuraciones/{sen_id}", headers=op_headers).status_code == 200

            # 2. Validaciones estrictas
            valid_payload = {
                "temp_critico_min": 12.0,
                "temp_min": 18.0,
                "temp_max": 25.0,
                "temp_critico_max": 32.0,
                "hum_critico_min": 25.0,
                "hum_min": 40.0,
                "hum_max": 70.0,
                "hum_critico_max": 85.0,
                "motivo": "Configuración inicial RF-12",
            }

            bad_min_max = client.put(
                f"/api/configuraciones/{sen_id}",
                headers=admin_headers,
                json={**valid_payload, "temp_min": 25.0, "temp_max": 25.0},
            )
            assert bad_min_max.status_code == 400
            assert bad_min_max.json()["detail"] == "El límite mínimo debe ser estrictamente menor que el límite máximo"

            bad_nan = client.put(
                f"/api/configuraciones/{sen_id}",
                headers=admin_headers,
                json={**valid_payload, "temp_min": ""},
            )
            assert bad_nan.status_code == 400

            bad_hum = client.put(
                f"/api/configuraciones/{sen_id}",
                headers=admin_headers,
                json={**valid_payload, "hum_critico_max": 105.0},
            )
            assert bad_hum.status_code == 400

            bad_dht_temp = client.put(
                f"/api/configuraciones/{sen_id}",
                headers=admin_headers,
                json={**valid_payload, "temp_critico_max": 95.0},
            )
            assert bad_dht_temp.status_code == 400

            bad_crit_order = client.put(
                f"/api/configuraciones/{sen_id}",
                headers=admin_headers,
                json={**valid_payload, "temp_critico_min": 19.0},
            )
            assert bad_crit_order.status_code == 400

            # 3. Sensor que solo mide temperatura no exige humedad
            temp_only_res = client.post(
                "/api/configuraciones",
                headers=admin_headers,
                json={
                    "sensor_id": sen_temp_only,
                    "temp_critico_min": 10.0,
                    "temp_min": 15.0,
                    "temp_max": 30.0,
                    "temp_critico_max": 40.0,
                },
            )
            assert temp_only_res.status_code == 200, temp_only_res.text
            assert temp_only_res.json()["configuracion"]["hum_min"] is None

            # 4. Guardado válido en MySQL + historial + control de concurrencia
            save_res = client.put(
                f"/api/configuraciones/{sen_id}",
                headers=admin_headers,
                json=valid_payload,
            )
            assert save_res.status_code == 200, save_res.text
            cfg_v2 = save_res.json()["configuracion"]
            assert cfg_v2["version"] == 2
            assert cfg_v2["temp_critico_min"] == 12.0
            assert cfg_v2["temp_critico_max"] == 32.0

            # Actualización v3
            save_v3 = client.put(
                f"/api/configuraciones/{sen_id}",
                headers=admin_headers,
                json={
                    **valid_payload,
                    "temp_min": 20.0,
                    "temp_max": 22.0,
                    "expected_version": 2,
                    "motivo": "Ajuste fino v3",
                },
            )
            assert save_v3.status_code == 200, save_v3.text
            assert save_v3.json()["configuracion"]["version"] == 3

            # Conflicto de concurrencia con expected_version=2
            conflict = client.put(
                f"/api/configuraciones/{sen_id}",
                headers=admin_headers,
                json={**valid_payload, "expected_version": 2},
            )
            assert conflict.status_code == 409

            hist_res = client.get(f"/api/configuraciones/{sen_id}/historial", headers=admin_headers)
            assert hist_res.status_code == 200
            hist_items = hist_res.json()["historial"]
            assert len(hist_items) >= 2
            assert hist_items[0]["vigente_hasta"] is None
            assert hist_items[1]["vigente_hasta"] is not None

            # 5. Aplicación inmediata a nueva medición sin alterar históricas
            now_dt = datetime.now(timezone.utc)
            measurement_persister.persist_event(
                {
                    "sensor_id": sen_id,
                    "dispositivo_id": dev_id,
                    "ubicacion_id": loc_id,
                    "magnitudes": {"temperatura": 23.5, "humedad": 55.0},
                    "fecha_hora": now_dt,
                }
            )
            with db_cursor() as cursor:
                cursor.execute(
                    "SELECT es_fuera_de_umbral FROM mediciones WHERE sensor_id = %s ORDER BY id_medicion DESC LIMIT 1",
                    (sen_id,),
                )
                row = cursor.fetchone()
            assert row is not None
            # Con el umbral v3 (temp_max=22.0), 23.5 °C debe marcarse fuera de umbral inmediatamente
            assert bool(row["es_fuera_de_umbral"]) is True

            # Verificar motor de reglas RF-12/RF-13
            rule_eval = evaluate_measurement_thresholds(save_v3.json()["configuracion"], temperatura=33.0, humedad=55.0)
            assert rule_eval["estado_operacional"] == "CRITICO"
            assert rule_eval["nivel_criticidad"] == "CRITICO"

            # Desactivar temporalmente sen_temp_only para que ubicacion/{loc_id}/temperatura-actual consulte sen_id
            with db_cursor() as cursor:
                cursor.execute("UPDATE sensores SET estado = 'INACTIVO' WHERE id_sensor = %s", (sen_temp_only,))

            # Verificar reflejo inmediato en RF-08 y RF-11
            rt_res = client.get(
                f"/api/mediciones/ubicacion/{loc_id}/temperatura-actual",
                headers=admin_headers,
            )
            assert rt_res.status_code == 200
            assert rt_res.json()["temp_min"] == 20.0
            assert rt_res.json()["temp_max"] == 22.0

            trends_res = client.get(
                "/api/mediciones/tendencias",
                params={"sensor_id": sen_id},
                headers=admin_headers,
            )
            assert trends_res.status_code == 200
            assert trends_res.json()["limites"]["temperatura"]["min"] == 20.0
            assert trends_res.json()["limites"]["temperatura"]["max"] == 22.0
        finally:
            with db_cursor() as cursor:
                if sen_id or sen_temp_only:
                    sids = [s for s in (sen_id, sen_temp_only) if s]
                    placeholders = ", ".join(["%s"] * len(sids))
                    cursor.execute(f"DELETE FROM mediciones WHERE sensor_id IN ({placeholders})", tuple(sids))
                    cursor.execute(f"DELETE FROM historial_umbrales WHERE sensor_id IN ({placeholders})", tuple(sids))
                    cursor.execute(f"DELETE FROM umbrales_alerta WHERE sensor_id IN ({placeholders})", tuple(sids))
                    cursor.execute(
                        f"DELETE FROM historial_configuracion_variables WHERE sensor_id IN ({placeholders})",
                        tuple(sids),
                    )
                    cursor.execute(
                        f"DELETE FROM configuracion_variables_sensor WHERE sensor_id IN ({placeholders})",
                        tuple(sids),
                    )
                    cursor.execute(f"DELETE FROM sensores WHERE id_sensor IN ({placeholders})", tuple(sids))
                if dev_id:
                    cursor.execute("DELETE FROM historial_ubicaciones WHERE dispositivo_id = %s", (dev_id,))
                    cursor.execute("DELETE FROM dispositivos WHERE id_dispositivo = %s", (dev_id,))
                if loc_id:
                    cursor.execute("DELETE FROM ubicaciones WHERE ubicacion_id = %s", (loc_id,))
