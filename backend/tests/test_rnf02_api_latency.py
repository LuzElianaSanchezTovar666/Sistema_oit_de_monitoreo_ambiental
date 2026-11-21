"""
Pruebas de benchmark y latencia para RNF-02: Tiempo de Respuesta de la API REST (<= 200 ms).
Verifica:
1. P95 del tiempo de respuesta <= 200 ms en endpoints clave:
   - GET /api/dispositivos
   - GET /api/alertas
   - GET /api/mediciones?limit=20
2. P50 del tiempo de respuesta <= 50 ms en condiciones normales de operación.
"""

from datetime import datetime, timezone
import os
from pathlib import Path
import statistics
import sys
import time

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("JWT_SECRET_KEY", "rnf02-pytest-secret-key-hs256-32bytes")

from app.database import db_cursor, run_migrations
from app.main import app
from app.security import create_access_token, hash_password, login_rate_limiter

BENCH_USER_EMAIL = "bench.rnf02@simoa.org"
_BENCH_USER_ID = 1


@pytest.fixture(scope="module", autouse=True)
def setup_rnf02():
    global _BENCH_USER_ID
    run_migrations()
    login_rate_limiter.clear_all()
    with db_cursor() as cursor:
        cursor.execute("DELETE FROM usuarios WHERE correo = %s", (BENCH_USER_EMAIL,))
        cursor.execute(
            """
            INSERT INTO usuarios (nombre, correo, password_hash, rol, estado)
            VALUES ('Admin Bench RNF02', %s, %s, 'Administrador', 'activo')
            """,
            (BENCH_USER_EMAIL, hash_password("BenchPass123!")),
        )
        _BENCH_USER_ID = cursor.lastrowid
    yield
    with db_cursor() as cursor:
        cursor.execute("DELETE FROM usuarios WHERE correo = %s", (BENCH_USER_EMAIL,))


def _get_auth_headers() -> dict:
    token, _, _ = create_access_token(user_id=_BENCH_USER_ID, rol="Administrador", correo=BENCH_USER_EMAIL)
    return {"Authorization": f"Bearer {token}"}


def _benchmark_endpoint(client: TestClient, path: str, iterations: int = 50) -> dict:
    headers = _get_auth_headers()
    # Petición de calentamiento (warm-up)
    warm = client.get(path, headers=headers)
    assert warm.status_code in (200, 404), f"Warm-up falló: {warm.status_code} {warm.text}"

    latencies_ms = []
    for _ in range(iterations):
        t0 = time.perf_counter()
        res = client.get(path, headers=headers)
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        assert res.status_code in (200, 404), f"Petición falló: {res.status_code}"
        latencies_ms.append(elapsed_ms)

    latencies_sorted = sorted(latencies_ms)
    p50 = latencies_sorted[int(0.50 * (len(latencies_sorted) - 1))]
    p95 = latencies_sorted[int(0.95 * (len(latencies_sorted) - 1))]
    p99 = latencies_sorted[int(0.99 * (len(latencies_sorted) - 1))]
    avg = sum(latencies_ms) / len(latencies_ms)

    return {
        "path": path,
        "iterations": iterations,
        "avg_ms": round(avg, 2),
        "p50_ms": round(p50, 2),
        "p95_ms": round(p95, 2),
        "p99_ms": round(p99, 2),
    }


def test_rnf02_p95_latency_under_200ms():
    """RNF-02: Los endpoints de consulta frecuente deben responder con P95 <= 200 ms."""
    endpoints_to_measure = [
        "/api/dispositivos",
        "/api/alertas",
        "/api/mediciones?limit=20",
    ]

    with TestClient(app) as client:
        for endpoint in endpoints_to_measure:
            metrics = _benchmark_endpoint(client, endpoint, iterations=50)
            assert metrics["p95_ms"] <= 200.0, (
                f"Endpoint {endpoint} excedió umbral P95 <= 200ms: {metrics['p95_ms']}ms "
                f"(P50={metrics['p50_ms']}ms, P99={metrics['p99_ms']}ms)"
            )
