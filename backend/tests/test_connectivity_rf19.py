from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import sys
import uuid

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("JWT_SECRET_KEY", "rf19-pytest-only-secret")

from app.database import db_cursor, run_migrations
from app.main import app
from app.security import hash_password, login_rate_limiter
from app.services import device_connectivity as connectivity

RF19_USER = ("Tecnico RF19", "tecnico.rf19@simoa-ejemplo.org", "TecnicoPass123!", "Técnico", "activo")


@pytest.fixture(scope="module", autouse=True)
def setup_rf19_user():
    run_migrations()
    login_rate_limiter.clear_all()
    with db_cursor() as cursor:
        cursor.execute("DELETE FROM usuarios WHERE correo = %s", (RF19_USER[1],))
        cursor.execute(
            """
            INSERT INTO usuarios (nombre, correo, password_hash, rol, estado)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (RF19_USER[0], RF19_USER[1], hash_password(RF19_USER[2]), RF19_USER[3], RF19_USER[4]),
        )
    yield
    with db_cursor() as cursor:
        cursor.execute("DELETE FROM usuarios WHERE correo = %s", (RF19_USER[1],))
    login_rate_limiter.clear_all()


def get_auth_token(client: TestClient) -> str:
    res = client.post("/api/auth/login", json={"correo": RF19_USER[1], "password": RF19_USER[2]})
    assert res.status_code == 200, f"Error en login de prueba: {res.text}"
    return res.json()["access_token"]


@pytest.fixture
def rf19_environment():
    run_migrations()
    tag = uuid.uuid4().hex[:8]
    loc_id = f"ubi-rf19-{tag}"
    node_online = f"dev-on-{tag}"
    node_weak = f"dev-wk-{tag}"
    node_exact = f"dev-ex-{tag}"
    node_offline = f"dev-off-{tag}"
    node_inactive = f"dev-inact-{tag}"

    nodes = [node_online, node_weak, node_exact, node_offline, node_inactive]
    with db_cursor() as cursor:
        cursor.execute(
            "INSERT INTO ubicaciones (ubicacion_id, nombre, codigo_area, tipo, estado) VALUES (%s, %s, %s, 'Laboratorio', 'ACTIVA')",
            (loc_id, f"Lab RF19 {tag}", tag[:8]),
        )
        for i, dev_id in enumerate(nodes):
            mac = "04:" + ":".join([tag[k:k + 2] for k in range(0, 8, 2)] + [f"{i:02X}"])
            cursor.execute(
                """
                INSERT INTO dispositivos (
                    id_dispositivo, nombre, codigo, mac_address, tipo, firmware_version,
                    ubicacion_id, mqtt_client_id, mqtt_topic, estado, activo_administrativamente
                ) VALUES (%s, %s, %s, %s, 'ESP32', 'v2.4.0', %s, %s, %s, 'PENDIENTE', 1)
                """,
                (
                    dev_id,
                    f"Nodo {dev_id}",
                    f"COD-{dev_id[:10]}",
                    mac,
                    loc_id,
                    f"client-{dev_id}",
                    f"simoa/dispositivos/COD-{dev_id[:10]}/telemetria",
                ),
            )
        # Configurar estado inactivo para el último
        cursor.execute(
            "UPDATE dispositivos SET estado = 'INACTIVO', activo_administrativamente = 0 WHERE id_dispositivo = %s",
            (node_inactive,),
        )

    yield {
        "location": loc_id,
        "online": node_online,
        "weak": node_weak,
        "exact": node_exact,
        "offline": node_offline,
        "inactive": node_inactive,
    }

    with db_cursor() as cursor:
        cursor.execute("DELETE FROM historial_conectividad_dispositivos WHERE dispositivo_id IN (%s, %s, %s, %s, %s)", tuple(nodes))
        cursor.execute("DELETE FROM dispositivos WHERE id_dispositivo IN (%s, %s, %s, %s, %s)", tuple(nodes))
        cursor.execute("DELETE FROM ubicaciones WHERE ubicacion_id = %s", (loc_id,))


def test_rf19_regla_umbral_senal_debil():
    """Verifica que RSSI < -80 dBm activa la alerta preventiva, y >= -80 dBm no la activa."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # -85 dBm: Señal débil
    res_weak = connectivity.serialize_connectivity({"estado": "ONLINE", "ultimo_ping": now, "rssi_dbm": -85}, now)
    assert res_weak["alerta_senal_debil"] is True
    assert res_weak["rssi_dbm"] == -85

    # -81 dBm: Señal débil
    res_weak_border = connectivity.serialize_connectivity({"estado": "ONLINE", "ultimo_ping": now, "rssi_dbm": -81}, now)
    assert res_weak_border["alerta_senal_debil"] is True

    # -80 dBm: Límite exacto -> NO es advertencia (regla < -80 dBm)
    res_exact = connectivity.serialize_connectivity({"estado": "ONLINE", "ultimo_ping": now, "rssi_dbm": -80}, now)
    assert res_exact["alerta_senal_debil"] is False
    assert res_exact["rssi_dbm"] == -80

    # -65 dBm: Señal excelente -> NO es advertencia
    res_good = connectivity.serialize_connectivity({"estado": "ONLINE", "ultimo_ping": now, "rssi_dbm": -65}, now)
    assert res_good["alerta_senal_debil"] is False

    # None: Señal no disponible -> NO es advertencia de señal débil, sino no disponible
    res_none = connectivity.serialize_connectivity({"estado": "ONLINE", "ultimo_ping": now, "rssi_dbm": None}, now)
    assert res_none["alerta_senal_debil"] is False
    assert res_none["rssi_dbm"] is None


def test_rf19_record_contact_persiste_rssi(rf19_environment):
    """Verifica que record_contact actualiza el campo rssi_dbm en dispositivos y en historial."""
    env = rf19_environment
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    with db_cursor() as cursor:
        device = connectivity.lock_device(cursor, env["weak"])
        assert device is not None
        ok = connectivity.record_contact(
            cursor, device, captured=now, received=now, reason="TEST_RSSI", rssi=-84
        )
        assert ok is True

    with db_cursor() as cursor:
        cursor.execute("SELECT ultimo_ping, rssi_dbm, estado FROM dispositivos WHERE id_dispositivo = %s", (env["weak"],))
        row = cursor.fetchone()
        assert row["rssi_dbm"] == -84
        assert row["estado"] == "ONLINE"

        # Verificar historial
        cursor.execute(
            "SELECT estado_nuevo, motivo, rssi_dbm FROM historial_conectividad_dispositivos WHERE dispositivo_id = %s ORDER BY id_evento DESC LIMIT 1",
            (env["weak"],),
        )
        hist = cursor.fetchone()
        assert hist["rssi_dbm"] == -84
        assert hist["estado_nuevo"] == "ONLINE"


def test_rf19_resumen_conectividad_endpoint(rf19_environment):
    """Verifica que el endpoint /api/dispositivos/resumen-conectividad calcula el contador global correctamente."""
    env = rf19_environment
    with TestClient(app) as client:
        # 1. Petición no autenticada debe ser rechazada con 401
        resp_anon = client.get("/api/dispositivos/resumen-conectividad")
        assert resp_anon.status_code == 401

        # 2. Registrar pings para configurar estados
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        with db_cursor() as cursor:
            # env["online"]: RSSI -65 (online normal)
            d_on = connectivity.lock_device(cursor, env["online"])
            connectivity.record_contact(cursor, d_on, captured=now, received=now, reason="TEST", rssi=-65)

            # env["weak"]: RSSI -85 (online con señal débil)
            d_wk = connectivity.lock_device(cursor, env["weak"])
            connectivity.record_contact(cursor, d_wk, captured=now, received=now, reason="TEST", rssi=-85)

            # env["offline"]: Forzar estado OFFLINE
            cursor.execute("UPDATE dispositivos SET estado = 'OFFLINE', ultimo_ping = %s, rssi_dbm = -75 WHERE id_dispositivo = %s", (now - timedelta(seconds=200), env["offline"]))

        # 3. Consultar resumen autenticado como Técnico
        token = get_auth_token(client)
        headers = {"Authorization": f"Bearer {token}"}
        resp = client.get("/api/dispositivos/resumen-conectividad", headers=headers)
        assert resp.status_code == 200
        data = resp.json()

        assert "online" in data
        assert "offline" in data
        assert "total_activos" in data
        assert "total_registrados" in data
        assert "texto_resumen" in data
        assert "senal_debil" in data

        # Verificamos que los 2 nodos activos contactados estén en online
        assert data["online"] >= 2
        assert data["total_activos"] >= 4  # online, weak, exact, offline
        assert "dispositivos conectados" in data["texto_resumen"]
        assert data["senal_debil"] >= 1  # env["weak"] tiene -85 dBm (< -80)


def test_rf19_simular_ping_endpoint(rf19_environment):
    """Verifica el endpoint POST /api/dispositivos/{id}/ping para diagnóstico técnico."""
    env = rf19_environment
    with TestClient(app) as client:
        token = get_auth_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        # Enviar ping con RSSI -83 dBm
        payload = {"rssi_dbm": -83}
        resp = client.post(f"/api/dispositivos/{env['exact']}/ping", json=payload, headers=headers)
        assert resp.status_code == 200
        res_data = resp.json()
        assert res_data["exito"] is True
        assert res_data["rssi_dbm"] == -83

        # Comprobar que en GET /api/dispositivos/{id} aparece el nuevo RSSI y la alerta de señal débil
        detail = client.get(f"/api/dispositivos/{env['exact']}", headers=headers).json()
        dev = detail["dispositivo"]
        assert dev["rssi_dbm"] == -83
        assert dev["alerta_senal_debil"] is True
        assert dev["estado"] == "ONLINE"
