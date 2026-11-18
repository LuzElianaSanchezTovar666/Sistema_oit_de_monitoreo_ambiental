from typing import Any, Callable, Dict, Tuple
from fastapi import Depends, HTTPException, Request, status
import jwt

from .database import db_cursor
from .security import decode_access_token

SAFE_MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _extract_token_and_source(request: Request) -> Tuple[str, str]:
    auth_header = request.headers.get("Authorization", "").strip()
    if auth_header:
        parts = auth_header.split(" ", 1)
        if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Esquema de autorización Bearer inválido.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return parts[1].strip(), "bearer"

    cookie_token = request.cookies.get("simoa_access_token", "").strip()
    if cookie_token:
        return cookie_token, "cookie"

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autenticado. Se requiere token de acceso.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(request: Request) -> Dict[str, Any]:
    token, source = _extract_token_and_source(request)

    # Protección CSRF Double-Submit cuando la sesión viaja en cookie HttpOnly en métodos mutantes
    if source == "cookie" and request.method.upper() in SAFE_MUTATING_METHODS:
        csrf_cookie = request.cookies.get("simoa_csrf", "")
        csrf_header = request.headers.get("X-CSRF-Token", "")
        if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Token CSRF inválido o ausente.",
            )

    try:
        payload = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El token de sesión ha expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acceso inválido.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    jti = payload.get("jti")
    sub = payload.get("sub")
    if not jti or not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acceso malformado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(sub)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identificador de usuario inválido en token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    with db_cursor() as cursor:
        cursor.execute("SELECT 1 FROM revoked_tokens WHERE jti = %s LIMIT 1", (jti,))
        if cursor.fetchone() is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="La sesión fue cerrada o el token fue revocado.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        cursor.execute(
            """
            SELECT id_usuario, nombre, correo, rol, estado, fecha_creacion, fecha_actualizacion
            FROM usuarios
            WHERE id_usuario = %s
            LIMIT 1
            """,
            (user_id,),
        )
        user = cursor.fetchone()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user["estado"] != "activo":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta deshabilitada. Contacte al administrador",
        )

    user["token_jti"] = jti
    user["token_exp"] = payload.get("exp")
    return user


def require_roles(*allowed_roles: str) -> Callable[[Dict[str, Any]], Dict[str, Any]]:
    """Dependencia RBAC aplicada en el backend para restringir operaciones por rol."""

    def _role_checker(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        if current_user["rol"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene permisos suficientes para realizar esta operación.",
            )
        return current_user

    return _role_checker
