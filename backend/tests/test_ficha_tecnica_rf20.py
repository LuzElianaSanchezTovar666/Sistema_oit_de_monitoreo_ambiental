from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
import uuid

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("JWT_SECRET_KEY", "rf20-pytest-secret")

from app.database import db_cursor, run_migrations
from app.main import app
from app.security import hash_password, login_rate_limiter
from app.services import device_connectivity as connectivity

ADMIN_USER = ("Admin RF20", "admin.rf20@simoa.org", "AdminPass123!", "Administrador", "activo")
TECNICO_USER = ("Tecnico RF20", "tecnico.rf20@simoa.org", "TecnicoPass123!", "Técnico", "activo")
SUPERVISOR_USER = ("Supervisor RF20", "supervisor.rf20@simoa.org", "SuperPass123!", "Supervisor", "activo")
OPERADOR_USER = ("Operador RF20", "operador.rf20@simoa.org", "OperPass123!", "Operador", "activo")

ALL_TEST_USERS = [ADMIN_USER, TECNICO_USER, SUPERVISOR_USER, OPERADOR_USER]


@pytest.fixture(scope="module", autouse=True)
def setup_rf20_users():
    run_migrations()
    login_rate_limiter.clear_all()
    with db_cursor() as cursor:
        for u in ALL_TEST_USERS:
            cursor.execute("DELETE FROM usuarios WHERE correo = %s", (u[1],))
            cursor.execute(
                """
                INSERT INTO usuarios (nombre, correo, password_hash, rol, estado)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (u[0], u[1], hash_password(u[2]), u[3], u[4]),
            )
    yield
    with db_cursor() as cursor:
        for u in ALL_TEST_USERS:
            cursor.execute("DELETE FROM usuarios WHERE correo = %s", (u[1],))
    login_rate_limiter.clear_all()


def get_token(client: TestClient, user_tuple) -> str:
    res = client.post("/api/auth/login", json={"correo": user_tuple[1], "password": user_tuple[2]})
    assert res.status_code == 200, f"Login falló para {user_tuple[1]}: {res.text}"
    return res.json()["access_token"]


@pytest.fixture
def rf20_device_fixture():
    run_migrations()
    tag = uuid.uuid4().hex[:8]
    ubi_id = f"ubi-rf20-{tag}"
    ubi2_id = f"ubi2-rf20-{tag}"
    dev_id = f"dev-rf20-{tag}"
    dev_empty_id = f"dev-empty-{tag}"
    sensor_id = f"sns-rf20-{tag}"

    with db_cursor() as cursor:
        # Ubicaciones
        cursor.execute(
            """
            INSERT INTO ubicaciones (ubicacion_id, nombre, codigo_area, tipo, descripcion, estado)
            VALUES (%s, %s, %s, 'Laboratorio', 'Ubicacion RF20', 'ACTIVA'),
                   (%s, %s, %s, 'Almacén', 'Ubicacion 2 RF20', 'ACTIVA')
            """,
            (ubi_id, f"Sala Principal {tag}", f"SP-{tag[:4]}", ubi2_id, f"Laboratorio {tag}", f"LAB-{tag[:4]}"),
        )
        # Dispositivo 1
        cursor.execute(
            """
            INSERT INTO dispositivos (
              id_dispositivo, codigo, nombre, mac_address, ip_address, tipo,
              ubicacion_id, ubicacion, estado, firmware_version, observacion_tecnica,
              mqtt_client_id, mqtt_topic, mqtt_username, mqtt_password_hash,
              estado_conectividad, ultimo_ping, rssi_dbm
            )
            VALUES (%s, %s, %s, %s, %s, 'ESP32', %s, %s, 'ONLINE', 'v1.4.2', 'Nodo experimental', %s, %s, %s, %s, 'ONLINE', NOW(), -85)
            """,
            (
                dev_id,
                f"NODE-{tag[:6]}",
                f"Nodo Central {tag}",
                f"AA:BB:CC:{tag[:2].upper()}:{tag[2:4].upper()}:{tag[4:6].upper()}",
                "192.168.1.150",
                ubi_id,
                f"Sala Principal {tag}",
                f"client-{tag}",
                f"simoa/dispositivos/NODE-{tag[:6]}/telemetria",
                f"user-{tag}",
                "secret_hash_never_expose",
            ),
        )
        # Dispositivo 2 (sin sensores ni mantenimientos)
        cursor.execute(
            """
            INSERT INTO dispositivos (
              id_dispositivo, codigo, nombre, mac_address, ip_address, tipo,
              ubicacion_id, ubicacion, estado, firmware_version, observacion_tecnica,
              mqtt_client_id, mqtt_topic, mqtt_username, mqtt_password_hash,
              estado_conectividad, ultimo_ping, rssi_dbm
            )
            VALUES (%s, %s, %s, %s, NULL, 'ESP8266', %s, %s, 'PENDIENTE', 'v1.0.0', NULL, %s, %s, %s, %s, 'PENDIENTE', NULL, NULL)
            """,
            (
                dev_empty_id,
                f"EMPTY-{tag[:6]}",
                f"Nodo Vacio {tag}",
                f"11:22:33:{tag[:2].upper()}:{tag[2:4].upper()}:{tag[4:6].upper()}",
                ubi_id,
                f"Sala Principal {tag}",
                f"client-empty-{tag}",
                f"simoa/dispositivos/EMPTY-{tag[:6]}/telemetria",
                f"user-empty-{tag}",
                "secret_empty_hash",
            ),
        )
        # Sensor vinculado a dev_id
        cursor.execute(
            """
            INSERT INTO sensores (id_sensor, dispositivo_id, identificador, modelo, variables_medidas, fecha_instalacion, ultima_calibracion, estado)
            VALUES (%s, %s, %s, 'BME280', '["temperatura", "humedad", "presion"]', '2026-01-10', '2026-02-01', 'ACTIVO')
            """,
            (sensor_id, dev_id, f"BME-{tag[:4]}"),
        )

    yield {
        "ubi_id": ubi_id,
        "ubi2_id": ubi2_id,
        "dev_id": dev_id,
        "dev_empty_id": dev_empty_id,
        "sensor_id": sensor_id,
        "tag": tag,
    }

    with db_cursor() as cursor:
        cursor.execute("DELETE FROM mantenimientos WHERE dispositivo_id IN (%s, %s)", (dev_id, dev_empty_id))
        cursor.execute("DELETE FROM sensores WHERE id_sensor = %s", (sensor_id,))
        cursor.execute("DELETE FROM historial_ubicaciones WHERE dispositivo_id IN (%s, %s)", (dev_id, dev_empty_id))
        cursor.execute("DELETE FROM dispositivos WHERE id_dispositivo IN (%s, %s)", (dev_id, dev_empty_id))
        cursor.execute("DELETE FROM ubicaciones WHERE ubicacion_id IN (%s, %s)", (ubi_id, ubi2_id))


def test_ficha_tecnica_payload_and_security(rf20_device_fixture):
    """Verifica que la ficha técnica consolide todos los datos y NUNCA exponga secretos MQTT."""
    client = TestClient(app)
    token = get_token(client, TECNICO_USER)
    headers = {"Authorization": f"Bearer {token}"}

    dev_id = rf20_device_fixture["dev_id"]
    res = client.get(f"/api/dispositivos/{dev_id}/ficha-tecnica", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()

    # 1. Identificación y Hardware
    assert data["dispositivo"]["id_dispositivo"] == dev_id
    assert data["dispositivo"]["ip_address"] == "192.168.1.150"
    assert data["dispositivo"]["firmware_version"] == "v1.4.2"

    # 2. Seguridad estricta: NO contraseñas ni hashes
    payload_str = json.dumps(data)
    assert "secret_hash_never_expose" not in payload_str
    assert "password_hash" not in payload_str
    assert "mqtt_password" not in payload_str

    # 3. MQTT Tópicos
    assert "simoa/dispositivos/" in data["mqtt"]["topic_telemetria"]
    assert "heartbeat" in data["mqtt"]["topic_heartbeat"]
    assert "broker_host" in data["mqtt"]

    # 4. Conectividad y RSSI
    assert data["conectividad"]["rssi_dbm"] == -85
    assert data["conectividad"]["alerta_senal_debil"] is True  # -85 < -80 dBm

    # 5. Sensores
    assert data["sensores_count"] == 1
    assert data["sensores"][0]["id_sensor"] == rf20_device_fixture["sensor_id"]

    # 6. Permisos de Técnico
    assert data["permisos"]["puede_editar_tecnico"] is True
    assert data["permisos"]["puede_registrar_mantenimiento"] is True
    assert "advertencia_hardware" in data


def test_ficha_tecnica_empty_device(rf20_device_fixture):
    """Verifica el comportamiento cuando un nodo no tiene sensores ni mantenimientos."""
    client = TestClient(app)
    token = get_token(client, SUPERVISOR_USER)
    headers = {"Authorization": f"Bearer {token}"}

    dev_id = rf20_device_fixture["dev_empty_id"]
    res = client.get(f"/api/dispositivos/{dev_id}/ficha-tecnica", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["dispositivo"]["ip_address"] is None
    assert data["sensores_count"] == 0
    assert len(data["sensores"]) == 0
    assert data["mantenimientos_count"] == 0
    assert len(data["mantenimientos"]) == 0
    # Supervisor NO puede editar (solo lectura - RN-22)
    assert data["permisos"]["puede_editar_tecnico"] is False
    assert data["permisos"]["puede_registrar_mantenimiento"] is False


def test_mantenimiento_rbac_rn22(rf20_device_fixture):
    """RN-22: Solo Administrador y Técnico pueden registrar mantenimientos; Operador y Supervisor deben recibir 403."""
    client = TestClient(app)
    dev_id = rf20_device_fixture["dev_id"]

    payload = {
        "dispositivo_id": dev_id,
        "sensor_id": rf20_device_fixture["sensor_id"],
        "tipo_mantenimiento": "CALIBRACION",
        "descripcion": "Calibración metrológica semestral del sensor BME280.",
        "actividades_realizadas": "Ajuste de offset y limpieza de sonda de humedad.",
        "resultado": "EXITOSO",
        "costo_estimado_usd": 65.50,
    }

    # 1. Operador -> 403
    token_op = get_token(client, OPERADOR_USER)
    res_op = client.post(
        f"/api/dispositivos/{dev_id}/mantenimientos",
        json=payload,
        headers={"Authorization": f"Bearer {token_op}"},
    )
    assert res_op.status_code == 403, f"Operador debió ser rechazado con 403: {res_op.text}"

    # 2. Supervisor -> 403
    token_sup = get_token(client, SUPERVISOR_USER)
    res_sup = client.post(
        f"/api/dispositivos/{dev_id}/mantenimientos",
        json=payload,
        headers={"Authorization": f"Bearer {token_sup}"},
    )
    assert res_sup.status_code == 403, f"Supervisor debió ser rechazado con 403: {res_sup.text}"

    # 3. Técnico -> 201 Created
    token_tec = get_token(client, TECNICO_USER)
    res_tec = client.post(
        f"/api/dispositivos/{dev_id}/mantenimientos",
        json=payload,
        headers={"Authorization": f"Bearer {token_tec}"},
    )
    assert res_tec.status_code == 201, f"Técnico debió registrar exitosamente: {res_tec.text}"
    mnt_data = res_tec.json()["mantenimiento"]
    assert mnt_data["tipo_mantenimiento"] == "CALIBRACION"
    assert mnt_data["tecnico_nombre"] == TECNICO_USER[0]
    assert mnt_data["costo_estimado_usd"] == 65.50

    # 4. Administrador -> 201 Created (vía /api/mantenimientos)
    token_adm = get_token(client, ADMIN_USER)
    payload_adm = {
        **payload,
        "tipo_mantenimiento": "ACTUALIZACION_FIRMWARE",
        "descripcion": "Flasheo de firmware v1.4.3 con parche de estabilidad WiFi.",
    }
    res_adm = client.post(
        "/api/mantenimientos",
        json=payload_adm,
        headers={"Authorization": f"Bearer {token_adm}"},
    )
    assert res_adm.status_code == 201, f"Administrador debió registrar exitosamente: {res_adm.text}"

    # 5. Comprobar que ambos mantenimientos aparecen en la ficha técnica
    res_ficha = client.get(
        f"/api/dispositivos/{dev_id}/ficha-tecnica",
        headers={"Authorization": f"Bearer {token_sup}"},
    )
    assert res_ficha.status_code == 200
    assert res_ficha.json()["mantenimientos_count"] >= 2


def test_patch_technical_parameters_rn22(rf20_device_fixture):
    """RN-22: Modificación de parámetros técnicos restringida a Admin y Técnico con validación de IP."""
    client = TestClient(app)
    dev_id = rf20_device_fixture["dev_id"]
    ubi2_id = rf20_device_fixture["ubi2_id"]

    # 1. Rechazo con 403 a Supervisor
    token_sup = get_token(client, SUPERVISOR_USER)
    res_sup = client.patch(
        f"/api/dispositivos/{dev_id}",
        json={"firmware_version": "v1.4.3"},
        headers={"Authorization": f"Bearer {token_sup}"},
    )
    assert res_sup.status_code == 403

    # 2. Rechazo con 422 si la dirección IP no tiene formato válido
    token_tec = get_token(client, TECNICO_USER)
    res_bad_ip = client.patch(
        f"/api/dispositivos/{dev_id}",
        json={"ip_address": "999.888.777.666"},
        headers={"Authorization": f"Bearer {token_tec}"},
    )
    assert res_bad_ip.status_code == 422, res_bad_ip.text

    # 3. Éxito con Técnico: actualiza IP, firmware y reasigna ubicación
    res_ok = client.patch(
        f"/api/dispositivos/{dev_id}",
        json={
            "firmware_version": "v1.4.3",
            "ip_address": "192.168.10.88",
            "ubicacion_id": ubi2_id,
            "observacion_tecnica": "Nodo reubicado en Laboratorio y actualizado a v1.4.3",
        },
        headers={"Authorization": f"Bearer {token_tec}"},
    )
    assert res_ok.status_code == 200, res_ok.text
    updated = res_ok.json()["dispositivo"]
    assert updated["firmware_version"] == "v1.4.3"
    assert updated["ip_address"] == "192.168.10.88"
    assert updated["ubicacion_id"] == ubi2_id

    # 4. Verifica que se haya registrado en historial_ubicaciones
    with db_cursor() as cursor:
        cursor.execute(
            "SELECT motivo FROM historial_ubicaciones WHERE dispositivo_id = %s ORDER BY id_historial DESC LIMIT 1",
            (dev_id,),
        )
        hist = cursor.fetchone()
        assert hist is not None
        assert "Modificación de parámetros técnicos" in hist["motivo"]


def test_unauthenticated_requests_blocked(rf20_device_fixture):
    """Peticiones sin autenticación deben responder con HTTP 401."""
    client = TestClient(app)
    dev_id = rf20_device_fixture["dev_id"]

    assert client.get(f"/api/dispositivos/{dev_id}/ficha-tecnica").status_code == 401
    assert client.get(f"/api/dispositivos/{dev_id}/mantenimientos").status_code == 401
    assert client.post(f"/api/dispositivos/{dev_id}/mantenimientos", json={}).status_code == 401
    assert client.patch(f"/api/dispositivos/{dev_id}", json={}).status_code == 401
    assert client.get("/api/mantenimientos").status_code == 401
    assert client.post("/api/mantenimientos", json={}).status_code == 401
