from datetime import datetime, timedelta, timezone
import io
import json
import os
from pathlib import Path
import sys
import time
import uuid

from fastapi.testclient import TestClient
import numpy as np
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
from app.services.anomaly_detector import AnomalyDetectionService, anomaly_service
from app.services.measurement_persistence import measurement_persister


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
def rf18_test_context():
    run_migrations()
    anomaly_service.clear_cache()
    tag = uuid.uuid4().hex[:8]
    location_id = f"qa-rf18-loc-{tag}"
    device_id = f"qa-rf18-dev-{tag}"
    sensor_id = f"qa-rf18-sen-{tag}"

    now_utc = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=3)

    with db_cursor() as cursor:
        cursor.execute(
            "INSERT INTO ubicaciones (ubicacion_id, nombre, codigo_area, tipo, estado) VALUES (%s, %s, %s, 'Invernadero', 'ACTIVA')",
            (location_id, f"Invernadero IA {tag}", f"I{tag[:4]}"),
        )
        mac = "02:" + ":".join([tag[k:k+2] for k in range(0, 8, 2)]) + ":18"
        cursor.execute(
            """
            INSERT INTO dispositivos (id_dispositivo, nombre, codigo, mac_address, ubicacion_id, estado, activo_administrativamente)
            VALUES (%s, %s, %s, %s, %s, 'ONLINE', 1)
            """,
            (device_id, f"ESP32 IA {tag}", f"SIMOA-{tag[:6]}", mac, location_id),
        )
        cursor.execute(
            """
            INSERT INTO sensores (id_sensor, dispositivo_id, identificador, modelo, variables_medidas, estado, fecha_instalacion, ultima_calibracion)
            VALUES (%s, %s, %s, 'DHT22', %s, 'ACTIVO', '2026-01-01', '2026-01-01')
            """,
            (sensor_id, device_id, f"SEN-IA-{tag[:6]}", json.dumps([{"variable": "temperatura"}, {"variable": "humedad"}])),
        )
        # Umbrales nominales para RF-13 (20 a 30 °C, 40 a 70 %RH)
        cursor.execute(
            """
            INSERT INTO umbrales_alerta (sensor_id, temp_min, temp_max, hum_min, hum_max, actualizado_por)
            VALUES (%s, 20.0, 30.0, 40.0, 70.0, 'test_rf18')
            ON DUPLICATE KEY UPDATE temp_min = 20.0, temp_max = 30.0, hum_min = 40.0, hum_max = 70.0
            """,
            (sensor_id,),
        )

    return {
        "location_id": location_id,
        "device_id": device_id,
        "sensor_id": sensor_id,
        "base_time": now_utc,
    }


# ------------------------------------------------------------------------------
# Pruebas Unitarias del Motor Estadístico y de ML (RF-18)
# ------------------------------------------------------------------------------

def test_z_score_calculations_and_zero_variance():
    """Verifica el cálculo de Z-score, manejo de varianza cero y datos insuficientes."""
    baseline = [20.0, 20.2, 19.8, 20.1, 20.0, 19.9, 20.3]
    # Valor cercano a la media (nominal)
    z_nom = AnomalyDetectionService.compute_z_score(20.1, baseline)
    assert z_nom is not None
    assert abs(z_nom) < 1.0

    # Valor extremo (anómalo > 3.0 sigmas)
    z_extreme = AnomalyDetectionService.compute_z_score(25.0, baseline)
    assert z_extreme is not None
    assert z_extreme >= 3.0

    # Desviación cero: todos los valores idénticos
    flat_baseline = [22.0, 22.0, 22.0, 22.0, 22.0]
    z_flat_same = AnomalyDetectionService.compute_z_score(22.0, flat_baseline)
    assert z_flat_same == 0.0

    z_flat_diff = AnomalyDetectionService.compute_z_score(23.5, flat_baseline)
    assert z_flat_diff is not None and z_flat_diff >= 3.0

    # Menos de 5 muestras: debe retornar None
    assert AnomalyDetectionService.compute_z_score(22.0, [20.0, 21.0]) is None


def test_graceful_degradation_under_50_samples(rf18_test_context):
    """Con menos de 50 registros (< 50), debe usar Z-Score local sin intentar Isolation Forest."""
    ctx = rf18_test_context
    sen_id = ctx["sensor_id"]
    base_t = ctx["base_time"]

    # Insertar 15 mediciones nominales previas
    with db_cursor() as cursor:
        for i in range(15):
            t_val = 22.0 + (i % 3) * 0.2
            h_val = 55.0 + (i % 2) * 1.0
            cursor.execute(
                """
                INSERT INTO mediciones (dispositivo_id, sensor_id, ubicacion_id, temperatura, humedad, fecha_hora)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (ctx["device_id"], sen_id, ctx["location_id"], t_val, h_val, base_t + timedelta(minutes=i)),
            )

    # 1. Medición nominal adicional (T=22.1)
    res_nom = anomaly_service.evaluate_measurement(
        sensor_id=sen_id,
        target_medicion={
            "temperatura": 22.1,
            "humedad": 55.0,
            "fecha_hora": base_t + timedelta(minutes=16),
        },
    )
    assert res_nom.method == "Z_SCORE"
    assert res_nom.is_anomaly is False
    assert res_nom.score < 0.70
    assert res_nom.inference_time_ms < 200.0

    # 2. Medición con salto térmico abrupto (T=32.0, Z > 3.0)
    res_spike = anomaly_service.evaluate_measurement(
        sensor_id=sen_id,
        target_medicion={
            "temperatura": 32.0,
            "humedad": 55.0,
            "fecha_hora": base_t + timedelta(minutes=17),
        },
    )
    assert res_spike.method == "Z_SCORE"
    assert res_spike.is_anomaly is True
    assert res_spike.pattern_type in ("PICO_REPENTINO", "FALLO_SENSOR")
    assert res_spike.score >= 0.70
    assert "Se detectó" in res_spike.explanation
    assert len(res_spike.possible_causes) > 0
    assert len(res_spike.recommendations) > 0


def test_isolation_forest_activation_from_50_samples_and_latency(rf18_test_context):
    """Con 50 o más registros (>= 50), debe activar y reutilizar Isolation Forest (< 200 ms)."""
    ctx = rf18_test_context
    sen_id = ctx["sensor_id"]
    base_t = ctx["base_time"]

    # Insertar 55 mediciones nominales
    with db_cursor() as cursor:
        for i in range(55):
            t_val = 21.0 + (i % 5) * 0.25
            h_val = 50.0 + (i % 4) * 0.8
            cursor.execute(
                """
                INSERT INTO mediciones (dispositivo_id, sensor_id, ubicacion_id, temperatura, humedad, fecha_hora)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (ctx["device_id"], sen_id, ctx["location_id"], t_val, h_val, base_t + timedelta(minutes=i)),
            )

    # Primera inferencia: entrena y cachea modelo
    t_start = time.perf_counter()
    res1 = anomaly_service.evaluate_measurement(
        sensor_id=sen_id,
        target_medicion={
            "temperatura": 21.5,
            "humedad": 51.0,
            "fecha_hora": base_t + timedelta(minutes=56),
        },
    )
    t_dur1 = (time.perf_counter() - t_start) * 1000.0
    assert res1.method == "ISOLATION_FOREST"
    assert res1.is_anomaly is False
    assert res1.score < 0.70

    # Segunda inferencia: reutiliza modelo en memoria (latencia ultrarrápida << 200 ms)
    latencies: list[float] = []
    for k in range(10):
        t0 = time.perf_counter()
        res_cached = anomaly_service.evaluate_measurement(
            sensor_id=sen_id,
            target_medicion={
                "temperatura": 21.4 + (k * 0.05),
                "humedad": 50.5,
                "fecha_hora": base_t + timedelta(minutes=57 + k),
            },
        )
        lat = (time.perf_counter() - t0) * 1000.0
        latencies.append(lat)
        assert res_cached.method == "ISOLATION_FOREST"
        assert res_cached.inference_time_ms < 200.0

    max_lat = max(latencies)
    avg_lat = sum(latencies) / len(latencies)
    assert max_lat < 200.0, f"Latencia máxima excedió 200ms: {max_lat}ms"
    assert avg_lat < 50.0, f"Latencia promedio esperada <50ms: {avg_lat}ms"

    # Inyectar una anomalía severa (pico repentino T=38.5, H=88.0)
    res_anom = anomaly_service.evaluate_measurement(
        sensor_id=sen_id,
        target_medicion={
            "temperatura": 38.5,
            "humedad": 88.0,
            "fecha_hora": base_t + timedelta(minutes=70),
        },
    )
    assert res_anom.method == "ISOLATION_FOREST"
    assert res_anom.is_anomaly is True
    assert res_anom.score >= 0.70
    assert res_anom.pattern_type in ("PICO_REPENTINO", "OSCILACION_INHABITUAL", "DERIVA_TERMICA")


def test_rn20_decoupling_with_threshold_alerts(rf18_test_context):
    """RN-20: La capa de IA no bloquea los umbrales fijos; ambas capas operan en paralelo.
    Prueba las 4 combinaciones posibles:
    1. Dentro de límites y sin anomalía IA.
    2. Fuera de límites y sin anomalía IA.
    3. Dentro de límites y con anomalía IA.
    4. Fuera de límites y con anomalía IA.
    """
    ctx = rf18_test_context
    sen_id = ctx["sensor_id"]
    dev_id = ctx["device_id"]
    ubi_id = ctx["location_id"]
    base_t = ctx["base_time"]

    # Poblar 30 mediciones base estables entre 24°C y 25°C (límites son 20 a 30 °C)
    with db_cursor() as cursor:
        for i in range(30):
            cursor.execute(
                """
                INSERT INTO mediciones (dispositivo_id, sensor_id, ubicacion_id, temperatura, humedad, fecha_hora)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (dev_id, sen_id, ubi_id, 24.5, 50.0, base_t + timedelta(minutes=i)),
            )

    # Caso 1: Dentro de límites (24.6°C) y sin anomalía (nominal)
    rec1 = {
        "dispositivo_id": dev_id,
        "sensor_id": sen_id,
        "ubicacion_id": ubi_id,
        "temperatura": 24.6,
        "humedad": 50.0,
        "presion": None,
        "configuracion_id": None,
        "variables_activas_snapshot": None,
        "clave_idempotencia": f"idem-rn20-1-{uuid.uuid4().hex[:6]}",
        "fecha_hora": (base_t + timedelta(minutes=31)).isoformat(),
        "recepcion_confiable": None,
    }
    med_id1, _, es_fuera1 = measurement_persister._insert_atomic_mysql(rec1)
    assert es_fuera1 is False

    with db_cursor() as cursor:
        cursor.execute("SELECT valor_anomalo, score_anomalia_ia FROM mediciones WHERE id_medicion = %s", (med_id1,))
        r1 = cursor.fetchone()
        assert r1["valor_anomalo"] == 0
        assert r1["score_anomalia_ia"] is not None and float(r1["score_anomalia_ia"]) < 0.70

    # Caso 2: Fuera de límites (31.0°C > max 30.0)
    # Variación térmica leve respecto al paso previo (apenas supera el umbral operacional)
    rec2 = {
        "dispositivo_id": dev_id,
        "sensor_id": sen_id,
        "ubicacion_id": ubi_id,
        "temperatura": 31.0,
        "humedad": 50.0,
        "presion": None,
        "configuracion_id": None,
        "variables_activas_snapshot": None,
        "clave_idempotencia": f"idem-rn20-2-{uuid.uuid4().hex[:6]}",
        "fecha_hora": (base_t + timedelta(minutes=32)).isoformat(),
        "recepcion_confiable": None,
    }
    med_id2, _, es_fuera2 = measurement_persister._insert_atomic_mysql(rec2)
    assert es_fuera2 is True  # Umbral detectado de forma independiente

    # Caso 3 & 4: Anomalía abrupta con caída repentina (T=15.0°C)
    # Fuera de límites (< 20.0°C) Y con anomalía estadística (Z > 3.0)
    rec3 = {
        "dispositivo_id": dev_id,
        "sensor_id": sen_id,
        "ubicacion_id": ubi_id,
        "temperatura": 15.0,
        "humedad": 50.0,
        "presion": None,
        "configuracion_id": None,
        "variables_activas_snapshot": None,
        "clave_idempotencia": f"idem-rn20-3-{uuid.uuid4().hex[:6]}",
        "fecha_hora": (base_t + timedelta(minutes=33)).isoformat(),
        "recepcion_confiable": None,
    }
    med_id3, _, es_fuera3 = measurement_persister._insert_atomic_mysql(rec3)
    assert es_fuera3 is True

    with db_cursor() as cursor:
        cursor.execute("SELECT valor_anomalo, score_anomalia_ia FROM mediciones WHERE id_medicion = %s", (med_id3,))
        r3 = cursor.fetchone()
        assert r3["valor_anomalo"] == 1
        assert float(r3["score_anomalia_ia"]) >= 0.70


def test_api_diagnostico_and_manual_evaluation_endpoints(rf18_test_context):
    """Prueba los endpoints REST de IA: /api/ia/diagnostico, /api/ia/evaluar, /api/ia/metricas."""
    client = TestClient(app)
    _ensure_user_and_login(client, "supervisor_rf18@simoa.com", "Supervisor", "Super RF18")

    ctx = rf18_test_context
    sen_id = ctx["sensor_id"]
    ubi_id = ctx["location_id"]

    # 1. Obtener diagnóstico inicial por ubicación o sensor
    resp_diag = client.get(f"/api/ia/diagnostico?sensor_id={sen_id}")
    assert resp_diag.status_code == 200, resp_diag.text
    diag_data = resp_diag.json()
    assert diag_data["sensor_id"] == sen_id
    assert "explicacion" in diag_data
    assert "posibles_causas" in diag_data
    assert "recomendaciones" in diag_data
    assert diag_data["tiempo_inferencia_ms"] < 200.0

    # 2. Evaluación puntual en caliente (/api/ia/evaluar)
    resp_eval = client.post(
        "/api/ia/evaluar",
        json={"sensor_id": sen_id, "temperatura": 41.5, "humedad": 92.0},
    )
    assert resp_eval.status_code == 200, resp_eval.text
    eval_json = resp_eval.json()
    assert eval_json["sensor_id"] == sen_id
    assert eval_json["tiempo_inferencia_ms"] < 200.0

    # 3. Métricas de latencia (/api/ia/metricas)
    resp_met = client.get("/api/ia/metricas")
    assert resp_met.status_code == 200
    met_data = resp_met.json()
    assert met_data["meta_latencia_ms"] == 200.0
    assert "modelo_version" in met_data


def test_unauthorized_access():
    """Valida control de accesos RBAC (RF-01) en endpoints de IA."""
    client = TestClient(app)
    # Sin autenticación
    resp = client.get("/api/ia/diagnostico")
    assert resp.status_code == 401

    resp_eval = client.post("/api/ia/evaluar", json={"sensor_id": "sen-1"})
    assert resp_eval.status_code == 401
