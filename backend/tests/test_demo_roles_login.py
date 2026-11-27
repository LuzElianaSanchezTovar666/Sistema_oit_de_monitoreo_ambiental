"""
Prueba de inicio de sesión para los 3 roles demo de SIMOA:
- Técnico: tecnico@simoa.org
- Operador: operador@simoa.org
- Supervisor: supervisor@simoa.org
"""

from pathlib import Path
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app
from app.seed_demo_users import DEMO_USERS, seed_demo_users


@pytest.fixture(scope="module", autouse=True)
def setup_roles():
    seed_demo_users()


def test_login_demo_roles():
    assert {user["rol"] for user in DEMO_USERS} == {"Técnico", "Operador", "Supervisor"}
    with TestClient(app) as client:
        for u in DEMO_USERS:
            res = client.post(
                "/api/auth/login",
                json={"correo": u["correo"], "password": u["password"]},
            )
            assert res.status_code == 200, f"Error iniciando sesión para {u['rol']}: {res.text}"
            data = res.json()
            assert "access_token" in data
            assert data["user"]["rol"] == u["rol"]
            assert data["user"]["correo"] == u["correo"]
            assert data["user"]["estado"] == "activo"
