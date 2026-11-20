from datetime import date, datetime, timezone
import json
import math
from typing import Any, Dict, List, Literal, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
import pymysql

from ..database import db_cursor
from ..dependencies import require_roles

router = APIRouter(tags=["Sensores Ambientales (RF-04)"])

SensorModelo = Literal["DHT22", "BME280", "SHT31"]
SensorEstado = Literal["ACTIVO", "FALLA", "CALIBRACION", "INACTIVO"]
VariableNombre = Literal["temperatura", "humedad", "presion"]

MODEL_CAPABILITIES: Dict[str, Dict[str, str]] = {
    "DHT22": {"temperatura": "°C", "humedad": "%RH"},
    "BME280": {"temperatura": "°C", "humedad": "%RH", "presion": "hPa"},
    "SHT31": {"temperatura": "°C", "humedad": "%RH"},
}

DEFAULT_LIMITS: Dict[str, Dict[str, float]] = {
    "temperatura": {"min": 18.0, "max": 25.0},
    "humedad": {"min": 40.0, "max": 70.0},
    "presion": {"min": 980.0, "max": 1030.0},
}


class SensorCreateRequest(BaseModel):
    dispositivo_id: str = Field(..., min_length=1, max_length=64)
    identificador: str = Field(..., min_length=2, max_length=64)
    modelo: SensorModelo
    variables: List[VariableNombre] = Field(..., min_length=1)
    fecha_instalacion: date
    ultima_calibracion: date
    estado: SensorEstado = "ACTIVO"
    descripcion: Optional[str] = Field(default=None, max_length=255)

    @field_validator("dispositivo_id", "identificador")
    @classmethod
    def strip_required(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("El campo no puede estar vacío.")
        return cleaned


class SensorUpdateRequest(BaseModel):
    identificador: str = Field(..., min_length=2, max_length=64)
    modelo: SensorModelo
    variables: List[VariableNombre] = Field(..., min_length=1)
    fecha_instalacion: date
    ultima_calibracion: date
    descripcion: Optional[str] = Field(default=None, max_length=255)

    @field_validator("identificador")
    @classmethod
    def strip_required(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("El identificador no puede estar vacío.")
        return cleaned


class SensorEstadoRequest(BaseModel):
    estado: SensorEstado


class TelemetryIngestValidationRequest(BaseModel):
    dispositivo_id: str = Field(..., min_length=1, max_length=64)
    sensor_id: str = Field(..., min_length=1, max_length=64)
    variable: VariableNombre
    valor: float
    unidad: str = Field(..., min_length=1, max_length=16)
    fecha_hora: Optional[datetime] = None


class SensorVariablesUpdateRequest(BaseModel):
    temperatura_habilitada: bool
    humedad_habilitada: bool
    presion_habilitada: Optional[bool] = False
    unidad_temperatura: str = Field(default="°C", min_length=1, max_length=16)
    unidad_humedad: str = Field(default="%RH", min_length=1, max_length=16)
    unidad_presion: Optional[str] = Field(default=None, max_length=16)


class TelemetryPayloadRequest(BaseModel):
    dispositivo_id: str = Field(..., min_length=1, max_length=64)
    sensor_id: str = Field(..., min_length=1, max_length=64)
    temperatura: Optional[float] = None
    humedad: Optional[float] = None
    presion: Optional[float] = None
    unidad_temperatura: Optional[str] = None
    unidad_humedad: Optional[str] = None
    unidad_presion: Optional[str] = None
    fecha_hora: Optional[datetime] = None


STANDARD_UNITS: Dict[str, str] = {
    "temperatura": "°C",
    "humedad": "%RH",
    "presion": "hPa",
}


def _active_variables_from_cfg(modelo: str, cfg_row: Dict[str, Any]) -> List[Dict[str, str]]:
    allowed = MODEL_CAPABILITIES.get(modelo, {})
    active: List[Dict[str, str]] = []
    if cfg_row.get("temperatura_habilitada") and "temperatura" in allowed:
        active.append({"variable": "temperatura", "unidad": STANDARD_UNITS["temperatura"]})
    if cfg_row.get("humedad_habilitada") and "humedad" in allowed:
        active.append({"variable": "humedad", "unidad": STANDARD_UNITS["humedad"]})
    if cfg_row.get("presion_habilitada") and "presion" in allowed:
        active.append({"variable": "presion", "unidad": STANDARD_UNITS["presion"]})
    return active


def _record_variables_history(
    cursor: Any,
    cfg_id: str,
    sensor_id: str,
    modelo: str,
    temp_on: bool,
    hum_on: bool,
    pres_on: bool,
    usuario_responsable: str,
) -> None:
    allowed = MODEL_CAPABILITIES.get(modelo, {})
    unidad_pres = STANDARD_UNITS["presion"] if "presion" in allowed else None
    snapshot = _active_variables_from_cfg(
        modelo,
        {
            "temperatura_habilitada": temp_on,
            "humedad_habilitada": hum_on,
            "presion_habilitada": pres_on,
        },
    )
    cursor.execute(
        """
        INSERT INTO historial_configuracion_variables (
          configuracion_id, sensor_id, temperatura_habilitada, humedad_habilitada,
          presion_habilitada, unidad_temperatura, unidad_humedad, unidad_presion,
          variables_snapshot, usuario_responsable
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            cfg_id,
            sensor_id,
            1 if temp_on else 0,
            1 if hum_on else 0,
            1 if pres_on else 0,
            STANDARD_UNITS["temperatura"],
            STANDARD_UNITS["humedad"],
            unidad_pres,
            json.dumps(snapshot, ensure_ascii=False),
            usuario_responsable,
        ),
    )


def _ensure_sensor_variables_config(
    cursor: Any,
    sensor_row: Dict[str, Any],
    usuario_responsable: str,
) -> Dict[str, Any]:
    sensor_id = sensor_row["id_sensor"]
    cursor.execute(
        "SELECT * FROM configuracion_variables_sensor WHERE sensor_id = %s LIMIT 1",
        (sensor_id,),
    )
    cfg = cursor.fetchone()
    if cfg is not None:
        return cfg

    modelo = sensor_row["modelo"]
    allowed = MODEL_CAPABILITIES.get(modelo, {})
    raw_vars = sensor_row.get("variables_medidas") or "[]"
    try:
        parsed = json.loads(raw_vars) if isinstance(raw_vars, str) else raw_vars
    except Exception:
        parsed = []
    var_names = {v.get("variable") for v in parsed if isinstance(v, dict)}

    temp_on = "temperatura" in var_names and "temperatura" in allowed
    hum_on = "humedad" in var_names and "humedad" in allowed
    pres_on = "presion" in var_names and "presion" in allowed
    if not (temp_on or hum_on or pres_on):
        temp_on = "temperatura" in allowed
        hum_on = "humedad" in allowed
        pres_on = "presion" in allowed

    cfg_id = f"cfg-{uuid.uuid4().hex[:8]}"
    unidad_pres = STANDARD_UNITS["presion"] if "presion" in allowed else None
    cursor.execute(
        """
        INSERT INTO configuracion_variables_sensor (
          id_configuracion, sensor_id, temperatura_habilitada, humedad_habilitada,
          presion_habilitada, unidad_temperatura, unidad_humedad, unidad_presion, actualizado_por
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            cfg_id,
            sensor_id,
            1 if temp_on else 0,
            1 if hum_on else 0,
            1 if pres_on else 0,
            STANDARD_UNITS["temperatura"],
            STANDARD_UNITS["humedad"],
            unidad_pres,
            usuario_responsable,
        ),
    )
    _record_variables_history(
        cursor, cfg_id, sensor_id, modelo, temp_on, hum_on, pres_on, usuario_responsable
    )
    cursor.execute(
        "SELECT * FROM configuracion_variables_sensor WHERE sensor_id = %s LIMIT 1",
        (sensor_id,),
    )
    return cursor.fetchone()


def _serialize_variables_config(sensor_row: Dict[str, Any], cfg_row: Dict[str, Any]) -> Dict[str, Any]:
    modelo = sensor_row["modelo"]
    allowed = MODEL_CAPABILITIES.get(modelo, {})
    fc = cfg_row.get("fecha_creacion")
    fa = cfg_row.get("fecha_actualizacion")
    return {
        "id_configuracion": cfg_row["id_configuracion"],
        "sensor_id": sensor_row["id_sensor"],
        "identificador": sensor_row["identificador"],
        "modelo": modelo,
        "estado": sensor_row["estado"],
        "dispositivo_id": sensor_row["dispositivo_id"],
        "dispositivo_nombre": sensor_row.get("dispositivo_nombre"),
        "ubicacion_id": sensor_row.get("ubicacion_id"),
        "ubicacion_nombre": sensor_row.get("ubicacion_nombre"),
        "variables_disponibles": [{"variable": k, "unidad": v} for k, v in allowed.items()],
        "temperatura_habilitada": bool(cfg_row.get("temperatura_habilitada")),
        "humedad_habilitada": bool(cfg_row.get("humedad_habilitada")),
        "presion_habilitada": bool(cfg_row.get("presion_habilitada")) if "presion" in allowed else False,
        "unidad_temperatura": cfg_row.get("unidad_temperatura") or STANDARD_UNITS["temperatura"],
        "unidad_humedad": cfg_row.get("unidad_humedad") or STANDARD_UNITS["humedad"],
        "unidad_presion": (cfg_row.get("unidad_presion") or STANDARD_UNITS["presion"]) if "presion" in allowed else None,
        "variables_habilitadas": _active_variables_from_cfg(modelo, cfg_row),
        "actualizado_por": cfg_row.get("actualizado_por"),
        "fecha_creacion": fc.isoformat() if hasattr(fc, "isoformat") else (str(fc) if fc else None),
        "fecha_actualizacion": fa.isoformat() if hasattr(fa, "isoformat") else (str(fa) if fa else None),
    }


def _validate_model_variables_and_dates(
    modelo: str,
    variables: List[str],
    fecha_instalacion: date,
    ultima_calibracion: date,
) -> List[Dict[str, str]]:
    if ultima_calibracion < fecha_instalacion:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha de última calibración no puede ser anterior a la fecha de instalación.",
        )

    allowed = MODEL_CAPABILITIES.get(modelo)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Modelo de sensor no permitido. Modelos admitidos: DHT22, BME280, SHT31.",
        )

    seen = set()
    normalized: List[Dict[str, str]] = []
    for var in variables:
        if var not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El modelo {modelo} no admite la variable '{var}'.",
            )
        if var not in seen:
            seen.add(var)
            normalized.append({"variable": var, "unidad": allowed[var]})

    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe seleccionar al menos una variable válida para el sensor.",
        )
    return normalized


def _build_default_limits_for_variables(variables_meta: List[Dict[str, str]]) -> Dict[str, Optional[float]]:
    var_names = {v["variable"] for v in variables_meta}
    return {
        "temp_min": DEFAULT_LIMITS["temperatura"]["min"] if "temperatura" in var_names else None,
        "temp_max": DEFAULT_LIMITS["temperatura"]["max"] if "temperatura" in var_names else None,
        "hum_min": DEFAULT_LIMITS["humedad"]["min"] if "humedad" in var_names else None,
        "hum_max": DEFAULT_LIMITS["humedad"]["max"] if "humedad" in var_names else None,
        "presion_min": DEFAULT_LIMITS["presion"]["min"] if "presion" in var_names else None,
        "presion_max": DEFAULT_LIMITS["presion"]["max"] if "presion" in var_names else None,
    }


def _serialize_sensor(row: Dict[str, Any]) -> Dict[str, Any]:
    raw_vars = row.get("variables_medidas") or "[]"
    try:
        vars_parsed = json.loads(raw_vars) if isinstance(raw_vars, str) else raw_vars
    except Exception:
        vars_parsed = []

    fi = row.get("fecha_instalacion")
    uc = row.get("ultima_calibracion")
    fc = row.get("fecha_creacion")
    fa = row.get("fecha_actualizacion")
    return {
        "id_sensor": row["id_sensor"],
        "dispositivo_id": row["dispositivo_id"],
        "dispositivo_nombre": row.get("dispositivo_nombre"),
        "dispositivo_codigo": row.get("dispositivo_codigo"),
        "dispositivo_estado": row.get("dispositivo_estado"),
        "ubicacion_id": row.get("ubicacion_id"),
        "ubicacion_nombre": row.get("ubicacion_nombre") or row.get("ubicacion"),
        "identificador": row["identificador"],
        "modelo": row["modelo"],
        "variables_medidas": vars_parsed,
        "fecha_instalacion": fi.isoformat() if hasattr(fi, "isoformat") else str(fi),
        "ultima_calibracion": uc.isoformat() if hasattr(uc, "isoformat") else str(uc),
        "estado": row["estado"],
        "descripcion": row.get("descripcion"),
        "historial_mediciones_count": int(row.get("historial_mediciones_count") or 0),
        "fecha_creacion": fc.isoformat() if hasattr(fc, "isoformat") else (str(fc) if fc else None),
        "fecha_actualizacion": fa.isoformat() if hasattr(fa, "isoformat") else (str(fa) if fa else None),
    }


_SENSOR_SELECT = """
    SELECT
      s.id_sensor, s.dispositivo_id, s.identificador, s.modelo, s.variables_medidas,
      s.fecha_instalacion, s.ultima_calibracion, s.estado, s.descripcion,
      s.fecha_creacion, s.fecha_actualizacion,
      d.nombre AS dispositivo_nombre, d.codigo AS dispositivo_codigo, d.estado AS dispositivo_estado,
      d.ubicacion_id, d.ubicacion, u.nombre AS ubicacion_nombre,
      COUNT(m.id_medicion) AS historial_mediciones_count
    FROM sensores s
    INNER JOIN dispositivos d ON d.id_dispositivo = s.dispositivo_id
    LEFT JOIN ubicaciones u ON u.ubicacion_id = d.ubicacion_id
    LEFT JOIN mediciones m ON m.sensor_id = s.id_sensor
"""


@router.get("/api/sensores")
def list_sensores(
    dispositivo_id: Optional[str] = Query(default=None),
    modelo: Optional[str] = Query(default=None),
    estado: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    conditions: List[str] = []
    params: List[Any] = []

    if dispositivo_id and dispositivo_id.strip():
        conditions.append("s.dispositivo_id = %s")
        params.append(dispositivo_id.strip())
    if modelo and modelo.strip() and modelo != "ALL":
        conditions.append("s.modelo = %s")
        params.append(modelo.strip())
    if estado and estado.strip() and estado != "ALL":
        conditions.append("s.estado = %s")
        params.append(estado.strip())
    if search and search.strip():
        q = f"%{search.strip()}%"
        conditions.append("(s.identificador LIKE %s OR s.modelo LIKE %s OR d.nombre LIKE %s)")
        params.extend([q, q, q])

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with db_cursor() as cursor:
        cursor.execute(
            f"""
            {_SENSOR_SELECT}
            {where_clause}
            GROUP BY s.id_sensor
            ORDER BY s.fecha_creacion DESC, s.identificador ASC
            """,
            tuple(params),
        )
        rows = cursor.fetchall()

    return {
        "items": [_serialize_sensor(r) for r in rows],
        "total": len(rows),
        "capacidades_modelos": MODEL_CAPABILITIES,
    }


@router.get("/api/sensores/{id_sensor}")
def get_sensor(
    id_sensor: str,
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    with db_cursor() as cursor:
        cursor.execute(
            f"{_SENSOR_SELECT} WHERE s.id_sensor = %s GROUP BY s.id_sensor LIMIT 1",
            (id_sensor,),
        )
        row = cursor.fetchone()

    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor no encontrado.")

    return {"sensor": _serialize_sensor(row)}


@router.get("/api/dispositivos/{id_dispositivo}/sensores")
def list_sensores_by_dispositivo(
    id_dispositivo: str,
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    with db_cursor() as cursor:
        cursor.execute(
            "SELECT id_dispositivo, nombre, codigo, estado FROM dispositivos WHERE id_dispositivo = %s LIMIT 1",
            (id_dispositivo,),
        )
        dev = cursor.fetchone()
        if dev is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispositivo no encontrado.")

        cursor.execute(
            f"{_SENSOR_SELECT} WHERE s.dispositivo_id = %s GROUP BY s.id_sensor ORDER BY s.identificador ASC",
            (id_dispositivo,),
        )
        rows = cursor.fetchall()

    return {
        "dispositivo": dev,
        "items": [_serialize_sensor(r) for r in rows],
        "total": len(rows),
    }


@router.post("/api/sensores", status_code=status.HTTP_201_CREATED)
def create_sensor(
    payload: SensorCreateRequest,
    current_user: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> Dict[str, Any]:
    vars_meta = _validate_model_variables_and_dates(
        payload.modelo,
        list(payload.variables),
        payload.fecha_instalacion,
        payload.ultima_calibracion,
    )
    limits = _build_default_limits_for_variables(vars_meta)
    sensor_id = f"sen-{uuid.uuid4().hex[:8]}"

    try:
        with db_cursor() as cursor:
            cursor.execute(
                """
                SELECT d.id_dispositivo, d.estado AS dispositivo_estado, d.ubicacion_id, u.estado AS ubicacion_estado
                FROM dispositivos d
                LEFT JOIN ubicaciones u ON u.ubicacion_id = d.ubicacion_id
                WHERE d.id_dispositivo = %s
                LIMIT 1
                """,
                (payload.dispositivo_id,),
            )
            dev = cursor.fetchone()
            if dev is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="El dispositivo padre no existe.",
                )
            if dev["dispositivo_estado"] == "INACTIVO":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No se puede vincular un sensor a un dispositivo inactivo.",
                )
            if not dev.get("ubicacion_id") or dev.get("ubicacion_estado") != "ACTIVA":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El dispositivo padre debe tener una ubicación física activa válida (RF-03).",
                )

            cursor.execute(
                "SELECT id_sensor FROM sensores WHERE identificador = %s LIMIT 1",
                (payload.identificador,),
            )
            if cursor.fetchone() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ya existe un sensor registrado con ese identificador único.",
                )

            cursor.execute(
                """
                INSERT INTO sensores (
                  id_sensor, dispositivo_id, identificador, modelo, variables_medidas,
                  fecha_instalacion, ultima_calibracion, estado, descripcion
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    sensor_id,
                    payload.dispositivo_id,
                    payload.identificador,
                    payload.modelo,
                    json.dumps(vars_meta, ensure_ascii=False),
                    payload.fecha_instalacion,
                    payload.ultima_calibracion,
                    payload.estado,
                    payload.descripcion.strip() if payload.descripcion else None,
                ),
            )

            cursor.execute(
                """
                INSERT INTO umbrales_alerta (
                  sensor_id, temp_min, temp_max, hum_min, hum_max, presion_min, presion_max,
                  es_predeterminado, actualizado_por
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, 1, %s)
                """,
                (
                    sensor_id,
                    limits["temp_min"],
                    limits["temp_max"],
                    limits["hum_min"],
                    limits["hum_max"],
                    limits["presion_min"],
                    limits["presion_max"],
                    current_user["correo"],
                ),
            )

            cursor.execute(
                f"{_SENSOR_SELECT} WHERE s.id_sensor = %s GROUP BY s.id_sensor LIMIT 1",
                (sensor_id,),
            )
            created = cursor.fetchone()
            if created is not None:
                _ensure_sensor_variables_config(cursor, created, current_user["correo"])
    except pymysql.err.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un sensor registrado con ese identificador único.",
        )

    return {
        "message": "Sensor registrado y vinculado con límites predeterminados configurables.",
        "sensor": _serialize_sensor(created),
        "configuracion_inicial": {
            "sensor_id": sensor_id,
            "es_predeterminado": True,
            "nota": "Valores predeterminados configurables posteriormente mediante RF-05 y RF-12.",
            **limits,
        },
    }


@router.put("/api/sensores/{id_sensor}")
def update_sensor(
    id_sensor: str,
    payload: SensorUpdateRequest,
    _admin: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> Dict[str, Any]:
    vars_meta = _validate_model_variables_and_dates(
        payload.modelo,
        list(payload.variables),
        payload.fecha_instalacion,
        payload.ultima_calibracion,
    )

    try:
        with db_cursor() as cursor:
            cursor.execute("SELECT id_sensor FROM sensores WHERE id_sensor = %s LIMIT 1", (id_sensor,))
            if cursor.fetchone() is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor no encontrado.")

            cursor.execute(
                "SELECT id_sensor FROM sensores WHERE identificador = %s AND id_sensor <> %s LIMIT 1",
                (payload.identificador, id_sensor),
            )
            if cursor.fetchone() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ya existe otro sensor con ese identificador único.",
                )

            cursor.execute(
                """
                UPDATE sensores
                SET identificador = %s,
                    modelo = %s,
                    variables_medidas = %s,
                    fecha_instalacion = %s,
                    ultima_calibracion = %s,
                    descripcion = %s
                WHERE id_sensor = %s
                """,
                (
                    payload.identificador,
                    payload.modelo,
                    json.dumps(vars_meta, ensure_ascii=False),
                    payload.fecha_instalacion,
                    payload.ultima_calibracion,
                    payload.descripcion.strip() if payload.descripcion else None,
                    id_sensor,
                ),
            )

            cursor.execute(
                f"{_SENSOR_SELECT} WHERE s.id_sensor = %s GROUP BY s.id_sensor LIMIT 1",
                (id_sensor,),
            )
            updated = cursor.fetchone()
    except pymysql.err.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe otro sensor con ese identificador único.",
        )

    return {"message": "Sensor actualizado correctamente.", "sensor": _serialize_sensor(updated)}


@router.patch("/api/sensores/{id_sensor}/estado")
def update_sensor_estado(
    id_sensor: str,
    payload: SensorEstadoRequest,
    _admin: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> Dict[str, Any]:
    with db_cursor() as cursor:
        cursor.execute("SELECT id_sensor FROM sensores WHERE id_sensor = %s LIMIT 1", (id_sensor,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor no encontrado.")

        cursor.execute(
            "UPDATE sensores SET estado = %s WHERE id_sensor = %s",
            (payload.estado, id_sensor),
        )
        cursor.execute(
            f"{_SENSOR_SELECT} WHERE s.id_sensor = %s GROUP BY s.id_sensor LIMIT 1",
            (id_sensor,),
        )
        updated = cursor.fetchone()

    nota_rn05 = (
        " En estado FALLA o CALIBRACION no genera alertas de producción (RN-05) y conserva su historial."
        if payload.estado in ("FALLA", "CALIBRACION")
        else ""
    )
    return {
        "message": f"Estado del sensor actualizado a {payload.estado}.{nota_rn05}",
        "sensor": _serialize_sensor(updated),
    }


@router.get("/api/sensores/{id_sensor}/configuraciones")
def get_sensor_configuraciones(
    id_sensor: str,
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    with db_cursor() as cursor:
        cursor.execute(
            "SELECT id_sensor, identificador, modelo, variables_medidas, estado FROM sensores WHERE id_sensor = %s LIMIT 1",
            (id_sensor,),
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
            (id_sensor,),
        )
        cfg = cursor.fetchone()

    if cfg:
        for k in (
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
        ):
            if cfg.get(k) is not None:
                cfg[k] = float(cfg[k])
        cfg["es_predeterminado"] = bool(cfg.get("es_predeterminado", 1))
        cfg["version"] = int(cfg.get("version") or 1)
        fa = cfg.get("fecha_actualizacion")
        cfg["fecha_actualizacion"] = fa.isoformat() if hasattr(fa, "isoformat") else (str(fa) if fa else None)

    return {
        "sensor": {
            "id_sensor": sensor["id_sensor"],
            "identificador": sensor["identificador"],
            "modelo": sensor["modelo"],
            "estado": sensor["estado"],
            "variables_medidas": json.loads(sensor["variables_medidas"]),
        },
        "configuracion": cfg,
    }


@router.post("/api/sensores/validar-ingesta")
def validate_and_record_telemetry_rn05(
    payload: TelemetryIngestValidationRequest,
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Técnico")
    ),
) -> Dict[str, Any]:
    """Valida relación dispositivo-sensor-variable-unidad y aplica RN-05 (sin alertas en FALLA/CALIBRACION)."""
    capture_dt = (
        payload.fecha_hora.astimezone(timezone.utc).replace(tzinfo=None)
        if payload.fecha_hora
        else datetime.now(timezone.utc).replace(tzinfo=None)
    )

    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT s.id_sensor, s.dispositivo_id, s.modelo, s.variables_medidas, s.estado,
                   d.ubicacion_id, d.estado AS dispositivo_estado
            FROM sensores s
            INNER JOIN dispositivos d ON d.id_dispositivo = s.dispositivo_id
            WHERE s.id_sensor = %s
            LIMIT 1
            """,
            (payload.sensor_id,),
        )
        sensor = cursor.fetchone()
        if sensor is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor no encontrado.")

        if sensor["dispositivo_id"] != payload.dispositivo_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="El dispositivo emisor no puede enviar mediciones atribuidas a un sensor no vinculado a él.",
            )

        if sensor["estado"] == "INACTIVO" or sensor["dispositivo_estado"] == "INACTIVO":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sensor o dispositivo inactivo; no participa en monitoreo activo.",
            )

        var_cfg = _ensure_sensor_variables_config(cursor, sensor, "system@simoa")
        active_vars = _active_variables_from_cfg(sensor["modelo"], var_cfg)
        matched_var = next((v for v in active_vars if v["variable"] == payload.variable), None)
        if matched_var is None or matched_var["unidad"] != payload.unidad:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La variable o unidad no está habilitada en la configuración actual del sensor.",
            )

        cursor.execute(
            "SELECT temp_min, temp_max, hum_min, hum_max, presion_min, presion_max FROM umbrales_alerta WHERE sensor_id = %s LIMIT 1",
            (payload.sensor_id,),
        )
        cfg = cursor.fetchone()

        fuera_umbral = False
        if cfg:
            if payload.variable == "temperatura" and cfg["temp_min"] is not None and cfg["temp_max"] is not None:
                fuera_umbral = payload.valor < float(cfg["temp_min"]) or payload.valor > float(cfg["temp_max"])
            elif payload.variable == "humedad" and cfg["hum_min"] is not None and cfg["hum_max"] is not None:
                fuera_umbral = payload.valor < float(cfg["hum_min"]) or payload.valor > float(cfg["hum_max"])
            elif payload.variable == "presion" and cfg["presion_min"] is not None and cfg["presion_max"] is not None:
                fuera_umbral = payload.valor < float(cfg["presion_min"]) or payload.valor > float(cfg["presion_max"])

        # RN-05: En FALLA o CALIBRACION se guarda trazabilidad pero NO se disparan alertas de producción
        alerta_produccion = bool(fuera_umbral and sensor["estado"] == "ACTIVO")
        suprimida_rn05 = bool(fuera_umbral and sensor["estado"] in ("FALLA", "CALIBRACION"))

        temp_val = payload.valor if payload.variable == "temperatura" else None
        hum_val = payload.valor if payload.variable == "humedad" else None
        pres_val = payload.valor if payload.variable == "presion" else None
        snapshot_str = json.dumps([v["variable"] for v in active_vars], ensure_ascii=False)

        cursor.execute(
            """
            INSERT INTO mediciones (
              dispositivo_id, sensor_id, ubicacion_id, temperatura, humedad, presion,
              alerta_generada, configuracion_id, variables_activas_snapshot, fecha_hora
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                payload.dispositivo_id,
                payload.sensor_id,
                sensor["ubicacion_id"],
                temp_val,
                hum_val,
                pres_val,
                1 if alerta_produccion else 0,
                var_cfg["id_configuracion"],
                snapshot_str,
                capture_dt,
            ),
        )
        med_id = cursor.lastrowid

    return {
        "id_medicion": med_id,
        "dispositivo_id": payload.dispositivo_id,
        "sensor_id": payload.sensor_id,
        "estado_sensor": sensor["estado"],
        "configuracion_id": var_cfg["id_configuracion"],
        "fuera_de_umbral": fuera_umbral,
        "alerta_produccion_generada": alerta_produccion,
        "alerta_suprimida_rn05": suprimida_rn05,
    }


@router.get("/api/sensores/{id_sensor}/variables")
def get_sensor_variables_config(
    id_sensor: str,
    current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    with db_cursor() as cursor:
        cursor.execute(
            f"{_SENSOR_SELECT} WHERE s.id_sensor = %s GROUP BY s.id_sensor LIMIT 1",
            (id_sensor,),
        )
        sensor = cursor.fetchone()
        if sensor is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor no encontrado.")
        cfg = _ensure_sensor_variables_config(cursor, sensor, current_user["correo"])

    return {"configuracion": _serialize_variables_config(sensor, cfg)}


@router.put("/api/sensores/{id_sensor}/variables")
def update_sensor_variables_config(
    id_sensor: str,
    payload: SensorVariablesUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> Dict[str, Any]:
    temp_on = bool(payload.temperatura_habilitada)
    hum_on = bool(payload.humedad_habilitada)
    pres_on = bool(payload.presion_habilitada)

    if not (temp_on or hum_on or pres_on):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe seleccionar al menos una variable ambiental",
        )

    if payload.unidad_temperatura != STANDARD_UNITS["temperatura"] or payload.unidad_humedad != STANDARD_UNITS["humedad"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="RN-06: Solo se permiten las unidades estándar inmutables (°C para temperatura y %RH para humedad relativa).",
        )

    with db_cursor() as cursor:
        cursor.execute(
            f"{_SENSOR_SELECT} WHERE s.id_sensor = %s GROUP BY s.id_sensor LIMIT 1",
            (id_sensor,),
        )
        sensor = cursor.fetchone()
        if sensor is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor no encontrado.")

        if sensor["estado"] == "INACTIVO":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Los sensores inactivos no participan en nuevas operaciones de monitoreo.",
            )

        modelo = sensor["modelo"]
        allowed = MODEL_CAPABILITIES.get(modelo, {})

        if temp_on and "temperatura" not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El modelo {modelo} no admite la variable 'temperatura'.",
            )
        if hum_on and "humedad" not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El modelo {modelo} no admite la variable 'humedad'.",
            )
        if pres_on and "presion" not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El modelo {modelo} no admite la variable 'presion'.",
            )
        if "presion" in allowed and payload.unidad_presion not in (None, STANDARD_UNITS["presion"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="RN-06: La unidad estándar para presión atmosférica es hPa.",
            )

        existing_cfg = _ensure_sensor_variables_config(cursor, sensor, current_user["correo"])
        cfg_id = existing_cfg["id_configuracion"]
        unidad_pres = STANDARD_UNITS["presion"] if "presion" in allowed else None
        pres_effective = pres_on if "presion" in allowed else False

        cursor.execute(
            """
            UPDATE configuracion_variables_sensor
            SET temperatura_habilitada = %s,
                humedad_habilitada = %s,
                presion_habilitada = %s,
                unidad_temperatura = %s,
                unidad_humedad = %s,
                unidad_presion = %s,
                actualizado_por = %s
            WHERE sensor_id = %s
            """,
            (
                1 if temp_on else 0,
                1 if hum_on else 0,
                1 if pres_effective else 0,
                STANDARD_UNITS["temperatura"],
                STANDARD_UNITS["humedad"],
                unidad_pres,
                current_user["correo"],
                id_sensor,
            ),
        )

        new_vars_meta = _active_variables_from_cfg(
            modelo,
            {
                "temperatura_habilitada": temp_on,
                "humedad_habilitada": hum_on,
                "presion_habilitada": pres_effective,
            },
        )
        cursor.execute(
            "UPDATE sensores SET variables_medidas = %s WHERE id_sensor = %s",
            (json.dumps(new_vars_meta, ensure_ascii=False), id_sensor),
        )

        _record_variables_history(
            cursor,
            cfg_id,
            id_sensor,
            modelo,
            temp_on,
            hum_on,
            pres_effective,
            current_user["correo"],
        )

        cursor.execute(
            f"{_SENSOR_SELECT} WHERE s.id_sensor = %s GROUP BY s.id_sensor LIMIT 1",
            (id_sensor,),
        )
        updated_sensor = cursor.fetchone()
        cursor.execute(
            "SELECT * FROM configuracion_variables_sensor WHERE sensor_id = %s LIMIT 1",
            (id_sensor,),
        )
        updated_cfg = cursor.fetchone()

    return {
        "message": "Configuración de variables actualizada correctamente en MySQL.",
        "configuracion": _serialize_variables_config(updated_sensor, updated_cfg),
    }


@router.get("/api/sensores/{id_sensor}/historial-configuraciones")
def get_sensor_variables_history(
    id_sensor: str,
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    with db_cursor() as cursor:
        cursor.execute("SELECT id_sensor FROM sensores WHERE id_sensor = %s LIMIT 1", (id_sensor,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor no encontrado.")

        cursor.execute(
            """
            SELECT id_historial, configuracion_id, sensor_id,
                   temperatura_habilitada, humedad_habilitada, presion_habilitada,
                   unidad_temperatura, unidad_humedad, unidad_presion,
                   variables_snapshot, usuario_responsable, fecha_cambio
            FROM historial_configuracion_variables
            WHERE sensor_id = %s
            ORDER BY fecha_cambio DESC, id_historial DESC
            """,
            (id_sensor,),
        )
        rows = cursor.fetchall()

    items: List[Dict[str, Any]] = []
    for row in rows:
        fc = row.get("fecha_cambio")
        try:
            snap = json.loads(row.get("variables_snapshot") or "[]")
        except Exception:
            snap = []
        items.append(
            {
                "id_historial": int(row["id_historial"]),
                "configuracion_id": row["configuracion_id"],
                "sensor_id": row["sensor_id"],
                "temperatura_habilitada": bool(row["temperatura_habilitada"]),
                "humedad_habilitada": bool(row["humedad_habilitada"]),
                "presion_habilitada": bool(row["presion_habilitada"]),
                "unidad_temperatura": row["unidad_temperatura"],
                "unidad_humedad": row["unidad_humedad"],
                "unidad_presion": row["unidad_presion"],
                "variables_snapshot": snap,
                "usuario_responsable": row["usuario_responsable"],
                "fecha_cambio": fc.isoformat() if hasattr(fc, "isoformat") else str(fc),
            }
        )

    return {"items": items, "total": len(items)}


@router.post("/api/sensores/telemetria")
def ingest_telemetry_by_sensor_config(
    payload: TelemetryPayloadRequest,
    current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Técnico", "Operador")
    ),
) -> Dict[str, Any]:
    """Procesa telemetría real consultando las variables habilitadas del sensor en RF-05."""
    capture_dt = (
        payload.fecha_hora.astimezone(timezone.utc).replace(tzinfo=None)
        if payload.fecha_hora
        else datetime.now(timezone.utc).replace(tzinfo=None)
    )

    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT s.id_sensor, s.dispositivo_id, s.identificador, s.modelo, s.variables_medidas,
                   s.estado, d.ubicacion_id, d.estado AS dispositivo_estado
            FROM sensores s
            INNER JOIN dispositivos d ON d.id_dispositivo = s.dispositivo_id
            WHERE s.id_sensor = %s
            LIMIT 1
            """,
            (payload.sensor_id,),
        )
        sensor = cursor.fetchone()
        if sensor is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor no encontrado.")

        if sensor["dispositivo_id"] != payload.dispositivo_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="El dispositivo emisor no coincide con el dispositivo padre del sensor.",
            )

        if sensor["estado"] == "INACTIVO" or sensor["dispositivo_estado"] == "INACTIVO":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sensor o dispositivo inactivo; no participa en nuevas operaciones de monitoreo.",
            )

        var_cfg = _ensure_sensor_variables_config(cursor, sensor, current_user["correo"])
        temp_on = bool(var_cfg["temperatura_habilitada"])
        hum_on = bool(var_cfg["humedad_habilitada"])
        pres_on = bool(var_cfg["presion_habilitada"]) and ("presion" in MODEL_CAPABILITIES.get(sensor["modelo"], {}))

        # Validar obligatoriedad y unidades de variables habilitadas
        if temp_on:
            if payload.temperatura is None or not math.isfinite(payload.temperatura):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La variable temperatura (°C) está habilitada y es obligatoria en la carga útil.",
                )
            if payload.unidad_temperatura and payload.unidad_temperatura != STANDARD_UNITS["temperatura"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="RN-06: La unidad de temperatura debe ser °C.",
                )

        if hum_on:
            if payload.humedad is None or not math.isfinite(payload.humedad):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La variable humedad relativa (%RH) está habilitada y es obligatoria en la carga útil.",
                )
            if payload.unidad_humedad and payload.unidad_humedad != STANDARD_UNITS["humedad"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="RN-06: La unidad de humedad relativa debe ser %RH.",
                )

        if pres_on:
            if payload.presion is None or not math.isfinite(payload.presion):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La variable presión atmosférica (hPa) está habilitada y es obligatoria en la carga útil.",
                )
            if payload.unidad_presion and payload.unidad_presion != STANDARD_UNITS["presion"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="RN-06: La unidad de presión atmosférica debe ser hPa.",
                )

        # Variables deshabilitadas: ignorarlas y NO almacenarlas
        ignored: List[str] = []
        if not temp_on and payload.temperatura is not None:
            ignored.append("temperatura")
        if not hum_on and payload.humedad is not None:
            ignored.append("humedad")
        if not pres_on and payload.presion is not None:
            ignored.append("presion")

        stored_temp = float(payload.temperatura) if temp_on else None
        stored_hum = float(payload.humedad) if hum_on else None
        stored_pres = float(payload.presion) if pres_on else None

        cursor.execute(
            "SELECT temp_min, temp_max, hum_min, hum_max, presion_min, presion_max FROM umbrales_alerta WHERE sensor_id = %s LIMIT 1",
            (payload.sensor_id,),
        )
        limits = cursor.fetchone()
        fuera_umbral = False
        if limits:
            if stored_temp is not None and limits["temp_min"] is not None and limits["temp_max"] is not None:
                if stored_temp < float(limits["temp_min"]) or stored_temp > float(limits["temp_max"]):
                    fuera_umbral = True
            if stored_hum is not None and limits["hum_min"] is not None and limits["hum_max"] is not None:
                if stored_hum < float(limits["hum_min"]) or stored_hum > float(limits["hum_max"]):
                    fuera_umbral = True
            if stored_pres is not None and limits["presion_min"] is not None and limits["presion_max"] is not None:
                if stored_pres < float(limits["presion_min"]) or stored_pres > float(limits["presion_max"]):
                    fuera_umbral = True

        alerta_produccion = bool(fuera_umbral and sensor["estado"] == "ACTIVO")
        active_vars = _active_variables_from_cfg(sensor["modelo"], var_cfg)
        snapshot_str = json.dumps([v["variable"] for v in active_vars], ensure_ascii=False)

        cursor.execute(
            """
            INSERT INTO mediciones (
              dispositivo_id, sensor_id, ubicacion_id, temperatura, humedad, presion,
              alerta_generada, configuracion_id, variables_activas_snapshot, fecha_hora
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                payload.dispositivo_id,
                payload.sensor_id,
                sensor["ubicacion_id"],
                stored_temp,
                stored_hum,
                stored_pres,
                1 if alerta_produccion else 0,
                var_cfg["id_configuracion"],
                snapshot_str,
                capture_dt,
            ),
        )
        med_id = cursor.lastrowid

    return {
        "id_medicion": med_id,
        "sensor_id": payload.sensor_id,
        "dispositivo_id": payload.dispositivo_id,
        "configuracion_id": var_cfg["id_configuracion"],
        "variables_almacenadas": [v["variable"] for v in active_vars],
        "variables_ignoradas": ignored,
        "temperatura": stored_temp,
        "humedad": stored_hum,
        "presion": stored_pres,
        "alerta_produccion_generada": alerta_produccion,
        "fecha_hora": capture_dt.isoformat(),
    }


@router.get("/api/dashboard/telemetria")
def get_dashboard_telemetria(
    ubicacion_id: Optional[str] = Query(default=None),
    dispositivo_id: Optional[str] = Query(default=None),
    sensor_id: Optional[str] = Query(default=None),
    limit: int = Query(default=60, ge=1, le=500),
    current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    """Devuelve mediciones reales en MySQL y configuración de variables activas por sensor para el Dashboard."""
    conditions: List[str] = []
    params: List[Any] = []
    if ubicacion_id and ubicacion_id.strip() and ubicacion_id != "ALL":
        conditions.append("COALESCE(m.ubicacion_id, d.ubicacion_id) = %s")
        params.append(ubicacion_id.strip())
    if dispositivo_id and dispositivo_id.strip() and dispositivo_id != "ALL":
        conditions.append("m.dispositivo_id = %s")
        params.append(dispositivo_id.strip())
    if sensor_id and sensor_id.strip() and sensor_id != "ALL":
        conditions.append("m.sensor_id = %s")
        params.append(sensor_id.strip())

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    sensor_conditions: List[str] = []
    sensor_params: List[Any] = []
    if ubicacion_id and ubicacion_id.strip() and ubicacion_id != "ALL":
        sensor_conditions.append("d.ubicacion_id = %s")
        sensor_params.append(ubicacion_id.strip())
    if dispositivo_id and dispositivo_id.strip() and dispositivo_id != "ALL":
        sensor_conditions.append("s.dispositivo_id = %s")
        sensor_params.append(dispositivo_id.strip())
    if sensor_id and sensor_id.strip() and sensor_id != "ALL":
        sensor_conditions.append("s.id_sensor = %s")
        sensor_params.append(sensor_id.strip())
    sensor_where = f"WHERE {' AND '.join(sensor_conditions)}" if sensor_conditions else ""

    with db_cursor() as cursor:
        cursor.execute(
            f"""
            SELECT s.id_sensor, s.dispositivo_id, s.identificador, s.modelo, s.variables_medidas,
                   s.estado, d.nombre AS dispositivo_nombre, d.ubicacion_id, u.nombre AS ubicacion_nombre,
                   l.temp_min, l.temp_max, l.hum_min, l.hum_max, l.presion_min, l.presion_max
            FROM sensores s
            INNER JOIN dispositivos d ON d.id_dispositivo = s.dispositivo_id
            LEFT JOIN ubicaciones u ON u.ubicacion_id = d.ubicacion_id
            LEFT JOIN umbrales_alerta l ON l.sensor_id = s.id_sensor
            {sensor_where}
            ORDER BY s.fecha_creacion DESC
            """,
            tuple(sensor_params),
        )
        sensor_rows = cursor.fetchall()
        sensor_configs: List[Dict[str, Any]] = []
        for s_row in sensor_rows:
            cfg = _ensure_sensor_variables_config(cursor, s_row, current_user["correo"])
            serialized_cfg = _serialize_variables_config(s_row, cfg)
            serialized_cfg["limites"] = {
                "temp_min": float(s_row["temp_min"]) if s_row.get("temp_min") is not None else None,
                "temp_max": float(s_row["temp_max"]) if s_row.get("temp_max") is not None else None,
                "hum_min": float(s_row["hum_min"]) if s_row.get("hum_min") is not None else None,
                "hum_max": float(s_row["hum_max"]) if s_row.get("hum_max") is not None else None,
                "presion_min": float(s_row["presion_min"]) if s_row.get("presion_min") is not None else None,
                "presion_max": float(s_row["presion_max"]) if s_row.get("presion_max") is not None else None,
            }
            sensor_configs.append(serialized_cfg)

        cursor.execute(
            f"""
            SELECT m.id_medicion, m.dispositivo_id, m.sensor_id,
                   COALESCE(m.ubicacion_id, d.ubicacion_id) AS ubicacion_id,
                   m.temperatura, m.humedad, m.presion, m.alerta_generada,
                   m.score_anomalia_ia, m.es_fuera_de_umbral,
                   m.configuracion_id, m.variables_activas_snapshot, m.fecha_hora
            FROM mediciones m
            INNER JOIN dispositivos d ON d.id_dispositivo = m.dispositivo_id
            {where_clause}
            ORDER BY m.fecha_hora DESC, m.id_medicion DESC
            LIMIT %s
            """,
            tuple(params + [limit]),
        )
        med_rows = cursor.fetchall()

    mediciones: List[Dict[str, Any]] = []
    for m in reversed(med_rows):
        fh = m.get("fecha_hora")
        snap = m.get("variables_activas_snapshot")
        try:
            snap_parsed = json.loads(snap) if isinstance(snap, str) and snap else None
        except Exception:
            snap_parsed = None
        mediciones.append(
            {
                "id_medicion": int(m["id_medicion"]),
                "dispositivo_id": m["dispositivo_id"],
                "sensor_id": m.get("sensor_id"),
                "ubicacion_id": m.get("ubicacion_id"),
                "temperatura": float(m["temperatura"]) if m.get("temperatura") is not None else None,
                "humedad": float(m["humedad"]) if m.get("humedad") is not None else None,
                "presion": float(m["presion"]) if m.get("presion") is not None else None,
                "alerta_generada": bool(m.get("alerta_generada")),
                "score_anomalia_ia": float(m["score_anomalia_ia"]) if m.get("score_anomalia_ia") is not None else None,
                "es_fuera_de_umbral": bool(m.get("es_fuera_de_umbral")),
                "configuracion_id": m.get("configuracion_id"),
                "variables_activas_snapshot": snap_parsed,
                "fecha_hora": fh.isoformat() if hasattr(fh, "isoformat") else str(fh),
            }
        )

    return {
        "sensores": sensor_configs,
        "mediciones": mediciones,
    }
