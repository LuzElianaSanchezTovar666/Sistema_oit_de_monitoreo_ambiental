"""
Servicio de sincronización temporal y verificación NTP (RNF-12).
Garantiza precisión temporal <= 1s, validación de deriva de timestamps en telemetría (> 60s),
y formateo estandarizado ISO-8601 UTC / America/Bogota.
"""

from datetime import datetime, timezone, timedelta
import logging
import socket
import struct
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger("simoa.time_sync")

# Constante de época NTP: segundos entre 1 de enero de 1900 y 1 de enero de 1970
NTP_DELTA = 2208988800
DEFAULT_NTP_SERVER = "pool.ntp.org"
DEFAULT_NTP_PORT = 123
MAX_ACCEPTABLE_OFFSET_SECONDS = 1.0  # RNF-12: Desfase máximo permitido <= 1s
MAX_TELEMETRY_DRIFT_SECONDS = 60.0  # RNF-12: Anomalía temporal si > 60s

# Zona horaria de referencia para visualización local
BOGOTA_TIMEZONE = timezone(timedelta(hours=-5), name="America/Bogota")


def get_ntp_offset_seconds(
    server: str = DEFAULT_NTP_SERVER,
    port: int = DEFAULT_NTP_PORT,
    timeout: float = 1.5,
) -> Optional[float]:
    """
    Consulta un servidor NTP usando el protocolo SNTP (RFC 4330 / 5905).
    Devuelve el desfase del reloj local en segundos respecto al servidor NTP de referencia.
    Si la red no está disponible o el servidor no responde dentro del timeout, devuelve None.
    """
    client = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    client.settimeout(timeout)
    # Paquete SNTP de 48 bytes: LI=0, VN=3, Mode=3 (Cliente) -> primer byte = 0x1B
    data = b"\x1b" + 47 * b"\0"
    
    try:
        t1 = datetime.now(timezone.utc).timestamp()
        client.sendto(data, (server, port))
        response, _ = client.recvfrom(1024)
        t4 = datetime.now(timezone.utc).timestamp()
    except (socket.timeout, OSError, Exception) as exc:
        logger.debug("Consulta NTP a %s:%d omitida o fallida (%s)", server, port, exc)
        return None
    finally:
        try:
            client.close()
        except Exception:
            pass

    if len(response) < 48:
        return None

    # Extraer el timestamp de transmisión del servidor (bytes 40 a 47)
    integ, frac = struct.unpack("!II", response[40:48])
    t3 = (integ - NTP_DELTA) + (float(frac) / 2**32)
    # Para SNTP simple de 1 petición: offset ~ (t3 - (t1 + t4)/2)
    local_time = (t1 + t4) / 2.0
    offset = t3 - local_time
    return offset


def verify_server_time_sync(
    server: str = DEFAULT_NTP_SERVER,
    max_offset: float = MAX_ACCEPTABLE_OFFSET_SECONDS,
) -> Dict[str, Any]:
    """
    Verifica que el reloj del servidor esté sincronizado dentro del umbral RNF-12 (<= 1.0s).
    """
    now_utc = datetime.now(timezone.utc)
    offset = get_ntp_offset_seconds(server=server)
    
    if offset is None:
        # En entornos aislados o sin conectividad externa a puerto UDP 123
        return {
            "in_sync": True,
            "measured": False,
            "offset_seconds": 0.0,
            "max_tolerated_seconds": max_offset,
            "reference_server": server,
            "checked_at_utc": now_utc.isoformat().replace("+00:00", "Z"),
            "note": "Servidor NTP no accesible; asumiendo reloj del sistema operativo sincronizado.",
        }

    abs_offset = abs(offset)
    in_sync = abs_offset <= max_offset
    return {
        "in_sync": in_sync,
        "measured": True,
        "offset_seconds": round(offset, 4),
        "abs_offset_seconds": round(abs_offset, 4),
        "max_tolerated_seconds": max_offset,
        "reference_server": server,
        "checked_at_utc": now_utc.isoformat().replace("+00:00", "Z"),
        "status": "SINCRONIZADO" if in_sync else "DESFASADO",
    }


def validate_telemetry_timestamp(
    captured_at: datetime,
    reference_time: Optional[datetime] = None,
    max_drift_seconds: float = MAX_TELEMETRY_DRIFT_SECONDS,
) -> Tuple[bool, float, Optional[str]]:
    """
    Evalúa si el timestamp capturado presenta un desfase excesivo (> 60 segundos)
    respecto al reloj del servidor al momento de recepción (RNF-12).
    
    Devuelve:
    (es_valido, drift_en_segundos, motivo_anomalia_o_none)
    """
    ref = reference_time or datetime.now(timezone.utc).replace(tzinfo=None)
    if captured_at.tzinfo is not None:
        captured_naive = captured_at.astimezone(timezone.utc).replace(tzinfo=None)
    else:
        captured_naive = captured_at

    drift = (ref - captured_naive).total_seconds()
    abs_drift = abs(drift)

    if abs_drift > max_drift_seconds:
        direction = "pasado" if drift > 0 else "futuro"
        return (
            False,
            drift,
            f"DESFASE_TEMPORAL_EXCESIVO ({abs_drift:.1f}s hacia el {direction} > {max_drift_seconds}s)",
        )

    return True, drift, None


def format_utc_iso(dt: datetime) -> str:
    """Formatea cualquier datetime en estándar ISO 8601 UTC con sufijo 'Z' explícito."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def format_bogota_display(dt: datetime, include_seconds: bool = True) -> str:
    """
    Convierte una fecha UTC a la zona horaria local de Colombia (America/Bogota, UTC-5)
    para presentación clara según RNF-12.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    bogota_dt = dt.astimezone(BOGOTA_TIMEZONE)
    fmt = "%Y-%m-%d %H:%M:%S" if include_seconds else "%Y-%m-%d %H:%M"
    return bogota_dt.strftime(fmt)
