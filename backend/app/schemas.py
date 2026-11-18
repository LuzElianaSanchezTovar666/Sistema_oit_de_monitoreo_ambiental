from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field

RoleType = Literal["Administrador", "Operador", "Técnico", "Supervisor"]
UserStatusType = Literal["activo", "inactivo"]


class LoginRequest(BaseModel):
    correo: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class UserProfile(BaseModel):
    id_usuario: int
    nombre: str
    correo: EmailStr
    rol: RoleType
    estado: UserStatusType
    fecha_creacion: Optional[str] = None
    fecha_actualizacion: Optional[str] = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int
    user: UserProfile
    message: str


class CreateUserRequest(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=120)
    correo: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    rol: RoleType = "Operador"
    estado: UserStatusType = "activo"


class MessageResponse(BaseModel):
    message: str
