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


RF03_TEST_USERS = [
    ("Admin RF03", "admin.rf03@simoa-ejemplo.org", "AdminPass123!", "Administrador", "activo"),
    ("Operador RF03", "operador.rf03@simoa-ejemplo.org", "OperadorPass123!", "Operador", "activo"),
    ("Tecnico RF03", "tecnico.rf03@simoa-ejemplo.org", "TecnicoPass123!", "Técnico", "activo"),
    ("Supervisor RF03", "supervisor.rf03@simoa-ejemplo.org", "SupervisorPass123!", "Supervisor", "activo"),
]

TEST_MAC = "DD:11:22:33:44:88"
TEST_AREA_CODES = ("AREA-91", "AREA-92")


@pytest.fixture(scope="module", autouse=True)
def setup_rf03_mysql():
    run_migrations()
    login_rate_limiter.clear_all()
    emails = [u[1] for u in RF03_TEST_USERS]
    with db_cursor() as cursor:
        cursor.execute(
            "DELETE h FROM historial_ubicaciones h INNER JOIN dispositivos d ON h.dispositivo_id = d.id_dispositivo WHERE d.mac_address = %s",
            (TEST_MAC,),
        )
        cursor.execute(
            "DELETE m FROM mediciones m INNER JOIN dispositivos d ON m.dispositivo_id = d.id_dispositivo WHERE d.mac_address = %s",
            (TEST_MAC,),
        )
        cursor.execute("DELETE FROM dispositivos WHERE mac_address = %s", (TEST_MAC,))
        cursor.execute("DELETE FROM ubicaciones WHERE codigo_area IN %s", (TEST_AREA_CODES,))
        placeholders = ",".join(["%s"] * len(emails))
        cursor.execute(f"DELETE FROM usuarios WHERE correo IN ({placeholders})", tuple(emails))
        for nombre, correo, plain_pw, rol, estado in RF03_TEST_USERS:
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
            "DELETE h FROM historial_ubicaciones h INNER JOIN dispositivos d ON h.dispositivo_id = d.id_dispositivo WHERE d.mac_address = %s",
            (TEST_MAC,),
        )
        cursor.execute(
            "DELETE m FROM mediciones m INNER JOIN dispositivos d ON m.dispositivo_id = d.id_dispositivo WHERE d.mac_address = %s",
            (TEST_MAC,),
        )
        cursor.execute("DELETE FROM dispositivos WHERE mac_address = %s", (TEST_MAC,))
        cursor.execute("DELETE FROM ubicaciones WHERE codigo_area IN %s", (TEST_AREA_CODES,))
        placeholders = ",".join(["%s"] * len(emails))
        cursor.execute(f"DELETE FROM usuarios WHERE correo IN ({placeholders})", tuple(emails))
    login_rate_limiter.clear_all()


def _login_token(client: TestClient, correo: str, password: str) -> str:
    res = client.post("/api/auth/login", json={"correo": correo, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_rf03_catalogo_ubicaciones_registro_duplicado_y_campos_obligatorios():
    with TestClient(app) as client:
        adm_token = _login_token(client, "admin.rf03@simoa-ejemplo.org", "AdminPass123!")

        # Catálogo inicial contiene las 4 zonas del invernadero
        cat_res = client.get("/api/ubicaciones", headers={"Authorization": f"Bearer {adm_token}"})
        assert cat_res.status_code == 200
        names = {u["nombre"] for u in cat_res.json()["items"]}
        assert {
            "Zona de Germinación y Semilleros",
            "Zona de Cultivo Hidropónico",
            "Zona de Ventilación y Nebulización",
            "Área de Fertirriego y Nutrientes",
        }.issubset(names)

        # Registro exitoso de nueva ubicación
        create_res = client.post(
            "/api/ubicaciones",
            json={
                "nombre": "Invernadero Experimental",
                "codigo_area": "AREA-91",
                "tipo": "Invernadero",
                "descripcion": "Zona de pruebas hidropónicas",
            },
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert create_res.status_code == 201
        assert create_res.json()["ubicacion"]["codigo_area"] == "AREA-91"
        assert create_res.json()["ubicacion"]["estado"] == "ACTIVA"

        # Rechazo de código de área duplicado
        dup_res = client.post(
            "/api/ubicaciones",
            json={
                "nombre": "Otro Recinto",
                "codigo_area": "AREA-91",
                "tipo": "Fertirriego",
            },
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert dup_res.status_code == 409

        # Validación de campos obligatorios
        bad_res = client.post(
            "/api/ubicaciones",
            json={"nombre": "", "codigo_area": "", "tipo": ""},
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert bad_res.status_code == 422


def test_rf03_asignacion_reasignacion_historial_mediciones_y_rn04():
    with TestClient(app) as client:
        adm_token = _login_token(client, "admin.rf03@simoa-ejemplo.org", "AdminPass123!")

        # Crear ubicación secundaria inactiva para probar rechazo RN-04
        inact_ubi = client.post(
            "/api/ubicaciones",
            json={"nombre": "Sala Mantenimiento Temporal", "codigo_area": "AREA-92", "tipo": "Sala"},
            headers={"Authorization": f"Bearer {adm_token}"},
        ).json()["ubicacion"]
        inact_id = inact_ubi["ubicacion_id"]

        deact_ubi = client.patch(
            f"/api/ubicaciones/{inact_id}/estado",
            json={"estado": "INACTIVA"},
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert deact_ubi.status_code == 200

        # Registrar dispositivo asignado a Zona de Germinación y Semilleros (ubi-lab-01)
        dev_res = client.post(
            "/api/dispositivos",
            json={
                "nombre": "Nodo Trazabilidad RF03",
                "mac_address": TEST_MAC,
                "tipo": "ESP32",
                "firmware_version": "v2.4.0",
                "ubicacion_id": "ubi-lab-01",
            },
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert dev_res.status_code == 201
        disp_id = dev_res.json()["dispositivo"]["id_dispositivo"]
        assert dev_res.json()["dispositivo"]["ubicacion_id"] == "ubi-lab-01"
        assert dev_res.json()["dispositivo"]["ubicacion"] == "Zona de Germinación y Semilleros"

        # Insertar medición histórica mientras el dispositivo estaba en Laboratorio (ubi-lab-01)
        with db_cursor() as cursor:
            cursor.execute(
                "INSERT INTO mediciones (dispositivo_id, ubicacion_id, temperatura, humedad) VALUES (%s, %s, 21.4, 52.0)",
                (disp_id, "ubi-lab-01"),
            )

        # Rechazo de ubicación inexistente (404) e inactiva (400)
        assert (
            client.put(
                f"/api/dispositivos/{disp_id}/ubicacion",
                json={"ubicacion_id": "ubi-no-existe"},
                headers={"Authorization": f"Bearer {adm_token}"},
            ).status_code
            == 404
        )
        assert (
            client.put(
                f"/api/dispositivos/{disp_id}/ubicacion",
                json={"ubicacion_id": inact_id},
                headers={"Authorization": f"Bearer {adm_token}"},
            ).status_code
            == 400
        )

        # RN-04: Impedir desactivar Laboratorio porque tiene dispositivo activo asociado
        block_deact = client.patch(
            "/api/ubicaciones/ubi-lab-01/estado",
            json={"estado": "INACTIVA"},
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert block_deact.status_code == 409

        # Reasignar dispositivo a Zona de Cultivo Hidropónico (ubi-bio-02)
        reas_res = client.put(
            f"/api/dispositivos/{disp_id}/ubicacion",
            json={"ubicacion_id": "ubi-bio-02", "motivo": "Traslado operativo"},
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert reas_res.status_code == 200
        assert reas_res.json()["dispositivo"]["ubicacion_id"] == "ubi-bio-02"
        assert reas_res.json()["dispositivo"]["ubicacion"] == "Zona de Cultivo Hidropónico"

        # Verificar historial de cambios de ubicación + usuario responsable
        hist_res = client.get(
            f"/api/dispositivos/{disp_id}/historial-ubicaciones",
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert hist_res.status_code == 200
        hist_items = hist_res.json()["items"]
        assert len(hist_items) == 2
        assert hist_items[0]["ubicacion_anterior_id"] == "ubi-lab-01"
        assert hist_items[0]["ubicacion_nueva_id"] == "ubi-bio-02"
        assert hist_items[0]["usuario_responsable_correo"] == "admin.rf03@simoa-ejemplo.org"

        # Insertar nueva medición ya estando en Bioterio (ubi-bio-02)
        with db_cursor() as cursor:
            cursor.execute(
                "INSERT INTO mediciones (dispositivo_id, ubicacion_id, temperatura, humedad) VALUES (%s, %s, 24.8, 60.5)",
                (disp_id, "ubi-bio-02"),
            )

        # Consultar dispositivos de Bioterio (debe incluir el dispositivo reasignado)
        by_ubi = client.get(
            "/api/ubicaciones/ubi-bio-02/dispositivos",
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert by_ubi.status_code == 200
        assert any(d["id_dispositivo"] == disp_id for d in by_ubi.json()["items"])

        # Filtrar Dashboard por Zona de Germinación y Semilleros: la medición histórica debe conservar ubi-lab-01
        dash_lab = client.get(
            "/api/ubicaciones/dashboard/mediciones?ubicacion_id=ubi-lab-01",
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert dash_lab.status_code == 200
        lab_meds = [m for m in dash_lab.json()["mediciones"] if m["dispositivo_id"] == disp_id]
        assert len(lab_meds) == 1
        assert lab_meds[0]["ubicacion_nombre"] == "Zona de Germinación y Semilleros"
        assert lab_meds[0]["temperatura"] == 21.4

        # Filtrar Dashboard por Zona de Cultivo Hidropónico: la nueva medición pertenece a ubi-bio-02
        dash_bio = client.get(
            "/api/ubicaciones/dashboard/mediciones?ubicacion_id=ubi-bio-02",
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert dash_bio.status_code == 200
        bio_meds = [m for m in dash_bio.json()["mediciones"] if m["dispositivo_id"] == disp_id]
        assert len(bio_meds) == 1
        assert bio_meds[0]["ubicacion_nombre"] == "Zona de Cultivo Hidropónico"
        assert bio_meds[0]["temperatura"] == 24.8


def test_rf03_rbac_restriccion_por_rol():
    with TestClient(app) as client:
        op_token = _login_token(client, "operador.rf03@simoa-ejemplo.org", "OperadorPass123!")
        tec_token = _login_token(client, "tecnico.rf03@simoa-ejemplo.org", "TecnicoPass123!")
        sup_token = _login_token(client, "supervisor.rf03@simoa-ejemplo.org", "SupervisorPass123!")

        for tok in (op_token, tec_token, sup_token):
            assert client.get("/api/ubicaciones", headers={"Authorization": f"Bearer {tok}"}).status_code == 200
            assert (
                client.post(
                    "/api/ubicaciones",
                    json={"nombre": "No Permitido", "codigo_area": "AREA-99", "tipo": "Lab"},
                    headers={"Authorization": f"Bearer {tok}"},
                ).status_code
                == 403
            )
            assert (
                client.patch(
                    "/api/ubicaciones/ubi-lab-01/estado",
                    json={"estado": "INACTIVA"},
                    headers={"Authorization": f"Bearer {tok}"},
                ).status_code
                == 403
            )
            assert (
                client.put(
                    "/api/dispositivos/dev-x/ubicacion",
                    json={"ubicacion_id": "ubi-bio-02"},
                    headers={"Authorization": f"Bearer {tok}"},
                ).status_code
                == 403
            )
