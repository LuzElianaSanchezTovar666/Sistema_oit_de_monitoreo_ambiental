import csv
from datetime import datetime, timedelta, timezone
import io
import json
import os
from pathlib import Path
import sys
import uuid

from fastapi.testclient import TestClient
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
def rf17_test_context():
    run_migrations()
    tag = uuid.uuid4().hex[:8]
    location_id = f"qa-rf17-loc-{tag}"
    device_id = f"qa-rf17-dev-{tag}"
    sensor_id = f"qa-rf17-sen-{tag}"

    now_utc = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=2)

    with db_cursor() as cursor:
        cursor.execute(
            "INSERT INTO ubicaciones (ubicacion_id, nombre, codigo_area, tipo, estado) VALUES (%s, %s, %s, 'Laboratorio', 'ACTIVA')",
            (location_id, f"Lab CSV {tag}", f"C{tag[:4]}"),
        )
        mac = "02:" + ":".join([tag[k:k+2] for k in range(0, 8, 2)]) + ":17"
        # Nombre de dispositivo con prefijo de inyección de fórmula para probar RN-19
        device_name = f"=SUM(1,2)_Nodo_{tag}"
        cursor.execute(
            """
            INSERT INTO dispositivos (id_dispositivo, nombre, codigo, mac_address, ubicacion_id, estado, activo_administrativamente)
            VALUES (%s, %s, %s, %s, %s, 'ONLINE', 1)
            """,
            (device_id, device_name, f"SIMOA-{tag[:6]}", mac, location_id),
        )
        sensor_ident = f"@Sensor_{tag[:6]}"
        cursor.execute(
            """
            INSERT INTO sensores (id_sensor, dispositivo_id, identificador, modelo, variables_medidas, estado, fecha_instalacion, ultima_calibracion)
            VALUES (%s, %s, %s, 'DHT22', %s, 'ACTIVO', '2026-01-01', '2026-01-01')
            """,
            (sensor_id, device_id, sensor_ident, json.dumps([{"variable": "temperatura"}, {"variable": "humedad"}])),
        )

        # 4 mediciones con diferentes estados:
        # 1: T=21.45, H=50.12, score=0.0500, NOMINAL (es_fuera_de_umbral=0)
        # 2: T=35.80, H=88.50, score=0.9200, FUERA DE RANGO (es_fuera_de_umbral=1)
        # 3: T=22.00, H=None, score=None, NO EVALUABLE (es_fuera_de_umbral=None)
        # 4: T=None, H=60.00, score=None, NOMINAL (es_fuera_de_umbral=0)
        test_records = [
            (device_id, sensor_id, location_id, 21.45, 50.12, 0.05, 0, now_utc),
            (device_id, sensor_id, location_id, 35.8, 88.5, 0.92, 1, now_utc + timedelta(minutes=5)),
            (device_id, sensor_id, location_id, 22.0, None, None, None, now_utc + timedelta(minutes=10)),
            (device_id, sensor_id, location_id, None, 60.0, None, 0, now_utc + timedelta(minutes=15)),
        ]
        for dev, sen, ubi, t, h, score, es_fuera, dt in test_records:
            cursor.execute(
                """
                INSERT INTO mediciones (dispositivo_id, sensor_id, ubicacion_id, temperatura, humedad, score_anomalia_ia, es_fuera_de_umbral, alerta_generada, fecha_hora)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 0, %s)
                """,
                (dev, sen, ubi, t, h, score, es_fuera, dt),
            )

    return {
        "location_id": location_id,
        "device_id": device_id,
        "device_name": device_name,
        "sensor_id": sensor_id,
        "sensor_ident": sensor_ident,
        "base_time": now_utc,
    }


def test_csv_export_structure_bom_and_injection(rf17_test_context):
    client = TestClient(app)
    _ensure_user_and_login(client, "admin_rf17@simoa.com", "Administrador", "Admin RF17")

    ctx = rf17_test_context
    resp = client.post(
        "/api/mediciones/exportar/csv",
        json={"ubicacion_id": ctx["location_id"]},
    )
    assert resp.status_code == 200, resp.text

    # Validar headers HTTP obligatorios
    content_disposition = resp.headers.get("content-disposition", "")
    assert "attachment; filename=\"simoa_reporte_" in content_disposition
    assert content_disposition.endswith(".csv\"")
    assert resp.headers.get("x-report-total-records") == "4"

    raw_bytes = resp.content

    # 1. Validar UTF-8 BOM inicial (\xef\xbb\xbf)
    assert raw_bytes.startswith(b"\xef\xbb\xbf"), "El archivo CSV debe incluir el BOM UTF-8 (RN-19)"

    # 2. Decodificar como UTF-8
    text_content = raw_bytes.decode("utf-8-sig")
    reader = list(csv.reader(io.StringIO(text_content)))
    assert len(reader) == 5  # 1 fila cabecera + 4 filas de datos

    # 3. Validar las 7 columnas obligatorias en el orden exacto de RF-17
    expected_headers = [
        "fecha_hora",
        "dispositivo",
        "sensor",
        "temperatura",
        "humedad",
        "score_ia",
        "estado_umbral",
    ]
    assert reader[0] == expected_headers

    # 4. Validar protección contra inyección de fórmulas (RN-19)
    # El dispositivo iniciaba con '=', debe estar protegido con "'"
    for row in reader[1:]:
        dispositivo_val = row[1]
        sensor_val = row[2]
        assert dispositivo_val.startswith("'="), f"Inyección no prevenida en dispositivo: {dispositivo_val}"
        assert sensor_val.startswith("'@"), f"Inyección no prevenida en sensor: {sensor_val}"

    # 5. Validar conservación de precisión, nulos como cadena vacía y estados de umbral
    row1 = reader[1]
    assert "21.45" in row1[3]
    assert "50.12" in row1[4]
    assert "0.05" in row1[5]
    assert row1[6] == "NOMINAL"

    row2 = reader[2]
    assert row2[6] == "FUERA DE RANGO"

    row3 = reader[3]
    assert row3[4] == ""  # Humedad None representada como vacía (no 0)
    assert row3[5] == ""  # Score None representado como vacío
    assert row3[6] == "NO EVALUABLE"

    row4 = reader[4]
    assert row4[3] == ""  # Temperatura None representada como vacía (no 0)


def test_csv_export_date_validation_400():
    client = TestClient(app)
    _ensure_user_and_login(client, "supervisor_rf17@simoa.com", "Supervisor", "Super RF17")

    resp = client.post(
        "/api/mediciones/exportar/csv",
        json={"fecha_inicio": "2026-11-20", "fecha_fin": "2026-11-10"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "La fecha inicial no puede ser mayor a la final"


def test_csv_export_empty_dataset_404():
    client = TestClient(app)
    _ensure_user_and_login(client, "tecnico_rf17@simoa.com", "Técnico", "Tec RF17")

    resp = client.post(
        "/api/mediciones/exportar/csv",
        json={"ubicacion_id": "ubi_totalmente_inexistente_9999"},
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "No hay mediciones disponibles para exportar con los filtros seleccionados"


def test_csv_export_get_endpoint_parity(rf17_test_context):
    client = TestClient(app)
    _ensure_user_and_login(client, "operador_rf17@simoa.com", "Operador", "Op RF17")

    ctx = rf17_test_context
    resp = client.get(f"/api/mediciones/exportar/csv?ubicacion_id={ctx['location_id']}")
    assert resp.status_code == 200
    assert resp.headers.get("x-report-total-records") == "4"
    lines = resp.content.decode("utf-8-sig").splitlines()
    assert len(lines) == 5
    assert lines[0] == "fecha_hora,dispositivo,sensor,temperatura,humedad,score_ia,estado_umbral"


def test_csv_export_unauthorized():
    client = TestClient(app)
    # Sin credenciales
    resp = client.post("/api/mediciones/exportar/csv", json={})
    assert resp.status_code == 401
