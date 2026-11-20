from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from ..dependencies import require_roles
from ..services.thresholds_service import (
    get_effective_sensor_thresholds,
    get_sensor_threshold_history,
    list_all_threshold_configs,
    upsert_sensor_thresholds,
)

router = APIRouter(prefix="/api/configuraciones", tags=["configuraciones-rf12"])


class ThresholdUpsertBody(BaseModel):
    sensor_id: Optional[str] = Field(default=None, min_length=1, max_length=64)
    temp_min: Optional[Any] = None
    temp_max: Optional[Any] = None
    temp_critico_min: Optional[Any] = None
    temp_critico_max: Optional[Any] = None
    hum_min: Optional[Any] = None
    hum_max: Optional[Any] = None
    hum_critico_min: Optional[Any] = None
    hum_critico_max: Optional[Any] = None
    presion_min: Optional[Any] = None
    presion_max: Optional[Any] = None
    expected_version: Optional[int] = None
    motivo: Optional[str] = Field(default=None, max_length=255)


class ThresholdPostBody(ThresholdUpsertBody):
    sensor_id: str = Field(..., min_length=1, max_length=64)


@router.get("")
def list_configuraciones(
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    items = list_all_threshold_configs()
    return {"configuraciones": items, "total": len(items)}


@router.get("/{sensor_id}")
def get_configuracion_sensor(
    sensor_id: str,
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    return get_effective_sensor_thresholds(sensor_id)


@router.get("/{sensor_id}/efectiva")
def get_configuracion_efectiva_sensor(
    sensor_id: str,
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    return get_effective_sensor_thresholds(sensor_id)


@router.get("/{sensor_id}/historial")
def get_historial_umbrales_sensor(
    sensor_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    items = get_sensor_threshold_history(sensor_id, limit=limit)
    return {"sensor_id": sensor_id, "historial": items, "total": len(items)}


@router.post("")
def create_or_save_configuracion(
    payload: ThresholdPostBody,
    current_user: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> Dict[str, Any]:
    return upsert_sensor_thresholds(
        payload.sensor_id,
        payload.model_dump(),
        current_user["correo"],
    )


@router.put("/{sensor_id}")
def update_configuracion_sensor(
    sensor_id: str,
    payload: ThresholdUpsertBody,
    current_user: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> Dict[str, Any]:
    return upsert_sensor_thresholds(
        sensor_id,
        payload.model_dump(),
        current_user["correo"],
    )
