import os
import sys
import uuid
from pathlib import Path
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DB_HOST", "127.0.0.1")
os.environ.setdefault("DB_PORT", "3306")
os.environ.setdefault("DB_USER", "root")
os.environ.setdefault("DB_PASSWORD", "")
os.environ.setdefault("DB_NAME", "simoa")

from app.database import db_cursor  # noqa: E402
from app.main import app  # noqa: E402
from app.security import hash_password  # noqa: E402

client = TestClient(app)


def _login(email: str, password: str) -> str:
    res = client.post("/api/auth/login", json={"correo": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _ensure_role_user(email: str, role: str, password: str) -> None:
    pwd_hash = hash_password(password)
    with db_cursor() as cursor:
        cursor.execute("SELECT id_usuario FROM usuarios WHERE correo = %s LIMIT 1", (email,))
        row = cursor.fetchone()
        if row is None:
            cursor.execute(
                """
                INSERT INTO usuarios (id_usuario, nombre, correo, password_hash, rol, estado)
                VALUES (%s, %s, %s, %s, %s, 'activo')
                """,
                (f"usr-{uuid.uuid4().hex[:8]}", f"QA {role}", email, pwd_hash, role),
            )
        else:
            cursor.execute(
                "UPDATE usuarios SET password_hash = %s, rol = %s, estado = 'activo' WHERE correo = %s",
                (pwd_hash, role, email),
            )


def _create_device_and_sensor(headers: dict, modelo: str = "DHT22", variables=None):
    if variables is None:
        variables = ["temperatura", "humedad"] if modelo != "BME280" else ["temperatura", "humedad", "presion"]

    loc_res = client.get("/api/ubicaciones", headers=headers)
    assert loc_res.status_code == 200
    active_loc = next(l for l in loc_res.json()["items"] if l["estado"] == "ACTIVA")

    uid = uuid.uuid4().hex[:6].upper()
    raw_mac = uuid.uuid4().bytes[:6]
    mac = ":".join(f"{b:02X}" for b in raw_mac)
    dev_res = client.post(
        "/api/dispositivos",
        headers=headers,
        json={
            "codigo": f"DEV-RF05-{uid}",
            "nombre": f"Nodo RF05 {uid}",
            "tipo": "ESP32",
            "firmware_version": "v2.4.1",
            "mac_address": mac,
            "ubicacion_id": active_loc["ubicacion_id"],
        },
    )
    assert dev_res.status_code == 201, dev_res.text
    dev_id = dev_res.json()["dispositivo"]["id_dispositivo"]

    sen_res = client.post(
        "/api/sensores",
        headers=headers,
        json={
            "dispositivo_id": dev_id,
            "identificador": f"SEN-RF05-{uid}",
            "modelo": modelo,
            "variables": variables,
            "fecha_instalacion": "2026-02-01",
            "ultima_calibracion": "2026-02-05",
            "estado": "ACTIVO",
        },
    )
    assert sen_res.status_code == 201, sen_res.text
    return dev_id, sen_res.json()["sensor"]["id_sensor"], active_loc["ubicacion_id"]


def test_rf05_configurar_variables_validaciones_unidades_y_persistencia():
    _ensure_role_user("admin.rf05@simoa-ejemplo.org", "Administrador", "AdminPass123!")
    token = _login("admin.rf05@simoa-ejemplo.org", "AdminPass123!")
    headers = {"Authorization": f"Bearer {token}"}

    _, dht_id, _ = _create_device_and_sensor(headers, modelo="DHT22", variables=["temperatura", "humedad"])

    # 1. Consultar configuración inicial
    get_res = client.get(f"/api/sensores/{dht_id}/variables", headers=headers)
    assert get_res.status_code == 200, get_res.text
    cfg = get_res.json()["configuracion"]
    assert cfg["temperatura_habilitada"] is True
    assert cfg["humedad_habilitada"] is True
    assert cfg["unidad_temperatura"] == "°C"
    assert cfg["unidad_humedad"] == "%RH"

    # 5. Rechazar configuración sin variables seleccionadas con el mensaje exacto
    empty_res = client.put(
        f"/api/sensores/{dht_id}/variables",
        headers=headers,
        json={
            "temperatura_habilitada": False,
            "humedad_habilitada": False,
            "presion_habilitada": False,
            "unidad_temperatura": "°C",
            "unidad_humedad": "%RH",
        },
    )
    assert empty_res.status_code == 400
    assert empty_res.json()["detail"] == "Debe seleccionar al menos una variable ambiental"

    # 6. Rechazar variable incompatible con el modelo (DHT22 no mide presión)
    incompat_res = client.put(
        f"/api/sensores/{dht_id}/variables",
        headers=headers,
        json={
            "temperatura_habilitada": True,
            "humedad_habilitada": False,
            "presion_habilitada": True,
            "unidad_temperatura": "°C",
            "unidad_humedad": "%RH",
            "unidad_presion": "hPa",
        },
    )
    assert incompat_res.status_code == 400

    # 7. Validar unidades estándar (RN-06)
    bad_unit_res = client.put(
        f"/api/sensores/{dht_id}/variables",
        headers=headers,
        json={
            "temperatura_habilitada": True,
            "humedad_habilitada": True,
            "unidad_temperatura": "°F",
            "unidad_humedad": "%RH",
        },
    )
    assert bad_unit_res.status_code == 400

    # 2. Habilitar solo temperatura
    only_temp = client.put(
        f"/api/sensores/{dht_id}/variables",
        headers=headers,
        json={
            "temperatura_habilitada": True,
            "humedad_habilitada": False,
            "unidad_temperatura": "°C",
            "unidad_humedad": "%RH",
        },
    )
    assert only_temp.status_code == 200, only_temp.text
    assert only_temp.json()["configuracion"]["temperatura_habilitada"] is True
    assert only_temp.json()["configuracion"]["humedad_habilitada"] is False

    # 3. Habilitar solo humedad relativa
    only_hum = client.put(
        f"/api/sensores/{dht_id}/variables",
        headers=headers,
        json={
            "temperatura_habilitada": False,
            "humedad_habilitada": True,
            "unidad_temperatura": "°C",
            "unidad_humedad": "%RH",
        },
    )
    assert only_hum.status_code == 200, only_hum.text
    assert only_hum.json()["configuracion"]["temperatura_habilitada"] is False
    assert only_hum.json()["configuracion"]["humedad_habilitada"] is True

    # 4 & 8. Habilitar ambas y verificar persistencia en MySQL al consultar nuevamente
    both_res = client.put(
        f"/api/sensores/{dht_id}/variables",
        headers=headers,
        json={
            "temperatura_habilitada": True,
            "humedad_habilitada": True,
            "unidad_temperatura": "°C",
            "unidad_humedad": "%RH",
        },
    )
    assert both_res.status_code == 200
    recheck = client.get(f"/api/sensores/{dht_id}/variables", headers=headers)
    assert recheck.status_code == 200
    assert recheck.json()["configuracion"]["temperatura_habilitada"] is True
    assert recheck.json()["configuracion"]["humedad_habilitada"] is True

    # 16. Verificar trazabilidad en historial-configuraciones (1 inicial + 3 cambios = 4)
    hist_res = client.get(f"/api/sensores/{dht_id}/historial-configuraciones", headers=headers)
    assert hist_res.status_code == 200
    assert hist_res.json()["total"] >= 4


def test_rf05_telemetria_historicos_trazabilidad_y_dashboard():
    _ensure_role_user("admin.rf05@simoa-ejemplo.org", "Administrador", "AdminPass123!")
    token = _login("admin.rf05@simoa-ejemplo.org", "AdminPass123!")
    headers = {"Authorization": f"Bearer {token}"}

    dev_id, sen_id, loc_id = _create_device_and_sensor(
        headers, modelo="SHT31", variables=["temperatura", "humedad"]
    )

    # 10. Carga útil con ambas variables habilitadas
    t1 = client.post(
        "/api/sensores/telemetria",
        headers=headers,
        json={
            "dispositivo_id": dev_id,
            "sensor_id": sen_id,
            "temperatura": 21.4,
            "humedad": 55.2,
            "unidad_temperatura": "°C",
            "unidad_humedad": "%RH",
        },
    )
    assert t1.status_code == 200, t1.text
    m1_id = t1.json()["id_medicion"]
    assert t1.json()["temperatura"] == 21.4
    assert t1.json()["humedad"] == 55.2

    # 13. Rechazar ausencia de una variable habilitada (falta humedad cuando ambas están activas)
    missing_hum = client.post(
        "/api/sensores/telemetria",
        headers=headers,
        json={
            "dispositivo_id": dev_id,
            "sensor_id": sen_id,
            "temperatura": 22.0,
            "unidad_temperatura": "°C",
        },
    )
    assert missing_hum.status_code == 400

    # Cambiar configuración a SOLO temperatura
    upd1 = client.put(
        f"/api/sensores/{sen_id}/variables",
        headers=headers,
        json={
            "temperatura_habilitada": True,
            "humedad_habilitada": False,
            "unidad_temperatura": "°C",
            "unidad_humedad": "%RH",
        },
    )
    assert upd1.status_code == 200

    # 11 & 14. Carga útil solo con temperatura; si llega humedad, se ignora y NO se guarda
    t2 = client.post(
        "/api/sensores/telemetria",
        headers=headers,
        json={
            "dispositivo_id": dev_id,
            "sensor_id": sen_id,
            "temperatura": 23.1,
            "humedad": 61.0,
            "unidad_temperatura": "°C",
        },
    )
    assert t2.status_code == 200, t2.text
    assert t2.json()["temperatura"] == 23.1
    assert t2.json()["humedad"] is None
    assert "humedad" in t2.json()["variables_ignoradas"]

    # Cambiar configuración a SOLO humedad
    upd2 = client.put(
        f"/api/sensores/{sen_id}/variables",
        headers=headers,
        json={
            "temperatura_habilitada": False,
            "humedad_habilitada": True,
            "unidad_temperatura": "°C",
            "unidad_humedad": "%RH",
        },
    )
    assert upd2.status_code == 200

    # 12. Carga útil solo con humedad (sin rechazar por ausencia de temperatura)
    t3 = client.post(
        "/api/sensores/telemetria",
        headers=headers,
        json={
            "dispositivo_id": dev_id,
            "sensor_id": sen_id,
            "humedad": 58.7,
            "unidad_humedad": "%RH",
        },
    )
    assert t3.status_code == 200, t3.text
    assert t3.json()["temperatura"] is None
    assert t3.json()["humedad"] == 58.7

    # 15 & 16. Medición histórica m1 conserva su temperatura y humedad originales + snapshot de configuración
    with db_cursor() as cursor:
        cursor.execute(
            "SELECT temperatura, humedad, variables_activas_snapshot FROM mediciones WHERE id_medicion = %s",
            (m1_id,),
        )
        hist_row = cursor.fetchone()
    assert hist_row is not None
    assert float(hist_row["temperatura"]) == 21.4
    assert float(hist_row["humedad"]) == 55.2
    assert "temperatura" in hist_row["variables_activas_snapshot"]
    assert "humedad" in hist_row["variables_activas_snapshot"]

    # 17. Endpoint Dashboard telemetría devuelve datos reales filtrados por ubicación y dispositivo
    dash_res = client.get(
        f"/api/dashboard/telemetria?ubicacion_id={loc_id}&dispositivo_id={dev_id}&sensor_id={sen_id}",
        headers=headers,
    )
    assert dash_res.status_code == 200, dash_res.text
    dash_data = dash_res.json()
    assert len(dash_data["sensores"]) == 1
    assert dash_data["sensores"][0]["humedad_habilitada"] is True
    assert dash_data["sensores"][0]["temperatura_habilitada"] is False
    assert len(dash_data["mediciones"]) >= 3


def test_rf05_rbac_y_sensor_inactivo():
    _ensure_role_user("admin.rf05@simoa-ejemplo.org", "Administrador", "AdminPass123!")
    admin_token = _login("admin.rf05@simoa-ejemplo.org", "AdminPass123!")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    _, sen_id, _ = _create_device_and_sensor(admin_headers, modelo="DHT22")

    _ensure_role_user("operador.rf05@simoa-ejemplo.org", "Operador", "Operador123!")
    op_token = _login("operador.rf05@simoa-ejemplo.org", "Operador123!")
    op_headers = {"Authorization": f"Bearer {op_token}"}

    # 18. Operador puede consultar pero NO modificar configuración
    assert client.get(f"/api/sensores/{sen_id}/variables", headers=op_headers).status_code == 200
    assert client.get(f"/api/sensores/{sen_id}/historial-configuraciones", headers=op_headers).status_code == 200
    forbidden = client.put(
        f"/api/sensores/{sen_id}/variables",
        headers=op_headers,
        json={
            "temperatura_habilitada": True,
            "humedad_habilitada": False,
            "unidad_temperatura": "°C",
            "unidad_humedad": "%RH",
        },
    )
    assert forbidden.status_code == 403

    # Sensor INACTIVO no participa en nuevas operaciones de monitoreo / configuración
    inact = client.patch(f"/api/sensores/{sen_id}/estado", headers=admin_headers, json={"estado": "INACTIVO"})
    assert inact.status_code == 200
    blocked_cfg = client.put(
        f"/api/sensores/{sen_id}/variables",
        headers=admin_headers,
        json={
            "temperatura_habilitada": True,
            "humedad_habilitada": False,
            "unidad_temperatura": "°C",
            "unidad_humedad": "%RH",
        },
    )
    assert blocked_cfg.status_code == 400
