from typing import Any, Dict
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import pymysql

from ..database import db_cursor
from ..dependencies import require_roles

router = APIRouter(prefix="/api", tags=["Recursos Protegidos SIMOA (RBAC)"])


class DeviceCreatePayload(BaseModel):
    nombre: str
    mac_address: str
    ubicacion_id: str


class DeviceTechnicalUpdatePayload(BaseModel):
    firmware_version: str
    observacion_tecnica: str


class AlertConfigPayload(BaseModel):
    sensor_id: str
    temp_min: float
    temp_max: float


@router.get("/dashboard/summary")
def get_dashboard_summary(
    current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    with db_cursor() as cursor:
        cursor.execute("SELECT COUNT(*) AS total_dispositivos FROM dispositivos")
        row = cursor.fetchone()
    return {
        "status": "ok",
        "usuario": current_user["nombre"],
        "rol": current_user["rol"],
        "total_dispositivos_mysql": int(row["total_dispositivos"]) if row else 0,
        "modulos_autorizados": {
            "Administrador": ["dashboard", "devices", "alerts", "analytics", "ai", "maintenance", "users"],
            "Operador": ["dashboard", "devices", "alerts", "analytics"],
            "Técnico": ["dashboard", "devices", "maintenance"],
            "Supervisor": ["dashboard", "devices", "alerts", "analytics", "ai"],
        }.get(current_user["rol"], ["dashboard"]),
    }


@router.get("/devices")
def list_devices(
    current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT id_dispositivo, nombre, mac_address, ubicacion_id, estado, firmware_version, observacion_tecnica
            FROM dispositivos
            ORDER BY id_dispositivo ASC
            """
        )
        items = cursor.fetchall()
    return {"rol": current_user["rol"], "permiso": "lectura_dispositivos", "items": items}


@router.post("/devices", status_code=status.HTTP_201_CREATED)
def create_device(
    payload: DeviceCreatePayload,
    current_user: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> Dict[str, Any]:
    device_id = f"dev-{uuid.uuid4().hex[:8]}"
    try:
        with db_cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO dispositivos (id_dispositivo, nombre, mac_address, ubicacion_id, creado_por)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    device_id,
                    payload.nombre.strip(),
                    payload.mac_address.strip().upper(),
                    payload.ubicacion_id.strip(),
                    current_user["correo"],
                ),
            )
    except pymysql.err.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un dispositivo registrado con esa dirección MAC.",
        )

    return {
        "message": "Dispositivo registrado en MySQL por Administrador.",
        "id_dispositivo": device_id,
        "creado_por": current_user["correo"],
        "dispositivo": payload.model_dump(),
    }


@router.patch("/devices/{device_id}/technical")
def update_device_technical(
    device_id: str,
    payload: DeviceTechnicalUpdatePayload,
    current_user: Dict[str, Any] = Depends(require_roles("Administrador", "Técnico")),
) -> Dict[str, Any]:
    with db_cursor() as cursor:
        cursor.execute(
            """
            UPDATE dispositivos
            SET firmware_version = %s, observacion_tecnica = %s
            WHERE id_dispositivo = %s
            """,
            (payload.firmware_version.strip(), payload.observacion_tecnica.strip(), device_id),
        )
    return {
        "message": "Información técnica actualizada.",
        "device_id": device_id,
        "actualizado_por": current_user["correo"],
        "rol": current_user["rol"],
        "datos": payload.model_dump(),
    }


@router.get("/measurements")
def list_measurements(
    current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    return {"rol": current_user["rol"], "permiso": "consulta_mediciones"}


@router.get("/alerts")
def list_alerts(
    current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Supervisor")
    ),
) -> Dict[str, Any]:
    return {"rol": current_user["rol"], "permiso": "consulta_alertas"}


@router.put("/alerts/config")
def configure_alerts(
    payload: AlertConfigPayload,
    current_user: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> Dict[str, Any]:
    if payload.temp_min >= payload.temp_max:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El límite mínimo debe ser estrictamente menor que el límite máximo.",
        )
    with db_cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO umbrales_alerta (sensor_id, temp_min, temp_max, actualizado_por)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
              temp_min = VALUES(temp_min),
              temp_max = VALUES(temp_max),
              actualizado_por = VALUES(actualizado_por)
            """,
            (payload.sensor_id, payload.temp_min, payload.temp_max, current_user["correo"]),
        )
    return {
        "message": "Umbrales de alerta guardados en MySQL por Administrador.",
        "configurado_por": current_user["correo"],
        "config": payload.model_dump(),
    }


@router.get("/reports/summary")
def get_reports_summary(
    current_user: Dict[str, Any] = Depends(require_roles("Administrador", "Supervisor")),
) -> Dict[str, Any]:
    return {
        "rol": current_user["rol"],
        "permiso": "consulta_reportes_e_indicadores",
    }
