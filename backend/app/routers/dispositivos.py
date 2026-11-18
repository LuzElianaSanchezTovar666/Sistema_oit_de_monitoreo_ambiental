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

router = APIRouter(prefix="/api/dispositivos", tags=["Dispositivos IoT (RF-02)"])

MAC_REGEX = re.compile(r"^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$")
DeviceTypeLiteral = Literal["ESP32", "ESP8266", "Gateway"]
INVALID_OR_DUPLICATE_MAC_MSG = "La dirección MAC ya existe o no tiene formato válido"


class DispositivoCreateRequest(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=120)
    mac_address: str = Field(..., min_length=17, max_length=17)
    tipo: DeviceTypeLiteral
    firmware_version: str = Field(..., min_length=1, max_length=32)
    ubicacion: str = Field(..., min_length=2, max_length=120)
    observacion_tecnica: Optional[str] = Field(default=None, max_length=255)

    @field_validator("nombre", "firmware_version", "ubicacion")
    @classmethod
    def strip_non_empty(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("El campo no puede estar vacío.")
        return cleaned


class DispositivoUpdateRequest(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=120)
    mac_address: str = Field(..., min_length=17, max_length=17)
    tipo: DeviceTypeLiteral
    firmware_version: str = Field(..., min_length=1, max_length=32)
    ubicacion: str = Field(..., min_length=2, max_length=120)
    observacion_tecnica: Optional[str] = Field(default=None, max_length=255)

    @field_validator("nombre", "firmware_version", "ubicacion")
    @classmethod
    def strip_non_empty(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("El campo no puede estar vacío.")
        return cleaned


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
        "ubicacion": row.get("ubicacion") or row.get("ubicacion_id") or "",
        "estado": row["estado"],
        "observacion_tecnica": row.get("observacion_tecnica"),
        "mqtt_client_id": row.get("mqtt_client_id"),
        "mqtt_topic": row.get("mqtt_topic"),
        "mqtt_username": row.get("mqtt_username"),
        "historial_mediciones_count": int(row.get("historial_mediciones_count") or 0),
        "fecha_registro": fr.isoformat() if hasattr(fr, "isoformat") else (str(fr) if fr else None),
        "fecha_actualizacion": fa.isoformat() if hasattr(fa, "isoformat") else (str(fa) if fa else None),
    }


@router.get("")
def list_dispositivos(
    search: Optional[str] = Query(default=None),
    estado: Optional[str] = Query(default=None),
    tipo: Optional[str] = Query(default=None),
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    conditions: List[str] = []
    params: List[Any] = []

    if search and search.strip():
        q = f"%{search.strip()}%"
        conditions.append("(d.nombre LIKE %s OR d.codigo LIKE %s OR d.mac_address LIKE %s OR d.ubicacion LIKE %s)")
        params.extend([q, q, q, q])
    if estado and estado.strip() and estado != "ALL":
        conditions.append("d.estado = %s")
        params.append(estado.strip())
    if tipo and tipo.strip() and tipo != "ALL":
        conditions.append("d.tipo = %s")
        params.append(tipo.strip())

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with db_cursor() as cursor:
        cursor.execute(
            f"""
            SELECT
              d.id_dispositivo, d.id_usuario, d.codigo, d.nombre, d.mac_address, d.tipo,
              d.ubicacion_id, d.ubicacion, d.estado, d.firmware_version, d.observacion_tecnica,
              d.mqtt_client_id, d.mqtt_topic, d.mqtt_username, d.fecha_registro, d.fecha_actualizacion,
              COUNT(m.id_medicion) AS historial_mediciones_count
            FROM dispositivos d
            LEFT JOIN mediciones m ON m.dispositivo_id = d.id_dispositivo
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
            """
            SELECT
              d.id_dispositivo, d.id_usuario, d.codigo, d.nombre, d.mac_address, d.tipo,
              d.ubicacion_id, d.ubicacion, d.estado, d.firmware_version, d.observacion_tecnica,
              d.mqtt_client_id, d.mqtt_topic, d.mqtt_username, d.fecha_registro, d.fecha_actualizacion,
              COUNT(m.id_medicion) AS historial_mediciones_count
            FROM dispositivos d
            LEFT JOIN mediciones m ON m.dispositivo_id = d.id_dispositivo
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
                    payload.ubicacion,
                    payload.ubicacion,
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
                SELECT
                  id_dispositivo, id_usuario, codigo, nombre, mac_address, tipo,
                  ubicacion_id, ubicacion, estado, firmware_version, observacion_tecnica,
                  mqtt_client_id, mqtt_topic, mqtt_username, fecha_registro, fecha_actualizacion,
                  0 AS historial_mediciones_count
                FROM dispositivos
                WHERE id_dispositivo = %s
                LIMIT 1
                """,
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
    _current_user: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> Dict[str, Any]:
    mac_normalized = _normalize_mac_or_400(payload.mac_address)

    try:
        with db_cursor() as cursor:
            cursor.execute(
                "SELECT id_dispositivo FROM dispositivos WHERE id_dispositivo = %s LIMIT 1",
                (id_dispositivo,),
            )
            if cursor.fetchone() is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Dispositivo no encontrado.",
                )

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
                    payload.ubicacion,
                    payload.ubicacion,
                    payload.observacion_tecnica.strip() if payload.observacion_tecnica else None,
                    id_dispositivo,
                ),
            )

            cursor.execute(
                """
                SELECT
                  d.id_dispositivo, d.id_usuario, d.codigo, d.nombre, d.mac_address, d.tipo,
                  d.ubicacion_id, d.ubicacion, d.estado, d.firmware_version, d.observacion_tecnica,
                  d.mqtt_client_id, d.mqtt_topic, d.mqtt_username, d.fecha_registro, d.fecha_actualizacion,
                  COUNT(m.id_medicion) AS historial_mediciones_count
                FROM dispositivos d
                LEFT JOIN mediciones m ON m.dispositivo_id = d.id_dispositivo
                WHERE d.id_dispositivo = %s
                GROUP BY d.id_dispositivo
                LIMIT 1
                """,
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


@router.patch("/{id_dispositivo}/desactivar")
def deactivate_dispositivo(
    id_dispositivo: str,
    _current_user: Dict[str, Any] = Depends(require_roles("Administrador")),
) -> Dict[str, Any]:
    with db_cursor() as cursor:
        cursor.execute(
            "SELECT id_dispositivo FROM dispositivos WHERE id_dispositivo = %s LIMIT 1",
            (id_dispositivo,),
        )
        if cursor.fetchone() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dispositivo no encontrado.",
            )

        cursor.execute(
            "UPDATE dispositivos SET estado = 'INACTIVO' WHERE id_dispositivo = %s",
            (id_dispositivo,),
        )

        cursor.execute(
            """
            SELECT
              d.id_dispositivo, d.id_usuario, d.codigo, d.nombre, d.mac_address, d.tipo,
              d.ubicacion_id, d.ubicacion, d.estado, d.firmware_version, d.observacion_tecnica,
              d.mqtt_client_id, d.mqtt_topic, d.mqtt_username, d.fecha_registro, d.fecha_actualizacion,
              COUNT(m.id_medicion) AS historial_mediciones_count
            FROM dispositivos d
            LEFT JOIN mediciones m ON m.dispositivo_id = d.id_dispositivo
            WHERE d.id_dispositivo = %s
            GROUP BY d.id_dispositivo
            LIMIT 1
            """,
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
        cursor.execute(
            "SELECT id_dispositivo FROM dispositivos WHERE id_dispositivo = %s LIMIT 1",
            (id_dispositivo,),
        )
        if cursor.fetchone() is None:
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

        # Incluso sin mediciones, aplicamos desactivación lógica recomendada para trazabilidad
        cursor.execute(
            "UPDATE dispositivos SET estado = 'INACTIVO' WHERE id_dispositivo = %s",
            (id_dispositivo,),
        )

    return {
        "message": "Dispositivo desactivado lógicamente (INACTIVO) para preservar trazabilidad.",
        "id_dispositivo": id_dispositivo,
    }
