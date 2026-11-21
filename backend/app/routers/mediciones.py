import asyncio
import csv
from datetime import date, datetime, timedelta, timezone
import io
import json
import logging
import math
from typing import Any, Dict, List, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
import pymysql

from ..database import db_cursor
from ..config import get_settings
from ..dependencies import require_roles
from ..services.device_connectivity import inventory_snapshot
from ..services.live_telemetry import (
    FRESHNESS_MAX_SECONDS,
    get_location_humidity_snapshot,
    get_location_temperature_snapshot,
    live_temperature_broadcaster,
)
from ..services.measurement_persistence import measurement_persister

router = APIRouter(prefix="/api/mediciones", tags=["Mediciones Persistentes UTC (RF-07)"])
logger = logging.getLogger("simoa.mediciones")
SSE_HEADERS = {"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"}


def _parse_historical_bound(raw: Optional[str], tz_offset_minutes: int, is_end: bool) -> Optional[Tuple[datetime, bool]]:
    """Convierte fecha_inicio / fecha_fin a UTC naive.
    - Si es fecha pura YYYY-MM-DD: inicio = 00:00 local -> UTC; fin = 00:00 del día siguiente local -> UTC (exclusivo).
    - Si incluye hora/zona ISO-8601: convierte a UTC (para fin inclusivo exacto, suma 1 microsegundo como límite exclusivo).
    """
    if not raw or not raw.strip():
        return None
    cleaned = raw.strip()

    if len(cleaned) == 10 and cleaned[4] == "-" and cleaned[7] == "-":
        try:
            d = date.fromisoformat(cleaned)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formato de fecha inválido. Use YYYY-MM-DD o ISO-8601.",
            )
        local_dt = datetime(d.year, d.month, d.day, 0, 0, 0)
        if is_end:
            local_dt = local_dt + timedelta(days=1)
        # JS getTimezoneOffset() = UTC - Local (ej. UTC-5 => +300 min) => UTC = Local + offset
        utc_dt = local_dt + timedelta(minutes=tz_offset_minutes)
        return utc_dt, True

    iso_str = cleaned[:-1] + "+00:00" if cleaned.endswith("Z") else cleaned
    try:
        dt = datetime.fromisoformat(iso_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de fecha/hora inválido. Use YYYY-MM-DD o ISO-8601.",
        )
    if dt.tzinfo is not None:
        utc_dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    else:
        utc_dt = dt + timedelta(minutes=tz_offset_minutes)
    if is_end:
        utc_dt = utc_dt + timedelta(microseconds=1)
    return utc_dt, False


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
        "valor_anomalo": (
            bool(row["valor_anomalo"]) if row.get("valor_anomalo") is not None else None
        ),
        "es_anomalia_ia": (
            bool(row["valor_anomalo"])
            if row.get("valor_anomalo") is not None
            else bool(row.get("score_anomalia_ia") is not None and float(row["score_anomalia_ia"]) >= 0.7)
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
                   alerta_generada, es_fuera_de_umbral, valor_anomalo, score_anomalia_ia,
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


@router.get("/historico")
def get_historico_mediciones(
    fecha_inicio: Optional[str] = Query(default=None),
    fecha_fin: Optional[str] = Query(default=None),
    tz_offset_minutes: int = Query(default=0, ge=-840, le=840),
    ubicacion_id: Optional[str] = Query(default=None, max_length=64),
    dispositivo_id: Optional[str] = Query(default=None, max_length=64),
    sensor_id: Optional[str] = Query(default=None, max_length=64),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    """RF-10: Consulta y filtrado histórico paginado en MySQL con estadísticas consolidadas y cumplimiento RF-07."""
    start_parsed = _parse_historical_bound(fecha_inicio, tz_offset_minutes, is_end=False)
    end_parsed = _parse_historical_bound(fecha_fin, tz_offset_minutes, is_end=True)

    start_utc = start_parsed[0] if start_parsed else None
    end_utc_excl = end_parsed[0] if end_parsed else None

    if start_utc is not None and end_utc_excl is not None and start_utc >= end_utc_excl:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha inicial no puede ser mayor a la final",
        )

    conditions: List[str] = []
    params: List[Any] = []

    if ubicacion_id and ubicacion_id.strip():
        conditions.append("COALESCE(m.ubicacion_id, d.ubicacion_id) = %s")
        params.append(ubicacion_id.strip())
    if dispositivo_id and dispositivo_id.strip():
        conditions.append("m.dispositivo_id = %s")
        params.append(dispositivo_id.strip())
    if sensor_id and sensor_id.strip():
        conditions.append("m.sensor_id = %s")
        params.append(sensor_id.strip())
    if start_utc is not None:
        conditions.append("m.fecha_hora >= %s")
        params.append(start_utc)
    if end_utc_excl is not None:
        conditions.append("m.fecha_hora < %s")
        params.append(end_utc_excl)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    offset = (page - 1) * page_size

    try:
        with db_cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                  COUNT(*) AS total_records,
                  COUNT(m.temperatura) AS temp_count,
                  MIN(m.temperatura) AS temp_min,
                  MAX(m.temperatura) AS temp_max,
                  AVG(m.temperatura) AS temp_avg,
                  STDDEV_SAMP(m.temperatura) AS temp_std,
                  COUNT(m.humedad) AS hum_count,
                  MIN(m.humedad) AS hum_min,
                  MAX(m.humedad) AS hum_max,
                  AVG(m.humedad) AS hum_avg,
                  STDDEV_SAMP(m.humedad) AS hum_std,
                  SUM(CASE WHEN m.es_fuera_de_umbral IS NOT NULL THEN 1 ELSE 0 END) AS mediciones_evaluables,
                  SUM(CASE WHEN m.es_fuera_de_umbral = 0 THEN 1 ELSE 0 END) AS mediciones_conformes
                FROM mediciones m
                INNER JOIN dispositivos d ON d.id_dispositivo = m.dispositivo_id
                {where_clause}
                """,
                tuple(params),
            )
            agg = cursor.fetchone() or {}

            total_records = int(agg.get("total_records") or 0)
            total_pages = math.ceil(total_records / page_size) if total_records > 0 else 0

            rows: List[Dict[str, Any]] = []
            if total_records > 0 and offset < total_records:
                cursor.execute(
                    f"""
                    SELECT
                      m.id_medicion,
                      m.dispositivo_id,
                      d.nombre AS dispositivo_nombre,
                      d.codigo AS dispositivo_codigo,
                      m.sensor_id,
                      s.identificador AS sensor_identificador,
                      s.modelo AS sensor_modelo,
                      COALESCE(m.ubicacion_id, d.ubicacion_id) AS ubicacion_id,
                      u.nombre AS ubicacion_nombre,
                      u.codigo_area AS ubicacion_codigo_area,
                      m.temperatura,
                      m.humedad,
                      m.presion,
                      m.es_fuera_de_umbral,
                      m.alerta_generada,
                      m.valor_anomalo,
                      m.score_anomalia_ia,
                      m.configuracion_id,
                      m.fecha_hora
                    FROM mediciones m
                    INNER JOIN dispositivos d ON d.id_dispositivo = m.dispositivo_id
                    LEFT JOIN sensores s ON s.id_sensor = m.sensor_id
                    LEFT JOIN ubicaciones u ON u.ubicacion_id = COALESCE(m.ubicacion_id, d.ubicacion_id)
                    {where_clause}
                    ORDER BY m.fecha_hora DESC, m.sensor_id ASC, m.id_medicion DESC
                    LIMIT %s OFFSET %s
                    """,
                    tuple(params + [page_size, offset]),
                )
                rows = cursor.fetchall()
    except pymysql.MySQLError as exc:
        logger.error("Error MySQL en consulta histórica RF-10: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Error temporal consultando el historial de mediciones en base de datos.",
        )

    items: List[Dict[str, Any]] = []
    for r in rows:
        base = _serialize_medicion(r)
        base.update(
            {
                "ubicacion_nombre": r.get("ubicacion_nombre"),
                "ubicacion_codigo_area": r.get("ubicacion_codigo_area"),
                "dispositivo_nombre": r.get("dispositivo_nombre"),
                "dispositivo_codigo": r.get("dispositivo_codigo"),
                "sensor_identificador": r.get("sensor_identificador"),
                "sensor_modelo": r.get("sensor_modelo"),
                "estado_evaluacion": (
                    "No evaluable"
                    if r.get("es_fuera_de_umbral") is None
                    else ("Fuera de umbral" if bool(r.get("es_fuera_de_umbral")) else "Conforme")
                ),
            }
        )
        items.append(base)

    temp_count = int(agg.get("temp_count") or 0)
    hum_count = int(agg.get("hum_count") or 0)
    evaluables = int(agg.get("mediciones_evaluables") or 0)
    conformes = int(agg.get("mediciones_conformes") or 0)

    def _round_opt(val: Any, digits: int = 2) -> Optional[float]:
        return round(float(val), digits) if val is not None else None

    estadisticas = {
        "total_registros_filtrados": total_records,
        "desviacion_tipo": "muestral",
        "criterio_cumplimiento": "evaluacion_combinada_rf07",
        "temperatura": {
            "muestras": temp_count,
            "unidad": "°C",
            "minimo": _round_opt(agg.get("temp_min"), 2),
            "maximo": _round_opt(agg.get("temp_max"), 2),
            "promedio": _round_opt(agg.get("temp_avg"), 2),
            "desviacion_estandar": (
                0.0 if temp_count == 1 else _round_opt(agg.get("temp_std"), 2)
            )
            if temp_count > 0
            else None,
        },
        "humedad": {
            "muestras": hum_count,
            "unidad": "%RH",
            "minimo": _round_opt(agg.get("hum_min"), 2),
            "maximo": _round_opt(agg.get("hum_max"), 2),
            "promedio": _round_opt(agg.get("hum_avg"), 2),
            "desviacion_estandar": (
                0.0 if hum_count == 1 else _round_opt(agg.get("hum_std"), 2)
            )
            if hum_count > 0
            else None,
        },
        "cumplimiento": {
            "mediciones_evaluables": evaluables,
            "mediciones_conformes": conformes,
            "porcentaje": round((conformes / evaluables) * 100.0, 2) if evaluables > 0 else None,
        },
    }

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total_records": total_records,
        "total_pages": total_pages,
        "estadisticas": estadisticas,
        "zona_horaria": "UTC",
    }


def _downsample_preserving_extremes(rows: List[Dict[str, Any]], max_points: int) -> List[Dict[str, Any]]:
    """Reduce volumen manteniendo orden cronológico, extremos (mín/máx), fuera de umbral y anomalías IA."""
    total = len(rows)
    if total <= max_points or max_points < 10:
        return rows

    num_buckets = max(1, max_points // 4)
    bucket_size = math.ceil(total / num_buckets)
    selected_indices = {0, total - 1}

    for start in range(0, total, bucket_size):
        end = min(total, start + bucket_size)
        selected_indices.add(start)
        selected_indices.add(end - 1)

        min_t_idx = max_t_idx = min_h_idx = max_h_idx = None
        for idx in range(start, end):
            r = rows[idx]
            if r.get("es_fuera_de_umbral") == 1 or r.get("valor_anomalo") == 1 or (
                r.get("score_anomalia_ia") is not None and float(r["score_anomalia_ia"]) >= 0.7
            ):
                selected_indices.add(idx)

            t = r.get("temperatura")
            if t is not None:
                tv = float(t)
                if min_t_idx is None or tv < float(rows[min_t_idx]["temperatura"]):
                    min_t_idx = idx
                if max_t_idx is None or tv > float(rows[max_t_idx]["temperatura"]):
                    max_t_idx = idx

            h = r.get("humedad")
            if h is not None:
                hv = float(h)
                if min_h_idx is None or hv < float(rows[min_h_idx]["humedad"]):
                    min_h_idx = idx
                if max_h_idx is None or hv > float(rows[max_h_idx]["humedad"]):
                    max_h_idx = idx

        for idx in (min_t_idx, max_t_idx, min_h_idx, max_h_idx):
            if idx is not None:
                selected_indices.add(idx)

    return [rows[i] for i in sorted(selected_indices)]


@router.get("/tendencias")
def get_tendencias_mediciones(
    fecha_inicio: Optional[str] = Query(default=None),
    fecha_fin: Optional[str] = Query(default=None),
    tz_offset_minutes: int = Query(default=0, ge=-840, le=840),
    ubicacion_id: Optional[str] = Query(default=None, max_length=64),
    dispositivo_id: Optional[str] = Query(default=None, max_length=64),
    sensor_id: Optional[str] = Query(default=None, max_length=64),
    max_points: int = Query(default=300, ge=20, le=1000),
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    """RF-11: Serie temporal cronológica real (SVG) integrada con filtros RF-10, límites reales y anomalías RF-18."""
    start_parsed = _parse_historical_bound(fecha_inicio, tz_offset_minutes, is_end=False)
    end_parsed = _parse_historical_bound(fecha_fin, tz_offset_minutes, is_end=True)

    start_utc = start_parsed[0] if start_parsed else None
    end_utc_excl = end_parsed[0] if end_parsed else None

    if start_utc is not None and end_utc_excl is not None and start_utc >= end_utc_excl:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha inicial no puede ser mayor a la final",
        )

    conditions: List[str] = []
    params: List[Any] = []
    if ubicacion_id and ubicacion_id.strip():
        conditions.append("COALESCE(m.ubicacion_id, d.ubicacion_id) = %s")
        params.append(ubicacion_id.strip())
    if dispositivo_id and dispositivo_id.strip():
        conditions.append("m.dispositivo_id = %s")
        params.append(dispositivo_id.strip())
    if sensor_id and sensor_id.strip():
        conditions.append("m.sensor_id = %s")
        params.append(sensor_id.strip())
    if start_utc is not None:
        conditions.append("m.fecha_hora >= %s")
        params.append(start_utc)
    if end_utc_excl is not None:
        conditions.append("m.fecha_hora < %s")
        params.append(end_utc_excl)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    try:
        with db_cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                  m.id_medicion,
                  m.dispositivo_id,
                  m.sensor_id,
                  s.identificador AS sensor_identificador,
                  s.modelo AS sensor_modelo,
                  COALESCE(m.ubicacion_id, d.ubicacion_id) AS ubicacion_id,
                  m.temperatura,
                  m.humedad,
                  m.es_fuera_de_umbral,
                  m.valor_anomalo,
                  m.score_anomalia_ia,
                  m.fecha_hora
                FROM mediciones m
                INNER JOIN dispositivos d ON d.id_dispositivo = m.dispositivo_id
                LEFT JOIN sensores s ON s.id_sensor = m.sensor_id
                {where_clause}
                ORDER BY m.fecha_hora ASC, m.sensor_id ASC, m.id_medicion ASC
                LIMIT 10000
                """,
                tuple(params),
            )
            raw_rows = cursor.fetchall()

            # Obtener límites reales de configuración para el sensor o conjunto filtrado
            limit_conditions: List[str] = []
            limit_params: List[Any] = []
            if sensor_id and sensor_id.strip():
                limit_conditions.append("l.sensor_id = %s")
                limit_params.append(sensor_id.strip())
            elif dispositivo_id and dispositivo_id.strip():
                limit_conditions.append("s.dispositivo_id = %s")
                limit_params.append(dispositivo_id.strip())
            elif ubicacion_id and ubicacion_id.strip():
                limit_conditions.append("d.ubicacion_id = %s")
                limit_params.append(ubicacion_id.strip())
            else:
                distinct_sensors = sorted({r["sensor_id"] for r in raw_rows if r.get("sensor_id")})
                if len(distinct_sensors) == 1:
                    limit_conditions.append("l.sensor_id = %s")
                    limit_params.append(distinct_sensors[0])

            limit_rows: List[Dict[str, Any]] = []
            if limit_conditions:
                limit_where = f"WHERE {' AND '.join(limit_conditions)}"
                cursor.execute(
                    f"""
                    SELECT l.sensor_id, l.temp_min, l.temp_max, l.hum_min, l.hum_max, l.fecha_actualizacion
                    FROM umbrales_alerta l
                    INNER JOIN sensores s ON s.id_sensor = l.sensor_id
                    INNER JOIN dispositivos d ON d.id_dispositivo = s.dispositivo_id
                    {limit_where}
                    """,
                    tuple(limit_params),
                )
                limit_rows = cursor.fetchall()
    except pymysql.MySQLError as exc:
        logger.error("Error MySQL en consulta de tendencias RF-11: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Error temporal consultando series de tendencia en base de datos.",
        )

    total_original = len(raw_rows)
    # Identificar huecos en la serie original antes de reducirla para visualización.
    for variable in ("temperatura", "humedad"):
        segment = 0
        previous = None
        maximum = get_settings().rf15_max_silence_seconds
        for row in raw_rows:
            if row.get(variable) is None:
                continue
            recorded = row["fecha_hora"]
            if previous is not None and (recorded - previous).total_seconds() > maximum:
                segment += 1
            row[f"segmento_{variable}"] = segment
            previous = recorded
    reduced_rows = _downsample_preserving_extremes(raw_rows, max_points)
    was_reduced = len(reduced_rows) < total_original

    series: List[Dict[str, Any]] = []
    anomalias_ia_disponibles = False
    for r in reduced_rows:
        fh = r.get("fecha_hora")
        fecha_utc = (
            fh.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
            if hasattr(fh, "isoformat")
            else str(fh)
        )
        score_ia = float(r["score_anomalia_ia"]) if r.get("score_anomalia_ia") is not None else None
        valor_anomalo = bool(r["valor_anomalo"]) if r.get("valor_anomalo") is not None else None
        if score_ia is not None or valor_anomalo is not None:
            anomalias_ia_disponibles = True
        es_anomalia_ia = valor_anomalo if valor_anomalo is not None else bool(score_ia is not None and score_ia >= 0.7)
        es_fuera = bool(r["es_fuera_de_umbral"]) if r.get("es_fuera_de_umbral") is not None else None
        series.append(
            {
                "id_medicion": int(r["id_medicion"]),
                "sensor_id": r.get("sensor_id"),
                "sensor_identificador": r.get("sensor_identificador"),
                "sensor_modelo": r.get("sensor_modelo"),
                "dispositivo_id": r["dispositivo_id"],
                "ubicacion_id": r.get("ubicacion_id"),
                "temperatura": float(r["temperatura"]) if r.get("temperatura") is not None else None,
                "humedad": float(r["humedad"]) if r.get("humedad") is not None else None,
                "segmento_temperatura": r.get("segmento_temperatura"),
                "segmento_humedad": r.get("segmento_humedad"),
                "es_fuera_de_umbral": es_fuera,
                "estado_evaluacion": (
                    "No evaluable"
                    if es_fuera is None
                    else ("Fuera de umbral" if es_fuera else "Conforme")
                ),
                "score_anomalia_ia": score_ia,
                "es_anomalia_ia": es_anomalia_ia,
                "fecha_hora_utc": fecha_utc,
            }
        )

    first_dt = raw_rows[0]["fecha_hora"] if raw_rows else None

    def _build_limit_meta(min_col: str, max_col: str) -> Dict[str, Any]:
        pairs = {
            (
                float(lr[min_col]) if lr.get(min_col) is not None else None,
                float(lr[max_col]) if lr.get(max_col) is not None else None,
            )
            for lr in limit_rows
            if lr.get(min_col) is not None and lr.get(max_col) is not None
        }
        if len(pairs) == 1:
            mn, mx = next(iter(pairs))
            fa = limit_rows[0].get("fecha_actualizacion")
            fa_utc = (
                fa.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
                if hasattr(fa, "isoformat")
                else None
            )
            vigencia_completa = bool(first_dt is not None and fa is not None and fa <= first_dt)
            return {
                "min": mn,
                "max": mx,
                "vigente_desde_utc": fa_utc,
                "vigencia_completa": vigencia_completa,
                "motivo": None,
            }
        motivo = (
            "Múltiples sensores con límites distintos; filtre por sensor para ver umbrales"
            if len(pairs) > 1
            else "Sin límites configurados en el sistema"
        )
        return {
            "min": None,
            "max": None,
            "vigente_desde_utc": None,
            "vigencia_completa": False,
            "motivo": motivo,
        }

    return {
        "series": series,
        "total_original": total_original,
        "total_retornados": len(series),
        "reducido": was_reduced,
        "estrategia_reduccion": "extremes_and_anomalies_bucket" if was_reduced else "none",
        "anomalias_ia_disponibles": anomalias_ia_disponibles,
        "limites": {
            "temperatura": _build_limit_meta("temp_min", "temp_max"),
            "humedad": _build_limit_meta("hum_min", "hum_max"),
        },
        "zona_horaria": "UTC",
    }


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
                   alerta_generada, es_fuera_de_umbral, valor_anomalo, score_anomalia_ia,
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


@router.get("/ubicacion/{ubicacion_id}/humedad-actual")
def get_ubicacion_humedad_actual(
    ubicacion_id: str,
    freshness_seconds: int = Query(default=FRESHNESS_MAX_SECONDS, ge=5, le=300),
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    """RF-09: Consulta la humedad relativa actual (%RH), banda óptima real y Z-Score higrométrico de la ubicación."""
    snapshot = get_location_humidity_snapshot(ubicacion_id, freshness_max_seconds=freshness_seconds)
    if snapshot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ubicación no encontrada.")
    return snapshot


async def _connectivity_events(request: Request):
    previous = None
    unavailable = False
    scans_without_event = 0
    interval = get_settings().rf15_scan_seconds
    while not await request.is_disconnected():
        try:
            rows = await asyncio.to_thread(inventory_snapshot)
            # El tiempo en silencio se deriva del último contacto y no es un cambio de estado.
            signature = [{key: value for key, value in row.items() if key != "silencio_segundos"} for row in rows]
            if unavailable or signature != previous:
                yield f"event: conectividad\ndata: {json.dumps(rows, ensure_ascii=False)}\n\n"
                previous = signature
                unavailable = False
                scans_without_event = 0
        except pymysql.MySQLError:
            if not unavailable:
                yield "event: conectividad_no_disponible\ndata: {}\n\n"
                unavailable = True
                scans_without_event = 0
        scans_without_event += 1
        if scans_without_event * interval >= 15:
            yield "event: heartbeat\ndata: {}\n\n"
            scans_without_event = 0
        await asyncio.sleep(interval)


@router.get("/stream/temperatura")
async def stream_ubicacion_temperatura(
    request: Request,
    ubicacion_id: Optional[str] = Query(default=None, min_length=1, max_length=64),
    conectividad: bool = Query(default=False),
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> StreamingResponse:
    """RF-08 & RF-09: Canal SSE único autenticado en tiempo real conectado post-COMMIT de RF-07."""
    if conectividad:
        return StreamingResponse(_connectivity_events(request), media_type="text/event-stream", headers=SSE_HEADERS)
    if not ubicacion_id:
        raise HTTPException(status_code=422, detail="Se requiere una ubicación para consultar telemetría.")
    initial = get_location_temperature_snapshot(ubicacion_id)
    if initial is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ubicación no encontrada.")

    hum_initial = get_location_humidity_snapshot(ubicacion_id)
    initial_bundle = {**initial, "humedad_snapshot": hum_initial}

    sensor_ids = {
        sid
        for sid in (initial.get("sensor_id"), hum_initial.get("sensor_id") if hum_initial else None)
        if sid
    }
    loop = asyncio.get_running_loop()
    sub_queue = live_temperature_broadcaster.subscribe_queue(sensor_ids, loop) if sensor_ids else None

    async def event_generator():
        try:
            yield f"event: snapshot\ndata: {json.dumps(initial_bundle, ensure_ascii=False)}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                if sub_queue is None:
                    await asyncio.sleep(10.0)
                    yield f"event: heartbeat\ndata: {json.dumps({'ubicacion_id': ubicacion_id})}\n\n"
                    continue
                try:
                    payload = await asyncio.wait_for(sub_queue.get(), timeout=15.0)
                    if "temperatura_actual" in payload:
                        yield f"event: temperatura\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
                    if payload.get("humedad_snapshot") is not None:
                        yield f"event: humedad\ndata: {json.dumps(payload['humedad_snapshot'], ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    yield f"event: heartbeat\ndata: {json.dumps({'ubicacion_id': ubicacion_id})}\n\n"
        finally:
            if sensor_ids and sub_queue is not None:
                live_temperature_broadcaster.unsubscribe_queue(sensor_ids, loop, sub_queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


# ==============================================================================
# RF-17: Exportación de Mediciones Históricas a Formato Tabular CSV (RN-19)
# ==============================================================================

def _escape_csv_cell(val: Any) -> Any:
    """Protección contra inyección de fórmulas (CSV / Formula Injection) en hojas de cálculo (RN-19)."""
    if isinstance(val, str) and val:
        stripped = val.lstrip()
        if stripped.startswith(("=", "+", "-", "@")) and not val.startswith("'"):
            return f"'{val}"
    return val


def _format_estado_umbral(es_fuera_de_umbral: Optional[int]) -> str:
    if es_fuera_de_umbral is None:
        return "NO EVALUABLE"
    return "FUERA DE RANGO" if bool(es_fuera_de_umbral) else "NOMINAL"


def _format_iso_utc(dt: Any) -> str:
    if isinstance(dt, datetime):
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    elif hasattr(dt, "strftime"):
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return str(dt) if dt else ""


def _generate_csv_chunks(where_clause: str, params: List[Any], total_count: int, chunk_size: int = 1000):
    output = io.StringIO()
    writer = csv.writer(output, delimiter=",", quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")

    # 1. UTF-8 BOM (\ufeff) para compatibilidad nativa inmediata con Microsoft Excel y LibreOffice Calc
    yield "\ufeff"

    # 2. Las siete columnas obligatorias en el orden exacto especificado por RF-17
    headers = [
        "fecha_hora",
        "dispositivo",
        "sensor",
        "temperatura",
        "humedad",
        "score_ia",
        "estado_umbral",
    ]
    writer.writerow(headers)
    yield output.getvalue()
    output.seek(0)
    output.truncate(0)

    # 3. Lotes sucesivos garantizando un orden determinista y evitando sobrecarga de memoria
    offset = 0
    with db_cursor() as cursor:
        while offset < total_count:
            cursor.execute(
                f"""
                SELECT
                  m.id_medicion,
                  m.fecha_hora,
                  COALESCE(d.nombre, d.codigo, m.dispositivo_id) AS dispositivo,
                  COALESCE(s.identificador, s.modelo, m.sensor_id) AS sensor,
                  m.temperatura,
                  m.humedad,
                  m.score_anomalia_ia,
                  m.es_fuera_de_umbral
                FROM mediciones m
                INNER JOIN dispositivos d ON d.id_dispositivo = m.dispositivo_id
                LEFT JOIN sensores s ON s.id_sensor = m.sensor_id
                LEFT JOIN ubicaciones u ON u.ubicacion_id = COALESCE(m.ubicacion_id, d.ubicacion_id)
                {where_clause}
                ORDER BY m.fecha_hora ASC, m.id_medicion ASC
                LIMIT %s OFFSET %s
                """,
                tuple(params + [chunk_size, offset]),
            )
            rows = cursor.fetchall()
            if not rows:
                break

            for r in rows:
                temp_val = "" if r.get("temperatura") is None else str(r["temperatura"])
                hum_val = "" if r.get("humedad") is None else str(r["humedad"])
                score_val = "" if r.get("score_anomalia_ia") is None else str(r["score_anomalia_ia"])

                row_cells = [
                    _format_iso_utc(r.get("fecha_hora")),
                    _escape_csv_cell(r.get("dispositivo") or ""),
                    _escape_csv_cell(r.get("sensor") or ""),
                    temp_val,
                    hum_val,
                    score_val,
                    _format_estado_umbral(r.get("es_fuera_de_umbral")),
                ]
                writer.writerow(row_cells)

            yield output.getvalue()
            output.seek(0)
            output.truncate(0)
            offset += len(rows)


def _build_csv_export_response(
    fecha_inicio: Optional[str],
    fecha_fin: Optional[str],
    tz_offset_minutes: int,
    ubicacion_id: Optional[str],
    dispositivo_id: Optional[str],
    sensor_id: Optional[str],
) -> StreamingResponse:
    start_parsed = _parse_historical_bound(fecha_inicio, tz_offset_minutes, is_end=False)
    end_parsed = _parse_historical_bound(fecha_fin, tz_offset_minutes, is_end=True)

    start_utc = start_parsed[0] if start_parsed else None
    end_utc_excl = end_parsed[0] if end_parsed else None

    if start_utc is not None and end_utc_excl is not None and start_utc >= end_utc_excl:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha inicial no puede ser mayor a la final",
        )

    conditions: List[str] = []
    params: List[Any] = []

    if ubicacion_id and ubicacion_id.strip():
        conditions.append("COALESCE(m.ubicacion_id, d.ubicacion_id) = %s")
        params.append(ubicacion_id.strip())
    if dispositivo_id and dispositivo_id.strip():
        conditions.append("m.dispositivo_id = %s")
        params.append(dispositivo_id.strip())
    if sensor_id and sensor_id.strip():
        conditions.append("m.sensor_id = %s")
        params.append(sensor_id.strip())
    if start_utc is not None:
        conditions.append("m.fecha_hora >= %s")
        params.append(start_utc)
    if end_utc_excl is not None:
        conditions.append("m.fecha_hora < %s")
        params.append(end_utc_excl)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with db_cursor() as cursor:
        cursor.execute(
            f"""
            SELECT COUNT(*) AS total_count
            FROM mediciones m
            INNER JOIN dispositivos d ON d.id_dispositivo = m.dispositivo_id
            {where_clause}
            """,
            tuple(params),
        )
        row = cursor.fetchone() or {}
        total_count = int(row.get("total_count") or 0)

    if total_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay mediciones disponibles para exportar con los filtros seleccionados",
        )

    now_stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"simoa_reporte_{now_stamp}.csv"

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Type": "text/csv; charset=utf-8",
        "X-Report-Total-Records": str(total_count),
        "Access-Control-Expose-Headers": "Content-Disposition, X-Report-Total-Records",
    }

    return StreamingResponse(
        _generate_csv_chunks(where_clause, params, total_count),
        media_type="text/csv; charset=utf-8",
        headers=headers,
    )


@router.get("/exportar/csv")
def exportar_mediciones_csv_get(
    fecha_inicio: Optional[str] = Query(default=None),
    fecha_fin: Optional[str] = Query(default=None),
    tz_offset_minutes: int = Query(default=0, ge=-840, le=840),
    ubicacion_id: Optional[str] = Query(default=None, max_length=64),
    dispositivo_id: Optional[str] = Query(default=None, max_length=64),
    sensor_id: Optional[str] = Query(default=None, max_length=64),
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> StreamingResponse:
    """RF-17: Exportación de mediciones históricas filtradas a CSV estándar (GET)."""
    return _build_csv_export_response(
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        tz_offset_minutes=tz_offset_minutes,
        ubicacion_id=ubicacion_id,
        dispositivo_id=dispositivo_id,
        sensor_id=sensor_id,
    )


@router.post("/exportar/csv")
def exportar_mediciones_csv_post(
    request_data: Dict[str, Any],
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> StreamingResponse:
    """RF-17: Exportación de mediciones históricas filtradas a CSV estándar (POST)."""
    return _build_csv_export_response(
        fecha_inicio=request_data.get("fecha_inicio"),
        fecha_fin=request_data.get("fecha_fin"),
        tz_offset_minutes=int(request_data.get("tz_offset_minutes") or 0),
        ubicacion_id=request_data.get("ubicacion_id"),
        dispositivo_id=request_data.get("dispositivo_id"),
        sensor_id=request_data.get("sensor_id"),
    )

