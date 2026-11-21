from collections import deque
from datetime import datetime, timezone
import hashlib
import json
import logging
import math
import os
from pathlib import Path
import sqlite3
import threading
import time
from typing import Any, Deque, Dict, List, Optional, Tuple

import pymysql

from ..database import db_cursor
from .device_connectivity import lock_device, record_contact

logger = logging.getLogger("simoa.rf07")

DEFAULT_BUFFER_PATH = Path(__file__).resolve().parents[2] / "data" / "rf07_pending_buffer.sqlite3"
MAX_BUFFER_ROWS = 10000


def _to_utc_naive(raw_dt: Any) -> datetime:
    if isinstance(raw_dt, datetime):
        if raw_dt.tzinfo is not None:
            return raw_dt.astimezone(timezone.utc).replace(tzinfo=None)
        return raw_dt
    if isinstance(raw_dt, str):
        cleaned = raw_dt.strip()
        if cleaned.endswith("Z"):
            cleaned = cleaned[:-1] + "+00:00"
        dt = datetime.fromisoformat(cleaned)
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    raise ValueError("Timestamp UTC inválido para almacenamiento en RF-07.")


def compute_idempotency_key(
    sensor_id: str,
    captured_at_utc: datetime,
    magnitudes: Dict[str, float],
    explicit_id: Optional[str] = None,
) -> str:
    if explicit_id and explicit_id.strip():
        return f"msg:{explicit_id.strip()[:70]}"
    canonical = json.dumps(
        {
            "s": sensor_id,
            "t": captured_at_utc.isoformat(),
            "m": {k: round(float(v), 6) for k, v in sorted(magnitudes.items())},
        },
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class DurablePendingBuffer:
    """Buffer local durable en SQLite WAL para conservar mediciones ante caídas temporales de MySQL o reinicios."""

    def __init__(self, db_path: Optional[Path] = None) -> None:
        env_path = os.getenv("RF07_BUFFER_PATH")
        self._path = Path(env_path) if env_path else (db_path or DEFAULT_BUFFER_PATH)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self._path), timeout=10.0, check_same_thread=False)
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        return conn

    def _init_db(self) -> None:
        with self._lock:
            conn = self._connect()
            try:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS pending_measurements (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      idempotency_key TEXT NOT NULL UNIQUE,
                      payload_json TEXT NOT NULL,
                      retry_count INTEGER NOT NULL DEFAULT 0,
                      created_at TEXT NOT NULL
                    )
                    """
                )
                conn.commit()
            finally:
                conn.close()

    def count(self) -> int:
        with self._lock:
            conn = self._connect()
            try:
                row = conn.execute("SELECT COUNT(*) FROM pending_measurements").fetchone()
                return int(row[0]) if row else 0
            finally:
                conn.close()

    def enqueue(self, idempotency_key: str, record: Dict[str, Any]) -> bool:
        with self._lock:
            conn = self._connect()
            try:
                total = conn.execute("SELECT COUNT(*) FROM pending_measurements").fetchone()[0]
                if total >= MAX_BUFFER_ROWS:
                    logger.error("Buffer durable RF-07 alcanzó su límite (%s); omitiendo nueva entrada.", MAX_BUFFER_ROWS)
                    return False
                conn.execute(
                    """
                    INSERT OR IGNORE INTO pending_measurements (idempotency_key, payload_json, created_at)
                    VALUES (?, ?, ?)
                    """,
                    (
                        idempotency_key,
                        json.dumps(record, ensure_ascii=False),
                        datetime.now(timezone.utc).isoformat(),
                    ),
                )
                conn.commit()
                return True
            finally:
                conn.close()

    def peek_batch(self, limit: int = 50) -> List[Tuple[int, str, Dict[str, Any], int]]:
        with self._lock:
            conn = self._connect()
            try:
                rows = conn.execute(
                    "SELECT id, idempotency_key, payload_json, retry_count FROM pending_measurements ORDER BY id ASC LIMIT ?",
                    (limit,),
                ).fetchall()
                return [(int(r[0]), str(r[1]), json.loads(r[2]), int(r[3])) for r in rows]
            finally:
                conn.close()

    def delete_row(self, row_id: int) -> None:
        with self._lock:
            conn = self._connect()
            try:
                conn.execute("DELETE FROM pending_measurements WHERE id = ?", (row_id,))
                conn.commit()
            finally:
                conn.close()

    def increment_retry(self, row_id: int) -> None:
        with self._lock:
            conn = self._connect()
            try:
                conn.execute(
                    "UPDATE pending_measurements SET retry_count = retry_count + 1 WHERE id = ?",
                    (row_id,),
                )
                conn.commit()
            finally:
                conn.close()


class MeasurementPersistenceService:
    """RF-07: Persistencia atómica en MySQL (UTC), evaluación de umbrales existente, idempotencia y recuperación."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._buffer = DurablePendingBuffer()
        self._stop_event = threading.Event()
        self._recovery_thread: Optional[threading.Thread] = None
        self._running = False

        self._insert_times_ms: Deque[float] = deque(maxlen=1000)
        self._stats: Dict[str, Any] = {
            "persisted_count": 0,
            "duplicate_ignored_count": 0,
            "buffered_count": 0,
            "recovered_count": 0,
            "failed_count": 0,
            "retry_attempts_count": 0,
            "last_error": None,
            "last_persisted_at": None,
        }

        self._base_backoff_s = float(os.getenv("RF07_BACKOFF_BASE_SECONDS", "1.0"))
        self._max_backoff_s = float(os.getenv("RF07_BACKOFF_MAX_SECONDS", "32.0"))
        self._max_inline_retries = int(os.getenv("RF07_MAX_INLINE_RETRIES", "2"))

    def start(self) -> None:
        with self._lock:
            if self._running:
                return
            self._stop_event.clear()
            self._running = True
            self._recovery_thread = threading.Thread(
                target=self._recovery_loop, name="simoa-rf07-recovery", daemon=True
            )
            self._recovery_thread.start()

    def stop(self) -> None:
        with self._lock:
            if not self._running:
                return
            self._running = False
            self._stop_event.set()
        if self._recovery_thread is not None:
            self._recovery_thread.join(timeout=2.0)

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            times = list(self._insert_times_ms)
            avg_ms = sum(times) / len(times) if times else 0.0
            max_ms = max(times) if times else 0.0
            p95_ms = sorted(times)[int(0.95 * (len(times) - 1))] if times else 0.0
            return {
                "running": self._running,
                "pending_buffer_count": self._buffer.count(),
                "metrics": {
                    **self._stats,
                    "avg_insert_ms": round(avg_ms, 3),
                    "p95_insert_ms": round(p95_ms, 3),
                    "max_insert_ms": round(max_ms, 3),
                    "samples_measured": len(times),
                },
            }

    def _build_record(self, event: Any) -> Dict[str, Any]:
        if isinstance(event, dict):
            sensor_id = event.get("sensor_id")
            dispositivo_id = event.get("dispositivo_id")
            ubicacion_id = event.get("ubicacion_id")
            configuracion_id = event.get("configuracion_id")
            magnitudes = event.get("magnitudes") or {}
            captured_raw = event.get("captured_at") or event.get("fecha_hora")
            explicit_id = event.get("message_id")
        else:
            sensor_id = event.sensor_id
            dispositivo_id = event.dispositivo_id
            ubicacion_id = event.ubicacion_id
            configuracion_id = event.configuracion_id
            magnitudes = event.magnitudes
            captured_raw = event.captured_at
            explicit_id = getattr(event, "message_id", None)

        if not sensor_id or not dispositivo_id:
            raise ValueError("La medición debe incluir sensor_id y dispositivo_id válidos.")
        if not magnitudes:
            raise ValueError("La medición no contiene magnitudes válidas.")

        for k, val in magnitudes.items():
            if isinstance(val, bool) or not isinstance(val, (int, float)) or not math.isfinite(float(val)):
                raise ValueError(f"Valor numérico inválido para '{k}'.")
            if k == "humedad" and (float(val) < 0.0 or float(val) > 100.0):
                raise ValueError("Anomalía de sensor: la humedad relativa debe estar entre 0 %RH y 100 %RH.")

        captured_utc = _to_utc_naive(captured_raw)
        idem_key = compute_idempotency_key(sensor_id, captured_utc, magnitudes, explicit_id=explicit_id)

        return {
            "dispositivo_id": dispositivo_id,
            "sensor_id": sensor_id,
            "ubicacion_id": ubicacion_id,
            "temperatura": float(magnitudes["temperatura"]) if "temperatura" in magnitudes else None,
            "humedad": float(magnitudes["humedad"]) if "humedad" in magnitudes else None,
            "presion": float(magnitudes["presion"]) if "presion" in magnitudes else None,
            "configuracion_id": configuracion_id,
            "variables_activas_snapshot": json.dumps(sorted(magnitudes.keys()), ensure_ascii=False),
            "clave_idempotencia": idem_key,
            "fecha_hora": captured_utc.isoformat(),
            "recepcion_confiable": (
                event.received_at if getattr(event, "connectivity_evidence", False) else None
            ),
            "rssi": (
                getattr(event, "rssi", None) if hasattr(event, "rssi")
                else (event.get("rssi") if isinstance(event, dict) else None)
            ),
        }

    def _insert_atomic_mysql(self, rec: Dict[str, Any]) -> Tuple[Optional[int], bool, Optional[bool]]:
        """Inserta una medición en MySQL dentro de una transacción atómica.
        Devuelve (id_medicion, es_duplicado_idempotente, es_fuera_de_umbral).
        """
        t0 = time.perf_counter()
        fecha_dt = datetime.fromisoformat(rec["fecha_hora"])

        with db_cursor() as cursor:
            receipt = rec.get("recepcion_confiable")
            device = lock_device(cursor, rec["dispositivo_id"]) if receipt else None
            if receipt and (not device or not device["activo_administrativamente"]):
                return None, False, None

            cursor.execute(
                """
                SELECT temp_min, temp_max, hum_min, hum_max, presion_min, presion_max
                FROM umbrales_alerta
                WHERE sensor_id = %s
                LIMIT 1
                """,
                (rec["sensor_id"],),
            )
            limits = cursor.fetchone()

            evaluated_any = False
            out_of_range = False
            if limits is not None:
                if rec["temperatura"] is not None and limits["temp_min"] is not None and limits["temp_max"] is not None:
                    evaluated_any = True
                    if rec["temperatura"] < float(limits["temp_min"]) or rec["temperatura"] > float(limits["temp_max"]):
                        out_of_range = True
                if rec["humedad"] is not None and limits["hum_min"] is not None and limits["hum_max"] is not None:
                    evaluated_any = True
                    if rec["humedad"] < float(limits["hum_min"]) or rec["humedad"] > float(limits["hum_max"]):
                        out_of_range = True
                if rec["presion"] is not None and limits["presion_min"] is not None and limits["presion_max"] is not None:
                    evaluated_any = True
                    if rec["presion"] < float(limits["presion_min"]) or rec["presion"] > float(limits["presion_max"]):
                        out_of_range = True

            es_fuera_de_umbral: Optional[bool] = out_of_range if evaluated_any else None
            es_fuera_db = (1 if out_of_range else 0) if evaluated_any else None

            # RF-18: Evaluación desacoplada de anomalías con Machine Learning (RN-20)
            ai_eval = None
            valor_anomalo_db: Optional[int] = None
            score_ia_db: Optional[float] = None
            try:
                from .anomaly_detector import anomaly_service
                ai_eval = anomaly_service.evaluate_measurement(
                    sensor_id=rec["sensor_id"],
                    target_medicion={
                        "temperatura": rec["temperatura"],
                        "humedad": rec["humedad"],
                        "fecha_hora": fecha_dt,
                        "dispositivo_id": rec["dispositivo_id"],
                        "ubicacion_id": rec["ubicacion_id"],
                    },
                )
                if ai_eval.is_anomaly is not None:
                    valor_anomalo_db = 1 if ai_eval.is_anomaly else 0
                    score_ia_db = ai_eval.score
            except Exception as ai_err:
                logger.warning("Fallo no bloqueante en evaluación de anomalía IA (RN-20): %s", ai_err)

            try:
                cursor.execute(
                    """
                    INSERT INTO mediciones (
                      dispositivo_id, sensor_id, ubicacion_id,
                      temperatura, humedad, presion,
                      alerta_generada, es_fuera_de_umbral, valor_anomalo, score_anomalia_ia,
                      configuracion_id, variables_activas_snapshot, clave_idempotencia, fecha_hora
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, 0, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        rec["dispositivo_id"],
                        rec["sensor_id"],
                        rec["ubicacion_id"],
                        rec["temperatura"],
                        rec["humedad"],
                        rec["presion"],
                        es_fuera_db,
                        valor_anomalo_db,
                        score_ia_db,
                        rec["configuracion_id"],
                        rec["variables_activas_snapshot"],
                        rec["clave_idempotencia"],
                        fecha_dt,
                    ),
                )
                med_id = int(cursor.lastrowid)

                if med_id and ai_eval:
                    try:
                        from .anomaly_detector import anomaly_service
                        anomaly_service.record_evaluation(
                            medicion_id=med_id,
                            sensor_id=rec["sensor_id"],
                            target_medicion={
                                "temperatura": rec["temperatura"],
                                "humedad": rec["humedad"],
                                "fecha_hora": fecha_dt,
                                "dispositivo_id": rec["dispositivo_id"],
                                "ubicacion_id": rec["ubicacion_id"],
                            },
                            eval_result=ai_eval,
                            cursor=cursor,
                        )
                    except Exception as rec_err:
                        logger.warning("Fallo no bloqueante al registrar evaluación IA: %s", rec_err)

                if receipt:
                    record_contact(
                        cursor,
                        device,
                        captured=fecha_dt,
                        received=_to_utc_naive(receipt),
                        reason="TELEMETRIA",
                        rssi=rec.get("rssi"),
                    )
                elapsed_ms = (time.perf_counter() - t0) * 1000.0
                with self._lock:
                    self._insert_times_ms.append(elapsed_ms)
                return med_id, False, es_fuera_de_umbral
            except pymysql.err.IntegrityError as exc:
                if exc.args and exc.args[0] == 1062:
                    cursor.execute(
                        "SELECT id_medicion, es_fuera_de_umbral FROM mediciones WHERE clave_idempotencia = %s LIMIT 1",
                        (rec["clave_idempotencia"],),
                    )
                    existing = cursor.fetchone()
                    existing_id = int(existing["id_medicion"]) if existing else None
                    existing_out = (
                        bool(existing["es_fuera_de_umbral"])
                        if existing and existing["es_fuera_de_umbral"] is not None
                        else None
                    )
                    return existing_id, True, existing_out
                raise

    def persist_event(self, event: Any) -> Tuple[bool, Optional[int], bool]:
        """Persiste la medición validada en MySQL.
        Devuelve (confirmado_en_mysql, id_medicion, fue_duplicado).
        Si MySQL cae, conserva la medición en buffer durable y devuelve (False, None, False).
        """
        rec = self._build_record(event)

        last_exc: Optional[Exception] = None
        for attempt in range(self._max_inline_retries + 1):
            try:
                med_id, is_dup, _out = self._insert_atomic_mysql(rec)
                if med_id is None:
                    return False, None, is_dup
                with self._lock:
                    if is_dup:
                        self._stats["duplicate_ignored_count"] += 1
                    else:
                        self._stats["persisted_count"] += 1
                    self._stats["last_persisted_at"] = datetime.now(timezone.utc).isoformat()
                    self._stats["last_error"] = None
                return True, med_id, is_dup
            except (pymysql.err.OperationalError, pymysql.err.InterfaceError) as exc:
                last_exc = exc
                with self._lock:
                    self._stats["retry_attempts_count"] += 1
                    self._stats["last_error"] = f"Fallo temporal MySQL: {type(exc).__name__}"
                if attempt < self._max_inline_retries:
                    delay = min(self._max_backoff_s, self._base_backoff_s * (2 ** attempt))
                    time.sleep(min(delay, 0.5))
            except Exception as exc:
                with self._lock:
                    self._stats["failed_count"] += 1
                    self._stats["last_error"] = str(exc)
                logger.error("Error de integridad/validación persistiendo medición RF-07: %s", exc)
                raise

        # MySQL sigue caído tras reintentos breves: conservar en buffer durable para recuperación
        if self._buffer.enqueue(rec["clave_idempotencia"], rec):
            with self._lock:
                self._stats["buffered_count"] += 1
        logger.warning("MySQL no disponible (%s); medición conservada en buffer durable RF-07.", type(last_exc).__name__)
        return False, None, False

    def flush_pending_buffer(self) -> int:
        """Drena mediciones pendientes desde el buffer durable hacia MySQL."""
        recovered = 0
        batch = self._buffer.peek_batch(limit=50)
        for row_id, _key, rec, _retries in batch:
            try:
                med_id, is_dup, _out = self._insert_atomic_mysql(rec)
                self._buffer.delete_row(row_id)
                if med_id is None:
                    continue
                recovered += 1
                with self._lock:
                    if is_dup:
                        self._stats["duplicate_ignored_count"] += 1
                    else:
                        self._stats["recovered_count"] += 1
                        self._stats["persisted_count"] += 1
                    self._stats["last_persisted_at"] = datetime.now(timezone.utc).isoformat()
                    self._stats["last_error"] = None
            except (pymysql.err.OperationalError, pymysql.err.InterfaceError) as exc:
                self._buffer.increment_retry(row_id)
                with self._lock:
                    self._stats["last_error"] = f"Recuperación diferida MySQL: {type(exc).__name__}"
                raise
            except Exception as exc:
                logger.error("Registro irrecuperable en buffer RF-07 (id=%s): %s", row_id, exc)
                self._buffer.delete_row(row_id)
                with self._lock:
                    self._stats["failed_count"] += 1
        return recovered

    def _recovery_loop(self) -> None:
        backoff = self._base_backoff_s
        while not self._stop_event.is_set():
            pending = self._buffer.count()
            if pending == 0:
                backoff = self._base_backoff_s
                self._stop_event.wait(1.0)
                continue

            try:
                drained = self.flush_pending_buffer()
                if drained > 0:
                    backoff = self._base_backoff_s
                    continue
            except (pymysql.err.OperationalError, pymysql.err.InterfaceError):
                with self._lock:
                    self._stats["retry_attempts_count"] += 1
                self._stop_event.wait(backoff)
                backoff = min(self._max_backoff_s, backoff * 2.0)
                continue

            self._stop_event.wait(0.5)


measurement_persister = MeasurementPersistenceService()
