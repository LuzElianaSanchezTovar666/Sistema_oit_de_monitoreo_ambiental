from datetime import datetime, timedelta, timezone
import secrets
from typing import Any, Dict
import uuid

import bcrypt
import jwt

from .config import get_settings
from .database import db_cursor


def hash_password(plain_password: str) -> str:
    """Genera un hash bcrypt seguro exigiendo mínimo 8 caracteres (RN-01, RN-03)."""
    if len(plain_password) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres.")
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verifica la contraseña en texto plano contra el hash bcrypt almacenado."""
    if not plain_password or not password_hash:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: int, rol: str, correo: str) -> tuple[str, str, datetime]:
    """Emite un JWT firmado con HS256 y vigencia de 8 horas (RN-06)."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=settings.jwt_expire_hours)
    jti = uuid.uuid4().hex

    payload: Dict[str, Any] = {
        "sub": str(user_id),
        "rol": rol,
        "correo": correo,
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, jti, expires_at


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decodifica y valida firma y expiración del JWT HS256."""
    settings = get_settings()
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
        options={"require": ["sub", "rol", "jti", "exp"]},
    )


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


class LoginRateLimiter:
    """Limitador persistente en MySQL de intentos fallidos de login (apto para múltiples workers)."""

    def _cutoff(self) -> datetime:
        settings = get_settings()
        return datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(
            seconds=settings.rate_limit_window_seconds
        )

    def is_blocked(self, key: str) -> bool:
        settings = get_settings()
        cutoff = self._cutoff()
        with db_cursor() as cursor:
            cursor.execute(
                "DELETE FROM login_attempts WHERE attempt_key = %s AND attempted_at < %s",
                (key, cutoff),
            )
            cursor.execute(
                "SELECT COUNT(*) AS cnt FROM login_attempts WHERE attempt_key = %s AND attempted_at >= %s",
                (key, cutoff),
            )
            row = cursor.fetchone()
            return bool(row and int(row["cnt"]) >= settings.rate_limit_max_attempts)

    def record_failure(self, key: str) -> None:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        with db_cursor() as cursor:
            cursor.execute(
                "INSERT INTO login_attempts (attempt_key, attempted_at) VALUES (%s, %s)",
                (key, now),
            )

    def reset(self, key: str) -> None:
        with db_cursor() as cursor:
            cursor.execute("DELETE FROM login_attempts WHERE attempt_key = %s", (key,))

    def clear_all(self) -> None:
        with db_cursor() as cursor:
            cursor.execute("DELETE FROM login_attempts")


login_rate_limiter = LoginRateLimiter()
