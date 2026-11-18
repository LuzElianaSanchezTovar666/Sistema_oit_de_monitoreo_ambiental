from datetime import datetime, timezone
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
import pymysql

from ..config import get_settings
from ..database import db_cursor
from ..dependencies import get_current_user, require_roles
from ..schemas import (
    CreateUserRequest,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    UserProfile,
)
from ..security import (
    create_access_token,
    generate_csrf_token,
    hash_password,
    login_rate_limiter,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["Autenticación y RBAC"])


def _serialize_user(row: Dict[str, Any]) -> UserProfile:
    fc = row.get("fecha_creacion")
    fa = row.get("fecha_actualizacion")
    return UserProfile(
        id_usuario=int(row["id_usuario"]),
        nombre=row["nombre"],
        correo=row["correo"],
        rol=row["rol"],
        estado=row["estado"],
        fecha_creacion=fc.isoformat() if hasattr(fc, "isoformat") else (str(fc) if fc else None),
        fecha_actualizacion=fa.isoformat() if hasattr(fa, "isoformat") else (str(fa) if fa else None),
    )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, response: Response) -> LoginResponse:
    settings = get_settings()
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"{client_ip}:{payload.correo.lower()}"

    if login_rate_limiter.is_blocked(rate_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos fallidos. Intente nuevamente en unos minutos.",
        )

    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT id_usuario, nombre, correo, password_hash, rol, estado, fecha_creacion, fecha_actualizacion
            FROM usuarios
            WHERE correo = %s
            LIMIT 1
            """,
            (payload.correo.strip().lower(),),
        )
        user = cursor.fetchone()

    if user is None or not verify_password(payload.password, user["password_hash"]):
        login_rate_limiter.record_failure(rate_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
        )

    if user["estado"] != "activo":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta deshabilitada. Contacte al administrador",
        )

    login_rate_limiter.reset(rate_key)

    access_token, _jti, _expires_at = create_access_token(
        user_id=int(user["id_usuario"]),
        rol=user["rol"],
        correo=user["correo"],
    )
    max_age = settings.jwt_expire_hours * 3600
    csrf_token = generate_csrf_token()

    # Cookie HttpOnly para proteger el JWT frente a XSS + cookie CSRF legible por el cliente
    response.set_cookie(
        key="simoa_access_token",
        value=access_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=max_age,
        path="/",
    )
    response.set_cookie(
        key="simoa_csrf",
        value=csrf_token,
        httponly=False,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=max_age,
        path="/",
    )

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in_seconds=max_age,
        user=_serialize_user(user),
        message="Autenticación exitosa",
    )


@router.get("/me", response_model=UserProfile)
def get_me(current_user: Dict[str, Any] = Depends(get_current_user)) -> UserProfile:
    return _serialize_user(current_user)


@router.post("/logout", response_model=MessageResponse)
def logout(
    response: Response,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> MessageResponse:
    jti = current_user["token_jti"]
    exp_ts = current_user.get("token_exp")
    expires_dt = (
        datetime.fromtimestamp(int(exp_ts), tz=timezone.utc).replace(tzinfo=None)
        if exp_ts
        else datetime.now(timezone.utc).replace(tzinfo=None)
    )

    with db_cursor() as cursor:
        cursor.execute(
            """
            INSERT IGNORE INTO revoked_tokens (jti, id_usuario, expires_at)
            VALUES (%s, %s, %s)
            """,
            (jti, int(current_user["id_usuario"]), expires_dt),
        )

    response.delete_cookie(key="simoa_access_token", path="/")
    response.delete_cookie(key="simoa_csrf", path="/")
    return MessageResponse(message="Sesión cerrada y token revocado correctamente.")


@router.get("/users", response_model=List[UserProfile])
def list_users(
    _admin: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> List[UserProfile]:
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT id_usuario, nombre, correo, rol, estado, fecha_creacion, fecha_actualizacion
            FROM usuarios
            ORDER BY id_usuario ASC
            """
        )
        rows = cursor.fetchall()
    return [_serialize_user(r) for r in rows]


@router.post("/users", response_model=UserProfile, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: CreateUserRequest,
    _admin: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> UserProfile:
    try:
        pw_hash = hash_password(payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    try:
        with db_cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO usuarios (nombre, correo, password_hash, rol, estado)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    payload.nombre.strip(),
                    payload.correo.strip().lower(),
                    pw_hash,
                    payload.rol,
                    payload.estado,
                ),
            )
            new_id = cursor.lastrowid
            cursor.execute(
                """
                SELECT id_usuario, nombre, correo, rol, estado, fecha_creacion, fecha_actualizacion
                FROM usuarios
                WHERE id_usuario = %s
                """,
                (new_id,),
            )
            created = cursor.fetchone()
    except pymysql.err.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario registrado con ese correo electrónico.",
        )

    return _serialize_user(created)
