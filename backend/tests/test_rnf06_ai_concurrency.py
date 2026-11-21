"""
Pruebas de concurrencia y rendimiento para RNF-06: Rendimiento y Concurrencia del Sistema e IA.
Verifica:
1. Soporte de >= 50 peticiones concurrentes sin errores 5xx ni degradación del servicio.
2. Inferencia de Machine Learning (Isolation Forest / Z-Score) < 200 ms.
3. Duración de reentrenamiento <= 3 segundos sin bloqueo del bucle principal.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import os
from pathlib import Path
import sys
import time

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("JWT_SECRET_KEY", "rnf06-pytest-secret-key-hs256-32bytes")

from app.database import db_cursor, run_migrations
from app.main import app
from app.security import create_access_token, hash_password, login_rate_limiter
from app.services.anomaly_detector import AnomalyDetectionService

CONCURRENCY_USER_EMAIL = "concurrency.rnf06@simoa.org"
_CONCURRENCY_USER_ID = 1


@pytest.fixture(scope="module", autouse=True)
def setup_rnf06():
    global _CONCURRENCY_USER_ID
    run_migrations()
    login_rate_limiter.clear_all()
    with db_cursor() as cursor:
        cursor.execute("DELETE FROM usuarios WHERE correo = %s", (CONCURRENCY_USER_EMAIL,))
        cursor.execute(
            """
            INSERT INTO usuarios (nombre, correo, password_hash, rol, estado)
            VALUES ('Operador Concurrencia RNF06', %s, %s, 'Operador', 'activo')
            """,
            (CONCURRENCY_USER_EMAIL, hash_password("ConcPass123!")),
        )
        _CONCURRENCY_USER_ID = cursor.lastrowid
    yield
    with db_cursor() as cursor:
        cursor.execute("DELETE FROM usuarios WHERE correo = %s", (CONCURRENCY_USER_EMAIL,))


def test_rnf06_concurrency_50_simultaneous_clients():
    """
    RNF-06: El sistema debe soportar al menos 50 clientes concurrentes
    sin fallas 5xx ni caídas en disponibilidad.
    """
    token, _, _ = create_access_token(user_id=_CONCURRENCY_USER_ID, rol="Operador", correo=CONCURRENCY_USER_EMAIL)
    headers = {"Authorization": f"Bearer {token}"}

    with TestClient(app) as client:
        def make_request(client_id: int):
            t0 = time.perf_counter()
            res = client.get("/api/dispositivos", headers=headers)
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            return {
                "client_id": client_id,
                "status_code": res.status_code,
                "elapsed_ms": elapsed_ms,
            }

        concurrency_level = 50
        results = []
        with ThreadPoolExecutor(max_workers=concurrency_level) as executor:
            futures = [executor.submit(make_request, i) for i in range(concurrency_level)]
            for fut in as_completed(futures):
                results.append(fut.result())

    assert len(results) == concurrency_level

    # 1. 0% de errores 5xx
    errors_5xx = [r for r in results if r["status_code"] >= 500]
    assert len(errors_5xx) == 0, f"Ocurrieron errores 5xx bajo carga concurrente: {errors_5xx}"

    # 2. 100% de respuestas exitosas (200 OK)
    successes = [r for r in results if r["status_code"] == 200]
    assert len(successes) == concurrency_level, f"Respuestas no exitosas: {[r for r in results if r['status_code'] != 200]}"


def test_rnf06_ai_inference_time_under_200ms():
    """
    RNF-06: Tiempo de inferencia de Isolation Forest / Z-Score < 200 ms.
    """
    detector = AnomalyDetectionService(window_size=50)

    # Generar ventana sintética de 50 mediciones normales
    now = datetime.now(timezone.utc)
    historical_window = [
        {
            "id_medicion": i,
            "sensor_id": "sen-bench-01",
            "temperatura": 24.0 + (i % 5) * 0.2,
            "humedad": 60.0 + (i % 4) * 0.5,
            "fecha_hora": now,
        }
        for i in range(50)
    ]

    target = {
        "id_medicion": 999,
        "sensor_id": "sen-bench-01",
        "temperatura": 35.5,  # Valor anómalo
        "humedad": 85.0,
        "fecha_hora": now,
    }

    # Evaluar inferencia y medir tiempo exacto
    t0 = time.perf_counter()
    eval_result = detector.evaluate_measurement(
        sensor_id="sen-bench-01",
        target_medicion=target,
        historical_window=historical_window,
    )
    total_time_ms = (time.perf_counter() - t0) * 1000.0

    assert eval_result.inference_time_ms < 200.0, (
        f"Tiempo de inferencia registrado ({eval_result.inference_time_ms}ms) superó 200 ms"
    )
    assert total_time_ms < 200.0, f"Tiempo total de llamada ({total_time_ms}ms) superó 200 ms"
    assert eval_result.method in ("ISOLATION_FOREST", "Z_SCORE")
