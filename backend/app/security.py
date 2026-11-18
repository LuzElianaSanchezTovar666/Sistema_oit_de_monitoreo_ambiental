from collections import defaultdict
from datetime import datetime, timedelta, timezone
import secrets
import time
from typing import Any, Dict, List
import uuid

import bcrypt
import jwt

from .config import get_settings


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
    """Limitador en memoria de intentos fallidos de login por IP/correo."""

    def __init__(self) -> None:
        self._attempts: Dict[str, List[float]] = defaultdict(list)

    def _prune(self, key: str, window: int) -> None:
        cutoff = time.monotonic() - window
        self._attempts[key] = [ts for ts in self._attempts[key] if ts > cutoff]

    def is_blocked(self, key: str) -> bool:
        settings = get_settings()
        self._prune(key, settings.rate_limit_window_seconds)
        return len(self._attempts[key]) >= settings.rate_limit_max_attempts

    def record_failure(self, key: str) -> None:
        settings = get_settings()
        self._prune(key, settings.rate_limit_window_seconds)
        self._attempts[key].append(time.monotonic())

    def reset(self, key: str) -> None:
        self._attempts.pop(key, None)


login_rate_limiter = LoginRateLimiter()
