from datetime import datetime, timedelta, timezone
import io
import json
import os
from pathlib import Path
import sys
import uuid

from fastapi.testclient import TestClient
import openpyxl
import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DB_HOST", "127.0.0.1")
os.environ.setdefault("DB_PORT", "3306")
os.environ.setdefault("DB_USER", "root")
os.environ.setdefault("DB_PASSWORD", "")
os.environ.setdefault("DB_NAME", "simoa")

from app.database import db_cursor, run_migrations
from app.main import app
from app.security import hash_password


def _ensure_user_and_login(client: TestClient, email: str, rol: str, nombre: str) -> dict:
    pwd = "TestPass123!"
    pwd_hash = hash_password(pwd)
    with db_cursor() as cursor:
        cursor.execute("SELECT id_usuario FROM usuarios WHERE correo = %s LIMIT 1", (email,))
        if cursor.fetchone() is None:
            cursor.execute(
                """
                INSERT INTO usuarios (nombre, correo, password_hash, rol, estado)
                VALUES (%s, %s, %s, %s, 'activo')
                """,
                (nombre, email, pwd_hash, rol),
            )
        else:
            cursor.execute(
                "UPDATE usuarios SET nombre = %s, password_hash = %s, rol = %s, estado = 'activo' WHERE correo = %s",
                (nombre, pwd_hash, rol, email),
            )
    res = client.post("/api/auth/login", json={"correo": email, "password": pwd})
    assert res.status_code == 200, res.text
    data = res.json()
    token = data["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return data["user"]


@pytest.fixture
def rf16_test_context():
    run_migrations()
    tag = uuid.uuid4().hex[:8]
    location_id = f"qa-rf16-loc-{tag}"
    device_id = f"qa-rf16-dev-{tag}"
    sensor_id = f"qa-rf16-sen-{tag}"

    now_utc = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=2)

    with db_cursor() as cursor:
        cursor.execute(
            "INSERT INTO ubicaciones (ubicacion_id, nombre, codigo_area, tipo, estado) VALUES (%s, %s, %s, 'Laboratorio', 'ACTIVA')",
            (location_id, f"Lab RF16 {tag}", f"L{tag[:4]}"),
        )
        mac = "02:" + ":".join([tag[k:k+2] for k in range(0, 8, 2)]) + ":16"
        cursor.execute(
            """
            INSERT INTO dispositivos (id_dispositivo, nombre, codigo, mac_address, ubicacion_id, estado, activo_administrativamente)
            VALUES (%s, %s, %s, %s, %s, 'ONLINE', 1)
            """,
            (device_id, f"Nodo RF16 {tag}", f"SIMOA-{tag[:6]}", mac, location_id),
        )
        cursor.execute(
            """
            INSERT INTO sensores (id_sensor, dispositivo_id, identificador, modelo, variables_medidas, estado, fecha_instalacion, ultima_calibracion)
            VALUES (%s, %s, %s, 'DHT22', %s, 'ACTIVO', '2026-01-01', '2026-01-01')
            """,
            (sensor_id, device_id, f"SEN-{tag[:6]}", json.dumps([{"variable": "temperatura"}, {"variable": "humedad"}])),
        )

        # Insertar 4 mediciones controladas:
        # 1: T=20.0, H=50.0 (Conforme, es_fuera_de_umbral=0)
        # 2: T=24.0, H=55.0 (Conforme, es_fuera_de_umbral=0)
        # 3: T=32.0, H=75.0 (Fuera de umbral, es_fuera_de_umbral=1)
        # 4: T=22.0, H=None (No evaluable, es_fuera_de_umbral=NULL)
        test_records = [
            (device_id, sensor_id, location_id, 20.0, 50.0, 0, 0, now_utc),
            (device_id, sensor_id, location_id, 24.0, 55.0, 0, 0, now_utc + timedelta(minutes=10)),
            (device_id, sensor_id, location_id, 32.0, 75.0, 1, 1, now_utc + timedelta(minutes=20)),
            (device_id, sensor_id, location_id, 22.0, None, None, 0, now_utc + timedelta(minutes=30)),
        ]
        for dev, sen, ubi, t, h, es_fuera, alerta, dt in test_records:
            cursor.execute(
                """
                INSERT INTO mediciones (dispositivo_id, sensor_id, ubicacion_id, temperatura, humedad, es_fuera_de_umbral, alerta_generada, fecha_hora)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (dev, sen, ubi, t, h, es_fuera, alerta, dt),
            )

        # Insertar 1 alerta asociada para probar la sección de incidencias
        alert_id = f"qa-alerta-{tag}"
        cursor.execute(
            """
            INSERT INTO alertas (id_alerta, dispositivo_id, sensor_id, ubicacion_id, variable, condicion, valor_detectado, umbral_superado, severidad, estado, mensaje, fecha_hora)
            VALUES (%s, %s, %s, %s, 'temperatura', 'MAXIMO', 32.0, 28.0, 'ADVERTENCIA', 'PENDIENTE', 'Excursión térmica de prueba', %s)
            """,
            (alert_id, device_id, sensor_id, location_id, now_utc + timedelta(minutes=20)),
        )

    yield {
        "location_id": location_id,
        "device_id": device_id,
        "sensor_id": sensor_id,
        "start_utc": now_utc - timedelta(minutes=5),
        "end_utc": now_utc + timedelta(hours=1),
    }

    with db_cursor() as cursor:
        cursor.execute("DELETE FROM alertas WHERE ubicacion_id = %s", (location_id,))
        cursor.execute("DELETE FROM mediciones WHERE ubicacion_id = %s", (location_id,))
        cursor.execute("DELETE FROM sensores WHERE id_sensor = %s", (sensor_id,))
        cursor.execute("DELETE FROM dispositivos WHERE id_dispositivo = %s", (device_id,))
        cursor.execute("DELETE FROM ubicaciones WHERE ubicacion_id = %s", (location_id,))


def test_rf16_unauthenticated_and_rbac():
    client = TestClient(app)
    # Sin autenticación -> 401
    res = client.post("/api/reportes/ambientales", json={"formato": "pdf"})
    assert res.status_code == 401

    res_get = client.get("/api/reportes/ambientales?formato=pdf")
    assert res_get.status_code == 401

    # Operador o Técnico autenticado -> 403 Forbidden
    tag = uuid.uuid4().hex[:6]
    _ensure_user_and_login(client, f"operador_{tag}@simoa.com", "Operador", "Operador Test")
    res_forbidden = client.post("/api/reportes/ambientales", json={"formato": "pdf"})
    assert res_forbidden.status_code == 403
    assert "No tiene permisos suficientes" in res_forbidden.json()["detail"]

    _ensure_user_and_login(client, f"tecnico_{tag}@simoa.com", "Técnico", "Técnico Test")
    res_tecnico = client.post("/api/reportes/ambientales", json={"formato": "pdf"})
    assert res_tecnico.status_code == 403


def test_rf16_fecha_inicial_mayor_a_final():
    client = TestClient(app)
    tag = uuid.uuid4().hex[:6]
    _ensure_user_and_login(client, f"admin_{tag}@simoa.com", "Administrador", "Admin Test")

    res = client.post(
        "/api/reportes/ambientales",
        json={"formato": "pdf", "fecha_inicio": "2026-11-20", "fecha_fin": "2026-11-10"},
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "La fecha inicial no puede ser mayor a la final"


def test_rf16_periodo_sin_mediciones():
    client = TestClient(app)
    tag = uuid.uuid4().hex[:6]
    _ensure_user_and_login(client, f"supervisor_{tag}@simoa.com", "Supervisor", "Supervisor Test")

    # Rango en el futuro sin registros
    res = client.post(
        "/api/reportes/ambientales",
        json={
            "formato": "pdf",
            "fecha_inicio": "2030-01-01",
            "fecha_fin": "2030-01-02",
        },
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "No se encontraron mediciones para el período y los filtros seleccionados"


def test_rf16_generacion_pdf_integridad_y_estadisticas(rf16_test_context):
    client = TestClient(app)
    tag = uuid.uuid4().hex[:6]
    _ensure_user_and_login(client, f"admin_{tag}@simoa.com", "Administrador", "Admin Test")

    ctx = rf16_test_context
    payload = {
        "formato": "pdf",
        "ubicacion_id": ctx["location_id"],
        "fecha_inicio": ctx["start_utc"].strftime("%Y-%m-%d"),
        "fecha_fin": ctx["end_utc"].strftime("%Y-%m-%d"),
        "tz_offset_minutes": 0,
    }

    res = client.post("/api/reportes/ambientales", json=payload)
    assert res.status_code == 200, res.text
    assert res.headers["content-type"] == "application/pdf"
    assert "simoa_reporte_ambiental" in res.headers["content-disposition"]
    assert res.headers.get("x-report-total-records") == "4"
    # Conformidad: 2 conformes de 3 evaluables = 66.67 %
    assert res.headers.get("x-report-conformidad") == "66.67"

    # Verificar firma válida de archivo PDF
    content = res.content
    assert content.startswith(b"%PDF"), "El archivo no contiene la cabecera estándar de PDF"
    assert b"%%EOF" in content or len(content) > 500


def test_rf16_generacion_excel_integridad_y_coherencia_rf10(rf16_test_context):
    client = TestClient(app)
    tag = uuid.uuid4().hex[:6]
    _ensure_user_and_login(client, f"supervisor_{tag}@simoa.com", "Supervisor", "Supervisor Test")

    ctx = rf16_test_context
    payload = {
        "formato": "excel",
        "ubicacion_id": ctx["location_id"],
        "fecha_inicio": ctx["start_utc"].strftime("%Y-%m-%d"),
        "fecha_fin": ctx["end_utc"].strftime("%Y-%m-%d"),
        "tz_offset_minutes": 0,
    }

    # 1. Comparar con RF-10 /api/mediciones/historico para garantizar 100% de coherencia
    rf10_res = client.get(
        "/api/mediciones/historico",
        params={
            "ubicacion_id": ctx["location_id"],
            "fecha_inicio": ctx["start_utc"].strftime("%Y-%m-%d"),
            "fecha_fin": ctx["end_utc"].strftime("%Y-%m-%d"),
            "tz_offset_minutes": 0,
        },
    )
    assert rf10_res.status_code == 200
    rf10_data = rf10_res.json()
    rf10_stats = rf10_data["estadisticas"]

    # 2. Descargar reporte Excel
    res = client.post("/api/reportes/ambientales", json=payload)
    assert res.status_code == 200, res.text
    assert "spreadsheetml.sheet" in res.headers["content-type"]
    assert "simoa_reporte_ambiental" in res.headers["content-disposition"]
    assert res.headers.get("x-report-total-records") == str(rf10_stats["total_registros_filtrados"])

    # 3. Abrir workbook y validar integridad de hojas
    wb = openpyxl.load_workbook(io.BytesIO(res.content), data_only=True)
    assert "Resumen" in wb.sheetnames
    assert "Mediciones" in wb.sheetnames
    assert "Alertas" in wb.sheetnames

    ws_resumen = wb["Resumen"]
    ws_mediciones = wb["Mediciones"]
    ws_alertas = wb["Alertas"]

    # Validar que Mediciones contiene 5 filas (1 encabezado + 4 registros)
    assert ws_mediciones.max_row == 5
    # Validar que Alertas contiene 2 filas (1 encabezado + 1 alerta)
    assert ws_alertas.max_row == 2
    # Validar coherencia numérica en Resumen
    assert ws_resumen.cell(row=1, column=1).value == "SISTEMA IoT DE MONITOREO AMBIENTAL (SIMOA)"
