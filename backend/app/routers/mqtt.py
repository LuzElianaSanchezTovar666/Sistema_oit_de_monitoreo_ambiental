from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query

from ..database import db_cursor
from ..dependencies import require_roles
from ..services.mqtt_ingest import mqtt_service

router = APIRouter(prefix="/api/mqtt", tags=["Ingestión MQTT (RF-06)"])


@router.get("/status")
def get_mqtt_status(
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    return mqtt_service.get_status()


@router.get("/enrutados")
def get_recent_routed_events(
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    items = mqtt_service.get_recent_routed()
    return {"items": items, "total": len(items)}


@router.get("/rechazos")
def list_rejected_mqtt_messages(
    motivo: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    conditions = []
    params = []
    if motivo and motivo.strip():
        conditions.append("motivo = %s")
        params.append(motivo.strip())

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with db_cursor() as cursor:
        cursor.execute(
            f"""
            SELECT id_rechazo, topico, codigo_dispositivo, motivo, detalle, payload_resumido, fecha_hora
            FROM mqtt_mensajes_rechazados
            {where_clause}
            ORDER BY id_rechazo DESC
            LIMIT %s
            """,
            tuple(params + [limit]),
        )
        rows = cursor.fetchall()

    for row in rows:
        fh = row.get("fecha_hora")
        row["fecha_hora"] = fh.isoformat() if hasattr(fh, "isoformat") else str(fh)

    return {"items": rows, "total": len(rows)}


@router.post("/cache/invalidate")
def invalidate_mqtt_metadata_cache(
    _admin: Dict[str, Any] = Depends(require_roles("Administrador", "Técnico")),
) -> Dict[str, Any]:
    mqtt_service.invalidate_cache()
    return {"message": "Caché de metadatos MQTT invalidada."}
