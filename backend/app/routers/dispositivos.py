import ipaddress
import re
import secrets
import socket
import time
from typing import Any, Dict, List, Literal, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
import pymysql

from ..config import get_settings
from ..database import db_cursor
from ..dependencies import require_roles
from ..security import hash_password
from ..services.device_connectivity import deactivate_device, lock_device, record_contact, serialize_connectivity, utc_now
from .mantenimientos import MantenimientoCreateRequest, serialize_mantenimiento
from .sensores import _SENSOR_SELECT, _serialize_sensor

router = APIRouter(prefix="/api/dispositivos", tags=["Dispositivos IoT (RF-02 y RF-03)"])

MAC_REGEX = re.compile(r"^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$")
DeviceTypeLiteral = Literal["ESP32", "ESP8266", "Gateway"]
INVALID_OR_DUPLICATE_MAC_MSG = "La dirección MAC ya existe o no tiene formato válido"


def _validate_optional_ip(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    cleaned = v.strip()
    if not cleaned or cleaned.lower() in ("no registrado", "none", "null"):
        return None
    try:
        ipaddress.ip_address(cleaned)
    except ValueError:
        raise ValueError(f"La dirección IP '{cleaned}' no tiene un formato IPv4 o IPv6 válido.")
    return cleaned


class DispositivoCreateRequest(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=120)
    mac_address: str = Field(..., min_length=1, max_length=32)
    tipo: DeviceTypeLiteral
    firmware_version: str = Field(..., min_length=1, max_length=32)
    ubicacion_id: Optional[str] = Field(default=None, max_length=64)
    ubicacion: Optional[str] = Field(default=None, max_length=120)
    ip_address: Optional[str] = Field(default=None, max_length=45)
    observacion_tecnica: Optional[str] = Field(default=None, max_length=255)

    @field_validator("nombre", "firmware_version")
    @classmethod
    def strip_non_empty(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("El campo no puede estar vacío.")
        return cleaned

    @field_validator("ip_address")
    @classmethod
    def check_ip(cls, v: Optional[str]) -> Optional[str]:
        return _validate_optional_ip(v)


class DispositivoUpdateRequest(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=120)
    mac_address: str = Field(..., min_length=1, max_length=32)
    tipo: DeviceTypeLiteral
    firmware_version: str = Field(..., min_length=1, max_length=32)
    ubicacion_id: Optional[str] = Field(default=None, max_length=64)
    ubicacion: Optional[str] = Field(default=None, max_length=120)
    ip_address: Optional[str] = Field(default=None, max_length=45)
    observacion_tecnica: Optional[str] = Field(default=None, max_length=255)

    @field_validator("nombre", "firmware_version")
    @classmethod
    def strip_non_empty(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("El campo no puede estar vacío.")
        return cleaned

    @field_validator("ip_address")
    @classmethod
    def check_ip(cls, v: Optional[str]) -> Optional[str]:
        return _validate_optional_ip(v)


class DispositivoPatchTechnicalRequest(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=120)
    firmware_version: Optional[str] = Field(default=None, min_length=1, max_length=32)
    ubicacion_id: Optional[str] = Field(default=None, max_length=64)
    ip_address: Optional[str] = Field(default=None, max_length=45)
    observacion_tecnica: Optional[str] = Field(default=None, max_length=255)

    @field_validator("nombre", "firmware_version")
    @classmethod
    def strip_non_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("El campo no puede estar vacío si se proporciona.")
        return cleaned

    @field_validator("ip_address")
    @classmethod
    def check_ip(cls, v: Optional[str]) -> Optional[str]:
        return _validate_optional_ip(v)


class DispositivoReasignarUbicacionRequest(BaseModel):
    ubicacion_id: str = Field(..., min_length=1, max_length=64)
    motivo: Optional[str] = Field(default=None, max_length=255)


_BROKER_STATUS_CACHE: Dict[str, Any] = {"checked_at": 0.0, "status": None}


def _check_mqtt_broker_status() -> Dict[str, Any]:
    global _BROKER_STATUS_CACHE
    now = time.monotonic()
    if (now - _BROKER_STATUS_CACHE["checked_at"]) < 2.0 and _BROKER_STATUS_CACHE["status"] is not None:
        return _BROKER_STATUS_CACHE["status"]

    settings = get_settings()
    host = settings.mqtt_broker_host
    port = settings.mqtt_broker_port

    try:
        from ..services.mqtt_ingest import mqtt_service
        if mqtt_service._connected:
            res = {
                "mqtt_broker_disponible": True,
                "mqtt_broker_host": host,
                "mqtt_broker_port": port,
                "mqtt_broker_mensaje": f"Broker MQTT conectado y activo en {host}:{port}.",
            }
            _BROKER_STATUS_CACHE = {"checked_at": now, "status": res}
            return res
    except Exception:
        pass

    try:
        with socket.create_connection((host, port), timeout=0.15):
            res = {
                "mqtt_broker_disponible": True,
                "mqtt_broker_host": host,
                "mqtt_broker_port": port,
                "mqtt_broker_mensaje": f"Broker MQTT accesible en {host}:{port}. Esperando autenticación del nodo.",
            }
    except OSError:
        res = {
            "mqtt_broker_disponible": False,
            "mqtt_broker_host": host,
            "mqtt_broker_port": port,
            "mqtt_broker_mensaje": (
                f"Broker MQTT no disponible en {host}:{port}; "
                "el dispositivo permanece en estado PENDIENTE sin conexión confirmada."
            ),
        }

    _BROKER_STATUS_CACHE = {"checked_at": now, "status": res}
    return res


def _normalize_mac_or_400(mac_raw: str) -> str:
    cleaned = mac_raw.strip().upper()
    if not MAC_REGEX.match(cleaned):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=INVALID_OR_DUPLICATE_MAC_MSG,
        )
    return cleaned


def _resolve_active_ubicacion(cursor: Any, ubicacion_id: Optional[str], ubicacion_name: Optional[str]) -> Dict[str, Any]:
    """Valida que la ubicación exista en MySQL y esté ACTIVA (RN-04)."""
    uid = (ubicacion_id or "").strip()
    uname = (ubicacion_name or "").strip()

    if not uid and not uname:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Todo dispositivo activo debe tener una ubicación física asignada (RN-04).",
        )

    if uid:
        cursor.execute(
            "SELECT ubicacion_id, nombre, codigo_area, estado FROM ubicaciones WHERE ubicacion_id = %s LIMIT 1",
            (uid,),
        )
    else:
        cursor.execute(
            "SELECT ubicacion_id, nombre, codigo_area, estado FROM ubicaciones WHERE ubicacion_id = %s OR nombre = %s LIMIT 1",
            (uname, uname),
        )

    ubi = cursor.fetchone()
    if ubi is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La ubicación seleccionada no existe en el catálogo (RN-04).",
        )
    if ubi["estado"] != "ACTIVA":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede asignar una ubicación inactiva (RN-04).",
        )
    return ubi


def _serialize_device(row: Dict[str, Any]) -> Dict[str, Any]:
    fr = row.get("fecha_registro")
    fa = row.get("fecha_actualizacion")
    return {
        "id_dispositivo": row["id_dispositivo"],
        "id_usuario": row.get("id_usuario"),
        "codigo": row.get("codigo"),
        "nombre": row["nombre"],
        "mac_address": row["mac_address"],
        "ip_address": row.get("ip_address"),
        "tipo": row.get("tipo", "ESP32"),
        "firmware_version": row.get("firmware_version", ""),
        "ubicacion_id": row.get("ubicacion_id") or "",
        "ubicacion": row.get("ubicacion_nombre") or row.get("ubicacion") or row.get("ubicacion_id") or "",
        "codigo_area": row.get("codigo_area") or "",
        **serialize_connectivity(row, utc_now()),
        "observacion_tecnica": row.get("observacion_tecnica"),
        "mqtt_client_id": row.get("mqtt_client_id"),
        "mqtt_topic": row.get("mqtt_topic"),
        "mqtt_username": row.get("mqtt_username"),
        "historial_mediciones_count": int(row.get("historial_mediciones_count") or 0),
        "fecha_registro": fr.isoformat() if hasattr(fr, "isoformat") else (str(fr) if fr else None),
        "fecha_actualizacion": fa.isoformat() if hasattr(fa, "isoformat") else (str(fa) if fa else None),
    }


_DEVICE_SELECT = """
    SELECT
      d.id_dispositivo, d.id_usuario, d.codigo, d.nombre, d.mac_address, d.ip_address, d.tipo,
      d.ubicacion_id, d.ubicacion, u.nombre AS ubicacion_nombre, u.codigo_area,
      d.estado, d.firmware_version, d.observacion_tecnica, d.activo_administrativamente,
      d.estado_conectividad, d.ultimo_ping, d.fecha_cambio_conectividad, d.rssi_dbm,
      d.mqtt_client_id, d.mqtt_topic, d.mqtt_username, d.fecha_registro, d.fecha_actualizacion,
      COUNT(m.id_medicion) AS historial_mediciones_count
    FROM dispositivos d
    LEFT JOIN ubicaciones u ON u.ubicacion_id = d.ubicacion_id
    LEFT JOIN mediciones m ON m.dispositivo_id = d.id_dispositivo
"""


class PingSimulatorRequest(BaseModel):
    rssi_dbm: Optional[int] = Field(default=None, ge=-130, le=0)


@router.get("/resumen-conectividad")
def resumen_conectividad(
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    """RF-19: Resumen global de conectividad de nodos IoT en tiempo real."""
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT id_dispositivo, estado, activo_administrativamente, estado_conectividad, ultimo_ping, rssi_dbm
            FROM dispositivos
            """
        )
        rows = cursor.fetchall()

    online = 0
    offline = 0
    advertencia = 0
    error_cnt = 0
    pendiente = 0
    inactivo = 0
    senal_debil = 0

    for r in rows:
        est = (r.get("estado") or "PENDIENTE").upper()
        activo = bool(r.get("activo_administrativamente", est != "INACTIVO"))
        rssi = r.get("rssi_dbm")
        if rssi is not None and rssi < -80:
            senal_debil += 1

        if not activo or est == "INACTIVO":
            inactivo += 1
        elif est == "ONLINE":
            online += 1
        elif est == "OFFLINE":
            offline += 1
        elif est == "ADVERTENCIA":
            advertencia += 1
        elif est == "ERROR":
            error_cnt += 1
        elif est == "PENDIENTE":
            pendiente += 1
        else:
            inactivo += 1

    total_activos = online + offline + advertencia + error_cnt + pendiente
    total_registrados = len(rows)
    pct = round((online / total_activos) * 100, 1) if total_activos > 0 else 0.0

    return {
        "online": online,
        "offline": offline,
        "advertencia": advertencia,
        "error": error_cnt,
        "pendiente": pendiente,
        "inactivo": inactivo,
        "senal_debil": senal_debil,
        "total_activos": total_activos,
        "total_registrados": total_registrados,
        "porcentaje_online": pct,
        "texto_resumen": f"{online} de {total_activos} dispositivos conectados",
    }


@router.get("")
def list_dispositivos(
    search: Optional[str] = Query(default=None),
    estado: Optional[str] = Query(default=None),
    tipo: Optional[str] = Query(default=None),
    ubicacion_id: Optional[str] = Query(default=None),
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    conditions: List[str] = []
    params: List[Any] = []

    if search and search.strip():
        q = f"%{search.strip()}%"
        conditions.append("(d.nombre LIKE %s OR d.codigo LIKE %s OR d.mac_address LIKE %s OR d.ubicacion LIKE %s OR u.codigo_area LIKE %s)")
        params.extend([q, q, q, q, q])
    if estado and estado.strip() and estado != "ALL":
        conditions.append("d.estado = %s")
        params.append(estado.strip())
    if tipo and tipo.strip() and tipo != "ALL":
        conditions.append("d.tipo = %s")
        params.append(tipo.strip())
    if ubicacion_id and ubicacion_id.strip() and ubicacion_id != "ALL":
        conditions.append("d.ubicacion_id = %s")
        params.append(ubicacion_id.strip())

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with db_cursor() as cursor:
        cursor.execute(
            f"""
            {_DEVICE_SELECT}
            {where_clause}
            GROUP BY d.id_dispositivo
            ORDER BY d.fecha_registro DESC, d.id_dispositivo ASC
            """,
            tuple(params),
        )
        rows = cursor.fetchall()

    broker_info = _check_mqtt_broker_status()
    return {
        "items": [_serialize_device(r) for r in rows],
        "total": len(rows),
        **broker_info,
    }


@router.get("/{id_dispositivo}")
def get_dispositivo(
    id_dispositivo: str,
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    with db_cursor() as cursor:
        cursor.execute(
            f"""
            {_DEVICE_SELECT}
            WHERE d.id_dispositivo = %s
            GROUP BY d.id_dispositivo
            LIMIT 1
            """,
            (id_dispositivo,),
        )
        row = cursor.fetchone()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dispositivo no encontrado.",
        )

    return {
        "dispositivo": _serialize_device(row),
        **_check_mqtt_broker_status(),
    }


@router.post("/{id_dispositivo}/ping")
def simular_ping_dispositivo(
    id_dispositivo: str,
    payload: PingSimulatorRequest,
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Técnico")
    ),
) -> Dict[str, Any]:
    """RF-19: Registro manual / simulación de contacto y nivel de señal RSSI."""
    now = utc_now()
    with db_cursor() as cursor:
        device = lock_device(cursor, id_dispositivo)
        if not device:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispositivo no encontrado.")
        if not device.get("activo_administrativamente"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dispositivo administrativamente inactivo.")
        recorded = record_contact(
            cursor, device, captured=now, received=now, reason="MANUAL_PING", rssi=payload.rssi_dbm
        )
    return {
        "message": "Ping registrado correctamente.",
        "id_dispositivo": id_dispositivo,
        "rssi_dbm": payload.rssi_dbm,
        "exito": recorded,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_dispositivo(
    payload: DispositivoCreateRequest,
    current_user: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> Dict[str, Any]:
    mac_normalized = _normalize_mac_or_400(payload.mac_address)

    device_id = f"dev-{uuid.uuid4().hex[:8]}"
    short_code = uuid.uuid4().hex[:6].upper()
    codigo = f"SIMOA-{payload.tipo.upper()}-{short_code}"
    mqtt_client_id = f"simoa_client_{codigo.lower()}"
    mqtt_topic = f"simoa/dispositivos/{codigo}/telemetria"
    mqtt_username = f"mqtt_{codigo.lower()}"
    mqtt_password_plain = secrets.token_urlsafe(16)
    mqtt_password_hash = hash_password(mqtt_password_plain)

    try:
        with db_cursor() as cursor:
            ubi = _resolve_active_ubicacion(cursor, payload.ubicacion_id, payload.ubicacion)

            cursor.execute(
                "SELECT id_dispositivo FROM dispositivos WHERE mac_address = %s LIMIT 1",
                (mac_normalized,),
            )
            if cursor.fetchone() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=INVALID_OR_DUPLICATE_MAC_MSG,
                )

            cursor.execute(
                """
                INSERT INTO dispositivos (
                  id_dispositivo, id_usuario, codigo, nombre, mac_address, ip_address, tipo,
                  ubicacion_id, ubicacion, estado, firmware_version, observacion_tecnica,
                  mqtt_client_id, mqtt_topic, mqtt_username, mqtt_password_hash, creado_por
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'PENDIENTE', %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    device_id,
                    int(current_user["id_usuario"]),
                    codigo,
                    payload.nombre,
                    mac_normalized,
                    payload.ip_address.strip() if payload.ip_address else None,
                    payload.tipo,
                    ubi["ubicacion_id"],
                    ubi["nombre"],
                    payload.firmware_version,
                    payload.observacion_tecnica.strip() if payload.observacion_tecnica else None,
                    mqtt_client_id,
                    mqtt_topic,
                    mqtt_username,
                    mqtt_password_hash,
                    current_user["correo"],
                ),
            )

            cursor.execute(
                """
                INSERT INTO historial_ubicaciones (
                  dispositivo_id, ubicacion_anterior_id, ubicacion_nueva_id,
                  usuario_responsable_id, usuario_responsable_correo, motivo
                )
                VALUES (%s, NULL, %s, %s, %s, 'Asignación inicial al registrar dispositivo')
                """,
                (
                    device_id,
                    ubi["ubicacion_id"],
                    int(current_user["id_usuario"]),
                    current_user["correo"],
                ),
            )

            cursor.execute(
                f"{_DEVICE_SELECT} WHERE d.id_dispositivo = %s GROUP BY d.id_dispositivo LIMIT 1",
                (device_id,),
            )
            created = cursor.fetchone()
    except pymysql.err.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=INVALID_OR_DUPLICATE_MAC_MSG,
        )

    broker_info = _check_mqtt_broker_status()
    return {
        "message": "Dispositivo registrado en estado PENDIENTE.",
        "dispositivo": _serialize_device(created),
        "mqtt_credentials_once": {
            "codigo": codigo,
            "mqtt_client_id": mqtt_client_id,
            "mqtt_topic": mqtt_topic,
            "mqtt_username": mqtt_username,
            "mqtt_password": mqtt_password_plain,
        },
        **broker_info,
    }


@router.put("/{id_dispositivo}")
def update_dispositivo(
    id_dispositivo: str,
    payload: DispositivoUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> Dict[str, Any]:
    mac_normalized = _normalize_mac_or_400(payload.mac_address)

    try:
        with db_cursor() as cursor:
            cursor.execute(
                "SELECT id_dispositivo, ubicacion_id, estado FROM dispositivos WHERE id_dispositivo = %s LIMIT 1",
                (id_dispositivo,),
            )
            existing = cursor.fetchone()
            if existing is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Dispositivo no encontrado.",
                )

            ubi = _resolve_active_ubicacion(cursor, payload.ubicacion_id, payload.ubicacion)

            cursor.execute(
                """
                SELECT id_dispositivo FROM dispositivos
                WHERE mac_address = %s AND id_dispositivo <> %s
                LIMIT 1
                """,
                (mac_normalized, id_dispositivo),
            )
            if cursor.fetchone() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=INVALID_OR_DUPLICATE_MAC_MSG,
                )

            cursor.execute(
                """
                UPDATE dispositivos
                SET nombre = %s,
                    mac_address = %s,
                    ip_address = %s,
                    tipo = %s,
                    firmware_version = %s,
                    ubicacion_id = %s,
                    ubicacion = %s,
                    observacion_tecnica = %s
                WHERE id_dispositivo = %s
                """,
                (
                    payload.nombre,
                    mac_normalized,
                    payload.ip_address.strip() if payload.ip_address else None,
                    payload.tipo,
                    payload.firmware_version,
                    ubi["ubicacion_id"],
                    ubi["nombre"],
                    payload.observacion_tecnica.strip() if payload.observacion_tecnica else None,
                    id_dispositivo,
                ),
            )

            if existing["ubicacion_id"] != ubi["ubicacion_id"]:
                cursor.execute(
                    """
                    INSERT INTO historial_ubicaciones (
                      dispositivo_id, ubicacion_anterior_id, ubicacion_nueva_id,
                      usuario_responsable_id, usuario_responsable_correo, motivo
                    )
                    VALUES (%s, %s, %s, %s, %s, 'Actualización de ficha de dispositivo')
                    """,
                    (
                        id_dispositivo,
                        existing["ubicacion_id"],
                        ubi["ubicacion_id"],
                        int(current_user["id_usuario"]),
                        current_user["correo"],
                    ),
                )

            cursor.execute(
                f"{_DEVICE_SELECT} WHERE d.id_dispositivo = %s GROUP BY d.id_dispositivo LIMIT 1",
                (id_dispositivo,),
            )
            updated = cursor.fetchone()
    except pymysql.err.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=INVALID_OR_DUPLICATE_MAC_MSG,
        )

    return {
        "message": "Dispositivo actualizado correctamente.",
        "dispositivo": _serialize_device(updated),
    }


@router.put("/{id_dispositivo}/ubicacion")
def assign_dispositivo_ubicacion(
    id_dispositivo: str,
    payload: DispositivoReasignarUbicacionRequest,
    current_user: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> Dict[str, Any]:
    """RF-03: Asigna o reasigna la ubicación física de un dispositivo conservando historial."""
    with db_cursor() as cursor:
        cursor.execute(
            "SELECT id_dispositivo, ubicacion_id, estado FROM dispositivos WHERE id_dispositivo = %s LIMIT 1",
            (id_dispositivo,),
        )
        existing = cursor.fetchone()
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispositivo no encontrado.")

        if existing["estado"] == "INACTIVO":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Un dispositivo INACTIVO conserva su última ubicación como historial (RN-04).",
            )

        ubi = _resolve_active_ubicacion(cursor, payload.ubicacion_id, None)

        cursor.execute(
            "UPDATE dispositivos SET ubicacion_id = %s, ubicacion = %s WHERE id_dispositivo = %s",
            (ubi["ubicacion_id"], ubi["nombre"], id_dispositivo),
        )

        cursor.execute(
            """
            INSERT INTO historial_ubicaciones (
              dispositivo_id, ubicacion_anterior_id, ubicacion_nueva_id,
              usuario_responsable_id, usuario_responsable_correo, motivo
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                id_dispositivo,
                existing["ubicacion_id"],
                ubi["ubicacion_id"],
                int(current_user["id_usuario"]),
                current_user["correo"],
                payload.motivo.strip() if payload.motivo else "Reasignación de ubicación",
            ),
        )

        cursor.execute(
            f"{_DEVICE_SELECT} WHERE d.id_dispositivo = %s GROUP BY d.id_dispositivo LIMIT 1",
            (id_dispositivo,),
        )
        updated = cursor.fetchone()

    return {
        "message": f"Ubicación actualizada a {ubi['nombre']} ({ubi['codigo_area']}).",
        "dispositivo": _serialize_device(updated),
    }


@router.get("/{id_dispositivo}/historial-ubicaciones")
def get_dispositivo_historial_ubicaciones(
    id_dispositivo: str,
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    with db_cursor() as cursor:
        cursor.execute(
            "SELECT id_dispositivo FROM dispositivos WHERE id_dispositivo = %s LIMIT 1",
            (id_dispositivo,),
        )
        if cursor.fetchone() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispositivo no encontrado.")

        cursor.execute(
            """
            SELECT
              h.id_historial,
              h.dispositivo_id,
              h.ubicacion_anterior_id,
              ua.nombre AS ubicacion_anterior_nombre,
              ua.codigo_area AS ubicacion_anterior_codigo,
              h.ubicacion_nueva_id,
              un.nombre AS ubicacion_nueva_nombre,
              un.codigo_area AS ubicacion_nueva_codigo,
              h.usuario_responsable_id,
              u.nombre AS usuario_responsable_nombre,
              h.usuario_responsable_correo,
              h.motivo,
              h.fecha_cambio
            FROM historial_ubicaciones h
            LEFT JOIN ubicaciones ua ON ua.ubicacion_id = h.ubicacion_anterior_id
            INNER JOIN ubicaciones un ON un.ubicacion_id = h.ubicacion_nueva_id
            LEFT JOIN usuarios u ON u.id_usuario = h.usuario_responsable_id
            WHERE h.dispositivo_id = %s
            ORDER BY h.fecha_cambio DESC, h.id_historial DESC
            """,
            (id_dispositivo,),
        )
        rows = cursor.fetchall()

    for r in rows:
        fc = r.get("fecha_cambio")
        r["fecha_cambio"] = fc.isoformat() if hasattr(fc, "isoformat") else str(fc)

    return {"items": rows, "total": len(rows)}


@router.patch("/{id_dispositivo}/desactivar")
def deactivate_dispositivo(
    id_dispositivo: str,
    _current_user: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> Dict[str, Any]:
    with db_cursor() as cursor:
        row = lock_device(cursor, id_dispositivo)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dispositivo no encontrado.",
            )

        deactivate_device(cursor, row)

        cursor.execute(
            f"{_DEVICE_SELECT} WHERE d.id_dispositivo = %s GROUP BY d.id_dispositivo LIMIT 1",
            (id_dispositivo,),
        )
        updated = cursor.fetchone()

    return {
        "message": "Dispositivo desactivado lógicamente (INACTIVO). Su historial permanece intacto.",
        "dispositivo": _serialize_device(updated),
    }


@router.delete("/{id_dispositivo}")
def delete_dispositivo_rn03(
    id_dispositivo: str,
    _current_user: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> Dict[str, Any]:
    """RN-03: Impide la eliminación física cuando existe historial de mediciones."""
    with db_cursor() as cursor:
        device = lock_device(cursor, id_dispositivo)
        if device is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dispositivo no encontrado.",
            )

        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM mediciones WHERE dispositivo_id = %s",
            (id_dispositivo,),
        )
        row = cursor.fetchone()
        hist_count = int(row["cnt"]) if row else 0

        if hist_count > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "No se permite la eliminación física de un dispositivo con historial de mediciones "
                    "(RN-03). Utilice la desactivación lógica."
                ),
            )

        deactivate_device(cursor, device)

    return {
        "message": "Dispositivo desactivado lógicamente (INACTIVO) para preservar trazabilidad.",
        "id_dispositivo": id_dispositivo,
    }


# ============================================================================
# RF-20: FICHA TÉCNICA DETALLADA E HISTORIAL POR DISPOSITIVO (RN-22)
# ============================================================================


@router.get("/{id_dispositivo}/ficha-tecnica")
def get_ficha_tecnica(
    id_dispositivo: str,
    current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    """RF-20: Consulta consolidada de la ficha técnica, hardware, conectividad, sensores y mantenimientos."""
    with db_cursor() as cursor:
        cursor.execute(
            f"{_DEVICE_SELECT} WHERE d.id_dispositivo = %s GROUP BY d.id_dispositivo LIMIT 1",
            (id_dispositivo,),
        )
        dev_row = cursor.fetchone()
        if not dev_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dispositivo '{id_dispositivo}' no encontrado.",
            )

        # 1. Sensores vinculados (RF-04)
        cursor.execute(
            f"{_SENSOR_SELECT} WHERE s.dispositivo_id = %s GROUP BY s.id_sensor ORDER BY s.identificador ASC",
            (id_dispositivo,),
        )
        sensors_rows = cursor.fetchall()
        sensores = [_serialize_sensor(s) for s in sensors_rows]

        # 2. Historial de mantenimientos (RF-20)
        cursor.execute(
            """
            SELECT m.*, d.nombre AS dispositivo_nombre, d.codigo AS dispositivo_codigo
            FROM mantenimientos m
            LEFT JOIN dispositivos d ON d.id_dispositivo = m.dispositivo_id
            WHERE m.dispositivo_id = %s
            ORDER BY m.fecha_intervencion DESC, m.fecha_registro DESC
            """,
            (id_dispositivo,),
        )
        mnt_rows = cursor.fetchall()
        mantenimientos = [serialize_mantenimiento(m) for m in mnt_rows]

        # 3. Alertas recientes asociadas
        cursor.execute(
            """
            SELECT id_alerta, tipo, severidad, estado, mensaje, fecha_hora
            FROM alertas
            WHERE dispositivo_id = %s
            ORDER BY fecha_hora DESC
            LIMIT 5
            """,
            (id_dispositivo,),
        )
        alertas_rows = cursor.fetchall()
        alertas = [
            {
                "id_alerta": a["id_alerta"],
                "tipo": a.get("tipo"),
                "severidad": a.get("severidad"),
                "nivel": a.get("severidad"),
                "estado": a.get("estado"),
                "mensaje": a.get("mensaje"),
                "fecha_hora": a["fecha_hora"].isoformat() if hasattr(a.get("fecha_hora"), "isoformat") else str(a.get("fecha_hora") or ""),
            }
            for a in alertas_rows
        ]

    # 4. Información MQTT protegida (NUNCA exponer password_hash ni credenciales secretas)
    broker_info = _check_mqtt_broker_status()
    device_code = dev_row.get("codigo") or dev_row["id_dispositivo"]
    mqtt_info = {
        "client_id": dev_row.get("mqtt_client_id") or f"simoa-{device_code}",
        "topic_telemetria": dev_row.get("mqtt_topic") or f"simoa/dispositivos/{device_code}/telemetria",
        "topic_heartbeat": f"simoa/dispositivos/{device_code}/heartbeat",
        "broker_host": broker_info.get("mqtt_broker_host"),
        "broker_port": broker_info.get("mqtt_broker_port"),
        "broker_disponible": broker_info.get("mqtt_broker_disponible", False),
        "broker_mensaje": broker_info.get("mqtt_broker_mensaje", ""),
    }

    # 5. Conectividad en tiempo real (RF-15 y RF-19)
    conectividad_info = serialize_connectivity(dev_row, utc_now())

    user_role = current_user.get("rol", "")
    puede_editar = user_role in ("Administrador", "Técnico")

    return {
        "dispositivo": _serialize_device(dev_row),
        "conectividad": conectividad_info,
        "mqtt": mqtt_info,
        "sensores": sensores,
        "sensores_count": len(sensores),
        "mantenimientos": mantenimientos,
        "mantenimientos_count": len(mantenimientos),
        "alertas_recientes": alertas,
        "permisos": {
            "puede_editar_tecnico": puede_editar,
            "puede_registrar_mantenimiento": puede_editar,
            "rol_actual": user_role,
        },
        "advertencia_hardware": (
            "La modificación de parámetros técnicos en SIMOA actualiza el catálogo del sistema "
            "pero no reprograma ni altera de manera automática el hardware o firmware físico del ESP32."
        ),
    }


@router.get("/{id_dispositivo}/mantenimientos")
def list_dispositivo_mantenimientos(
    id_dispositivo: str,
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    """Consulta el historial de intervenciones técnicas específico de un dispositivo."""
    with db_cursor() as cursor:
        cursor.execute(
            "SELECT id_dispositivo, nombre, codigo FROM dispositivos WHERE id_dispositivo = %s LIMIT 1",
            (id_dispositivo,),
        )
        dev = cursor.fetchone()
        if not dev:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dispositivo '{id_dispositivo}' no encontrado.",
            )

        cursor.execute(
            """
            SELECT m.*, d.nombre AS dispositivo_nombre, d.codigo AS dispositivo_codigo
            FROM mantenimientos m
            LEFT JOIN dispositivos d ON d.id_dispositivo = m.dispositivo_id
            WHERE m.dispositivo_id = %s
            ORDER BY m.fecha_intervencion DESC, m.fecha_registro DESC
            """,
            (id_dispositivo,),
        )
        rows = cursor.fetchall()

    return {
        "dispositivo": dev,
        "items": [serialize_mantenimiento(r) for r in rows],
        "total": len(rows),
    }


@router.post("/{id_dispositivo}/mantenimientos", status_code=status.HTTP_201_CREATED)
def create_dispositivo_mantenimiento(
    id_dispositivo: str,
    payload: MantenimientoCreateRequest,
    current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Técnico")
    ),
) -> Dict[str, Any]:
    """RN-22: Solo Administrador y Técnico pueden registrar mantenimientos para este nodo."""
    now = utc_now()
    fecha_int = payload.fecha_intervencion or now
    mnt_id = f"mnt-{uuid.uuid4().hex[:8]}"

    with db_cursor() as cursor:
        cursor.execute(
            "SELECT id_dispositivo FROM dispositivos WHERE id_dispositivo = %s",
            (id_dispositivo,),
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dispositivo '{id_dispositivo}' no encontrado.",
            )

        if payload.sensor_id:
            cursor.execute(
                "SELECT id_sensor FROM sensores WHERE id_sensor = %s AND dispositivo_id = %s",
                (payload.sensor_id, id_dispositivo),
            )
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El sensor especificado no pertenece a este dispositivo.",
                )

        if payload.id_alerta_relacionada:
            cursor.execute(
                "SELECT id_alerta FROM alertas WHERE id_alerta = %s",
                (payload.id_alerta_relacionada,),
            )
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La alerta especificada no existe.",
                )

        cursor.execute(
            """
            INSERT INTO mantenimientos (
                id_mantenimiento, dispositivo_id, sensor_id, id_usuario_responsable,
                tecnico_nombre, tipo_mantenimiento, fecha_intervencion, descripcion,
                actividades_realizadas, resultado, observaciones, proxima_fecha_sugerida,
                costo_estimado_usd, id_alerta_relacionada, estado, fecha_registro
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                mnt_id,
                id_dispositivo,
                payload.sensor_id,
                int(current_user["id_usuario"]),
                current_user.get("nombre") or "Técnico SIMOA",
                payload.tipo_mantenimiento,
                fecha_int,
                payload.descripcion.strip(),
                payload.actividades_realizadas.strip() if payload.actividades_realizadas else None,
                payload.resultado,
                payload.observaciones.strip() if payload.observaciones else None,
                payload.proxima_fecha_sugerida,
                payload.costo_estimado_usd or 0.0,
                payload.id_alerta_relacionada,
                payload.estado,
                now,
            ),
        )

        cursor.execute("SELECT * FROM mantenimientos WHERE id_mantenimiento = %s", (mnt_id,))
        created = cursor.fetchone()

    return {
        "message": "Intervención técnica registrada exitosamente en MySQL.",
        "mantenimiento": serialize_mantenimiento(created),
    }


@router.patch("/{id_dispositivo}")
def patch_dispositivo_tecnico(
    id_dispositivo: str,
    payload: DispositivoPatchTechnicalRequest,
    current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Técnico")
    ),
) -> Dict[str, Any]:
    """RN-22: Modificación de parámetros técnicos restringida a Administrador y Técnico.
    Protege la clave primaria, código y credenciales MQTT."""
    with db_cursor() as cursor:
        cursor.execute(
            "SELECT id_dispositivo, nombre, firmware_version, ubicacion_id, ubicacion, ip_address, observacion_tecnica FROM dispositivos WHERE id_dispositivo = %s LIMIT 1",
            (id_dispositivo,),
        )
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dispositivo no encontrado.",
            )

        new_name = payload.nombre if payload.nombre is not None else existing["nombre"]
        new_fw = payload.firmware_version if payload.firmware_version is not None else existing["firmware_version"]
        new_obs = payload.observacion_tecnica.strip() if payload.observacion_tecnica is not None else existing["observacion_tecnica"]
        new_ip = payload.ip_address if payload.ip_address is not None else existing["ip_address"]

        new_ubi_id = existing["ubicacion_id"]
        new_ubi_name = existing["ubicacion"]

        if payload.ubicacion_id and payload.ubicacion_id != existing["ubicacion_id"]:
            ubi = _resolve_active_ubicacion(cursor, payload.ubicacion_id, None)
            new_ubi_id = ubi["ubicacion_id"]
            new_ubi_name = ubi["nombre"]

            cursor.execute(
                """
                INSERT INTO historial_ubicaciones (
                  dispositivo_id, ubicacion_anterior_id, ubicacion_nueva_id,
                  usuario_responsable_id, usuario_responsable_correo, motivo
                )
                VALUES (%s, %s, %s, %s, %s, 'Modificación de parámetros técnicos')
                """,
                (
                    id_dispositivo,
                    existing["ubicacion_id"],
                    new_ubi_id,
                    int(current_user["id_usuario"]),
                    current_user["correo"],
                ),
            )

        now = utc_now()
        cursor.execute(
            """
            UPDATE dispositivos
            SET nombre = %s,
                firmware_version = %s,
                ubicacion_id = %s,
                ubicacion = %s,
                ip_address = %s,
                observacion_tecnica = %s,
                fecha_actualizacion = %s
            WHERE id_dispositivo = %s
            """,
            (
                new_name,
                new_fw,
                new_ubi_id,
                new_ubi_name,
                new_ip,
                new_obs,
                now,
                id_dispositivo,
            ),
        )

        cursor.execute(
            f"{_DEVICE_SELECT} WHERE d.id_dispositivo = %s GROUP BY d.id_dispositivo LIMIT 1",
            (id_dispositivo,),
        )
        updated = cursor.fetchone()

    return {
        "message": (
            "Parámetros técnicos actualizados en SIMOA. Nota: La modificación de estos parámetros en el sistema "
            "no reprograma físicamente el firmware ni la dirección IP del hardware ESP32."
        ),
        "dispositivo": _serialize_device(updated),
    }
