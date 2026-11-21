import os
from pathlib import Path
import sys

import bcrypt
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.security import hash_password, verify_password
from app.database import db_cursor, run_migrations


def test_rnf04_bcrypt_cost_factor_greater_or_equal_12():
    """RNF-04: El algoritmo de hash debe ser bcrypt con factor de costo >= 12."""
    password = "SeguridadSimoa2026!#"
    hashed = hash_password(password)
    
    assert hashed.startswith("$2b$") or hashed.startswith("$2a$")
    parts = hashed.split("$")
    assert len(parts) >= 4
    cost_factor = int(parts[2])
    assert cost_factor >= 12, f"El factor de costo bcrypt es {cost_factor}, debe ser >= 12"


def test_rnf04_distinct_salts_and_no_plain_passwords():
    """RNF-04: Cada hash debe generar una sal criptográfica distinta e impedir almacenamiento en texto plano."""
    pwd = "ContrasenaValida123!"
    h1 = hash_password(pwd)
    h2 = hash_password(pwd)
    
    assert h1 != h2, "Dos hashes de la misma contraseña deben diferir por la sal única"
    assert verify_password(pwd, h1) is True
    assert verify_password(pwd, h2) is True
    assert verify_password("ContrasenaIncorrecta", h1) is False


def test_rnf04_reject_short_passwords():
    """RNF-04: Rechaza contraseñas débiles o de longitud menor a 8 caracteres."""
    with pytest.raises(ValueError, match="al menos 8 caracteres"):
        hash_password("corta")


def test_rnf04_database_users_contain_no_plaintext():
    """RNF-04: Ninguna fila en la tabla usuarios debe contener contraseñas en texto plano."""
    run_migrations()
    with db_cursor() as cursor:
        cursor.execute("SELECT id_usuario, correo, password_hash FROM usuarios")
        rows = cursor.fetchall()
        for r in rows:
            ph = r["password_hash"]
            assert ph.startswith("$2b$") or ph.startswith("$2a$"), f"Usuario {r['correo']} tiene hash no bcrypt: {ph}"
            assert len(ph) >= 59
