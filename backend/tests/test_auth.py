from datetime import datetime, timedelta, timezone
import os
import sys
from pathlib import Path

import jwt
import pytest
from fastapi.testclient import TestClient

# Asegurar que backend/ esté en sys.path y configurar entorno de pruebas
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

from app.config import get_settings  # noqa: E402
from app.database import db_cursor, run_migrations  # noqa: E402
from app.main import app  # noqa: E402
from app.security import hash_password, login_rate_limiter  # noqa: E402


TEST_USERS = [
    ("Admin Test", "admin.test@simoa-ejemplo.org", "AdminPass123!", "Administrador", "activo"),
    ("Operador Test", "operador.test@simoa-ejemplo.org", "OperadorPass123!", "Operador", "activo"),
    ("Tecnico Test", "tecnico.test@simoa-ejemplo.org", "TecnicoPass123!", "Técnico", "activo"),
    ("Supervisor Test", "supervisor.test@simoa-ejemplo.org", "SupervisorPass123!", "Supervisor", "activo"),
    ("Inactivo Test", "inactivo.test@simoa-ejemplo.org", "InactivoPass123!", "Operador", "inactivo"),
]


@pytest.fixture(scope="module", autouse=True)
def setup_mysql_test_users():
    run_migrations()
    emails = [u[1] for u in TEST_USERS]
    with db_cursor() as cursor:
        placeholders = ",".join(["%s"] * len(emails))
        cursor.execute(f"DELETE FROM usuarios WHERE correo IN ({placeholders})", tuple(emails))
        for nombre, correo, plain_pw, rol, estado in TEST_USERS:
            cursor.execute(
                """
                INSERT INTO usuarios (nombre, correo, password_hash, rol, estado)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (nombre, correo, hash_password(plain_pw), rol, estado),
            )
    yield
    with db_cursor() as cursor:
        placeholders = ",".join(["%s"] * len(emails))
        cursor.execute(f"DELETE FROM usuarios WHERE correo IN ({placeholders})", tuple(emails))
        cursor.execute("DELETE FROM dispositivos WHERE mac_address IN ('AA:BB:CC:11:22:33', 'AA:BB:CC:11:22:99')")


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    login_rate_limiter.clear_all()
    yield
    login_rate_limiter.clear_all()


def test_rn01_rechaza_password_menor_8_caracteres():
    with pytest.raises(ValueError):
        hash_password("1234567")


def test_login_exitoso_emite_jwt_8h_y_cookie_httponly():
    with TestClient(app) as client:
        res = client.post(
            "/api/auth/login",
            json={"correo": "admin.test@simoa-ejemplo.org", "password": "AdminPass123!"},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["token_type"] == "bearer"
        assert body["expires_in_seconds"] == 8 * 3600
        assert body["user"]["correo"] == "admin.test@simoa-ejemplo.org"
        assert body["user"]["rol"] == "Administrador"
        assert "password_hash" not in body["user"]

        # Verificar payload del JWT HS256
        settings = get_settings()
        decoded = jwt.decode(body["access_token"], settings.jwt_secret_key, algorithms=["HS256"])
        assert decoded["rol"] == "Administrador"
        assert decoded["sub"] == str(body["user"]["id_usuario"])
        assert decoded["exp"] - decoded["iat"] == 8 * 3600

        # Verificar cookie HttpOnly emitida
        assert "simoa_access_token" in res.cookies


def test_login_contrasena_incorrecta():
    with TestClient(app) as client:
        res = client.post(
            "/api/auth/login",
            json={"correo": "admin.test@simoa-ejemplo.org", "password": "WrongPassword!"},
        )
        assert res.status_code == 401
        assert res.json()["detail"] == "Correo o contraseña incorrectos"


def test_login_correo_inexistente():
    with TestClient(app) as client:
        res = client.post(
            "/api/auth/login",
            json={"correo": "noexiste@simoa-ejemplo.org", "password": "AdminPass123!"},
        )
        assert res.status_code == 401
        assert res.json()["detail"] == "Correo o contraseña incorrectos"


def test_login_usuario_inactivo():
    with TestClient(app) as client:
        res = client.post(
            "/api/auth/login",
            json={"correo": "inactivo.test@simoa-ejemplo.org", "password": "InactivoPass123!"},
        )
        assert res.status_code == 403
        assert res.json()["detail"] == "Cuenta deshabilitada. Contacte al administrador"


def test_acceso_sin_token_rechazado():
    with TestClient(app) as client:
        res = client.get("/api/auth/me")
        assert res.status_code == 401


def test_token_invalido_rechazado():
    with TestClient(app) as client:
        res = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer token.invalido.firma"},
        )
        assert res.status_code == 401


def test_token_vencido_rechazado():
    settings = get_settings()
    expired_payload = {
        "sub": "1",
        "rol": "Administrador",
        "jti": "expired-jti-test",
        "exp": int((datetime.now(timezone.utc) - timedelta(minutes=5)).timestamp()),
    }
    expired_token = jwt.encode(expired_payload, settings.jwt_secret_key, algorithm="HS256")
    with TestClient(app) as client:
        res = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert res.status_code == 401


def test_consulta_perfil_con_token_valido():
    with TestClient(app) as client:
        login_res = client.post(
            "/api/auth/login",
            json={"correo": "operador.test@simoa-ejemplo.org", "password": "OperadorPass123!"},
        )
        token = login_res.json()["access_token"]

        me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_res.status_code == 200
        assert me_res.json()["correo"] == "operador.test@simoa-ejemplo.org"
        assert me_res.json()["rol"] == "Operador"


def test_rbac_permisos_por_rol_en_backend():
    with TestClient(app) as client:
        op_token = client.post(
            "/api/auth/login",
            json={"correo": "operador.test@simoa-ejemplo.org", "password": "OperadorPass123!"},
        ).json()["access_token"]
        tec_token = client.post(
            "/api/auth/login",
            json={"correo": "tecnico.test@simoa-ejemplo.org", "password": "TecnicoPass123!"},
        ).json()["access_token"]
        sup_token = client.post(
            "/api/auth/login",
            json={"correo": "supervisor.test@simoa-ejemplo.org", "password": "SupervisorPass123!"},
        ).json()["access_token"]
        adm_token = client.post(
            "/api/auth/login",
            json={"correo": "admin.test@simoa-ejemplo.org", "password": "AdminPass123!"},
        ).json()["access_token"]

        # Operador NO puede crear dispositivos (solo Admin) ni consultar reportes (Admin/Supervisor)
        assert (
            client.post(
                "/api/devices",
                json={"nombre": "ESP32-X", "mac_address": "AA:BB:CC:11:22:33", "ubicacion_id": "loc-1"},
                headers={"Authorization": f"Bearer {op_token}"},
            ).status_code
            == 403
        )
        assert (
            client.get("/api/reports/summary", headers={"Authorization": f"Bearer {op_token}"}).status_code
            == 403
        )
        # Operador SÍ puede consultar mediciones y alertas
        assert (
            client.get("/api/measurements", headers={"Authorization": f"Bearer {op_token}"}).status_code
            == 200
        )

        # Técnico SÍ puede actualizar info técnica, pero NO configurar alertas (solo Admin)
        assert (
            client.patch(
                "/api/devices/dev-1/technical",
                json={"firmware_version": "v2.5", "observacion_tecnica": "Antena calibrada"},
                headers={"Authorization": f"Bearer {tec_token}"},
            ).status_code
            == 200
        )
        assert (
            client.put(
                "/api/alerts/config",
                json={"sensor_id": "sen-1", "temp_min": 18.0, "temp_max": 26.0},
                headers={"Authorization": f"Bearer {tec_token}"},
            ).status_code
            == 403
        )

        # Supervisor SÍ puede consultar reportes
        assert (
            client.get("/api/reports/summary", headers={"Authorization": f"Bearer {sup_token}"}).status_code
            == 200
        )

        # Administrador SÍ puede crear dispositivos y configurar alertas
        assert (
            client.post(
                "/api/devices",
                json={"nombre": "ESP32-Admin", "mac_address": "AA:BB:CC:11:22:99", "ubicacion_id": "loc-1"},
                headers={"Authorization": f"Bearer {adm_token}"},
            ).status_code
            == 201
        )


def test_logout_revoca_token_en_mysql():
    with TestClient(app) as client:
        login_res = client.post(
            "/api/auth/login",
            json={"correo": "supervisor.test@simoa-ejemplo.org", "password": "SupervisorPass123!"},
        )
        token = login_res.json()["access_token"]

        # Token válido antes del logout
        assert (
            client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code
            == 200
        )

        # Logout revoca el jti en MySQL
        logout_res = client.post(
            "/api/auth/logout",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert logout_res.status_code == 200

        # Token revocado ya no es aceptado
        after_res = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert after_res.status_code == 401
