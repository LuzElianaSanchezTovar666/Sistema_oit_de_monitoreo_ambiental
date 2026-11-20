import asyncio
from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse

from ..database import db_cursor
from ..dependencies import require_roles
from ..services.live_telemetry import (
    FRESHNESS_MAX_SECONDS,
    get_location_temperature_snapshot,
    live_temperature_broadcaster,
)
from ..services.measurement_persistence import measurement_persister

router = APIRouter(prefix="/api/mediciones", tags=["Mediciones Persistentes UTC (RF-07)"])


def _parse_utc_query_dt(raw: Optional[str]) -> Optional[datetime]:
    if not raw or not raw.strip():
        return None
    cleaned = raw.strip()
    if cleaned.endswith("Z"):
        cleaned = cleaned[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(cleaned)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de fecha/hora inválido. Use ISO-8601 (UTC).",
        )
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _serialize_medicion(row: Dict[str, Any]) -> Dict[str, Any]:
    fh = row.get("fecha_hora")
    if hasattr(fh, "isoformat"):
        fecha_utc = fh.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    else:
        fecha_utc = str(fh)

    return {
        "id_medicion": int(row["id_medicion"]),
        "dispositivo_id": row["dispositivo_id"],
        "sensor_id": row.get("sensor_id"),
        "ubicacion_id": row.get("ubicacion_id"),
        "temperatura": float(row["temperatura"]) if row.get("temperatura") is not None else None,
        "humedad": float(row["humedad"]) if row.get("humedad") is not None else None,
        "presion": float(row["presion"]) if row.get("presion") is not None else None,
        "alerta_generada": bool(row.get("alerta_generada")),
        "es_fuera_de_umbral": (
            bool(row["es_fuera_de_umbral"]) if row.get("es_fuera_de_umbral") is not None else None
        ),
        "score_anomalia_ia": (
            float(row["score_anomalia_ia"]) if row.get("score_anomalia_ia") is not None else None
        ),
        "configuracion_id": row.get("configuracion_id"),
        "variables_activas_snapshot": row.get("variables_activas_snapshot"),
        "fecha_hora_utc": fecha_utc,
    }


@router.get("/rf07/status")
def get_rf07_status(
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    return measurement_persister.get_status()


@router.get("")
def list_mediciones(
    sensor_id: Optional[str] = Query(default=None),
    dispositivo_id: Optional[str] = Query(default=None),
    ubicacion_id: Optional[str] = Query(default=None),
    desde: Optional[str] = Query(default=None),
    hasta: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    """Consulta mediciones almacenadas en UTC (compatible con RF-10, RF-11, RF-16 y RF-18).
    RN-09: Solo lectura; no existen endpoints de modificación o eliminación.
    """
    conditions: List[str] = []
    params: List[Any] = []

    if sensor_id and sensor_id.strip():
        conditions.append("sensor_id = %s")
        params.append(sensor_id.strip())
    if dispositivo_id and dispositivo_id.strip():
        conditions.append("dispositivo_id = %s")
        params.append(dispositivo_id.strip())
    if ubicacion_id and ubicacion_id.strip():
        conditions.append("ubicacion_id = %s")
        params.append(ubicacion_id.strip())

    desde_dt = _parse_utc_query_dt(desde)
    hasta_dt = _parse_utc_query_dt(hasta)
    if desde_dt is not None:
        conditions.append("fecha_hora >= %s")
        params.append(desde_dt)
    if hasta_dt is not None:
        conditions.append("fecha_hora <= %s")
        params.append(hasta_dt)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with db_cursor() as cursor:
        cursor.execute(
            f"""
            SELECT id_medicion, dispositivo_id, sensor_id, ubicacion_id,
                   temperatura, humedad, presion,
                   alerta_generada, es_fuera_de_umbral, score_anomalia_ia,
                   configuracion_id, variables_activas_snapshot, fecha_hora
            FROM mediciones
            {where_clause}
            ORDER BY fecha_hora DESC, id_medicion DESC
            LIMIT %s
            """,
            tuple(params + [limit]),
        )
        rows = cursor.fetchall()

    items = [_serialize_medicion(r) for r in rows]
    return {"items": items, "total": len(items), "zona_horaria": "UTC"}


@router.get("/{id_medicion}")
def get_medicion_by_id(
    id_medicion: int,
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT id_medicion, dispositivo_id, sensor_id, ubicacion_id,
                   temperatura, humedad, presion,
                   alerta_generada, es_fuera_de_umbral, score_anomalia_ia,
                   configuracion_id, variables_activas_snapshot, fecha_hora
            FROM mediciones
            WHERE id_medicion = %s
            LIMIT 1
            """,
            (id_medicion,),
        )
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medición no encontrada.")

    return {"medicion": _serialize_medicion(row), "zona_horaria": "UTC"}


@router.get("/ubicacion/{ubicacion_id}/temperatura-actual")
def get_ubicacion_temperatura_actual(
    ubicacion_id: str,
    freshness_seconds: int = Query(default=FRESHNESS_MAX_SECONDS, ge=5, le=300),
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    """RF-08: Consulta la temperatura actual (°C), límites reales y Z-Score estadístico de la ubicación."""
    snapshot = get_location_temperature_snapshot(ubicacion_id, freshness_max_seconds=freshness_seconds)
    if snapshot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ubicación no encontrada.")
    return snapshot


@router.get("/stream/temperatura")
async def stream_ubicacion_temperatura(
    request: Request,
    ubicacion_id: str = Query(..., min_length=1, max_length=64),
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> StreamingResponse:
    """RF-08: Canal SSE autenticado en tiempo real conectado post-COMMIT de RF-07."""
    initial = get_location_temperature_snapshot(ubicacion_id)
    if initial is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ubicación no encontrada.")

    sensor_id = initial.get("sensor_id")
    loop = asyncio.get_running_loop()
    sub_queue = live_temperature_broadcaster.subscribe(sensor_id, loop) if sensor_id else None

    async def event_generator():
        try:
            yield f"event: snapshot\ndata: {json.dumps(initial, ensure_ascii=False)}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                if sub_queue is None:
                    await asyncio.sleep(10.0)
                    yield f"event: heartbeat\ndata: {json.dumps({'ubicacion_id': ubicacion_id})}\n\n"
                    continue
                try:
                    payload = await asyncio.wait_for(sub_queue.get(), timeout=15.0)
                    yield f"event: temperatura\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    yield f"event: heartbeat\ndata: {json.dumps({'ubicacion_id': ubicacion_id})}\n\n"
        finally:
            if sensor_id and sub_queue is not None:
                live_temperature_broadcaster.unsubscribe(sensor_id, loop, sub_queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
