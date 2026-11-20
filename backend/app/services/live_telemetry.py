import asyncio
from datetime import datetime, timezone
import logging
import math
import os
import threading
from typing import Any, Dict, List, Optional, Set, Tuple

from ..database import db_cursor
from ..routers.sensores import MODEL_CAPABILITIES

logger = logging.getLogger("simoa.rf08")

FRESHNESS_MAX_SECONDS = int(os.getenv("RF08_FRESHNESS_MAX_SECONDS", "30"))
ZSCORE_WINDOW_SIZE = int(os.getenv("RF08_ZSCORE_WINDOW_SIZE", "30"))
ZSCORE_MIN_SAMPLES = int(os.getenv("RF08_ZSCORE_MIN_SAMPLES", "5"))


def compute_temperature_zscore(
    current_temp: float,
    history_temps: List[float],
    min_samples: int = ZSCORE_MIN_SAMPLES,
) -> Tuple[Optional[float], bool, str]:
    """Calcula Z = (T_actual - media) / desviacion_estandar sobre ventana real en MySQL.
    No confundir con el score del modelo de IA de RF-18.
    """
    valid = [float(t) for t in history_temps if t is not None and math.isfinite(float(t))]
    if len(valid) < min_samples:
        return None, False, f"Muestras insuficientes (mínimo {min_samples})"

    n = len(valid)
    mean = sum(valid) / n
    variance = sum((x - mean) ** 2 for x in valid) / n
    std_dev = math.sqrt(variance)
    if std_dev <= 1e-9:
        return None, False, "Desviación estándar cero"

    z_val = (float(current_temp) - mean) / std_dev
    return round(z_val, 2), True, "Calculado sobre ventana real"


def evaluate_thermal_state(
    temperatura: Optional[float],
    temp_min: Optional[float],
    temp_max: Optional[float],
) -> str:
    if temperatura is None:
        return "ESPERANDO_DATOS"
    if temp_min is None or temp_max is None:
        return "SIN_CONFIGURACION"
    if float(temp_min) <= float(temperatura) <= float(temp_max):
        return "NOMINAL"
    return "FUERA DE RANGO"


def select_temperature_sensor_for_location(cursor: Any, ubicacion_id: str) -> Optional[Dict[str, Any]]:
    """Regla explícita RF-08:
    1. Considera sensores vinculados a dispositivos de la ubicación cuyo dispositivo no esté INACTIVO.
    2. Filtra sensores con temperatura habilitada en RF-05 (o capacidad térmica en RF-04).
    3. Prioriza sensores en estado ACTIVO (más reciente primero); si no hay activos, toma el primero
       para reportar estado no operativo / ESPERANDO DATOS sin mezclar lecturas entre sensores.
    """
    cursor.execute(
        """
        SELECT s.id_sensor, s.dispositivo_id, s.identificador, s.modelo, s.estado AS sensor_estado,
               d.nombre AS dispositivo_nombre, d.codigo AS dispositivo_codigo, d.estado AS dispositivo_estado,
               c.temperatura_habilitada,
               l.temp_min, l.temp_max
        FROM sensores s
        INNER JOIN dispositivos d ON d.id_dispositivo = s.dispositivo_id
        LEFT JOIN configuracion_variables_sensor c ON c.sensor_id = s.id_sensor
        LEFT JOIN umbrales_alerta l ON l.sensor_id = s.id_sensor
        WHERE d.ubicacion_id = %s
          AND d.estado <> 'INACTIVO'
        ORDER BY (s.estado = 'ACTIVO') DESC, s.fecha_creacion DESC, s.id_sensor ASC
        """,
        (ubicacion_id,),
    )
    rows = cursor.fetchall()
    for row in rows:
        modelo = row["modelo"]
        if "temperatura" not in MODEL_CAPABILITIES.get(modelo, {}):
            continue
        temp_enabled = row.get("temperatura_habilitada")
        if temp_enabled is not None and not bool(temp_enabled):
            continue
        return row
    return None


def get_location_temperature_snapshot(
    ubicacion_id: str,
    freshness_max_seconds: int = FRESHNESS_MAX_SECONDS,
) -> Optional[Dict[str, Any]]:
    with db_cursor() as cursor:
        cursor.execute(
            "SELECT ubicacion_id, nombre, codigo_area, estado FROM ubicaciones WHERE ubicacion_id = %s LIMIT 1",
            (ubicacion_id,),
        )
        loc = cursor.fetchone()
        if loc is None:
            return None

        sensor = select_temperature_sensor_for_location(cursor, ubicacion_id)
        if sensor is None:
            return {
                "ubicacion_id": loc["ubicacion_id"],
                "ubicacion_nombre": loc["nombre"],
                "codigo_area": loc["codigo_area"],
                "sensor_id": None,
                "sensor_identificador": None,
                "sensor_modelo": None,
                "sensor_estado": None,
                "dispositivo_id": None,
                "temperatura_actual": None,
                "unidad": "°C",
                "temp_min": None,
                "temp_max": None,
                "estado_termico": "ESPERANDO_DATOS",
                "estado_operativo": "SIN_SENSOR",
                "datos_recientes": False,
                "antiguedad_max_segundos": freshness_max_seconds,
                "z_score": None,
                "z_score_disponible": False,
                "z_score_motivo": "Sin sensor de temperatura",
                "z_score_muestras": 0,
                "fecha_hora_utc": None,
            }

        temp_min = float(sensor["temp_min"]) if sensor.get("temp_min") is not None else None
        temp_max = float(sensor["temp_max"]) if sensor.get("temp_max") is not None else None
        sensor_id = sensor["id_sensor"]
        sensor_operativo = sensor["sensor_estado"] == "ACTIVO" and sensor["dispositivo_estado"] not in ("INACTIVO", "OFFLINE")

        cursor.execute(
            """
            SELECT id_medicion, temperatura, fecha_hora
            FROM mediciones
            WHERE sensor_id = %s AND temperatura IS NOT NULL
            ORDER BY fecha_hora DESC, id_medicion DESC
            LIMIT %s
            """,
            (sensor_id, ZSCORE_WINDOW_SIZE),
        )
        meds = cursor.fetchall()

    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    latest = meds[0] if meds else None
    latest_dt = latest["fecha_hora"] if latest else None

    is_fresh = False
    if latest_dt is not None and sensor_operativo:
        age_seconds = (now_utc - latest_dt).total_seconds()
        is_fresh = age_seconds <= freshness_max_seconds

    temp_actual: Optional[float] = round(float(latest["temperatura"]), 2) if (latest and is_fresh) else None
    fecha_utc_iso: Optional[str] = (
        latest_dt.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
        if latest_dt is not None
        else None
    )

    if temp_actual is None:
        estado_termico = "ESPERANDO_DATOS"
        z_val, z_ok, z_reason = None, False, "Sin lectura reciente"
        estado_operativo = "DESCONECTADO" if not sensor_operativo else "ESPERANDO_DATOS"
    else:
        estado_termico = evaluate_thermal_state(temp_actual, temp_min, temp_max)
        estado_operativo = "ACTIVO"
        history_temps = [float(m["temperatura"]) for m in meds]
        z_val, z_ok, z_reason = compute_temperature_zscore(temp_actual, history_temps)

    return {
        "ubicacion_id": loc["ubicacion_id"],
        "ubicacion_nombre": loc["nombre"],
        "codigo_area": loc["codigo_area"],
        "sensor_id": sensor_id,
        "sensor_identificador": sensor["identificador"],
        "sensor_modelo": sensor["modelo"],
        "sensor_estado": sensor["sensor_estado"],
        "dispositivo_id": sensor["dispositivo_id"],
        "temperatura_actual": temp_actual,
        "unidad": "°C",
        "temp_min": temp_min,
        "temp_max": temp_max,
        "estado_termico": estado_termico,
        "estado_operativo": estado_operativo,
        "datos_recientes": is_fresh,
        "antiguedad_max_segundos": freshness_max_seconds,
        "z_score": z_val,
        "z_score_disponible": z_ok,
        "z_score_motivo": z_reason,
        "z_score_muestras": len(meds),
        "fecha_hora_utc": fecha_utc_iso,
    }


class LiveTemperatureBroadcaster:
    """Distribuidor en vivo (SSE) por sensor_id conectado post-COMMIT de RF-07."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._subscribers: Dict[str, Set[Tuple[asyncio.AbstractEventLoop, asyncio.Queue]]] = {}

    def subscribe(self, sensor_id: str, loop: asyncio.AbstractEventLoop) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        with self._lock:
            self._subscribers.setdefault(sensor_id, set()).add((loop, q))
        return q

    def unsubscribe(self, sensor_id: str, loop: asyncio.AbstractEventLoop, q: asyncio.Queue) -> None:
        with self._lock:
            subs = self._subscribers.get(sensor_id)
            if subs:
                subs.discard((loop, q))
                if not subs:
                    self._subscribers.pop(sensor_id, None)

    def publish_from_rf07_event(self, event: Any) -> None:
        """Invocado desde _rf13_handlers solo DESPUÉS de confirmar COMMIT en MySQL (RF-07)."""
        magnitudes = getattr(event, "magnitudes", None) or {}
        if "temperatura" not in magnitudes:
            return
        sensor_id = getattr(event, "sensor_id", None)
        ubicacion_id = getattr(event, "ubicacion_id", None)
        if not sensor_id or not ubicacion_id:
            return

        with self._lock:
            targets = list(self._subscribers.get(sensor_id, ()))
        if not targets:
            return

        try:
            snapshot = get_location_temperature_snapshot(ubicacion_id)
        except Exception as exc:
            logger.error("Error construyendo snapshot en vivo RF-08: %s", exc)
            return

        if snapshot is None:
            return

        for loop, q in targets:
            try:
                loop.call_soon_threadsafe(self._safe_put, q, snapshot)
            except RuntimeError:
                pass

    @staticmethod
    def _safe_put(q: asyncio.Queue, item: Dict[str, Any]) -> None:
        if q.full():
            try:
                q.get_nowait()
            except asyncio.QueueEmpty:
                pass
        try:
            q.put_nowait(item)
        except asyncio.QueueFull:
            pass


live_temperature_broadcaster = LiveTemperatureBroadcaster()
