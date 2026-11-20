import json
import math
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status

from ..database import db_cursor
from .live_telemetry import live_temperature_broadcaster

MIN_MAX_ERROR_MSG = "El límite mínimo debe ser estrictamente menor que el límite máximo"

MODEL_TEMP_RANGES: Dict[str, Tuple[float, float]] = {
    "DHT22": (-40.0, 80.0),
    "BME280": (-40.0, 85.0),
    "SHT31": (-40.0, 125.0),
}

HUMIDITY_RANGE: Tuple[float, float] = (0.0, 100.0)
PRESSURE_RANGE: Tuple[float, float] = (300.0, 1100.0)


def _to_finite_float(value: Any, field_label: str) -> float:
    if value is None or isinstance(value, bool):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El campo '{field_label}' es obligatorio y debe ser un número finito.",
        )
    if isinstance(value, str) and not value.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El campo '{field_label}' no puede estar vacío.",
        )
    try:
        num = float(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El campo '{field_label}' debe ser un valor numérico válido.",
        ) from exc
    if not math.isfinite(num):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El campo '{field_label}' debe ser un número finito (no NaN ni infinito).",
        )
    return round(num, 2)


def _extract_measured_variables(variables_medidas_raw: Any) -> List[str]:
    if isinstance(variables_medidas_raw, str):
        parsed = json.loads(variables_medidas_raw)
    else:
        parsed = variables_medidas_raw or []
    names: List[str] = []
    for item in parsed:
        if isinstance(item, dict) and item.get("variable"):
            names.append(str(item["variable"]).lower())
        elif isinstance(item, str):
            names.append(item.lower())
    return names


def _serialize_dt(val: Any) -> Optional[str]:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    return str(val)


def _serialize_threshold_row(row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if row is None:
        return None
    numeric_fields = (
        "temp_min",
        "temp_max",
        "temp_critico_min",
        "temp_critico_max",
        "hum_min",
        "hum_max",
        "hum_critico_min",
        "hum_critico_max",
        "presion_min",
        "presion_max",
    )
    out: Dict[str, Any] = {
        "sensor_id": row["sensor_id"],
        "es_predeterminado": bool(row.get("es_predeterminado", 0)),
        "version": int(row.get("version") or 1),
        "actualizado_por": row.get("actualizado_por"),
        "fecha_actualizacion": _serialize_dt(row.get("fecha_actualizacion")),
    }
    for field in numeric_fields:
        val = row.get(field)
        out[field] = float(val) if val is not None else None
    return out


def validate_threshold_payload(
    modelo: str,
    measured_vars: List[str],
    payload: Dict[str, Any],
) -> Dict[str, Optional[float]]:
    """Valida reglas estrictas RF-12 para cada variable que el sensor realmente mide."""
    result: Dict[str, Optional[float]] = {
        "temp_min": None,
        "temp_max": None,
        "temp_critico_min": None,
        "temp_critico_max": None,
        "hum_min": None,
        "hum_max": None,
        "hum_critico_min": None,
        "hum_critico_max": None,
        "presion_min": None,
        "presion_max": None,
    }

    if "temperatura" in measured_vars:
        t_min = _to_finite_float(payload.get("temp_min"), "temp_min")
        t_max = _to_finite_float(payload.get("temp_max"), "temp_max")
        if t_min >= t_max:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=MIN_MAX_ERROR_MSG)

        t_cmin_raw = payload.get("temp_critico_min")
        t_cmax_raw = payload.get("temp_critico_max")
        t_cmin = _to_finite_float(t_cmin_raw, "temp_critico_min") if t_cmin_raw is not None else None
        t_cmax = _to_finite_float(t_cmax_raw, "temp_critico_max") if t_cmax_raw is not None else None

        if (t_cmin is None) != (t_cmax is None):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe definir tanto el límite crítico inferior como el crítico superior de temperatura.",
            )
        if t_cmin is not None and t_cmax is not None:
            if not (t_cmin < t_min < t_max < t_cmax):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La temperatura debe cumplir: critico_inferior < temp_min < temp_max < critico_superior.",
                )

        low_bound, high_bound = MODEL_TEMP_RANGES.get(modelo, (-40.0, 85.0))
        for label, val in (
            ("temp_critico_min", t_cmin),
            ("temp_min", t_min),
            ("temp_max", t_max),
            ("temp_critico_max", t_cmax),
        ):
            if val is not None and (val < low_bound or val > high_bound):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{label} ({val} °C) está fuera del rango soportado por el modelo {modelo} ({low_bound} °C a {high_bound} °C).",
                )

        result["temp_min"] = t_min
        result["temp_max"] = t_max
        result["temp_critico_min"] = t_cmin
        result["temp_critico_max"] = t_cmax

    if "humedad" in measured_vars:
        h_min = _to_finite_float(payload.get("hum_min"), "hum_min")
        h_max = _to_finite_float(payload.get("hum_max"), "hum_max")
        if h_min >= h_max:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=MIN_MAX_ERROR_MSG)

        h_cmin_raw = payload.get("hum_critico_min")
        h_cmax_raw = payload.get("hum_critico_max")
        h_cmin = _to_finite_float(h_cmin_raw, "hum_critico_min") if h_cmin_raw is not None else None
        h_cmax = _to_finite_float(h_cmax_raw, "hum_critico_max") if h_cmax_raw is not None else None

        if (h_cmin is None) != (h_cmax is None):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe definir tanto el límite crítico inferior como el crítico superior de humedad relativa.",
            )
        if h_cmin is not None and h_cmax is not None:
            if not (h_cmin < h_min < h_max < h_cmax):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La humedad relativa debe cumplir: critico_inferior < hum_min < hum_max < critico_superior.",
                )

        for label, val in (
            ("hum_critico_min", h_cmin),
            ("hum_min", h_min),
            ("hum_max", h_max),
            ("hum_critico_max", h_cmax),
        ):
            if val is not None and (val < HUMIDITY_RANGE[0] or val > HUMIDITY_RANGE[1]):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{label} ({val} %RH) debe estar entre 0 % y 100 %.",
                )

        result["hum_min"] = h_min
        result["hum_max"] = h_max
        result["hum_critico_min"] = h_cmin
        result["hum_critico_max"] = h_cmax

    if "presion" in measured_vars and (
        payload.get("presion_min") is not None or payload.get("presion_max") is not None
    ):
        p_min = _to_finite_float(payload.get("presion_min"), "presion_min")
        p_max = _to_finite_float(payload.get("presion_max"), "presion_max")
        if p_min >= p_max:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=MIN_MAX_ERROR_MSG)
        if p_min < PRESSURE_RANGE[0] or p_max > PRESSURE_RANGE[1]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La presión debe estar entre {PRESSURE_RANGE[0]} hPa y {PRESSURE_RANGE[1]} hPa.",
            )
        result["presion_min"] = p_min
        result["presion_max"] = p_max

    return result


def evaluate_measurement_thresholds(
    limits: Optional[Dict[str, Any]],
    temperatura: Optional[float] = None,
    humedad: Optional[float] = None,
    presion: Optional[float] = None,
) -> Dict[str, Any]:
    """Motor de reglas ambientales RF-12 (listo para RF-13) sin alterar lecturas históricas."""
    if not limits:
        return {
            "estado_operacional": "SIN_CONFIGURACION",
            "nivel_criticidad": "NORMAL",
            "es_fuera_de_umbral": False,
            "variables_fuera_rango": [],
            "variables_criticas": [],
        }

    fuera_rango: List[str] = []
    criticas: List[str] = []

    checks = [
        ("temperatura", temperatura, "temp_min", "temp_max", "temp_critico_min", "temp_critico_max"),
        ("humedad", humedad, "hum_min", "hum_max", "hum_critico_min", "hum_critico_max"),
        ("presion", presion, "presion_min", "presion_max", None, None),
    ]
    for var_name, val, k_min, k_max, k_cmin, k_cmax in checks:
        if val is None:
            continue
        v_min = limits.get(k_min)
        v_max = limits.get(k_max)
        v_cmin = limits.get(k_cmin) if k_cmin else None
        v_cmax = limits.get(k_cmax) if k_cmax else None

        is_crit = False
        if v_cmin is not None and val < float(v_cmin):
            is_crit = True
        if v_cmax is not None and val > float(v_cmax):
            is_crit = True

        if is_crit:
            criticas.append(var_name)
            fuera_rango.append(var_name)
        elif (v_min is not None and val < float(v_min)) or (v_max is not None and val > float(v_max)):
            fuera_rango.append(var_name)

    if criticas:
        estado = "CRITICO"
        nivel = "CRITICO"
    elif fuera_rango:
        estado = "FUERA_DE_RANGO"
        nivel = "ADVERTENCIA"
    else:
        estado = "NORMAL"
        nivel = "NORMAL"

    return {
        "estado_operacional": estado,
        "nivel_criticidad": nivel,
        "es_fuera_de_umbral": len(fuera_rango) > 0,
        "variables_fuera_rango": fuera_rango,
        "variables_criticas": criticas,
    }


def list_all_threshold_configs() -> List[Dict[str, Any]]:
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT s.id_sensor, s.identificador, s.modelo, s.estado AS sensor_estado,
                   s.variables_medidas,
                   d.id_dispositivo, d.nombre AS dispositivo_nombre,
                   u.ubicacion_id, u.nombre AS ubicacion_nombre, u.codigo_area,
                   l.temp_min, l.temp_max, l.temp_critico_min, l.temp_critico_max,
                   l.hum_min, l.hum_max, l.hum_critico_min, l.hum_critico_max,
                   l.presion_min, l.presion_max, l.es_predeterminado, l.version,
                   l.actualizado_por, l.fecha_actualizacion
            FROM sensores s
            INNER JOIN dispositivos d ON d.id_dispositivo = s.dispositivo_id
            LEFT JOIN ubicaciones u ON u.ubicacion_id = d.ubicacion_id
            LEFT JOIN umbrales_alerta l ON l.sensor_id = s.id_sensor
            ORDER BY u.nombre ASC, d.nombre ASC, s.identificador ASC
            """
        )
        rows = cursor.fetchall()

    items: List[Dict[str, Any]] = []
    for r in rows:
        measured = _extract_measured_variables(r.get("variables_medidas"))
        has_cfg = any(
            r.get(k) is not None
            for k in ("temp_min", "temp_max", "hum_min", "hum_max", "presion_min", "presion_max")
        )
        cfg = (
            _serialize_threshold_row({"sensor_id": r["id_sensor"], **r})
            if has_cfg
            else None
        )
        t_low, t_high = MODEL_TEMP_RANGES.get(r["modelo"], (-40.0, 85.0))
        items.append(
            {
                "sensor_id": r["id_sensor"],
                "identificador": r["identificador"],
                "modelo": r["modelo"],
                "sensor_estado": r["sensor_estado"],
                "variables_medidas": measured,
                "rango_modelo_temperatura": {"min": t_low, "max": t_high},
                "dispositivo_id": r["id_dispositivo"],
                "dispositivo_nombre": r["dispositivo_nombre"],
                "ubicacion_id": r["ubicacion_id"],
                "ubicacion_nombre": r["ubicacion_nombre"],
                "codigo_area": r["codigo_area"],
                "configuracion": cfg,
            }
        )
    return items


def get_effective_sensor_thresholds(sensor_id: str) -> Dict[str, Any]:
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT s.id_sensor, s.identificador, s.modelo, s.estado AS sensor_estado,
                   s.variables_medidas,
                   d.id_dispositivo, d.nombre AS dispositivo_nombre,
                   u.ubicacion_id, u.nombre AS ubicacion_nombre, u.codigo_area
            FROM sensores s
            INNER JOIN dispositivos d ON d.id_dispositivo = s.dispositivo_id
            LEFT JOIN ubicaciones u ON u.ubicacion_id = d.ubicacion_id
            WHERE s.id_sensor = %s
            LIMIT 1
            """,
            (sensor_id,),
        )
        sensor = cursor.fetchone()
        if sensor is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor no encontrado.")

        cursor.execute(
            """
            SELECT sensor_id, temp_min, temp_max, temp_critico_min, temp_critico_max,
                   hum_min, hum_max, hum_critico_min, hum_critico_max,
                   presion_min, presion_max, es_predeterminado, version,
                   actualizado_por, fecha_actualizacion
            FROM umbrales_alerta
            WHERE sensor_id = %s
            LIMIT 1
            """,
            (sensor_id,),
        )
        cfg_row = cursor.fetchone()

    measured = _extract_measured_variables(sensor.get("variables_medidas"))
    t_low, t_high = MODEL_TEMP_RANGES.get(sensor["modelo"], (-40.0, 85.0))
    return {
        "sensor": {
            "id_sensor": sensor["id_sensor"],
            "identificador": sensor["identificador"],
            "modelo": sensor["modelo"],
            "estado": sensor["sensor_estado"],
            "variables_medidas": measured,
            "rango_modelo_temperatura": {"min": t_low, "max": t_high},
            "dispositivo_id": sensor["id_dispositivo"],
            "dispositivo_nombre": sensor["dispositivo_nombre"],
            "ubicacion_id": sensor["ubicacion_id"],
            "ubicacion_nombre": sensor["ubicacion_nombre"],
            "codigo_area": sensor["codigo_area"],
        },
        "precedencia": "SENSOR",
        "configuracion": _serialize_threshold_row(cfg_row),
    }


def upsert_sensor_thresholds(
    sensor_id: str,
    payload: Dict[str, Any],
    actualizado_por: str,
) -> Dict[str, Any]:
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT s.id_sensor, s.identificador, s.modelo, s.variables_medidas,
                   d.ubicacion_id
            FROM sensores s
            INNER JOIN dispositivos d ON d.id_dispositivo = s.dispositivo_id
            WHERE s.id_sensor = %s
            LIMIT 1
            """,
            (sensor_id,),
        )
        sensor = cursor.fetchone()
        if sensor is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor no encontrado.")

        measured = _extract_measured_variables(sensor.get("variables_medidas"))
        validated = validate_threshold_payload(sensor["modelo"], measured, payload)

        cursor.execute(
            "SELECT version FROM umbrales_alerta WHERE sensor_id = %s LIMIT 1 FOR UPDATE",
            (sensor_id,),
        )
        existing = cursor.fetchone()

        expected_version = payload.get("expected_version")
        current_version = int(existing["version"]) if existing and existing.get("version") is not None else 0
        if expected_version is not None and existing is not None and int(expected_version) != current_version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Conflicto de concurrencia: los umbrales fueron actualizados por otro usuario. Recarga la configuración vigente antes de guardar.",
            )

        new_version = (current_version + 1) if existing else 1
        now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
        motivo = (str(payload.get("motivo") or "").strip()[:255]) or "Actualización de umbrales RF-12"

        cursor.execute(
            """
            UPDATE historial_umbrales
            SET vigente_hasta = %s
            WHERE sensor_id = %s AND vigente_hasta IS NULL
            """,
            (now_utc, sensor_id),
        )

        cursor.execute(
            """
            INSERT INTO umbrales_alerta (
              sensor_id, temp_min, temp_max, temp_critico_min, temp_critico_max,
              hum_min, hum_max, hum_critico_min, hum_critico_max,
              presion_min, presion_max, es_predeterminado, version, actualizado_por
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0, %s, %s)
            ON DUPLICATE KEY UPDATE
              temp_min = VALUES(temp_min),
              temp_max = VALUES(temp_max),
              temp_critico_min = VALUES(temp_critico_min),
              temp_critico_max = VALUES(temp_critico_max),
              hum_min = VALUES(hum_min),
              hum_max = VALUES(hum_max),
              hum_critico_min = VALUES(hum_critico_min),
              hum_critico_max = VALUES(hum_critico_max),
              presion_min = VALUES(presion_min),
              presion_max = VALUES(presion_max),
              es_predeterminado = 0,
              version = VALUES(version),
              actualizado_por = VALUES(actualizado_por)
            """,
            (
                sensor_id,
                validated["temp_min"],
                validated["temp_max"],
                validated["temp_critico_min"],
                validated["temp_critico_max"],
                validated["hum_min"],
                validated["hum_max"],
                validated["hum_critico_min"],
                validated["hum_critico_max"],
                validated["presion_min"],
                validated["presion_max"],
                new_version,
                actualizado_por,
            ),
        )

        cursor.execute(
            """
            INSERT INTO historial_umbrales (
              id_historial, sensor_id,
              temp_min, temp_max, temp_critico_min, temp_critico_max,
              hum_min, hum_max, hum_critico_min, hum_critico_max,
              presion_min, presion_max, version, actualizado_por, motivo,
              vigente_desde, vigente_hasta
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NULL)
            """,
            (
                f"hu-{uuid.uuid4().hex[:12]}",
                sensor_id,
                validated["temp_min"],
                validated["temp_max"],
                validated["temp_critico_min"],
                validated["temp_critico_max"],
                validated["hum_min"],
                validated["hum_max"],
                validated["hum_critico_min"],
                validated["hum_critico_max"],
                validated["presion_min"],
                validated["presion_max"],
                new_version,
                actualizado_por,
                motivo,
                now_utc,
            ),
        )

    ubicacion_id = sensor.get("ubicacion_id")
    if ubicacion_id:
        live_temperature_broadcaster.publish_threshold_update(sensor_id, ubicacion_id)

    effective = get_effective_sensor_thresholds(sensor_id)
    return {
        "message": "Umbrales ambientales guardados en MySQL y aplicados al motor de reglas.",
        **effective,
    }


def get_sensor_threshold_history(sensor_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    with db_cursor() as cursor:
        cursor.execute("SELECT id_sensor FROM sensores WHERE id_sensor = %s LIMIT 1", (sensor_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor no encontrado.")

        cursor.execute(
            """
            SELECT id_historial, sensor_id,
                   temp_min, temp_max, temp_critico_min, temp_critico_max,
                   hum_min, hum_max, hum_critico_min, hum_critico_max,
                   presion_min, presion_max, version, actualizado_por, motivo,
                   vigente_desde, vigente_hasta
            FROM historial_umbrales
            WHERE sensor_id = %s
            ORDER BY vigente_desde DESC, version DESC
            LIMIT %s
            """,
            (sensor_id, limit),
        )
        rows = cursor.fetchall()

    out: List[Dict[str, Any]] = []
    for r in rows:
        item = _serialize_threshold_row(r) or {}
        item["id_historial"] = r["id_historial"]
        item["motivo"] = r.get("motivo")
        item["vigente_desde"] = _serialize_dt(r.get("vigente_desde"))
        item["vigente_hasta"] = _serialize_dt(r.get("vigente_hasta"))
        out.append(item)
    return out
