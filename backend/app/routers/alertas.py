import asyncio
import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from ..dependencies import require_roles
from ..services.alerts_service import alert_stream_broadcaster, alerts_service, list_alertas

router = APIRouter(prefix="/api/alertas", tags=["alertas-rf13"])


@router.get("")
def get_alertas(
    estado: Optional[str] = Query(default=None, pattern="^(PENDIENTE|EN_ATENCION|RESUELTA)$"),
    severidad: Optional[str] = Query(default=None, pattern="^(ADVERTENCIA|CRITICA)$"),
    ubicacion_id: Optional[str] = Query(default=None, min_length=1, max_length=64),
    limit: int = Query(default=100, ge=1, le=500),
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Supervisor")
    ),
) -> Dict[str, Any]:
    items = list_alertas(
        estado=estado,
        severidad=severidad,
        ubicacion_id=ubicacion_id,
        limit=limit,
    )
    return {"alertas": items, "total": len(items)}


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
    """Canal SSE autenticado para notificaciones inmediatas de alertas RF-13."""
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
                    yield f"event: alerta\ndata: {json.dumps(alert_item, ensure_ascii=False)}\n\n"
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
