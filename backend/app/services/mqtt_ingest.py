from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import logging
import math
import queue
import threading
import time
from typing import Any, Callable, Deque, Dict, List, Optional, Tuple
import uuid

import paho.mqtt.client as mqtt
import pymysql

from ..config import get_settings
from ..database import db_cursor
from ..routers.sensores import MODEL_CAPABILITIES, STANDARD_UNITS
from .device_connectivity import lock_device, record_contact, utc_now
from .live_telemetry import live_temperature_broadcaster
from .measurement_persistence import measurement_persister

logger = logging.getLogger("simoa.mqtt")

TOPIC_WILDCARD = "simoa/dispositivos/+/telemetria"
HEARTBEAT_WILDCARD = "simoa/dispositivos/+/heartbeat"
RESERVED_PAYLOAD_KEYS = {"codigo", "timestamp", "sensor_id", "identificador", "unidades", "mqtt_client_id"}
SENSITIVE_KEYS = ("password", "pass", "token", "secret", "authorization", "clave")
MAX_DLQ_ROWS = 5000


@dataclass
class CachedSensor:
    id_sensor: str
    dispositivo_id: str
    identificador: str
    modelo: str
    estado: str
    configuracion_id: Optional[str]
    enabled_variables: Dict[str, str]


@dataclass
class CachedDevice:
    id_dispositivo: str
    codigo: str
    nombre: str
    estado: str
    ubicacion_id: Optional[str]
    sensors: List[CachedSensor] = field(default_factory=list)
    mqtt_client_id: Optional[str] = None
    mqtt_topic: Optional[str] = None


@dataclass
class NormalizedTelemetryEvent:
    event_id: str
    topic: str
    codigo: str
    dispositivo_id: str
    ubicacion_id: Optional[str]
    sensor_id: str
    sensor_identificador: str
    sensor_modelo: str
    configuracion_id: Optional[str]
    captured_at: str
    received_at: str
    processing_ms: float
    magnitudes: Dict[str, float]
    unidades: Dict[str, str]
    route_targets: Tuple[str, ...] = ("RF-07", "RF-13")
    connectivity_evidence: bool = False


@dataclass
class Heartbeat:
    device_id: str
    captured: datetime
    received: datetime


@dataclass
class RejectedMqttRecord:
    topico: str
    codigo_dispositivo: Optional[str]
    motivo: str
    detalle: str
    payload_resumido: str
    fecha_hora: datetime


def _sanitize_payload_preview(raw_bytes: bytes) -> str:
    try:
        text = raw_bytes.decode("utf-8", errors="replace")
    except Exception:
        text = repr(raw_bytes[:256])
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            redacted = {
                k: ("[REDACTED]" if any(s in str(k).lower() for s in SENSITIVE_KEYS) else v)
                for k, v in parsed.items()
            }
            text = json.dumps(redacted, ensure_ascii=False)
    except Exception:
        pass
    return text[:1024]


def _extract_topic_code(topic: str) -> Optional[str]:
    parts = topic.split("/")
    if len(parts) != 4 or parts[0] != "simoa" or parts[1] != "dispositivos" or parts[3] not in ("telemetria", "heartbeat"):
        return None
    code = parts[2].strip()
    return code if code else None


def _parse_timestamp(raw_ts: Any) -> Optional[datetime]:
    if raw_ts is None or isinstance(raw_ts, bool):
        return None
    if isinstance(raw_ts, (int, float)):
        try:
            if not math.isfinite(raw_ts) or raw_ts <= 0:
                return None
            ts_sec = raw_ts / 1000.0 if raw_ts > 1e12 else float(raw_ts)
            return datetime.fromtimestamp(ts_sec, tz=timezone.utc).replace(tzinfo=None)
        except (OSError, OverflowError, ValueError):
            return None
    if isinstance(raw_ts, str):
        cleaned = raw_ts.strip()
        if not cleaned:
            return None
        if cleaned.endswith("Z"):
            cleaned = cleaned[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(cleaned)
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt
        except ValueError:
            return None
    return None


class MetadataCache:
    """Caché en memoria con TTL para evitar consultas repetidas a MySQL en el hilo MQTT."""

    def __init__(self, ttl_seconds: int = 15) -> None:
        self._ttl = max(1, ttl_seconds)
        self._lock = threading.RLock()
        self._loaded_at: float = 0.0
        self._devices_by_code: Dict[str, CachedDevice] = {}

    def invalidate(self) -> None:
        with self._lock:
            self._loaded_at = 0.0

    def get_device(self, codigo: str, allow_refresh: bool = True) -> Optional[CachedDevice]:
        with self._lock:
            now = time.monotonic()
            expired = (now - self._loaded_at) >= self._ttl
            if expired or (codigo not in self._devices_by_code and allow_refresh and (now - self._loaded_at) >= 0.25):
                self._reload_locked()
            return self._devices_by_code.get(codigo)

    def refresh_now(self) -> int:
        with self._lock:
            self._reload_locked()
            return len(self._devices_by_code)

    def _reload_locked(self) -> None:
        devices_by_id: Dict[str, CachedDevice] = {}
        devices_by_code: Dict[str, CachedDevice] = {}

        with db_cursor() as cursor:
            cursor.execute(
                """
                SELECT id_dispositivo, codigo, nombre, estado, ubicacion_id, mqtt_client_id, mqtt_topic
                FROM dispositivos
                WHERE codigo IS NOT NULL AND codigo <> ''
                """
            )
            for row in cursor.fetchall():
                dev = CachedDevice(
                    id_dispositivo=row["id_dispositivo"],
                    codigo=row["codigo"],
                    nombre=row["nombre"],
                    estado=row["estado"],
                    ubicacion_id=row.get("ubicacion_id"),
                    mqtt_client_id=row.get("mqtt_client_id"),
                    mqtt_topic=row.get("mqtt_topic"),
                )
                devices_by_id[dev.id_dispositivo] = dev
                devices_by_code[dev.codigo] = dev

            cursor.execute(
                """
                SELECT s.id_sensor, s.dispositivo_id, s.identificador, s.modelo, s.estado,
                       s.variables_medidas,
                       c.id_configuracion, c.temperatura_habilitada, c.humedad_habilitada, c.presion_habilitada
                FROM sensores s
                LEFT JOIN configuracion_variables_sensor c ON c.sensor_id = s.id_sensor
                """
            )
            for s_row in cursor.fetchall():
                dev = devices_by_id.get(s_row["dispositivo_id"])
                if dev is None:
                    continue
                modelo = s_row["modelo"]
                allowed = MODEL_CAPABILITIES.get(modelo, {})
                enabled: Dict[str, str] = {}

                if s_row.get("id_configuracion") is not None:
                    if s_row.get("temperatura_habilitada") and "temperatura" in allowed:
                        enabled["temperatura"] = STANDARD_UNITS["temperatura"]
                    if s_row.get("humedad_habilitada") and "humedad" in allowed:
                        enabled["humedad"] = STANDARD_UNITS["humedad"]
                    if s_row.get("presion_habilitada") and "presion" in allowed:
                        enabled["presion"] = STANDARD_UNITS["presion"]
                else:
                    try:
                        parsed = json.loads(s_row.get("variables_medidas") or "[]")
                    except Exception:
                        parsed = []
                    for item in parsed:
                        if isinstance(item, dict):
                            v_name = item.get("variable")
                            if v_name in allowed:
                                enabled[v_name] = STANDARD_UNITS.get(v_name, allowed[v_name])

                dev.sensors.append(
                    CachedSensor(
                        id_sensor=s_row["id_sensor"],
                        dispositivo_id=s_row["dispositivo_id"],
                        identificador=s_row["identificador"],
                        modelo=modelo,
                        estado=s_row["estado"],
                        configuracion_id=s_row.get("id_configuracion"),
                        enabled_variables=enabled,
                    )
                )

        self._devices_by_code = devices_by_code
        self._loaded_at = time.monotonic()


class MqttIngestionService:
    """Servicio singleton por proceso para ingestión continua de telemetría MQTT (RF-06)."""

    def __init__(self) -> None:
        settings = get_settings()
        self._lock = threading.RLock()
        self._running = False
        self._connected = False
        self._subscribed = False
        self._client: Optional[mqtt.Client] = None
        self._cache = MetadataCache(ttl_seconds=settings.mqtt_cache_ttl_seconds)

        self.telemetry_queue: queue.Queue[NormalizedTelemetryEvent | Heartbeat] = queue.Queue(
            maxsize=max(10, settings.mqtt_queue_maxsize)
        )
        self.dlq_queue: queue.Queue[RejectedMqttRecord] = queue.Queue(maxsize=2000)

        self._stop_event = threading.Event()
        self._telemetry_thread: Optional[threading.Thread] = None
        self._dlq_thread: Optional[threading.Thread] = None

        self._rf07_handlers: List[Callable[[NormalizedTelemetryEvent], None]] = []
        self._rf13_handlers: List[Callable[[NormalizedTelemetryEvent], None]] = [
            live_temperature_broadcaster.publish_from_rf07_event
        ]
        self._recent_routed: Deque[NormalizedTelemetryEvent] = deque(maxlen=200)
        self._processing_times_ms: Deque[float] = deque(maxlen=1000)

        self._stats: Dict[str, Any] = {
            "received_count": 0,
            "accepted_count": 0,
            "rejected_count": 0,
            "routed_count": 0,
            "reconnect_count": 0,
            "last_error": None,
            "last_connected_at": None,
            "last_message_at": None,
        }

    def register_rf07_handler(self, handler: Callable[[NormalizedTelemetryEvent], None]) -> None:
        self._rf07_handlers.append(handler)

    def register_rf13_handler(self, handler: Callable[[NormalizedTelemetryEvent], None]) -> None:
        self._rf13_handlers.append(handler)

    def invalidate_cache(self) -> None:
        self._cache.invalidate()

    def get_recent_routed(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [
                {
                    "event_id": e.event_id,
                    "topic": e.topic,
                    "codigo": e.codigo,
                    "dispositivo_id": e.dispositivo_id,
                    "ubicacion_id": e.ubicacion_id,
                    "sensor_id": e.sensor_id,
                    "sensor_modelo": e.sensor_modelo,
                    "configuracion_id": e.configuracion_id,
                    "captured_at": e.captured_at,
                    "received_at": e.received_at,
                    "processing_ms": round(e.processing_ms, 3),
                    "magnitudes": e.magnitudes,
                    "unidades": e.unidades,
                    "route_targets": list(e.route_targets),
                }
                for e in list(self._recent_routed)
            ]

    def get_status(self) -> Dict[str, Any]:
        settings = get_settings()
        with self._lock:
            times = list(self._processing_times_ms)
            avg_ms = sum(times) / len(times) if times else 0.0
            max_ms = max(times) if times else 0.0
            p95_ms = sorted(times)[int(0.95 * (len(times) - 1))] if times else 0.0
            return {
                "enabled": settings.mqtt_enabled,
                "running": self._running,
                "connected": self._connected,
                "subscribed": self._subscribed,
                "topic_filter": TOPIC_WILDCARD,
                "broker_host": settings.mqtt_broker_host,
                "broker_port": settings.mqtt_broker_port,
                "client_id": settings.mqtt_client_id,
                "qos": settings.mqtt_qos,
                "queue_size": self.telemetry_queue.qsize(),
                "queue_maxsize": self.telemetry_queue.maxsize,
                "dlq_pending": self.dlq_queue.qsize(),
                "metrics": {
                    **self._stats,
                    "avg_processing_ms": round(avg_ms, 3),
                    "max_processing_ms": round(max_ms, 3),
                    "p95_processing_ms": round(p95_ms, 3),
                    "samples_measured": len(times),
                },
            }

    def start(self, wait_connect_seconds: float = 0.0) -> None:
        settings = get_settings()
        with self._lock:
            if self._running or not settings.mqtt_enabled:
                return

            self._stop_event.clear()
            try:
                self._cache.refresh_now()
            except Exception as exc:
                logger.warning("Precarga inicial de caché MQTT diferida: %s", exc)

            client_id = f"{settings.mqtt_client_id}-{uuid.uuid4().hex[:6]}"
            client = mqtt.Client(
                callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
                client_id=client_id,
                clean_session=True,
            )
            if settings.mqtt_username:
                client.username_pw_set(settings.mqtt_username, settings.mqtt_password or None)
            if settings.mqtt_tls_ca_file:
                client.tls_set(ca_certs=settings.mqtt_tls_ca_file)

            client.reconnect_delay_set(
                min_delay=max(1, settings.mqtt_reconnect_min_delay),
                max_delay=max(2, settings.mqtt_reconnect_max_delay),
            )
            client.on_connect = self._on_connect
            client.on_disconnect = self._on_disconnect
            client.on_message = self._on_message

            self._telemetry_thread = threading.Thread(
                target=self._telemetry_worker_loop, name="simoa-mqtt-router", daemon=True
            )
            self._dlq_thread = threading.Thread(
                target=self._dlq_worker_loop, name="simoa-mqtt-dlq", daemon=True
            )
            measurement_persister.start()
            self._telemetry_thread.start()
            self._dlq_thread.start()

            try:
                client.connect_async(
                    settings.mqtt_broker_host,
                    settings.mqtt_broker_port,
                    keepalive=settings.mqtt_keepalive_seconds,
                )
                client.loop_start()
            except Exception as exc:
                self._stats["last_error"] = str(exc)
                logger.error("Error iniciando conexión MQTT: %s", exc)

            self._client = client
            self._running = True

        if wait_connect_seconds > 0:
            deadline = time.monotonic() + wait_connect_seconds
            while time.monotonic() < deadline:
                if self._connected and self._subscribed:
                    break
                time.sleep(0.05)

    def stop(self) -> None:
        with self._lock:
            if not self._running:
                return
            self._running = False
            self._stop_event.set()
            client = self._client
            self._client = None

        if client is not None:
            try:
                client.disconnect()
            except Exception:
                pass
            try:
                client.loop_stop()
            except Exception:
                pass

        if self._telemetry_thread is not None:
            self._telemetry_thread.join(timeout=2.0)
        if self._dlq_thread is not None:
            self._dlq_thread.join(timeout=2.0)
        measurement_persister.stop()

        with self._lock:
            self._connected = False
            self._subscribed = False

    def _on_connect(self, client: mqtt.Client, _userdata: Any, _flags: Any, reason_code: Any, _props: Any) -> None:
        settings = get_settings()
        is_ok = getattr(reason_code, "is_failure", False) is False
        with self._lock:
            if is_ok:
                was_disconnected = self._stats["last_connected_at"] is not None and not self._connected
                if was_disconnected:
                    self._stats["reconnect_count"] += 1
                self._connected = True
                self._stats["last_connected_at"] = datetime.now(timezone.utc).isoformat()
                self._stats["last_error"] = None
            else:
                self._connected = False
                self._subscribed = False
                self._stats["last_error"] = f"MQTT connect rejected: {reason_code}"

        if is_ok:
            topics = [(TOPIC_WILDCARD, settings.mqtt_qos)]
            if settings.rf15_mqtt_acl_enforced:
                topics.append((HEARTBEAT_WILDCARD, settings.mqtt_qos))
            res, _mid = client.subscribe(topics)
            with self._lock:
                self._subscribed = res == mqtt.MQTT_ERR_SUCCESS
            logger.info("SIMOA MQTT conectado y suscrito a %s (QoS=%s)", TOPIC_WILDCARD, settings.mqtt_qos)

    def _on_disconnect(self, _client: mqtt.Client, _userdata: Any, _flags: Any, reason_code: Any, _props: Any) -> None:
        with self._lock:
            self._connected = False
            self._subscribed = False
            if getattr(reason_code, "is_failure", False):
                self._stats["last_error"] = f"Desconexión MQTT: {reason_code}"
        logger.warning("SIMOA MQTT desconectado (%s); reconexión automática activa.", reason_code)

    def _enqueue_rejection(
        self, topic: str, codigo: Optional[str], motivo: str, detalle: str, raw_bytes: bytes
    ) -> None:
        with self._lock:
            self._stats["rejected_count"] += 1
        rec = RejectedMqttRecord(
            topico=topic[:180],
            codigo_dispositivo=codigo[:64] if codigo else None,
            motivo=motivo,
            detalle=detalle[:255],
            payload_resumido=_sanitize_payload_preview(raw_bytes),
            fecha_hora=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        try:
            self.dlq_queue.put_nowait(rec)
        except queue.Full:
            logger.error("DLQ en memoria saturada; rechazo descartado (%s: %s)", motivo, topic)

    def _on_message(self, _client: mqtt.Client, _userdata: Any, msg: mqtt.MQTTMessage) -> None:
        t_start = time.perf_counter()
        received = utc_now()
        topic = msg.topic or ""
        raw_bytes = msg.payload or b""
        topic_code = _extract_topic_code(topic)

        with self._lock:
            self._stats["received_count"] += 1
            self._stats["last_message_at"] = datetime.now(timezone.utc).isoformat()

        if topic_code is None:
            self._enqueue_rejection(topic, None, "TOPICO_INVALIDO", "Tópico no coincide con simoa/dispositivos/+/telemetria", raw_bytes)
            return

        # 1. JSON válido
        try:
            payload = json.loads(raw_bytes.decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("La carga útil debe ser un objeto JSON.")
        except Exception as exc:
            self._enqueue_rejection(topic, topic_code, "JSON_MALFORMADO", f"JSON inválido: {exc}", raw_bytes)
            return

        # 2. Código presente y coincidente con el tópico
        payload_code = payload.get("codigo")
        if not isinstance(payload_code, str) or not payload_code.strip() or payload_code.strip() != topic_code:
            self._enqueue_rejection(
                topic,
                topic_code,
                "CODIGO_INCONSISTENTE",
                "El campo 'codigo' es obligatorio y debe coincidir exactamente con el tópico.",
                raw_bytes,
            )
            return

        # 3. Dispositivo existente y activo (RF-02, RN-07)
        try:
            device = self._cache.get_device(topic_code)
        except (pymysql.err.OperationalError, pymysql.err.InterfaceError) as exc:
            logger.warning("Validación MQTT aplazada por MySQL (%s).", type(exc).__name__)
            return
        if device is None:
            self._enqueue_rejection(
                topic,
                topic_code,
                "DISPOSITIVO_DESCONOCIDO",
                "Dispositivo no registrado en RF-02 (no se crean dispositivos automáticamente).",
                raw_bytes,
            )
            return

        if device.estado == "INACTIVO":
            self._enqueue_rejection(
                topic,
                topic_code,
                "DISPOSITIVO_INACTIVO",
                "RN-07: Dispositivo inactivo; no genera mediciones nuevas.",
                raw_bytes,
            )
            return

        # 4. Timestamp válido
        captured_dt = _parse_timestamp(payload.get("timestamp"))
        if captured_dt is None:
            self._enqueue_rejection(
                topic,
                topic_code,
                "TIMESTAMP_INVALIDO",
                "El campo 'timestamp' es obligatorio y debe ser epoch válido o ISO-8601.",
                raw_bytes,
            )
            return

        trusted = get_settings().rf15_mqtt_acl_enforced and bool(device.mqtt_client_id) and (
            device.mqtt_topic == f"simoa/dispositivos/{topic_code}/telemetria"
        )
        retained = bool(getattr(msg, "retain", False))
        if topic.endswith("/heartbeat"):
            if not trusted or retained or set(payload) != {"codigo", "timestamp", "mqtt_client_id"} or (
                payload["mqtt_client_id"] != device.mqtt_client_id
            ):
                self._enqueue_rejection(
                    topic, topic_code, "HEARTBEAT_INVALIDO",
                    "El latido debe ser no retenido e identificar el cliente MQTT registrado.", raw_bytes,
                )
                return
            try:
                self.telemetry_queue.put_nowait(Heartbeat(device.id_dispositivo, captured_dt, received))
            except queue.Full:
                self._enqueue_rejection(topic, topic_code, "COLA_SATURADA", "Cola MQTT saturada.", raw_bytes)
            return

        if "mqtt_client_id" in payload and payload["mqtt_client_id"] != device.mqtt_client_id:
            self._enqueue_rejection(topic, topic_code, "CLIENTE_INCONSISTENTE", "Client ID MQTT inconsistente.", raw_bytes)
            return

        # 5. Valores numéricos válidos y extensibles (sin asumir solo temperatura y humedad)
        magnitudes: Dict[str, float] = {}
        for key, value in payload.items():
            if key in RESERVED_PAYLOAD_KEYS:
                continue
            try:
                num_val = float(value) if type(value) in (int, float) else math.nan
            except OverflowError:
                num_val = math.nan
            if not math.isfinite(num_val):
                self._enqueue_rejection(
                    topic,
                    topic_code,
                    "VALOR_NUMERICO_INVALIDO",
                    f"Valor numérico inválido para magnitud '{key}' (NaN/Inf/no numérico).",
                    raw_bytes,
                )
                return
            if key == "humedad" and (num_val < 0.0 or num_val > 100.0):
                logger.warning(
                    "Anomalía de sensor en %s (%s): humedad físicamente inválida (%s %%RH); descartada sin alerta ambiental.",
                    topic_code,
                    topic,
                    num_val,
                )
                self._enqueue_rejection(
                    topic,
                    topic_code,
                    "LECTURA_FISICA_INVALIDA",
                    f"Anomalía de sensor: humedad fuera de rango físico [0, 100] %RH ({num_val}).",
                    raw_bytes,
                )
                return
            magnitudes[key] = num_val

        if not magnitudes:
            self._enqueue_rejection(
                topic,
                topic_code,
                "VARIABLE_NO_HABILITADA",
                "La carga útil no contiene magnitudes ambientales.",
                raw_bytes,
            )
            return

        # 6. Sensor vinculado en RF-04 y operativo (RN-07)
        if not device.sensors:
            self._enqueue_rejection(
                topic,
                topic_code,
                "SENSOR_NO_VINCULADO",
                "El dispositivo no tiene sensores vinculados en RF-04.",
                raw_bytes,
            )
            return

        requested_sensor_ref = payload.get("sensor_id") or payload.get("identificador")
        selected_sensor: Optional[CachedSensor] = None
        if requested_sensor_ref is not None:
            ref_str = str(requested_sensor_ref).strip()
            selected_sensor = next(
                (s for s in device.sensors if s.id_sensor == ref_str or s.identificador == ref_str),
                None,
            )
            if selected_sensor is None:
                self._enqueue_rejection(
                    topic,
                    topic_code,
                    "SENSOR_NO_VINCULADO",
                    "El sensor indicado no pertenece al dispositivo emisor.",
                    raw_bytes,
                )
                return
        else:
            # Elegir el primer sensor operativo cuyas capacidades cubran las magnitudes, o el primer sensor vinculado
            operational = [s for s in device.sensors if s.estado == "ACTIVO"]
            candidates = operational if operational else device.sensors
            selected_sensor = next(
                (s for s in candidates if set(magnitudes.keys()).issubset(set(s.enabled_variables.keys()))),
                candidates[0],
            )

        if selected_sensor.estado in ("FALLA", "CALIBRACION", "INACTIVO"):
            self._enqueue_rejection(
                topic,
                topic_code,
                "SENSOR_NO_OPERATIVO",
                f"RN-07: Sensor {selected_sensor.identificador} en estado {selected_sensor.estado}.",
                raw_bytes,
            )
            return

        # 7. Variables habilitadas en RF-05
        enabled_vars = selected_sensor.enabled_variables
        for mag in magnitudes:
            if mag not in enabled_vars:
                self._enqueue_rejection(
                    topic,
                    topic_code,
                    "VARIABLE_NO_HABILITADA",
                    f"La variable '{mag}' no está habilitada en RF-05 para el sensor {selected_sensor.identificador}.",
                    raw_bytes,
                )
                return

        missing_enabled = [req for req in enabled_vars if req not in magnitudes]
        if missing_enabled:
            self._enqueue_rejection(
                topic,
                topic_code,
                "VARIABLE_NO_HABILITADA",
                f"Faltan magnitudes habilitadas en RF-05: {', '.join(missing_enabled)}.",
                raw_bytes,
            )
            return

        # 8. Normalización a unidades estándar y enrutamiento no bloqueante hacia cola
        elapsed_ms = (time.perf_counter() - t_start) * 1000.0
        event = NormalizedTelemetryEvent(
            event_id=f"evt-{uuid.uuid4().hex[:12]}",
            topic=topic,
            codigo=topic_code,
            dispositivo_id=device.id_dispositivo,
            ubicacion_id=device.ubicacion_id,
            sensor_id=selected_sensor.id_sensor,
            sensor_identificador=selected_sensor.identificador,
            sensor_modelo=selected_sensor.modelo,
            configuracion_id=selected_sensor.configuracion_id,
            captured_at=captured_dt.isoformat(),
            received_at=received.replace(tzinfo=timezone.utc).isoformat(),
            processing_ms=elapsed_ms,
            magnitudes=magnitudes,
            unidades={k: enabled_vars[k] for k in magnitudes},
            connectivity_evidence=trusted and not retained,
        )

        try:
            self.telemetry_queue.put_nowait(event)
        except queue.Full:
            self._enqueue_rejection(
                topic,
                topic_code,
                "COLA_SATURADA",
                "Cola de procesamiento saturada; mensaje rechazado sin bloqueo.",
                raw_bytes,
            )
            return

        with self._lock:
            self._stats["accepted_count"] += 1
            self._processing_times_ms.append(elapsed_ms)

    def _telemetry_worker_loop(self) -> None:
        while not self._stop_event.is_set() or not self.telemetry_queue.empty():
            try:
                event = self.telemetry_queue.get(timeout=0.2)
            except queue.Empty:
                continue

            try:
                if isinstance(event, Heartbeat):
                    try:
                        with db_cursor() as cursor:
                            device = lock_device(cursor, event.device_id)
                            record_contact(
                                cursor, device, captured=event.captured, received=event.received, reason="HEARTBEAT"
                            )
                    except pymysql.MySQLError as exc:
                        logger.warning("No se pudo registrar el latido MQTT (%s).", type(exc).__name__)
                    continue
                # RF-07: Persistir en MySQL dentro de transacción atómica ANTES de liberar a suscriptores en vivo
                persisted_ok = False
                med_id = None
                try:
                    persisted_ok, med_id, _is_dup = measurement_persister.persist_event(event)
                except Exception as exc:
                    logger.error("Error RF-07 persistiendo evento %s: %s", event.event_id, exc)

                for handler in self._rf07_handlers:
                    try:
                        handler(event)
                    except Exception as exc:
                        logger.error("Error en handler RF-07 (%s): %s", event.event_id, exc)

                if persisted_ok:
                    with self._lock:
                        self._recent_routed.append(event)
                        self._stats["routed_count"] += 1

                    for handler in self._rf13_handlers:
                        try:
                            handler(event)
                        except Exception as exc:
                            logger.error("Error en handler RF-13 (%s): %s", event.event_id, exc)

                # RF-13: Evaluación de alertas por desborde de límites (incluso con buffer provisional si MySQL cayó)
                try:
                    from .alerts_service import alerts_service

                    alerts_service.process_event(event, medicion_id=med_id)
                except Exception as exc:
                    logger.error("Error evaluando alertas RF-13 (%s): %s", event.event_id, exc)
            finally:
                self.telemetry_queue.task_done()

    def _dlq_worker_loop(self) -> None:
        dlq_ops = 0
        while not self._stop_event.is_set() or not self.dlq_queue.empty():
            try:
                rec = self.dlq_queue.get(timeout=0.2)
            except queue.Empty:
                continue

            try:
                for attempt in range(3):
                    try:
                        with db_cursor() as cursor:
                            cursor.execute(
                                """
                                INSERT INTO mqtt_mensajes_rechazados (
                                  topico, codigo_dispositivo, motivo, detalle, payload_resumido, fecha_hora
                                )
                                VALUES (%s, %s, %s, %s, %s, %s)
                                """,
                                (
                                    rec.topico,
                                    rec.codigo_dispositivo,
                                    rec.motivo,
                                    rec.detalle,
                                    rec.payload_resumido,
                                    rec.fecha_hora,
                                ),
                            )
                            dlq_ops += 1
                            if dlq_ops % 50 == 0:
                                cursor.execute(
                                    """
                                    DELETE FROM mqtt_mensajes_rechazados
                                    WHERE id_rechazo <= (
                                      SELECT cutoff FROM (
                                        SELECT id_rechazo AS cutoff
                                        FROM mqtt_mensajes_rechazados
                                        ORDER BY id_rechazo DESC
                                        LIMIT 1 OFFSET %s
                                      ) AS t
                                    )
                                    """,
                                    (MAX_DLQ_ROWS,),
                                )
                        break
                    except pymysql.err.OperationalError as exc:
                        if exc.args and exc.args[0] == 1213 and attempt < 2:
                            time.sleep(0.05)
                            continue
                        raise
            except Exception as exc:
                logger.error("Error persistiendo rechazo MQTT en DLQ: %s", exc)
            finally:
                self.dlq_queue.task_done()


mqtt_service = MqttIngestionService()
