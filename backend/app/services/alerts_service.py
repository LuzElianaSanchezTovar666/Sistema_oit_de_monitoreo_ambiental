import asyncio
from datetime import datetime, timedelta, timezone
import json
import logging
import math
from pathlib import Path
import sqlite3
import threading
import time
from typing import Any, Dict, List, Optional, Set, Tuple
import uuid

import pymysql

from ..database import db_cursor

logger = logging.getLogger("simoa.rf13")

DEBOUNCE_WINDOW_SECONDS = 300
ALERT_BUFFER_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "rf13_pending_alerts.sqlite3"


def _to_utc_naive(dt: Any) -> datetime:
    if isinstance(dt, str):
        parsed = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        dt = parsed
    if not isinstance(dt, datetime):
        return datetime.now(timezone.utc).replace(tzinfo=None)
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _format_utc_iso(dt: Any) -> str:
    if dt is None:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    if isinstance(dt, str):
        return dt
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def evaluate_variable_breach(
    variable: str,
    valor: Optional[float],
    limits: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """Evalúa una magnitud válida contra los umbrales vigentes de RF-12.
    Retorna None si está dentro del rango operacional, si es inválida o si faltan umbrales.
    """
    if valor is None or not math.isfinite(float(valor)):
        return None
    val = round(float(valor), 2)

    if not limits:
        logger.warning("RF-13: Sensor sin configuración de umbrales vigente; no se clasifica alerta para %s.", variable)
        return None

    if variable == "temperatura":
        t_min = limits.get("temp_min")
        t_max = limits.get("temp_max")
        if t_min is None or t_max is None:
            logger.warning("RF-13: Faltan límites temp_min/temp_max; se omite clasificación de temperatura.")
            return None
        t_min_f = float(t_min)
        t_max_f = float(t_max)
        t_cmin = float(limits["temp_critico_min"]) if limits.get("temp_critico_min") is not None else None
        t_cmax = float(limits["temp_critico_max"]) if limits.get("temp_critico_max") is not None else None

        if t_min_f <= val <= t_max_f:
            return None
        if val < t_min_f:
            if t_cmin is not None and val <= t_cmin:
                return {
                    "variable": "temperatura",
                    "condicion": "BAJO_MINIMO",
                    "valor_detectado": val,
                    "umbral_superado": t_cmin,
                    "severidad": "CRITICA",
                    "mensaje": (
                        f"Temperatura crítica baja: se registraron {val:.1f} °C, "
                        f"por debajo del límite crítico inferior de {t_cmin:.1f} °C"
                    ),
                }
            return {
                "variable": "temperatura",
                "condicion": "BAJO_MINIMO",
                "valor_detectado": val,
                "umbral_superado": t_min_f,
                "severidad": "ADVERTENCIA",
                "mensaje": (
                    f"Temperatura baja: se registraron {val:.1f} °C, "
                    f"por debajo del límite mínimo configurado de {t_min_f:.1f} °C"
                ),
            }
        # val > t_max_f
        if t_cmax is not None and val >= t_cmax:
            return {
                "variable": "temperatura",
                "condicion": "SOBRE_MAXIMO",
                "valor_detectado": val,
                "umbral_superado": t_cmax,
                "severidad": "CRITICA",
                "mensaje": (
                    f"Temperatura crítica elevada: se registraron {val:.1f} °C, "
                    f"superando el límite crítico superior de {t_cmax:.1f} °C"
                ),
            }
        return {
            "variable": "temperatura",
            "condicion": "SOBRE_MAXIMO",
            "valor_detectado": val,
            "umbral_superado": t_max_f,
            "severidad": "ADVERTENCIA",
            "mensaje": (
                f"Temperatura elevada: se registraron {val:.1f} °C, "
                f"superando el límite máximo configurado de {t_max_f:.1f} °C"
            ),
        }

    if variable == "humedad":
        if val < 0.0 or val > 100.0:
            logger.warning("RF-13: Humedad fuera de rango físico [0, 100] (%s %%RH); tratada como error de sensor.", val)
            return None
        h_min = limits.get("hum_min")
        h_max = limits.get("hum_max")
        if h_min is None or h_max is None:
            logger.warning("RF-13: Faltan límites hum_min/hum_max; se omite clasificación de humedad.")
            return None
        h_min_f = float(h_min)
        h_max_f = float(h_max)
        h_cmin = float(limits["hum_critico_min"]) if limits.get("hum_critico_min") is not None else None
        h_cmax = float(limits["hum_critico_max"]) if limits.get("hum_critico_max") is not None else None

        if h_min_f <= val <= h_max_f:
            return None
        if val < h_min_f:
            if h_cmin is not None and val <= h_cmin:
                return {
                    "variable": "humedad",
                    "condicion": "BAJO_MINIMO",
                    "valor_detectado": val,
                    "umbral_superado": h_cmin,
                    "severidad": "CRITICA",
                    "mensaje": (
                        f"Humedad relativa crítica baja: se registraron {val:.1f} %RH, "
                        f"por debajo del límite crítico inferior de {h_cmin:.1f} %RH"
                    ),
                }
            return {
                "variable": "humedad",
                "condicion": "BAJO_MINIMO",
                "valor_detectado": val,
                "umbral_superado": h_min_f,
                "severidad": "ADVERTENCIA",
                "mensaje": (
                    f"Humedad relativa baja: se registraron {val:.1f} %RH, "
                    f"por debajo del límite mínimo configurado de {h_min_f:.1f} %RH"
                ),
            }
        if h_cmax is not None and val >= h_cmax:
            return {
                "variable": "humedad",
                "condicion": "SOBRE_MAXIMO",
                "valor_detectado": val,
                "umbral_superado": h_cmax,
                "severidad": "CRITICA",
                "mensaje": (
                    f"Humedad relativa crítica elevada: se registraron {val:.1f} %RH, "
                    f"superando el límite crítico superior de {h_cmax:.1f} %RH"
                ),
            }
        return {
            "variable": "humedad",
            "condicion": "SOBRE_MAXIMO",
            "valor_detectado": val,
            "umbral_superado": h_max_f,
            "severidad": "ADVERTENCIA",
            "mensaje": (
                f"Humedad relativa elevada: se registraron {val:.1f} %RH, "
                f"superando el límite máximo configurado de {h_max_f:.1f} %RH"
            ),
        }

    return None


class DurableAlertPendingBuffer:
    """Cola durable SQLite para tolerancia a fallos temporales de MySQL en RF-13."""

    def __init__(self, db_path: Path = ALERT_BUFFER_DB_PATH) -> None:
        self._db_path = db_path
        self._lock = threading.Lock()
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS pending_alerts (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  idem_key TEXT NOT NULL UNIQUE,
                  payload_json TEXT NOT NULL,
                  retries INTEGER NOT NULL DEFAULT 0,
                  created_at TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(str(self._db_path), timeout=5.0, check_same_thread=False)

    def enqueue(self, idem_key: str, payload: Dict[str, Any]) -> bool:
        with self._lock:
            with self._connect() as conn:
                try:
                    conn.execute(
                        "INSERT INTO pending_alerts (idem_key, payload_json, created_at) VALUES (?, ?, ?)",
                        (idem_key, json.dumps(payload, ensure_ascii=False), datetime.now(timezone.utc).isoformat()),
                    )
                    conn.commit()
                    return True
                except sqlite3.IntegrityError:
                    return False

    def peek_batch(self, limit: int = 50) -> List[Tuple[int, str, Dict[str, Any]]]:
        with self._lock:
            with self._connect() as conn:
                cur = conn.execute(
                    "SELECT id, idem_key, payload_json FROM pending_alerts ORDER BY id ASC LIMIT ?",
                    (limit,),
                )
                return [(int(r[0]), str(r[1]), json.loads(r[2])) for r in cur.fetchall()]

    def delete_row(self, row_id: int) -> None:
        with self._lock:
            with self._connect() as conn:
                conn.execute("DELETE FROM pending_alerts WHERE id = ?", (row_id,))
                conn.commit()

    def increment_retry(self, row_id: int) -> None:
        with self._lock:
            with self._connect() as conn:
                conn.execute("UPDATE pending_alerts SET retries = retries + 1 WHERE id = ?", (row_id,))
                conn.commit()

    def count(self) -> int:
        with self._lock:
            with self._connect() as conn:
                cur = conn.execute("SELECT COUNT(*) FROM pending_alerts")
                return int(cur.fetchone()[0])


class AlertStreamBroadcaster:
    """Canal SSE en tiempo real para notificaciones inmediatas de alertas RF-13."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._subscribers: Set[Tuple[asyncio.AbstractEventLoop, asyncio.Queue]] = set()

    def subscribe(self, loop: asyncio.AbstractEventLoop) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        with self._lock:
            self._subscribers.add((loop, q))
        return q

    def unsubscribe(self, loop: asyncio.AbstractEventLoop, q: asyncio.Queue) -> None:
        with self._lock:
            self._subscribers.discard((loop, q))

    def broadcast_alert(self, alert_dto: Dict[str, Any]) -> None:
        with self._lock:
            targets = list(self._subscribers)
        for loop, q in targets:
            try:
                loop.call_soon_threadsafe(self._safe_put, q, alert_dto)
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


alert_stream_broadcaster = AlertStreamBroadcaster()


class AlertsService:
    """Servicio RF-13: evaluación, debouncing RN-15 (300 s), persistencia MySQL, buffer y SSE."""

    def __init__(self, buffer: Optional[DurableAlertPendingBuffer] = None) -> None:
        self._buffer = buffer or DurableAlertPendingBuffer()
        self._lock = threading.Lock()
        self._thresholds_cache: Dict[str, Dict[str, Any]] = {}
        self._stop_event = threading.Event()
        self._recovery_thread: Optional[threading.Thread] = None
        self._stats: Dict[str, Any] = {
            "persisted_count": 0,
            "debounced_count": 0,
            "escalated_count": 0,
            "buffered_count": 0,
            "recovered_count": 0,
            "last_latency_ms": None,
            "last_error": None,
        }

    def start(self) -> None:
        if self._recovery_thread and self._recovery_thread.is_alive():
            return
        self._stop_event.clear()
        self._recovery_thread = threading.Thread(target=self._recovery_loop, daemon=True, name="rf13-alert-recovery")
        self._recovery_thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._recovery_thread and self._recovery_thread.is_alive():
            self._recovery_thread.join(timeout=2.0)

    def get_stats(self) -> Dict[str, Any]:
        with self._lock:
            return {**self._stats, "pending_buffer_count": self._buffer.count()}

    def _get_limits_and_context(self, sensor_id: str) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any]]:
        with db_cursor() as cursor:
            cursor.execute(
                """
                SELECT s.id_sensor, s.identificador AS sensor_identificador, s.modelo AS sensor_modelo,
                       d.id_dispositivo, d.nombre AS dispositivo_nombre,
                       u.ubicacion_id, u.nombre AS ubicacion_nombre,
                       l.temp_min, l.temp_max, l.temp_critico_min, l.temp_critico_max,
                       l.hum_min, l.hum_max, l.hum_critico_min, l.hum_critico_max
                FROM sensores s
                INNER JOIN dispositivos d ON d.id_dispositivo = s.dispositivo_id
                LEFT JOIN ubicaciones u ON u.ubicacion_id = d.ubicacion_id
                LEFT JOIN umbrales_alerta l ON l.sensor_id = s.id_sensor
                WHERE s.id_sensor = %s
                LIMIT 1
                """,
                (sensor_id,),
            )
            row = cursor.fetchone()
        if not row:
            return None, {}

        limits: Optional[Dict[str, Any]] = None
        if any(row.get(k) is not None for k in ("temp_min", "temp_max", "hum_min", "hum_max")):
            limits = {
                k: float(row[k]) if row.get(k) is not None else None
                for k in (
                    "temp_min",
                    "temp_max",
                    "temp_critico_min",
                    "temp_critico_max",
                    "hum_min",
                    "hum_max",
                    "hum_critico_min",
                    "hum_critico_max",
                )
            }
            with self._lock:
                self._thresholds_cache[sensor_id] = {
                    "limits": limits,
                    "context": {
                        "sensor_identificador": row.get("sensor_identificador"),
                        "sensor_modelo": row.get("sensor_modelo"),
                        "dispositivo_nombre": row.get("dispositivo_nombre"),
                        "ubicacion_nombre": row.get("ubicacion_nombre"),
                    },
                }

        ctx = {
            "sensor_identificador": row.get("sensor_identificador"),
            "sensor_modelo": row.get("sensor_modelo"),
            "dispositivo_nombre": row.get("dispositivo_nombre"),
            "ubicacion_nombre": row.get("ubicacion_nombre"),
        }
        return limits, ctx

    def _persist_or_debounce_mysql(self, candidate: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
        """Inserta o aplica debouncing RN-15 en MySQL de forma atómica.
        Retorna (alert_dto, action) donde action in ('created', 'escalated', 'debounced', 'duplicate').
        """
        event_dt = _to_utc_naive(candidate["fecha_hora"])
        window_start = event_dt - timedelta(seconds=DEBOUNCE_WINDOW_SECONDS)

        with db_cursor() as cursor:
            cursor.execute(
                """
                SELECT id_alerta, severidad, ocurrencias_en_ventana
                FROM alertas
                WHERE sensor_id = %s
                  AND variable = %s
                  AND condicion = %s
                  AND fecha_hora >= %s
                  AND fecha_hora <= %s
                ORDER BY fecha_hora DESC
                LIMIT 1
                FOR UPDATE
                """,
                (
                    candidate["sensor_id"],
                    candidate["variable"],
                    candidate["condicion"],
                    window_start,
                    event_dt,
                ),
            )
            existing = cursor.fetchone()

            if existing is not None:
                is_escalation = existing["severidad"] == "ADVERTENCIA" and candidate["severidad"] == "CRITICA"
                if not is_escalation:
                    cursor.execute(
                        """
                        UPDATE alertas
                        SET ocurrencias_en_ventana = ocurrencias_en_ventana + 1,
                            ultimo_valor_detectado = %s,
                            ultima_ocurrencia_utc = %s
                        WHERE id_alerta = %s
                        """,
                        (candidate["valor_detectado"], event_dt, existing["id_alerta"]),
                    )
                    return {
                        **candidate,
                        "id_alerta": existing["id_alerta"],
                        "persistida": True,
                        "provisional": False,
                        "debounced": True,
                    }, "debounced"

                action = "escalated"
            else:
                action = "created"

            alert_id = candidate["id_alerta"]
            try:
                cursor.execute(
                    """
                    INSERT INTO alertas (
                      id_alerta, medicion_id, dispositivo_id, sensor_id, ubicacion_id,
                      tipo, variable, condicion, valor_detectado, umbral_superado,
                      severidad, estado, mensaje, ocurrencias_en_ventana,
                      ultimo_valor_detectado, ultima_ocurrencia_utc,
                      clave_idempotencia, fecha_hora
                    )
                    VALUES (%s, %s, %s, %s, %s, 'LIMITE_SUPERADO', %s, %s, %s, %s, %s, 'PENDIENTE', %s, 1, %s, %s, %s, %s)
                    """,
                    (
                        alert_id,
                        candidate.get("medicion_id"),
                        candidate["dispositivo_id"],
                        candidate["sensor_id"],
                        candidate["ubicacion_id"],
                        candidate["variable"],
                        candidate["condicion"],
                        candidate["valor_detectado"],
                        candidate["umbral_superado"],
                        candidate["severidad"],
                        candidate["mensaje"],
                        candidate["valor_detectado"],
                        event_dt,
                        candidate["clave_idempotencia"],
                        event_dt,
                    ),
                )
            except pymysql.err.IntegrityError as exc:
                if exc.args and exc.args[0] == 1062:
                    return {**candidate, "persistida": True, "provisional": False}, "duplicate"
                raise

        return {
            **candidate,
            "id_alerta": alert_id,
            "estado": "PENDIENTE",
            "persistida": True,
            "provisional": False,
            "escalada": action == "escalated",
        }, action

    def process_event(self, event: Any, medicion_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Evalúa temperatura y humedad de un evento válido y genera/debouncea alertas RF-13."""
        t0 = time.perf_counter()
        if isinstance(event, dict):
            sensor_id = event.get("sensor_id")
            dispositivo_id = event.get("dispositivo_id")
            ubicacion_id = event.get("ubicacion_id")
            magnitudes = event.get("magnitudes") or {}
            fecha_raw = event.get("fecha_hora")
            med_id = medicion_id or event.get("medicion_id")
        else:
            sensor_id = getattr(event, "sensor_id", None)
            dispositivo_id = getattr(event, "dispositivo_id", None)
            ubicacion_id = getattr(event, "ubicacion_id", None)
            magnitudes = getattr(event, "magnitudes", None) or {}
            fecha_raw = getattr(event, "fecha_hora", None)
            med_id = medicion_id or getattr(event, "medicion_id", None)

        if not sensor_id or not dispositivo_id or not ubicacion_id:
            return []

        event_dt = _to_utc_naive(fecha_raw)
        fecha_iso = _format_utc_iso(event_dt)

        limits: Optional[Dict[str, Any]] = None
        ctx: Dict[str, Any] = {}
        mysql_available = True

        try:
            limits, ctx = self._get_limits_and_context(sensor_id)
        except (pymysql.err.OperationalError, pymysql.err.InterfaceError) as exc:
            mysql_available = False
            with self._lock:
                cached = self._thresholds_cache.get(sensor_id)
                self._stats["last_error"] = f"MySQL no disponible en RF-13: {type(exc).__name__}"
            if cached:
                limits = cached["limits"]
                ctx = cached["context"]

        if limits is None:
            return []

        results: List[Dict[str, Any]] = []
        for var_name in ("temperatura", "humedad"):
            if var_name not in magnitudes:
                continue
            breach = evaluate_variable_breach(var_name, magnitudes.get(var_name), limits)
            if breach is None:
                continue

            idem_key = f"{sensor_id}:{var_name}:{breach['condicion']}:{breach['severidad']}:{fecha_iso}"
            candidate = {
                "id_alerta": f"alr-{uuid.uuid4().hex[:12]}",
                "medicion_id": med_id,
                "dispositivo_id": dispositivo_id,
                "sensor_id": sensor_id,
                "ubicacion_id": ubicacion_id,
                "sensor_identificador": ctx.get("sensor_identificador"),
                "sensor_modelo": ctx.get("sensor_modelo"),
                "dispositivo_nombre": ctx.get("dispositivo_nombre"),
                "ubicacion_nombre": ctx.get("ubicacion_nombre"),
                "tipo": "LIMITE_SUPERADO",
                "variable": breach["variable"],
                "condicion": breach["condicion"],
                "valor_detectado": breach["valor_detectado"],
                "umbral_superado": breach["umbral_superado"],
                "severidad": breach["severidad"],
                "nivel": breach["severidad"],
                "estado": "PENDIENTE",
                "mensaje": breach["mensaje"],
                "clave_idempotencia": idem_key,
                "fecha_hora": fecha_iso,
            }

            if mysql_available:
                try:
                    persisted_dto, action = self._persist_or_debounce_mysql(candidate)
                    with self._lock:
                        if action == "debounced":
                            self._stats["debounced_count"] += 1
                        elif action in ("created", "escalated"):
                            self._stats["persisted_count"] += 1
                            if action == "escalated":
                                self._stats["escalated_count"] += 1
                        self._stats["last_error"] = None
                    if action in ("created", "escalated"):
                        alert_stream_broadcaster.broadcast_alert(persisted_dto)
                        results.append(persisted_dto)
                    continue
                except (pymysql.err.OperationalError, pymysql.err.InterfaceError) as exc:
                    with self._lock:
                        self._stats["last_error"] = f"Fallo MySQL guardando alerta: {type(exc).__name__}"

            # Fallback durable ante caída temporal de MySQL
            if self._buffer.enqueue(idem_key, candidate):
                with self._lock:
                    self._stats["buffered_count"] += 1
            provisional_dto = {
                **candidate,
                "persistida": False,
                "provisional": True,
                "mensaje": f"[Provisional · pendiente de persistencia] {candidate['mensaje']}",
            }
            alert_stream_broadcaster.broadcast_alert(provisional_dto)
            results.append(provisional_dto)

        elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        with self._lock:
            self._stats["last_latency_ms"] = elapsed_ms
        return results

    def flush_pending_alerts(self) -> int:
        recovered = 0
        for row_id, _key, candidate in self._buffer.peek_batch(limit=50):
            try:
                persisted_dto, action = self._persist_or_debounce_mysql(candidate)
                self._buffer.delete_row(row_id)
                recovered += 1
                with self._lock:
                    self._stats["recovered_count"] += 1
                    if action in ("created", "escalated"):
                        self._stats["persisted_count"] += 1
                if action in ("created", "escalated"):
                    alert_stream_broadcaster.broadcast_alert(persisted_dto)
            except (pymysql.err.OperationalError, pymysql.err.InterfaceError):
                self._buffer.increment_retry(row_id)
                raise
            except Exception as exc:
                logger.error("Alerta irrecuperable en buffer RF-13 (id=%s): %s", row_id, exc)
                self._buffer.delete_row(row_id)
        return recovered

    def _recovery_loop(self) -> None:
        backoff = 1.0
        while not self._stop_event.is_set():
            if self._buffer.count() == 0:
                backoff = 1.0
                self._stop_event.wait(1.0)
                continue
            try:
                drained = self.flush_pending_alerts()
                if drained > 0:
                    backoff = 1.0
                    continue
            except (pymysql.err.OperationalError, pymysql.err.InterfaceError):
                self._stop_event.wait(backoff)
                backoff = min(15.0, backoff * 2.0)
                continue
            self._stop_event.wait(0.5)


def list_alertas(
    estado: Optional[str] = None,
    severidad: Optional[str] = None,
    ubicacion_id: Optional[str] = None,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    clauses: List[str] = []
    params: List[Any] = []
    if estado:
        clauses.append("a.estado = %s")
        params.append(estado)
    if severidad:
        clauses.append("a.severidad = %s")
        params.append(severidad)
    if ubicacion_id:
        clauses.append("a.ubicacion_id = %s")
        params.append(ubicacion_id)

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    params.append(limit)

    with db_cursor() as cursor:
        cursor.execute(
            f"""
            SELECT a.id_alerta, a.medicion_id, a.dispositivo_id, a.sensor_id, a.ubicacion_id,
                   a.tipo, a.variable, a.condicion, a.valor_detectado, a.umbral_superado,
                   a.severidad, a.estado, a.mensaje, a.ocurrencias_en_ventana,
                   a.ultimo_valor_detectado, a.ultima_ocurrencia_utc, a.fecha_hora,
                   u.nombre AS ubicacion_nombre,
                   d.nombre AS dispositivo_nombre,
                   s.identificador AS sensor_identificador,
                   s.modelo AS sensor_modelo
            FROM alertas a
            LEFT JOIN ubicaciones u ON u.ubicacion_id = a.ubicacion_id
            LEFT JOIN dispositivos d ON d.id_dispositivo = a.dispositivo_id
            LEFT JOIN sensores s ON s.id_sensor = a.sensor_id
            {where_sql}
            ORDER BY a.fecha_hora DESC
            LIMIT %s
            """,
            tuple(params),
        )
        rows = cursor.fetchall()

    out: List[Dict[str, Any]] = []
    for r in rows:
        out.append(
            {
                "id_alerta": r["id_alerta"],
                "medicion_id": r.get("medicion_id"),
                "dispositivo_id": r["dispositivo_id"],
                "sensor_id": r["sensor_id"],
                "ubicacion_id": r["ubicacion_id"],
                "ubicacion_nombre": r.get("ubicacion_nombre"),
                "dispositivo_nombre": r.get("dispositivo_nombre"),
                "sensor_identificador": r.get("sensor_identificador"),
                "sensor_modelo": r.get("sensor_modelo"),
                "tipo": r["tipo"],
                "variable": r["variable"],
                "variable_alterada": r["variable"],
                "condicion": r["condicion"],
                "valor_detectado": float(r["valor_detectado"]),
                "valor_registrado": float(r["valor_detectado"]),
                "umbral_superado": float(r["umbral_superado"]),
                "valor_limite": float(r["umbral_superado"]),
                "severidad": r["severidad"],
                "nivel": r["severidad"],
                "estado": r["estado"],
                "mensaje": r["mensaje"],
                "ocurrencias_en_ventana": int(r.get("ocurrencias_en_ventana") or 1),
                "ultimo_valor_detectado": (
                    float(r["ultimo_valor_detectado"]) if r.get("ultimo_valor_detectado") is not None else None
                ),
                "ultima_ocurrencia_utc": _format_utc_iso(r["ultima_ocurrencia_utc"])
                if r.get("ultima_ocurrencia_utc")
                else None,
                "fecha_hora": _format_utc_iso(r["fecha_hora"]),
                "persistida": True,
                "provisional": False,
            }
        )
    return out


alerts_service = AlertsService()
