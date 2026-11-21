from datetime import datetime, timedelta, timezone
import logging
import threading
import time
from typing import Any

from ..config import get_settings
from ..database import db_cursor

logger = logging.getLogger("simoa.rf15")
_inventory_lock = threading.Lock()
_inventory_cache: tuple[float, list[dict]] = (0, [])


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def utc_iso(value: datetime | None) -> str | None:
    return value.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z") if value else None


def classify_contact(last_contact: datetime | None, now: datetime, normal: int, maximum: int) -> str:
    if last_contact is None:
        return "PENDIENTE"
    silence = (now - last_contact).total_seconds()
    if silence <= normal:
        return "ONLINE"
    if silence <= maximum:
        return "ADVERTENCIA"
    return "OFFLINE"


def _change_state(
    cursor: Any, row: dict, new: str, reason: str, now: datetime, contact: datetime | None, rssi: int | None = None
) -> None:
    previous = row["estado"]
    if previous == new:
        return
    reading_cutoff = None
    if new == "OFFLINE" and contact is not None:
        reading_cutoff = contact + timedelta(seconds=get_settings().rf15_max_silence_seconds)
    cursor.execute(
        """
        UPDATE dispositivos
        SET estado = %s,
            estado_conectividad = CASE WHEN %s = 'INACTIVO' THEN estado_conectividad ELSE %s END,
            activo_administrativamente = CASE WHEN %s = 'INACTIVO' THEN 0 ELSE activo_administrativamente END,
            fecha_cambio_conectividad = %s, fecha_actualizacion = %s,
            lecturas_desde_utc = COALESCE(%s, lecturas_desde_utc)
        WHERE id_dispositivo = %s
        """,
        (new, new, new, new, now, now, reading_cutoff, row["id_dispositivo"]),
    )
    rssi_to_log = rssi if rssi is not None else row.get("rssi_dbm")
    cursor.execute(
        """
        INSERT INTO historial_conectividad_dispositivos
          (dispositivo_id, estado_anterior, estado_nuevo, motivo, fecha_cambio_utc, ultimo_ping, rssi_dbm)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (row["id_dispositivo"], previous, new, reason, now, contact, rssi_to_log),
    )


def lock_device(cursor: Any, device_id: str) -> dict | None:
    cursor.execute(
        """
        SELECT id_dispositivo, estado, activo_administrativamente, ultimo_ping, ultima_evidencia_origen, rssi_dbm
        FROM dispositivos WHERE id_dispositivo = %s FOR UPDATE
        """,
        (device_id,),
    )
    return cursor.fetchone()


def deactivate_device(cursor: Any, row: dict) -> None:
    _change_state(cursor, row, "INACTIVO", "DESACTIVACION", utc_now(), row["ultimo_ping"])


def record_contact(
    cursor: Any, row: dict | None, *, captured: datetime, received: datetime, reason: str,
    now: datetime | None = None,
    rssi: int | None = None,
) -> bool:
    settings = get_settings()
    if not row or not row["activo_administrativamente"]:
        return False
    age = (received - captured).total_seconds()
    previous_contact = row["ultimo_ping"]
    previous_origin = row["ultima_evidencia_origen"]
    if (
        age < -settings.rf15_normal_seconds or age > settings.rf15_evidence_max_age_seconds
        or (previous_contact is not None and received <= previous_contact)
        or (previous_origin is not None and captured <= previous_origin)
    ):
        return False

    now = now if now is not None else utc_now()
    rssi_val = None
    if rssi is not None:
        try:
            val = int(rssi)
            if -130 <= val <= 0:
                rssi_val = val
        except (TypeError, ValueError):
            rssi_val = None

    cursor.execute(
        """
        UPDATE dispositivos
        SET ultimo_ping = %s, ultima_evidencia_origen = %s,
            rssi_dbm = COALESCE(%s, rssi_dbm),
            fecha_actualizacion = fecha_actualizacion
        WHERE id_dispositivo = %s
        """,
        (received, captured, rssi_val, row["id_dispositivo"]),
    )
    if rssi_val is not None:
        row["rssi_dbm"] = rssi_val
    new = classify_contact(received, now, settings.rf15_normal_seconds, settings.rf15_max_silence_seconds)
    _change_state(cursor, row, new, reason, now, received, rssi=rssi_val)
    return True


def serialize_connectivity(row: dict, now: datetime) -> dict:
    contact = row.get("ultimo_ping")
    silence = max(0, int((now - contact).total_seconds())) if contact else None
    rssi = row.get("rssi_dbm")
    # RF-19: Advertencia preventiva si RSSI < -80 dBm. Si es >= -80 dBm, no se muestra advertencia.
    alerta_senal_debil = bool(rssi is not None and rssi < -80)
    return {
        "estado": row["estado"],
        "activo_administrativamente": bool(row.get("activo_administrativamente", row["estado"] != "INACTIVO")),
        "estado_conectividad": row.get("estado_conectividad"),
        "ultimo_ping": utc_iso(contact),
        "fecha_cambio_conectividad": utc_iso(row.get("fecha_cambio_conectividad")),
        "silencio_segundos": silence,
        "tiempo_silencio_segundos": silence,
        "tolerancia_maxima_segundos": get_settings().rf15_max_silence_seconds,
        "rssi_dbm": rssi,
        "alerta_senal_debil": alerta_senal_debil,
    }


def inventory_snapshot() -> list[dict]:
    global _inventory_cache
    with _inventory_lock:
        loaded, rows = _inventory_cache
        if not loaded or time.monotonic() - loaded >= get_settings().rf15_scan_seconds:
            rows = _read_inventory()
            _inventory_cache = (time.monotonic(), rows)
        return rows


def _read_inventory() -> list[dict]:
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT d.id_dispositivo, d.codigo, d.nombre, d.ubicacion_id, d.estado,
                   COALESCE(u.nombre, d.ubicacion) AS ubicacion,
                   d.activo_administrativamente, d.estado_conectividad,
                   d.ultimo_ping, d.fecha_cambio_conectividad, d.rssi_dbm
            FROM dispositivos d LEFT JOIN ubicaciones u ON u.ubicacion_id = d.ubicacion_id
            ORDER BY d.id_dispositivo
            """
        )
        rows = cursor.fetchall()
    now = utc_now()
    return [
        {
            **{key: row[key] for key in ("id_dispositivo", "codigo", "nombre", "ubicacion_id", "ubicacion")},
            **serialize_connectivity(row, now),
        }
        for row in rows
    ]


class ConnectivityMonitor:
    def __init__(self) -> None:
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def scan(self) -> int:
        settings = get_settings()
        now = utc_now()
        normal_cutoff = now - timedelta(seconds=settings.rf15_normal_seconds)
        max_cutoff = now - timedelta(seconds=settings.rf15_max_silence_seconds)
        lock_name = f"rf15:{settings.db_name}"[:64]
        with db_cursor() as lock:
            lock.execute("SELECT GET_LOCK(%s, 0) AS acquired", (lock_name,))
            if lock.fetchone()["acquired"] != 1:
                return 0
            try:
                with db_cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id_dispositivo, estado, ultimo_ping
                        FROM dispositivos
                        WHERE activo_administrativamente = 1 AND (
                            (ultimo_ping IS NULL AND estado <> 'PENDIENTE')
                            OR (estado_conectividad = 'ONLINE' AND ultimo_ping < %s)
                            OR (estado_conectividad = 'ADVERTENCIA' AND ultimo_ping < %s)
                            OR (estado_conectividad = 'OFFLINE' AND ultimo_ping >= %s)
                            OR (estado_conectividad = 'ADVERTENCIA' AND ultimo_ping >= %s)
                        ) ORDER BY id_dispositivo FOR UPDATE
                        """,
                        (normal_cutoff, max_cutoff, max_cutoff, normal_cutoff),
                    )
                    changes = 0
                    for row in cursor.fetchall():
                        new = classify_contact(
                            row["ultimo_ping"], now, settings.rf15_normal_seconds, settings.rf15_max_silence_seconds
                        )
                        if new != row["estado"]:
                            _change_state(cursor, row, new, "SILENCIO", now, row["ultimo_ping"])
                            changes += 1
                    return changes
            finally:
                lock.execute("SELECT RELEASE_LOCK(%s)", (lock_name,))

    def _run(self) -> None:
        interval = get_settings().rf15_scan_seconds
        while not self._stop.is_set():
            try:
                self.scan()
            except Exception as exc:
                logger.warning("No se pudo evaluar conectividad; se reintentará (%s).", type(exc).__name__)
            self._stop.wait(interval)

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="rf15-connectivity", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        t = self._thread
        self._thread = None
        if t is not None and t.is_alive():
            try:
                t.join(timeout=5)
            except RuntimeError:
                pass


connectivity_monitor = ConnectivityMonitor()
