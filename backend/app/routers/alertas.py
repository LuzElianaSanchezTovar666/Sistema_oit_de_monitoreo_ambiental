import asyncio
import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..dependencies import require_roles
from ..services.alerts_service import (
    alert_stream_broadcaster,
    alerts_service,
    get_alerta_by_id,
    get_alerta_historial,
    list_alertas,
    list_alertas_paginated,
    transition_alerta_estado,
)

router = APIRouter(prefix="/api/alertas", tags=["alertas-rf13-rf14"])


class AlertEstadoUpdateBody(BaseModel):
    estado_nuevo: str = Field(..., min_length=1, max_length=24)
    accion_correctiva: Optional[str] = Field(default=None, max_length=2000)
    causa_raiz: Optional[str] = Field(default=None, max_length=255)
    observaciones: Optional[str] = Field(default=None, max_length=2000)
    expected_version: Optional[int] = None


@router.get("")
def get_alertas(
    estado: Optional[str] = Query(default=None, pattern="^(PENDIENTE|ATENDIDA|EN_ATENCION|RESUELTA)$"),
    severidad: Optional[str] = Query(default=None, pattern="^(ADVERTENCIA|CRITICA)$"),
    ubicacion_id: Optional[str] = Query(default=None, min_length=1, max_length=64),
    dispositivo_id: Optional[str] = Query(default=None, min_length=1, max_length=64),
    sensor_id: Optional[str] = Query(default=None, min_length=1, max_length=64),
    fecha_inicio: Optional[str] = Query(default=None, max_length=40),
    fecha_fin: Optional[str] = Query(default=None, max_length=40),
    tz_offset_minutes: int = Query(default=0, ge=-840, le=840),
    search: Optional[str] = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    limit: Optional[int] = Query(default=None, ge=1, le=500),
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Supervisor")
    ),
) -> Dict[str, Any]:
    effective_page_size = limit if limit is not None else page_size
    return list_alertas_paginated(
        estado=estado,
        severidad=severidad,
        ubicacion_id=ubicacion_id,
        dispositivo_id=dispositivo_id,
        sensor_id=sensor_id,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        tz_offset_minutes=tz_offset_minutes,
        search=search,
        page=page,
        page_size=effective_page_size,
    )


@router.get("/estado-servicio")
def get_alertas_service_status(
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Supervisor")
    ),
) -> Dict[str, Any]:
    return alerts_service.get_stats()


@router.get("/stream")
async def stream_alertas(
    request: Request,
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Supervisor")
    ),
) -> StreamingResponse:
    """Canal SSE autenticado para alertas automáticas RF-13 y actualizaciones de estado RF-14."""
    initial_alerts = list_alertas(limit=50)
    loop = asyncio.get_running_loop()
    q = alert_stream_broadcaster.subscribe(loop)

    async def event_generator():
        try:
            yield f"event: snapshot\ndata: {json.dumps({'alertas': initial_alerts}, ensure_ascii=False)}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    alert_item = await asyncio.wait_for(q.get(), timeout=15.0)
                    ev_name = alert_item.get("event_type") or "alerta"
                    yield f"event: {ev_name}\ndata: {json.dumps(alert_item, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    yield "event: heartbeat\ndata: {}\n\n"
        finally:
            alert_stream_broadcaster.unsubscribe(loop, q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{alerta_id}")
def get_alerta_detalle(
    alerta_id: str,
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Supervisor")
    ),
) -> Dict[str, Any]:
    return {"alerta": get_alerta_by_id(alerta_id)}


@router.get("/{alerta_id}/historial")
def get_alerta_audit_historial(
    alerta_id: str,
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Supervisor")
    ),
) -> Dict[str, Any]:
    items = get_alerta_historial(alerta_id)
    return {"alerta_id": alerta_id, "historial": items, "total": len(items)}


@router.patch("/{alerta_id}/estado")
def patch_alerta_estado(
    alerta_id: str,
    payload: AlertEstadoUpdateBody,
    current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Supervisor")
    ),
) -> Dict[str, Any]:
    updated = transition_alerta_estado(
        alerta_id=alerta_id,
        estado_nuevo_raw=payload.estado_nuevo,
        current_user=current_user,
        accion_correctiva=payload.accion_correctiva,
        causa_raiz=payload.causa_raiz,
        observaciones=payload.observaciones,
        expected_version=payload.expected_version,
    )
    return {
        "message": f"Alerta actualizada a estado {updated['estado']} y registrada en bitácora.",
        "alerta": updated,
    }
