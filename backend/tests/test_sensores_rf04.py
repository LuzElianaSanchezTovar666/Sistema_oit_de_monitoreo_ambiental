import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DB_HOST", "127.0.0.1")
os.environ.setdefault("DB_PORT", "3306")
os.environ.setdefault("DB_USER", "root")
os.environ.setdefault("DB_PASSWORD", "")
os.environ.setdefault("DB_NAME", "simoa")
os.environ.setdefault("JWT_SECRET_KEY", "simoa_test_secret_key_for_pytest_hs256_32bytes_min")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("JWT_EXPIRE_HOURS", "8")
os.environ.setdefault("COOKIE_SECURE", "false")

from app.database import db_cursor, run_migrations  # noqa: E402
from app.main import app  # noqa: E402
from app.security import hash_password, login_rate_limiter  # noqa: E402


RF04_TEST_USERS = [
    ("Admin RF04", "admin.rf04@simoa-ejemplo.org", "AdminPass123!", "Administrador", "activo"),
    ("Operador RF04", "operador.rf04@simoa-ejemplo.org", "OperadorPass123!", "Operador", "activo"),
    ("Tecnico RF04", "tecnico.rf04@simoa-ejemplo.org", "TecnicoPass123!", "Técnico", "activo"),
    ("Supervisor RF04", "supervisor.rf04@simoa-ejemplo.org", "SupervisorPass123!", "Supervisor", "activo"),
]

TEST_MACS = ("EE:11:22:33:44:01", "EE:11:22:33:44:02", "EE:11:22:33:44:03")


def _cleanup_rf04():
    emails = [u[1] for u in RF04_TEST_USERS]
    with db_cursor() as cursor:
        cursor.execute(
            "DELETE m FROM mediciones m INNER JOIN dispositivos d ON m.dispositivo_id = d.id_dispositivo WHERE d.mac_address IN %s",
            (TEST_MACS,),
        )
        cursor.execute(
            "DELETE u FROM umbrales_alerta u INNER JOIN sensores s ON u.sensor_id = s.id_sensor INNER JOIN dispositivos d ON s.dispositivo_id = d.id_dispositivo WHERE d.mac_address IN %s",
            (TEST_MACS,),
        )
        cursor.execute(
            "DELETE s FROM sensores s INNER JOIN dispositivos d ON s.dispositivo_id = d.id_dispositivo WHERE d.mac_address IN %s",
            (TEST_MACS,),
        )
        cursor.execute(
            "DELETE h FROM historial_ubicaciones h INNER JOIN dispositivos d ON h.dispositivo_id = d.id_dispositivo WHERE d.mac_address IN %s",
            (TEST_MACS,),
        )
        cursor.execute("DELETE FROM dispositivos WHERE mac_address IN %s", (TEST_MACS,))
        placeholders = ",".join(["%s"] * len(emails))
        cursor.execute(f"DELETE FROM usuarios WHERE correo IN ({placeholders})", tuple(emails))


@pytest.fixture(scope="module", autouse=True)
def setup_rf04_mysql():
    run_migrations()
    login_rate_limiter.clear_all()
    _cleanup_rf04()
    with db_cursor() as cursor:
        for nombre, correo, plain_pw, rol, estado in RF04_TEST_USERS:
            cursor.execute(
                """
                INSERT INTO usuarios (nombre, correo, password_hash, rol, estado)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (nombre, correo, hash_password(plain_pw), rol, estado),
            )
    yield
    _cleanup_rf04()
    login_rate_limiter.clear_all()


def _login_token(client: TestClient, correo: str, password: str) -> str:
    res = client.post("/api/auth/login", json={"correo": correo, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_rf04_registro_modelos_unidades_y_limites_predeterminados():
    with TestClient(app) as client:
        adm_token = _login_token(client, "admin.rf04@simoa-ejemplo.org", "AdminPass123!")

        dev_res = client.post(
            "/api/dispositivos",
            json={
                "nombre": "Nodo Sensores RF04",
                "mac_address": TEST_MACS[0],
                "tipo": "ESP32",
                "firmware_version": "v2.4.0",
                "ubicacion_id": "ubi-lab-01",
            },
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert dev_res.status_code == 201
        dev_id = dev_res.json()["dispositivo"]["id_dispositivo"]

        # 1. DHT22 (temperatura + humedad)
        dht_res = client.post(
            "/api/sensores",
            json={
                "dispositivo_id": dev_id,
                "identificador": "SEN-DHT22-RF04-01",
                "modelo": "DHT22",
                "variables": ["temperatura", "humedad"],
                "fecha_instalacion": "2026-01-10",
                "ultima_calibracion": "2026-01-15",
            },
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert dht_res.status_code == 201
        dht_cfg = dht_res.json()["configuracion_inicial"]
        assert dht_cfg["es_predeterminado"] is True
        assert dht_cfg["temp_min"] == 18.0
        assert dht_cfg["hum_min"] == 40.0
        assert dht_cfg["presion_min"] is None

        # 2. BME280 (temperatura + humedad + presion)
        bme_res = client.post(
            "/api/sensores",
            json={
                "dispositivo_id": dev_id,
                "identificador": "SEN-BME280-RF04-02",
                "modelo": "BME280",
                "variables": ["temperatura", "humedad", "presion"],
                "fecha_instalacion": "2026-01-10",
                "ultima_calibracion": "2026-01-10",
            },
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert bme_res.status_code == 201
        bme_vars = {v["variable"]: v["unidad"] for v in bme_res.json()["sensor"]["variables_medidas"]}
        assert bme_vars == {"temperatura": "°C", "humedad": "%RH", "presion": "hPa"}
        assert bme_res.json()["configuracion_inicial"]["presion_min"] == 980.0

        # 3. SHT31 (solo temperatura)
        sht_res = client.post(
            "/api/sensores",
            json={
                "dispositivo_id": dev_id,
                "identificador": "SEN-SHT31-RF04-03",
                "modelo": "SHT31",
                "variables": ["temperatura"],
                "fecha_instalacion": "2026-02-01",
                "ultima_calibracion": "2026-02-01",
            },
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert sht_res.status_code == 201
        sht_cfg = sht_res.json()["configuracion_inicial"]
        assert sht_cfg["temp_min"] == 18.0
        assert sht_cfg["hum_min"] is None
        assert sht_cfg["presion_min"] is None

        # Consultar sensores asociados al dispositivo
        by_dev = client.get(
            f"/api/dispositivos/{dev_id}/sensores",
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert by_dev.status_code == 200
        assert by_dev.json()["total"] == 3


def test_rf04_validaciones_rechazo_dispositivo_modelo_duplicado_y_fechas():
    with TestClient(app) as client:
        adm_token = _login_token(client, "admin.rf04@simoa-ejemplo.org", "AdminPass123!")

        # Crear dispositivo inactivo
        inact_dev = client.post(
            "/api/dispositivos",
            json={
                "nombre": "Nodo Inactivo RF04",
                "mac_address": TEST_MACS[1],
                "tipo": "ESP8266",
                "firmware_version": "v1.0.0",
                "ubicacion_id": "ubi-bod-04",
            },
            headers={"Authorization": f"Bearer {adm_token}"},
        ).json()["dispositivo"]
        client.patch(
            f"/api/dispositivos/{inact_dev['id_dispositivo']}/desactivar",
            headers={"Authorization": f"Bearer {adm_token}"},
        )

        # Rechazar dispositivo inactivo (400)
        assert (
            client.post(
                "/api/sensores",
                json={
                    "dispositivo_id": inact_dev["id_dispositivo"],
                    "identificador": "SEN-ERR-INACT",
                    "modelo": "DHT22",
                    "variables": ["temperatura"],
                    "fecha_instalacion": "2026-01-10",
                    "ultima_calibracion": "2026-01-10",
                },
                headers={"Authorization": f"Bearer {adm_token}"},
            ).status_code
            == 400
        )

        # Rechazar dispositivo inexistente (404)
        assert (
            client.post(
                "/api/sensores",
                json={
                    "dispositivo_id": "dev-no-existe",
                    "identificador": "SEN-ERR-404",
                    "modelo": "DHT22",
                    "variables": ["temperatura"],
                    "fecha_instalacion": "2026-01-10",
                    "ultima_calibracion": "2026-01-10",
                },
                headers={"Authorization": f"Bearer {adm_token}"},
            ).status_code
            == 404
        )

        # Obtener dispositivo activo
        devs = client.get("/api/dispositivos", headers={"Authorization": f"Bearer {adm_token}"}).json()["items"]
        act_dev = next(d for d in devs if d["mac_address"] == TEST_MACS[0])

        # Rechazar variable 'presion' en DHT22 (400)
        assert (
            client.post(
                "/api/sensores",
                json={
                    "dispositivo_id": act_dev["id_dispositivo"],
                    "identificador": "SEN-ERR-VAR",
                    "modelo": "DHT22",
                    "variables": ["temperatura", "presion"],
                    "fecha_instalacion": "2026-01-10",
                    "ultima_calibracion": "2026-01-10",
                },
                headers={"Authorization": f"Bearer {adm_token}"},
            ).status_code
            == 400
        )

        # Rechazar calibración anterior a instalación (400)
        assert (
            client.post(
                "/api/sensores",
                json={
                    "dispositivo_id": act_dev["id_dispositivo"],
                    "identificador": "SEN-ERR-DATE",
                    "modelo": "SHT31",
                    "variables": ["temperatura"],
                    "fecha_instalacion": "2026-02-10",
                    "ultima_calibracion": "2026-01-01",
                },
                headers={"Authorization": f"Bearer {adm_token}"},
            ).status_code
            == 400
        )

        # Rechazar identificador duplicado (409)
        assert (
            client.post(
                "/api/sensores",
                json={
                    "dispositivo_id": act_dev["id_dispositivo"],
                    "identificador": "SEN-DHT22-RF04-01",
                    "modelo": "DHT22",
                    "variables": ["temperatura"],
                    "fecha_instalacion": "2026-01-10",
                    "ultima_calibracion": "2026-01-10",
                },
                headers={"Authorization": f"Bearer {adm_token}"},
            ).status_code
            == 409
        )

        # Rechazar modelo no permitido y campos vacíos (422)
        assert (
            client.post(
                "/api/sensores",
                json={
                    "dispositivo_id": act_dev["id_dispositivo"],
                    "identificador": "",
                    "modelo": "MODELO-X",
                    "variables": [],
                    "fecha_instalacion": "2026-01-10",
                    "ultima_calibracion": "2026-01-10",
                },
                headers={"Authorization": f"Bearer {adm_token}"},
            ).status_code
            == 422
        )


def test_rf04_rn05_estados_sin_alertas_en_falla_calibracion_y_validacion_mqtt():
    with TestClient(app) as client:
        adm_token = _login_token(client, "admin.rf04@simoa-ejemplo.org", "AdminPass123!")

        # Crear segundo dispositivo activo para probar rechazo de atribución cruzada
        other_dev = client.post(
            "/api/dispositivos",
            json={
                "nombre": "Nodo Ajeno RF04",
                "mac_address": TEST_MACS[2],
                "tipo": "Gateway",
                "firmware_version": "v1.0.0",
                "ubicacion_id": "ubi-cam-03",
            },
            headers={"Authorization": f"Bearer {adm_token}"},
        ).json()["dispositivo"]

        sensores = client.get("/api/sensores", headers={"Authorization": f"Bearer {adm_token}"}).json()["items"]
        sen = next(s for s in sensores if s["identificador"] == "SEN-DHT22-RF04-01")
        sen_id = sen["id_sensor"]
        dev_id = sen["dispositivo_id"]

        # Actualizar descripción del sensor
        upd = client.put(
            f"/api/sensores/{sen_id}",
            json={
                "identificador": "SEN-DHT22-RF04-01",
                "modelo": "DHT22",
                "variables": ["temperatura", "humedad"],
                "fecha_instalacion": "2026-01-10",
                "ultima_calibracion": "2026-02-01",
                "descripcion": "Sonda calibrada",
            },
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert upd.status_code == 200
        assert upd.json()["sensor"]["descripcion"] == "Sonda calibrada"

        # Un dispositivo ajeno NO puede enviar mediciones atribuidas a este sensor (403)
        spoof = client.post(
            "/api/sensores/validar-ingesta",
            json={
                "dispositivo_id": other_dev["id_dispositivo"],
                "sensor_id": sen_id,
                "variable": "temperatura",
                "valor": 22.0,
                "unidad": "°C",
            },
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert spoof.status_code == 403

        # Cambiar a CALIBRACION -> lectura fuera de rango NO dispara alerta de producción (RN-05)
        assert (
            client.patch(
                f"/api/sensores/{sen_id}/estado",
                json={"estado": "CALIBRACION"},
                headers={"Authorization": f"Bearer {adm_token}"},
            ).status_code
            == 200
        )
        cal_ing = client.post(
            "/api/sensores/validar-ingesta",
            json={
                "dispositivo_id": dev_id,
                "sensor_id": sen_id,
                "variable": "temperatura",
                "valor": 39.5,
                "unidad": "°C",
            },
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert cal_ing.status_code == 200
        assert cal_ing.json()["alerta_produccion_generada"] is False
        assert cal_ing.json()["alerta_suprimida_rn05"] is True

        # Cambiar a FALLA -> tampoco dispara alerta de producción (RN-05)
        assert (
            client.patch(
                f"/api/sensores/{sen_id}/estado",
                json={"estado": "FALLA"},
                headers={"Authorization": f"Bearer {adm_token}"},
            ).status_code
            == 200
        )
        falla_ing = client.post(
            "/api/sensores/validar-ingesta",
            json={
                "dispositivo_id": dev_id,
                "sensor_id": sen_id,
                "variable": "temperatura",
                "valor": 41.0,
                "unidad": "°C",
            },
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert falla_ing.status_code == 200
        assert falla_ing.json()["alerta_produccion_generada"] is False
        assert falla_ing.json()["alerta_suprimida_rn05"] is True

        # Volver a ACTIVO -> las nuevas lecturas fuera de rango sí generan alerta, conservando historial
        assert (
            client.patch(
                f"/api/sensores/{sen_id}/estado",
                json={"estado": "ACTIVO"},
                headers={"Authorization": f"Bearer {adm_token}"},
            ).status_code
            == 200
        )
        act_ing = client.post(
            "/api/sensores/validar-ingesta",
            json={
                "dispositivo_id": dev_id,
                "sensor_id": sen_id,
                "variable": "temperatura",
                "valor": 35.0,
                "unidad": "°C",
            },
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert act_ing.status_code == 200
        assert act_ing.json()["alerta_produccion_generada"] is True

        detail = client.get(
            f"/api/sensores/{sen_id}",
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert detail.json()["sensor"]["historial_mediciones_count"] == 3


def test_rf04_rbac_solo_admin_registra_actualiza_y_cambia_estado():
    with TestClient(app) as client:
        op_token = _login_token(client, "operador.rf04@simoa-ejemplo.org", "OperadorPass123!")
        tec_token = _login_token(client, "tecnico.rf04@simoa-ejemplo.org", "TecnicoPass123!")
        sup_token = _login_token(client, "supervisor.rf04@simoa-ejemplo.org", "SupervisorPass123!")

        for tok in (op_token, tec_token, sup_token):
            assert client.get("/api/sensores", headers={"Authorization": f"Bearer {tok}"}).status_code == 200
            assert (
                client.post(
                    "/api/sensores",
                    json={
                        "dispositivo_id": "dev-x",
                        "identificador": "SEN-NO",
                        "modelo": "DHT22",
                        "variables": ["temperatura"],
                        "fecha_instalacion": "2026-01-10",
                        "ultima_calibracion": "2026-01-10",
                    },
                    headers={"Authorization": f"Bearer {tok}"},
                ).status_code
                == 403
            )
            assert (
                client.patch(
                    "/api/sensores/sen-x/estado",
                    json={"estado": "INACTIVO"},
                    headers={"Authorization": f"Bearer {tok}"},
                ).status_code
                == 403
            )
