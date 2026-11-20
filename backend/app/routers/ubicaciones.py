import re
from typing import Any, Dict, List, Literal, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
import pymysql

from ..database import db_cursor
from ..dependencies import require_roles

router = APIRouter(prefix="/api/ubicaciones", tags=["Ubicaciones Físicas (RF-03)"])

AREA_CODE_REGEX = re.compile(r"^[A-Z0-9]+-[A-Z0-9]+$")
UbicacionEstado = Literal["ACTIVA", "INACTIVA"]


class UbicacionCreateRequest(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=120)
    codigo_area: str = Field(..., min_length=3, max_length=32)
    tipo: str = Field(..., min_length=2, max_length=60)
    descripcion: Optional[str] = Field(default=None, max_length=255)

    @field_validator("nombre", "codigo_area", "tipo")
    @classmethod
    def strip_required(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("El campo no puede estar vacío.")
        return cleaned


class UbicacionUpdateRequest(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=120)
    codigo_area: str = Field(..., min_length=3, max_length=32)
    tipo: str = Field(..., min_length=2, max_length=60)
    descripcion: Optional[str] = Field(default=None, max_length=255)

    @field_validator("nombre", "codigo_area", "tipo")
    @classmethod
    def strip_required(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("El campo no puede estar vacío.")
        return cleaned


class UbicacionEstadoRequest(BaseModel):
    estado: UbicacionEstado


def _normalize_codigo_area(raw: str) -> str:
    code = raw.strip().upper()
    if not AREA_CODE_REGEX.match(code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código de área debe tener formato consistente (ejemplo: AREA-01).",
        )
    return code


def _serialize_ubicacion(row: Dict[str, Any]) -> Dict[str, Any]:
    fc = row.get("fecha_creacion")
    fa = row.get("fecha_actualizacion")
    return {
        "ubicacion_id": row["ubicacion_id"],
        "nombre": row["nombre"],
        "codigo_area": row["codigo_area"],
        "tipo": row["tipo"],
        "descripcion": row.get("descripcion"),
        "estado": row["estado"],
        "dispositivos_count": int(row.get("dispositivos_count") or 0),
        "dispositivos_activos_count": int(row.get("dispositivos_activos_count") or 0),
        "fecha_creacion": fc.isoformat() if hasattr(fc, "isoformat") else (str(fc) if fc else None),
        "fecha_actualizacion": fa.isoformat() if hasattr(fa, "isoformat") else (str(fa) if fa else None),
    }


@router.get("")
def list_ubicaciones(
    estado: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    conditions: List[str] = []
    params: List[Any] = []

    if estado and estado.strip() and estado != "ALL":
        conditions.append("u.estado = %s")
        params.append(estado.strip().upper())
    if search and search.strip():
        q = f"%{search.strip()}%"
        conditions.append("(u.nombre LIKE %s OR u.codigo_area LIKE %s OR u.tipo LIKE %s)")
        params.extend([q, q, q])

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with db_cursor() as cursor:
        cursor.execute(
            f"""
            SELECT
              u.ubicacion_id, u.nombre, u.codigo_area, u.tipo, u.descripcion, u.estado,
              u.fecha_creacion, u.fecha_actualizacion,
              COUNT(d.id_dispositivo) AS dispositivos_count,
              SUM(CASE WHEN d.id_dispositivo IS NOT NULL AND d.estado <> 'INACTIVO' THEN 1 ELSE 0 END) AS dispositivos_activos_count
            FROM ubicaciones u
            LEFT JOIN dispositivos d ON d.ubicacion_id = u.ubicacion_id
            {where_clause}
            GROUP BY u.ubicacion_id
            ORDER BY u.codigo_area ASC, u.nombre ASC
            """,
            tuple(params),
        )
        rows = cursor.fetchall()

    return {
        "items": [_serialize_ubicacion(r) for r in rows],
        "total": len(rows),
    }


@router.get("/dashboard/mediciones")
def get_dashboard_mediciones_por_ubicacion(
    ubicacion_id: Optional[str] = Query(default=None),
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    """Consulta mediciones reales en MySQL filtradas y agrupadas por ubicación histórica."""
    conditions: List[str] = []
    params: List[Any] = []
    if ubicacion_id and ubicacion_id.strip() and ubicacion_id != "ALL":
        conditions.append("COALESCE(m.ubicacion_id, d.ubicacion_id) = %s")
        params.append(ubicacion_id.strip())

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with db_cursor() as cursor:
        cursor.execute(
            f"""
            SELECT
              m.id_medicion,
              m.dispositivo_id,
              d.nombre AS dispositivo_nombre,
              d.codigo AS dispositivo_codigo,
              COALESCE(m.ubicacion_id, d.ubicacion_id) AS ubicacion_id,
              u.nombre AS ubicacion_nombre,
              u.codigo_area AS ubicacion_codigo_area,
              m.temperatura,
              m.humedad,
              m.fecha_hora
            FROM mediciones m
            INNER JOIN dispositivos d ON d.id_dispositivo = m.dispositivo_id
            LEFT JOIN ubicaciones u ON u.ubicacion_id = COALESCE(m.ubicacion_id, d.ubicacion_id)
            {where_clause}
            ORDER BY m.id_medicion DESC, m.fecha_hora DESC
            LIMIT 200
            """,
            tuple(params),
        )
        mediciones = cursor.fetchall()

        cursor.execute(
            """
            SELECT
              u.ubicacion_id,
              u.nombre AS ubicacion_nombre,
              u.codigo_area,
              COUNT(m.id_medicion) AS total_mediciones,
              ROUND(AVG(m.temperatura), 2) AS promedio_temp,
              ROUND(AVG(m.humedad), 2) AS promedio_hum
            FROM ubicaciones u
            LEFT JOIN mediciones m ON m.ubicacion_id = u.ubicacion_id
            GROUP BY u.ubicacion_id
            ORDER BY u.codigo_area ASC
            """
        )
        resumen_por_ubicacion = cursor.fetchall()

    for m in mediciones:
        fh = m.get("fecha_hora")
        m["fecha_hora"] = fh.isoformat() if hasattr(fh, "isoformat") else str(fh)
        m["temperatura"] = float(m["temperatura"]) if m.get("temperatura") is not None else None
        m["humedad"] = float(m["humedad"]) if m.get("humedad") is not None else None

    for r in resumen_por_ubicacion:
        r["total_mediciones"] = int(r["total_mediciones"] or 0)
        r["promedio_temp"] = float(r["promedio_temp"]) if r["promedio_temp"] is not None else None
        r["promedio_hum"] = float(r["promedio_hum"]) if r["promedio_hum"] is not None else None

    return {
        "mediciones": mediciones,
        "resumen_por_ubicacion": resumen_por_ubicacion,
    }


@router.get("/{ubicacion_id}")
def get_ubicacion(
    ubicacion_id: str,
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT
              u.ubicacion_id, u.nombre, u.codigo_area, u.tipo, u.descripcion, u.estado,
              u.fecha_creacion, u.fecha_actualizacion,
              COUNT(d.id_dispositivo) AS dispositivos_count,
              SUM(CASE WHEN d.id_dispositivo IS NOT NULL AND d.estado <> 'INACTIVO' THEN 1 ELSE 0 END) AS dispositivos_activos_count
            FROM ubicaciones u
            LEFT JOIN dispositivos d ON d.ubicacion_id = u.ubicacion_id
            WHERE u.ubicacion_id = %s
            GROUP BY u.ubicacion_id
            LIMIT 1
            """,
            (ubicacion_id,),
        )
        row = cursor.fetchone()

    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ubicación no encontrada.")

    return {"ubicacion": _serialize_ubicacion(row)}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_ubicacion(
    payload: UbicacionCreateRequest,
    _admin: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> Dict[str, Any]:
    codigo_area = _normalize_codigo_area(payload.codigo_area)
    ubicacion_id = f"ubi-{uuid.uuid4().hex[:8]}"

    try:
        with db_cursor() as cursor:
            cursor.execute(
                """
                SELECT ubicacion_id FROM ubicaciones
                WHERE nombre = %s OR codigo_area = %s
                LIMIT 1
                """,
                (payload.nombre, codigo_area),
            )
            if cursor.fetchone() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ya existe una ubicación con ese nombre o código de área.",
                )

            cursor.execute(
                """
                INSERT INTO ubicaciones (ubicacion_id, nombre, codigo_area, tipo, descripcion, estado)
                VALUES (%s, %s, %s, %s, %s, 'ACTIVA')
                """,
                (
                    ubicacion_id,
                    payload.nombre,
                    codigo_area,
                    payload.tipo,
                    payload.descripcion.strip() if payload.descripcion else None,
                ),
            )
            cursor.execute(
                """
                SELECT
                  ubicacion_id, nombre, codigo_area, tipo, descripcion, estado,
                  fecha_creacion, fecha_actualizacion,
                  0 AS dispositivos_count, 0 AS dispositivos_activos_count
                FROM ubicaciones WHERE ubicacion_id = %s LIMIT 1
                """,
                (ubicacion_id,),
            )
            created = cursor.fetchone()
    except pymysql.err.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una ubicación con ese nombre o código de área.",
        )

    return {
        "message": "Ubicación registrada correctamente.",
        "ubicacion": _serialize_ubicacion(created),
    }


@router.put("/{ubicacion_id}")
def update_ubicacion(
    ubicacion_id: str,
    payload: UbicacionUpdateRequest,
    _admin: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> Dict[str, Any]:
    codigo_area = _normalize_codigo_area(payload.codigo_area)

    try:
        with db_cursor() as cursor:
            cursor.execute(
                "SELECT ubicacion_id FROM ubicaciones WHERE ubicacion_id = %s LIMIT 1",
                (ubicacion_id,),
            )
            if cursor.fetchone() is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ubicación no encontrada.")

            cursor.execute(
                """
                SELECT ubicacion_id FROM ubicaciones
                WHERE (nombre = %s OR codigo_area = %s) AND ubicacion_id <> %s
                LIMIT 1
                """,
                (payload.nombre, codigo_area, ubicacion_id),
            )
            if cursor.fetchone() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ya existe otra ubicación con ese nombre o código de área.",
                )

            cursor.execute(
                """
                UPDATE ubicaciones
                SET nombre = %s, codigo_area = %s, tipo = %s, descripcion = %s
                WHERE ubicacion_id = %s
                """,
                (
                    payload.nombre,
                    codigo_area,
                    payload.tipo,
                    payload.descripcion.strip() if payload.descripcion else None,
                    ubicacion_id,
                ),
            )
            # Sincronizar nombre visible en dispositivos asociados por FK
            cursor.execute(
                "UPDATE dispositivos SET ubicacion = %s WHERE ubicacion_id = %s",
                (payload.nombre, ubicacion_id),
            )
            cursor.execute(
                """
                SELECT
                  u.ubicacion_id, u.nombre, u.codigo_area, u.tipo, u.descripcion, u.estado,
                  u.fecha_creacion, u.fecha_actualizacion,
                  COUNT(d.id_dispositivo) AS dispositivos_count,
                  SUM(CASE WHEN d.id_dispositivo IS NOT NULL AND d.estado <> 'INACTIVO' THEN 1 ELSE 0 END) AS dispositivos_activos_count
                FROM ubicaciones u
                LEFT JOIN dispositivos d ON d.ubicacion_id = u.ubicacion_id
                WHERE u.ubicacion_id = %s
                GROUP BY u.ubicacion_id
                LIMIT 1
                """,
                (ubicacion_id,),
            )
            updated = cursor.fetchone()
    except pymysql.err.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe otra ubicación con ese nombre o código de área.",
        )

    return {
        "message": "Ubicación actualizada correctamente.",
        "ubicacion": _serialize_ubicacion(updated),
    }


@router.patch("/{ubicacion_id}/estado")
def update_ubicacion_estado(
    ubicacion_id: str,
    payload: UbicacionEstadoRequest,
    _admin: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> Dict[str, Any]:
    with db_cursor() as cursor:
        cursor.execute(
            "SELECT ubicacion_id FROM ubicaciones WHERE ubicacion_id = %s LIMIT 1",
            (ubicacion_id,),
        )
        if cursor.fetchone() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ubicación no encontrada.")

        if payload.estado == "INACTIVA":
            cursor.execute(
                """
                SELECT COUNT(*) AS cnt FROM dispositivos
                WHERE ubicacion_id = %s AND estado <> 'INACTIVO'
                """,
                (ubicacion_id,),
            )
            row = cursor.fetchone()
            active_count = int(row["cnt"]) if row else 0
            if active_count > 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "No se puede desactivar una ubicación con dispositivos activos asociados (RN-04); "
                        "reasigne los dispositivos primero."
                    ),
                )

        cursor.execute(
            "UPDATE ubicaciones SET estado = %s WHERE ubicacion_id = %s",
            (payload.estado, ubicacion_id),
        )
        cursor.execute(
            """
            SELECT
              u.ubicacion_id, u.nombre, u.codigo_area, u.tipo, u.descripcion, u.estado,
              u.fecha_creacion, u.fecha_actualizacion,
              COUNT(d.id_dispositivo) AS dispositivos_count,
              SUM(CASE WHEN d.id_dispositivo IS NOT NULL AND d.estado <> 'INACTIVO' THEN 1 ELSE 0 END) AS dispositivos_activos_count
            FROM ubicaciones u
            LEFT JOIN dispositivos d ON d.ubicacion_id = u.ubicacion_id
            WHERE u.ubicacion_id = %s
            GROUP BY u.ubicacion_id
            LIMIT 1
            """,
            (ubicacion_id,),
        )
        updated = cursor.fetchone()

    return {
        "message": f"Ubicación marcada como {payload.estado}.",
        "ubicacion": _serialize_ubicacion(updated),
    }


@router.get("/{ubicacion_id}/dispositivos")
def list_dispositivos_by_ubicacion(
    ubicacion_id: str,
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    with db_cursor() as cursor:
        cursor.execute(
            "SELECT ubicacion_id, nombre, codigo_area, estado FROM ubicaciones WHERE ubicacion_id = %s LIMIT 1",
            (ubicacion_id,),
        )
        ubi = cursor.fetchone()
        if ubi is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ubicación no encontrada.")

        cursor.execute(
            """
            SELECT id_dispositivo, codigo, nombre, mac_address, tipo, estado, firmware_version, fecha_registro
            FROM dispositivos
            WHERE ubicacion_id = %s
            ORDER BY nombre ASC
            """,
            (ubicacion_id,),
        )
        devices = cursor.fetchall()

    for d in devices:
        fr = d.get("fecha_registro")
        d["fecha_registro"] = fr.isoformat() if hasattr(fr, "isoformat") else (str(fr) if fr else None)

    return {
        "ubicacion": ubi,
        "items": devices,
        "total": len(devices),
    }
