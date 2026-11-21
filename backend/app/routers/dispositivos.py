import re
import secrets
import socket
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

router = APIRouter(prefix="/api/dispositivos", tags=["Dispositivos IoT (RF-02 y RF-03)"])

MAC_REGEX = re.compile(r"^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$")
DeviceTypeLiteral = Literal["ESP32", "ESP8266", "Gateway"]
INVALID_OR_DUPLICATE_MAC_MSG = "La dirección MAC ya existe o no tiene formato válido"


class DispositivoCreateRequest(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=120)
    mac_address: str = Field(..., min_length=1, max_length=32)
    tipo: DeviceTypeLiteral
    firmware_version: str = Field(..., min_length=1, max_length=32)
    ubicacion_id: Optional[str] = Field(default=None, max_length=64)
    ubicacion: Optional[str] = Field(default=None, max_length=120)
    observacion_tecnica: Optional[str] = Field(default=None, max_length=255)

    @field_validator("nombre", "firmware_version")
    @classmethod
    def strip_non_empty(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("El campo no puede estar vacío.")
        return cleaned


class DispositivoUpdateRequest(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=120)
    mac_address: str = Field(..., min_length=1, max_length=32)
    tipo: DeviceTypeLiteral
    firmware_version: str = Field(..., min_length=1, max_length=32)
    ubicacion_id: Optional[str] = Field(default=None, max_length=64)
    ubicacion: Optional[str] = Field(default=None, max_length=120)
    observacion_tecnica: Optional[str] = Field(default=None, max_length=255)

    @field_validator("nombre", "firmware_version")
    @classmethod
    def strip_non_empty(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("El campo no puede estar vacío.")
        return cleaned


class DispositivoReasignarUbicacionRequest(BaseModel):
    ubicacion_id: str = Field(..., min_length=1, max_length=64)
    motivo: Optional[str] = Field(default=None, max_length=255)


def _check_mqtt_broker_status() -> Dict[str, Any]:
    settings = get_settings()
    host = settings.mqtt_broker_host
    port = settings.mqtt_broker_port
    try:
        with socket.create_connection((host, port), timeout=0.5):
            return {
                "mqtt_broker_disponible": True,
                "mqtt_broker_host": host,
                "mqtt_broker_port": port,
                "mqtt_broker_mensaje": f"Broker MQTT accesible en {host}:{port}. Esperando autenticación del nodo.",
            }
    except OSError:
        return {
            "mqtt_broker_disponible": False,
            "mqtt_broker_host": host,
            "mqtt_broker_port": port,
            "mqtt_broker_mensaje": (
                f"Broker MQTT no disponible en {host}:{port}; "
                "el dispositivo permanece en estado PENDIENTE sin conexión confirmada."
            ),
        }


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
      d.id_dispositivo, d.id_usuario, d.codigo, d.nombre, d.mac_address, d.tipo,
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
                  id_dispositivo, id_usuario, codigo, nombre, mac_address, tipo,
                  ubicacion_id, ubicacion, estado, firmware_version, observacion_tecnica,
                  mqtt_client_id, mqtt_topic, mqtt_username, mqtt_password_hash, creado_por
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'PENDIENTE', %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    device_id,
                    int(current_user["id_usuario"]),
                    codigo,
                    payload.nombre,
                    mac_normalized,
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
