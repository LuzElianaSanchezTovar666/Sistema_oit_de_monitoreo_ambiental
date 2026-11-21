from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import sys
import uuid

import jwt
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("JWT_SECRET_KEY", "rnf05-pytest-secret-key-hs256-32bytes")

from app.database import db_cursor, run_migrations
from app.main import app
from app.security import create_access_token, hash_password, login_rate_limiter
from app.config import get_settings


ADMIN_USER = ("Admin RNF05", "admin.rnf05@simoa.org", "AdminPass123!", "Administrador", "activo")
OPERADOR_USER = ("Operador RNF05", "operador.rnf05@simoa.org", "OperPass123!", "Operador", "activo")


@pytest.fixture(scope="module", autouse=True)
def setup_rnf05_users():
    run_migrations()
    login_rate_limiter.clear_all()
    with db_cursor() as cursor:
        for u in [ADMIN_USER, OPERADOR_USER]:
            cursor.execute("DELETE FROM usuarios WHERE correo = %s", (u[1],))
            cursor.execute(
                """
                INSERT INTO usuarios (nombre, correo, password_hash, rol, estado)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (u[0], u[1], hash_password(u[2]), u[3], u[4]),
            )
    yield
    with db_cursor() as cursor:
        for u in [ADMIN_USER, OPERADOR_USER]:
            cursor.execute("DELETE FROM usuarios WHERE correo = %s", (u[1],))
    login_rate_limiter.clear_all()


def get_token(user_tuple) -> str:
    with TestClient(app) as client:
        res = client.post("/api/auth/login", json={"correo": user_tuple[1], "password": user_tuple[2]})
        assert res.status_code == 200, res.text
        return res.json()["access_token"]


def test_rnf05_100_percent_admin_endpoints_protected():
    """RNF-05: 100% de los endpoints administrativos deben exigir rol Administrador y token JWT."""
    admin_token = get_token(ADMIN_USER)
    operador_token = get_token(OPERADOR_USER)

    admin_endpoints = [
        ("POST", "/api/auth/users", {"nombre": "Nuevo User", "correo": "nuevo@simoa.org", "password": "NewUserPass123!", "rol": "Operador"}),
        ("POST", "/api/dispositivos", {"nombre": "Nuevo Dev", "mac_address": "11:22:33:44:55:66", "tipo": "ESP32", "firmware_version": "v1.0"}),
        ("POST", "/api/ubicaciones", {"nombre": "Nueva Sala RNF05", "codigo_area": "RNF05-01", "tipo": "Laboratorio"}),
        ("POST", "/api/configuraciones", {"clave": "TEMP_MAX", "valor": "30.0"}),
        ("PATCH", "/api/dispositivos/dev-fake-id/desactivar", {}),
        ("DELETE", "/api/dispositivos/dev-fake-id", {}),
    ]

    with TestClient(app) as clean_client:
        for method, path, payload in admin_endpoints:
            # 1. Petición sin token -> 401
            res_no_auth = clean_client.request(method, path, json=payload)
            assert res_no_auth.status_code == 401, f"Ruta administrativa {method} {path} debe devolver 401 sin token (obtuvo {res_no_auth.status_code})"

            # 2. Petición con rol Operador -> 403
            res_forbidden = clean_client.request(method, path, json=payload, headers={"Authorization": f"Bearer {operador_token}"})
            assert res_forbidden.status_code == 403, f"Ruta administrativa {method} {path} debe devolver 403 a Operador (obtuvo {res_forbidden.status_code})"


def test_rnf05_token_expiration_maximum_8_hours():
    """RNF-05: El tiempo de vencimiento máximo del token de acceso es de 8 horas."""
    settings = get_settings()
    assert settings.jwt_expire_hours <= 8, f"Vigencia del JWT ({settings.jwt_expire_hours}h) no debe superar 8 horas"

    token, jti, expires_at = create_access_token(user_id=1, rol="Administrador", correo=ADMIN_USER[1])
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    
    issued_at = payload["iat"]
    exp_time = payload["exp"]
    duration_hours = (exp_time - issued_at) / 3600.0
    assert duration_hours <= 8.01, f"La duración del token ({duration_hours}h) excede 8 horas"


def test_rnf05_reject_expired_token():
    """RNF-05: Rechaza peticiones con tokens expirados con HTTP 401."""
    client = TestClient(app)
    settings = get_settings()
    now = datetime.now(timezone.utc) - timedelta(hours=9)
    expired_payload = {
        "sub": "1",
        "rol": "Administrador",
        "correo": ADMIN_USER[1],
        "jti": uuid.uuid4().hex,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=8)).timestamp()),  # Expiró hace 1 hora
    }
    expired_token = jwt.encode(expired_payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert res.status_code == 401
    assert "expirado" in res.json().get("detail", "").lower()
