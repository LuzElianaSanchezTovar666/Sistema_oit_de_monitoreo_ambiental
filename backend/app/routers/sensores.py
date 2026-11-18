from datetime import date, datetime, timezone
import json
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
            SELECT sensor_id, temp_min, temp_max, hum_min, hum_max, presion_min, presion_max,
                   es_predeterminado, actualizado_por, fecha_actualizacion
            FROM umbrales_alerta
            WHERE sensor_id = %s
            LIMIT 1
            """,
            (id_sensor,),
        )
        cfg = cursor.fetchone()

    if cfg:
        for k in ("temp_min", "temp_max", "hum_min", "hum_max", "presion_min", "presion_max"):
            if cfg.get(k) is not None:
                cfg[k] = float(cfg[k])
        cfg["es_predeterminado"] = bool(cfg.get("es_predeterminado", 1))
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

        vars_list = json.loads(sensor["variables_medidas"])
        matched_var = next((v for v in vars_list if v["variable"] == payload.variable), None)
        if matched_var is None or matched_var["unidad"] != payload.unidad:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La variable o unidad no corresponde a las capacidades configuradas del sensor.",
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

        cursor.execute(
            """
            INSERT INTO mediciones (
              dispositivo_id, sensor_id, ubicacion_id, temperatura, humedad, presion, alerta_generada, fecha_hora
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                payload.dispositivo_id,
                payload.sensor_id,
                sensor["ubicacion_id"],
                temp_val,
                hum_val,
                pres_val,
                1 if alerta_produccion else 0,
                capture_dt,
            ),
        )
        med_id = cursor.lastrowid

    return {
        "id_medicion": med_id,
        "dispositivo_id": payload.dispositivo_id,
        "sensor_id": payload.sensor_id,
        "estado_sensor": sensor["estado"],
        "fuera_de_umbral": fuera_umbral,
        "alerta_produccion_generada": alerta_produccion,
        "alerta_suprimida_rn05": suprimida_rn05,
    }
