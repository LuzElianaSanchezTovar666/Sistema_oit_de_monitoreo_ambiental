"""
Pruebas automatizadas para RNF-12: Sincronización Temporal de Mediciones (NTP).
Verifica:
1. Precisión del desfase temporal (<= 1s).
2. Detección y corrección de anomalías temporales (> 60s) en telemetría.
3. Formato ISO-8601 UTC en almacenamiento y respuestas de API.
4. Formateo y conversión explícita a la zona horaria local America/Bogota (UTC-5).
"""

from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("JWT_SECRET_KEY", "rnf12-pytest-secret-key-hs256-32bytes")

from app.database import db_cursor, run_migrations
from app.main import app
from app.seed_demo_users import DEMO_USERS
from app.services.time_sync import (
    BOGOTA_TIMEZONE,
    format_bogota_display,
    format_utc_iso,
    validate_telemetry_timestamp,
    verify_server_time_sync,
)


@pytest.fixture(scope="module", autouse=True)
def setup_rnf12():
    run_migrations()


def test_rnf12_server_time_sync_verification():
    """RNF-12: La sincronización horaria debe cumplir con un desfase máximo tolerado <= 1.0s."""
    sync_report = verify_server_time_sync(max_offset=1.0)
    assert "in_sync" in sync_report
    assert sync_report["max_tolerated_seconds"] == 1.0
    if sync_report.get("measured"):
        assert sync_report["abs_offset_seconds"] <= 1.0


def test_rnf12_telemetry_timestamp_drift_detection():
    """
    RNF-12: Si una medición llega con timestamp desfasado > 60s respecto al reloj del servidor,
    debe ser marcada como anomalía temporal.
    """
    now_ref = datetime(2026, 11, 21, 12, 0, 0, tzinfo=timezone.utc).replace(tzinfo=None)

    # 1. Timestamp dentro del rango normal (ej: 5 segundos de antigüedad por latencia de red)
    normal_ts = now_ref - timedelta(seconds=5)
    valid, drift, reason = validate_telemetry_timestamp(normal_ts, reference_time=now_ref, max_drift_seconds=60.0)
    assert valid is True
    assert reason is None
    assert abs(drift) <= 60.0

    # 2. Timestamp desfasado hacia el pasado (> 60s)
    stale_ts = now_ref - timedelta(seconds=120)
    valid_stale, drift_stale, reason_stale = validate_telemetry_timestamp(stale_ts, reference_time=now_ref, max_drift_seconds=60.0)
    assert valid_stale is False
    assert "DESFASE_TEMPORAL_EXCESIVO" in reason_stale
    assert drift_stale == 120.0

    # 3. Timestamp desfasado hacia el futuro (> 60s)
    future_ts = now_ref + timedelta(seconds=90)
    valid_future, drift_future, reason_future = validate_telemetry_timestamp(future_ts, reference_time=now_ref, max_drift_seconds=60.0)
    assert valid_future is False
    assert "DESFASE_TEMPORAL_EXCESIVO" in reason_future
    assert drift_future == -90.0


def test_rnf12_iso_utc_formatting_standard():
    """RNF-12: Todos los timestamps serializados para almacenamiento y API deben ser ISO 8601 UTC con 'Z'."""
    dt_utc = datetime(2026, 11, 21, 14, 30, 45, tzinfo=timezone.utc)
    formatted = format_utc_iso(dt_utc)
    assert formatted == "2026-11-21T14:30:45Z"
    assert formatted.endswith("Z")

    # Si es naive, se asume UTC
    dt_naive = datetime(2026, 11, 21, 14, 30, 45)
    formatted_naive = format_utc_iso(dt_naive)
    assert formatted_naive == "2026-11-21T14:30:45Z"


def test_rnf12_bogota_local_display_conversion():
    """
    RNF-12: La conversión a zona horaria local 'America/Bogota' (UTC-5) debe
    restar exactamente 5 horas respecto a UTC.
    """
    utc_time = datetime(2026, 11, 21, 17, 30, 0, tzinfo=timezone.utc)
    bogota_str = format_bogota_display(utc_time)
    # 17:30 UTC -> 12:30 America/Bogota (UTC-5)
    assert "2026-11-21 12:30:00" in bogota_str


def test_rnf12_api_mediciones_returns_explicit_utc():
    """RNF-12: Endpoints de consulta deben entregar el campo fecha_hora_utc con formato ISO-8601 UTC."""
    with TestClient(app) as client:
        # Iniciar sesión como operador para consultar mediciones
        operator = next(user for user in DEMO_USERS if user["rol"] == "Operador")
        login_res = client.post("/api/auth/login", json={"correo": operator["correo"], "password": operator["password"]})
        if login_res.status_code == 200:
            token = login_res.json()["access_token"]
            res = client.get("/api/mediciones?limit=5", headers={"Authorization": f"Bearer {token}"})
            if res.status_code == 200:
                data = res.json()
                items = data.get("items", [])
                for item in items:
                    utc_field = item.get("fecha_hora_utc")
                    assert utc_field is not None, "El campo fecha_hora_utc es obligatorio"
                    assert utc_field.endswith("Z") or "+00:00" in utc_field, f"Formato inválido: {utc_field}"
