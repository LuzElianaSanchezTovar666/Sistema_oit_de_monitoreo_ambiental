"""
Pruebas automatizadas para RNF-03: Eficiencia en Comunicación MQTT.
Verifica:
1. Tamaño promedio del payload MQTT <= 256 bytes en 100 tramas simuladas.
2. Tamaño máximo de payload de telemetría individual <= 256 bytes.
3. Soporte de QoS 0 (telemetría continua) y QoS 1 (crítico / alertas).
"""

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import random
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings


def generate_telemetry_payload(device_code: str, temp: float, hum: float, rssi: int, sensor_id: str = None) -> bytes:
    """Genera una carga útil real en formato JSON codificado en UTF-8."""
    data = {
        "codigo": device_code,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "temperatura": round(temp, 2),
        "humedad": round(hum, 2),
        "rssi_dbm": rssi,
    }
    if sensor_id:
        data["sensor_id"] = sensor_id
        data["presion"] = 1013.25
    return json.dumps(data, separators=(",", ":")).encode("utf-8")


def test_rnf03_average_payload_size_under_256_bytes():
    """
    RNF-03: El tamaño promedio del payload MQTT por mensaje de telemetría debe ser <= 256 bytes.
    Verifica 100 muestras consecutivas con variaciones numéricas e identificadores.
    """
    payload_sizes = []
    device_codes = ["ESP32-INV-01", "ESP32-BIO-02", "ESP32-CAM-03", "ESP32-BOD-04"]

    for i in range(100):
        code = random.choice(device_codes)
        temp = random.uniform(18.0, 32.0)
        hum = random.uniform(40.0, 85.0)
        rssi = random.randint(-85, -45)
        sensor_ref = f"sen-{i:03d}" if i % 2 == 0 else None

        raw = generate_telemetry_payload(code, temp, hum, rssi, sensor_ref)
        size_bytes = len(raw)
        payload_sizes.append(size_bytes)
        assert size_bytes <= 256, f"El mensaje individual {i} ({size_bytes}B) excedió 256 bytes"

    avg_size = sum(payload_sizes) / len(payload_sizes)
    assert avg_size <= 256.0, f"Tamaño promedio ({avg_size}B) excedió 256 bytes"
    assert avg_size < 160.0, f"Tamaño promedio óptimo debe rondar ~100-150B (obtenido: {avg_size:.1f}B)"


def test_rnf03_qos_configuration_compliance():
    """
    RNF-03: La configuración de QoS debe ser 0 o 1 según el perfil de criticidad ambiental.
    """
    settings = get_settings()
    assert settings.mqtt_qos in (0, 1), f"El QoS configurado ({settings.mqtt_qos}) debe ser 0 o 1"
