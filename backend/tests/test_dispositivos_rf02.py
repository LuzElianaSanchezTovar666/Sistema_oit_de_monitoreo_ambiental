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


RF02_TEST_USERS = [
    ("Admin RF02", "admin.rf02@simoa-ejemplo.org", "AdminPass123!", "Administrador", "activo"),
    ("Operador RF02", "operador.rf02@simoa-ejemplo.org", "OperadorPass123!", "Operador", "activo"),
    ("Tecnico RF02", "tecnico.rf02@simoa-ejemplo.org", "TecnicoPass123!", "Técnico", "activo"),
    ("Supervisor RF02", "supervisor.rf02@simoa-ejemplo.org", "SupervisorPass123!", "Supervisor", "activo"),
]

TEST_MACS = ("AA:11:22:33:44:55", "BB:11:22:33:44:66", "CC:11:22:33:44:77")


@pytest.fixture(scope="module", autouse=True)
def setup_rf02_mysql():
    run_migrations()
    login_rate_limiter.clear_all()
    emails = [u[1] for u in RF02_TEST_USERS]
    with db_cursor() as cursor:
        cursor.execute(
            "DELETE h FROM historial_conectividad_dispositivos h JOIN dispositivos d ON h.dispositivo_id = d.id_dispositivo WHERE d.mac_address IN %s",
            (TEST_MACS,),
        )
        cursor.execute(
            "DELETE h FROM historial_ubicaciones h INNER JOIN dispositivos d ON h.dispositivo_id = d.id_dispositivo WHERE d.mac_address IN %s",
            (TEST_MACS,),
        )
        cursor.execute(
            "DELETE m FROM mediciones m INNER JOIN dispositivos d ON m.dispositivo_id = d.id_dispositivo WHERE d.mac_address IN %s",
            (TEST_MACS,),
        )
        cursor.execute("DELETE FROM dispositivos WHERE mac_address IN %s", (TEST_MACS,))
        placeholders = ",".join(["%s"] * len(emails))
        cursor.execute(f"DELETE FROM usuarios WHERE correo IN ({placeholders})", tuple(emails))
        for nombre, correo, plain_pw, rol, estado in RF02_TEST_USERS:
            cursor.execute(
                """
                INSERT INTO usuarios (nombre, correo, password_hash, rol, estado)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (nombre, correo, hash_password(plain_pw), rol, estado),
            )
    yield
    with db_cursor() as cursor:
        cursor.execute(
            "DELETE h FROM historial_conectividad_dispositivos h JOIN dispositivos d ON h.dispositivo_id = d.id_dispositivo WHERE d.mac_address IN %s",
            (TEST_MACS,),
        )
        cursor.execute(
            "DELETE h FROM historial_ubicaciones h INNER JOIN dispositivos d ON h.dispositivo_id = d.id_dispositivo WHERE d.mac_address IN %s",
            (TEST_MACS,),
        )
        cursor.execute(
            "DELETE m FROM mediciones m INNER JOIN dispositivos d ON m.dispositivo_id = d.id_dispositivo WHERE d.mac_address IN %s",
            (TEST_MACS,),
        )
        cursor.execute("DELETE FROM dispositivos WHERE mac_address IN %s", (TEST_MACS,))
        placeholders = ",".join(["%s"] * len(emails))
        cursor.execute(f"DELETE FROM usuarios WHERE correo IN ({placeholders})", tuple(emails))
    login_rate_limiter.clear_all()


def _login_token(client: TestClient, correo: str, password: str) -> str:
    res = client.post("/api/auth/login", json={"correo": correo, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_rf02_registro_exitoso_estado_pendiente_y_credenciales_mqtt():
    with TestClient(app) as client:
        adm_token = _login_token(client, "admin.rf02@simoa-ejemplo.org", "AdminPass123!")

        res = client.post(
            "/api/dispositivos",
            json={
                "nombre": "Nodo Bioterio Norte",
                "mac_address": "aa:11:22:33:44:55",
                "tipo": "ESP32",
                "firmware_version": "v2.4.1",
                "ubicacion": "Bioterio",
            },
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert res.status_code == 201
        body = res.json()
        disp = body["dispositivo"]
        creds = body["mqtt_credentials_once"]

        # Estado inicial debe ser PENDIENTE (nunca ONLINE sin confirmación real)
        assert disp["estado"] == "PENDIENTE"
        assert disp["mac_address"] == "AA:11:22:33:44:55"
        assert disp["tipo"] == "ESP32"
        assert disp["codigo"].startswith("SIMOA-ESP32-")
        assert creds["codigo"] == disp["codigo"]
        assert creds["mqtt_client_id"] == f"simoa_client_{disp['codigo'].lower()}"
        assert creds["mqtt_topic"] == f"simoa/dispositivos/{disp['codigo']}/telemetria"
        assert len(creds["mqtt_password"]) >= 12
        assert "mqtt_password_hash" not in disp

        # Verificar que en MySQL se guardó hash bcrypt y no texto plano
        with db_cursor() as cursor:
            cursor.execute(
                "SELECT mqtt_password_hash FROM dispositivos WHERE id_dispositivo = %s",
                (disp["id_dispositivo"],),
            )
            row = cursor.fetchone()
            assert row is not None
            assert row["mqtt_password_hash"].startswith("$2")
            assert row["mqtt_password_hash"] != creds["mqtt_password"]


def test_rf02_rechaza_mac_formato_invalido_y_mac_duplicada():
    with TestClient(app) as client:
        adm_token = _login_token(client, "admin.rf02@simoa-ejemplo.org", "AdminPass123!")

        # Formato inválido (incluye longitud distinta a 17 caracteres)
        for bad_mac_val in ("ZZ:11:22:33:44:55", "INVALID-MAC"):
            bad_fmt = client.post(
                "/api/dispositivos",
                json={
                    "nombre": "Nodo Malo",
                    "mac_address": bad_mac_val,
                    "tipo": "ESP8266",
                    "firmware_version": "v1.0.0",
                    "ubicacion": "Laboratorio",
                },
                headers={"Authorization": f"Bearer {adm_token}"},
            )
            assert bad_fmt.status_code == 400
            assert bad_fmt.json()["detail"] == "La dirección MAC ya existe o no tiene formato válido"

        # MAC duplicada (ya registrada en el test anterior)
        dup_mac = client.post(
            "/api/dispositivos",
            json={
                "nombre": "Nodo Duplicado",
                "mac_address": "AA:11:22:33:44:55",
                "tipo": "Gateway",
                "firmware_version": "v1.0.0",
                "ubicacion": "Bodega",
            },
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert dup_mac.status_code == 409
        assert dup_mac.json()["detail"] == "La dirección MAC ya existe o no tiene formato válido"


def test_rf02_validacion_campos_obligatorios():
    with TestClient(app) as client:
        adm_token = _login_token(client, "admin.rf02@simoa-ejemplo.org", "AdminPass123!")

        res = client.post(
            "/api/dispositivos",
            json={
                "nombre": "",
                "mac_address": "BB:11:22:33:44:66",
                "tipo": "TipoInvalido",
                "firmware_version": "",
                "ubicacion": "",
            },
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert res.status_code == 422


def test_rf02_consulta_inventario_detalle_y_actualizacion():
    with TestClient(app) as client:
        adm_token = _login_token(client, "admin.rf02@simoa-ejemplo.org", "AdminPass123!")

        list_res = client.get("/api/dispositivos", headers={"Authorization": f"Bearer {adm_token}"})
        assert list_res.status_code == 200
        items = list_res.json()["items"]
        target = next(d for d in items if d["mac_address"] == "AA:11:22:33:44:55")
        assert "mqtt_password" not in target
        assert "mqtt_password_hash" not in target

        detail_res = client.get(
            f"/api/dispositivos/{target['id_dispositivo']}",
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert detail_res.status_code == 200
        assert detail_res.json()["dispositivo"]["codigo"] == target["codigo"]

        upd_res = client.put(
            f"/api/dispositivos/{target['id_dispositivo']}",
            json={
                "nombre": "Nodo Bioterio Actualizado",
                "mac_address": "BB:11:22:33:44:66",
                "tipo": "Gateway",
                "firmware_version": "v3.0.0",
                "ubicacion": "Cámara fría",
                "observacion_tecnica": "Migrado a Gateway",
            },
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert upd_res.status_code == 200
        updated = upd_res.json()["dispositivo"]
        assert updated["nombre"] == "Nodo Bioterio Actualizado"
        assert updated["mac_address"] == "BB:11:22:33:44:66"
        assert updated["tipo"] == "Gateway"
        assert updated["firmware_version"] == "v3.0.0"


def test_rf02_rn03_desactivacion_logica_y_proteccion_historial():
    with TestClient(app) as client:
        adm_token = _login_token(client, "admin.rf02@simoa-ejemplo.org", "AdminPass123!")

        list_res = client.get("/api/dispositivos", headers={"Authorization": f"Bearer {adm_token}"})
        target = next(d for d in list_res.json()["items"] if d["mac_address"] == "BB:11:22:33:44:66")
        disp_id = target["id_dispositivo"]

        # Insertar una medición histórica real en MySQL para probar RN-03
        with db_cursor() as cursor:
            cursor.execute(
                "INSERT INTO mediciones (dispositivo_id, temperatura, humedad) VALUES (%s, 22.5, 55.0)",
                (disp_id,),
            )

        # Intentar eliminación física debe fallar por RN-03 (409 Conflict)
        del_res = client.delete(
            f"/api/dispositivos/{disp_id}",
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert del_res.status_code == 409

        # Desactivación lógica debe funcionar y conservar el historial
        deact_res = client.patch(
            f"/api/dispositivos/{disp_id}/desactivar",
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert deact_res.status_code == 200
        assert deact_res.json()["dispositivo"]["estado"] == "INACTIVO"
        assert deact_res.json()["dispositivo"]["historial_mediciones_count"] == 1


def test_rf02_rbac_solo_admin_registra_edita_y_desactiva():
    with TestClient(app) as client:
        # Sin token -> 401
        assert client.get("/api/dispositivos").status_code == 401

        op_token = _login_token(client, "operador.rf02@simoa-ejemplo.org", "OperadorPass123!")
        tec_token = _login_token(client, "tecnico.rf02@simoa-ejemplo.org", "TecnicoPass123!")
        sup_token = _login_token(client, "supervisor.rf02@simoa-ejemplo.org", "SupervisorPass123!")

        # Operador, Técnico y Supervisor pueden consultar inventario
        assert client.get("/api/dispositivos", headers={"Authorization": f"Bearer {op_token}"}).status_code == 200
        assert client.get("/api/dispositivos", headers={"Authorization": f"Bearer {tec_token}"}).status_code == 200
        assert client.get("/api/dispositivos", headers={"Authorization": f"Bearer {sup_token}"}).status_code == 200

        # Pero ninguno de los 3 puede crear, actualizar ni desactivar dispositivos
        payload = {
            "nombre": "Nodo No Autorizado",
            "mac_address": "CC:11:22:33:44:77",
            "tipo": "ESP32",
            "firmware_version": "v1.0.0",
            "ubicacion": "Laboratorio",
        }
        for tok in (op_token, tec_token, sup_token):
            assert (
                client.post("/api/dispositivos", json=payload, headers={"Authorization": f"Bearer {tok}"}).status_code
                == 403
            )
            assert (
                client.put("/api/dispositivos/dev-x", json=payload, headers={"Authorization": f"Bearer {tok}"}).status_code
                == 403
            )
            assert (
                client.patch("/api/dispositivos/dev-x/desactivar", headers={"Authorization": f"Bearer {tok}"}).status_code
                == 403
            )
