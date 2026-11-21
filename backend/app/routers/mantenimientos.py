from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
import pymysql

from ..database import db_cursor
from ..dependencies import require_roles
from ..services.device_connectivity import utc_now

router = APIRouter(prefix="/api/mantenimientos", tags=["Mantenimiento y Calibración Técnica (RF-20 y RN-22)"])

MaintenanceTypeLiteral = Literal[
    "PREVENTIVO",
    "CORRECTIVO",
    "CALIBRACION",
    "REEMPLAZO_BATERIA",
    "LIMPIEZA_SONDA",
    "ACTUALIZACION_FIRMWARE",
    "REVISION_GENERAL",
]

MaintenanceResultLiteral = Literal["EXITOSO", "PENDIENTE", "EN_OBSERVACION"]
MaintenanceStatusLiteral = Literal["COMPLETADO", "PROGRAMADO", "EN_CURSO"]


class MantenimientoCreateRequest(BaseModel):
    dispositivo_id: str = Field(..., min_length=1, max_length=64)
    sensor_id: Optional[str] = Field(default=None, max_length=64)
    tipo_mantenimiento: MaintenanceTypeLiteral = Field(default="PREVENTIVO")
    fecha_intervencion: Optional[datetime] = None
    descripcion: str = Field(..., min_length=3, max_length=1000)
    actividades_realizadas: Optional[str] = Field(default=None, max_length=2000)
    resultado: MaintenanceResultLiteral = Field(default="EXITOSO")
    observaciones: Optional[str] = Field(default=None, max_length=1000)
    proxima_fecha_sugerida: Optional[str] = Field(default=None, max_length=32)
    costo_estimado_usd: Optional[float] = Field(default=0.0, ge=0.0)
    id_alerta_relacionada: Optional[str] = Field(default=None, max_length=64)
    estado: MaintenanceStatusLiteral = Field(default="COMPLETADO")


def serialize_mantenimiento(row: Dict[str, Any]) -> Dict[str, Any]:
    fi = row.get("fecha_intervencion")
    fr = row.get("fecha_registro")
    pf = row.get("proxima_fecha_sugerida")
    return {
        "id_mantenimiento": row["id_mantenimiento"],
        "dispositivo_id": row["dispositivo_id"],
        "sensor_id": row.get("sensor_id"),
        "id_usuario_responsable": row.get("id_usuario_responsable"),
        "tecnico_id": str(row.get("id_usuario_responsable") or ""),
        "tecnico_nombre": row.get("tecnico_nombre") or "Técnico SIMOA",
        "tipo_mantenimiento": row.get("tipo_mantenimiento"),
        "fecha_intervencion": fi.isoformat() if hasattr(fi, "isoformat") else str(fi or ""),
        "fecha_realizacion": fi.isoformat() if hasattr(fi, "isoformat") else str(fi or ""),
        "descripcion": row.get("descripcion") or "",
        "actividades_realizadas": row.get("actividades_realizadas"),
        "resultado": row.get("resultado") or "EXITOSO",
        "observaciones": row.get("observaciones"),
        "proxima_fecha_sugerida": pf.isoformat() if hasattr(pf, "isoformat") else (str(pf) if pf else None),
        "costo_estimado_usd": float(row.get("costo_estimado_usd") or 0.0),
        "id_alerta_relacionada": row.get("id_alerta_relacionada"),
        "estado": row.get("estado") or "COMPLETADO",
        "fecha_registro": fr.isoformat() if hasattr(fr, "isoformat") else (str(fr) if fr else None),
    }


@router.get("")
def list_mantenimientos(
    dispositivo_id: Optional[str] = Query(default=None),
    tipo: Optional[str] = Query(default=None),
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    """Consulta el historial de intervenciones técnicas en MySQL."""
    conditions: List[str] = []
    params: List[Any] = []

    if dispositivo_id and dispositivo_id.strip() and dispositivo_id != "ALL":
        conditions.append("m.dispositivo_id = %s")
        params.append(dispositivo_id.strip())
    if tipo and tipo.strip() and tipo != "ALL":
        conditions.append("m.tipo_mantenimiento = %s")
        params.append(tipo.strip())

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with db_cursor() as cursor:
        cursor.execute(
            f"""
            SELECT m.*, d.nombre AS dispositivo_nombre, d.codigo AS dispositivo_codigo
            FROM mantenimientos m
            LEFT JOIN dispositivos d ON d.id_dispositivo = m.dispositivo_id
            {where_clause}
            ORDER BY m.fecha_intervencion DESC, m.fecha_registro DESC
            """,
            tuple(params),
        )
        rows = cursor.fetchall()

    return {
        "items": [
            {
                **serialize_mantenimiento(r),
                "dispositivo_nombre": r.get("dispositivo_nombre"),
                "dispositivo_codigo": r.get("dispositivo_codigo"),
            }
            for r in rows
        ],
        "total": len(rows),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_mantenimiento(
    payload: MantenimientoCreateRequest,
    current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Técnico")
    ),
) -> Dict[str, Any]:
    """RN-22: Solo Administrador y Técnico pueden registrar mantenimientos."""
    now = utc_now()
    fecha_int = payload.fecha_intervencion or now
    mnt_id = f"mnt-{uuid.uuid4().hex[:8]}"

    with db_cursor() as cursor:
        cursor.execute(
            "SELECT id_dispositivo FROM dispositivos WHERE id_dispositivo = %s",
            (payload.dispositivo_id,),
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dispositivo '{payload.dispositivo_id}' no encontrado.",
            )

        if payload.sensor_id:
            cursor.execute(
                "SELECT id_sensor FROM sensores WHERE id_sensor = %s AND dispositivo_id = %s",
                (payload.sensor_id, payload.dispositivo_id),
            )
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El sensor especificado no pertenece a este dispositivo.",
                )

        if payload.id_alerta_relacionada:
            cursor.execute(
                "SELECT id_alerta FROM alertas WHERE id_alerta = %s",
                (payload.id_alerta_relacionada,),
            )
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La alerta especificada no existe.",
                )

        cursor.execute(
            """
            INSERT INTO mantenimientos (
                id_mantenimiento, dispositivo_id, sensor_id, id_usuario_responsable,
                tecnico_nombre, tipo_mantenimiento, fecha_intervencion, descripcion,
                actividades_realizadas, resultado, observaciones, proxima_fecha_sugerida,
                costo_estimado_usd, id_alerta_relacionada, estado, fecha_registro
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                mnt_id,
                payload.dispositivo_id,
                payload.sensor_id,
                int(current_user["id_usuario"]),
                current_user.get("nombre") or "Técnico SIMOA",
                payload.tipo_mantenimiento,
                fecha_int,
                payload.descripcion.strip(),
                payload.actividades_realizadas.strip() if payload.actividades_realizadas else None,
                payload.resultado,
                payload.observaciones.strip() if payload.observaciones else None,
                payload.proxima_fecha_sugerida,
                payload.costo_estimado_usd or 0.0,
                payload.id_alerta_relacionada,
                payload.estado,
                now,
            ),
        )

        cursor.execute("SELECT * FROM mantenimientos WHERE id_mantenimiento = %s", (mnt_id,))
        created = cursor.fetchone()

    return {
        "message": "Intervención técnica registrada exitosamente en MySQL.",
        "mantenimiento": serialize_mantenimiento(created),
    }


@router.get("/{id_mantenimiento}")
def get_mantenimiento(
    id_mantenimiento: str,
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT m.*, d.nombre AS dispositivo_nombre, d.codigo AS dispositivo_codigo
            FROM mantenimientos m
            LEFT JOIN dispositivos d ON d.id_dispositivo = m.dispositivo_id
            WHERE m.id_mantenimiento = %s
            LIMIT 1
            """,
            (id_mantenimiento,),
        )
        row = cursor.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mantenimiento no encontrado.",
        )

    return {"mantenimiento": serialize_mantenimiento(row)}
