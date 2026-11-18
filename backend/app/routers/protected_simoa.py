from typing import Any, Dict
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

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
    return {
        "status": "ok",
        "usuario": current_user["nombre"],
        "rol": current_user["rol"],
        "modulos_autorizados": {
            "Administrador": ["dashboard", "devices", "alerts", "analytics", "ai", "maintenance", "users"],
            "Operador": ["dashboard", "devices", "alerts", "analytics"],
            "Técnico": ["dashboard", "devices", "maintenance"],
            "Supervisor": ["dashboard", "alerts", "analytics", "reports"],
        }.get(current_user["rol"], ["dashboard"]),
    }


@router.get("/devices")
def list_devices(
    current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    return {"rol": current_user["rol"], "permiso": "lectura_dispositivos"}


@router.post("/devices", status_code=status.HTTP_201_CREATED)
def create_device(
    payload: DeviceCreatePayload,
    current_user: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> Dict[str, Any]:
    return {
        "message": "Dispositivo autorizado para registro por Administrador.",
        "creado_por": current_user["correo"],
        "dispositivo": payload.model_dump(),
    }


@router.patch("/devices/{device_id}/technical")
def update_device_technical(
    device_id: str,
    payload: DeviceTechnicalUpdatePayload,
    current_user: Dict[str, Any] = Depends(require_roles("Administrador", "Técnico")),
) -> Dict[str, Any]:
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
    return {
        "message": "Umbrales de alerta actualizados por Administrador.",
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
