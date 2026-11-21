"""
Pruebas automatizadas para RNF-11: Tolerancia a Fallos y Copias de Respaldo.
Verifica:
1. Generación, compresión GZIP y suma SHA-256 de respaldos MySQL.
2. Detección de corrupción de integridad mediante hash SHA-256.
3. Política de rotación automática de respaldos antiguos.
4. Aislamiento en cola DLQ del 100% de mensajes MQTT corruptos sin detener el proceso principal.
"""

from datetime import datetime, timezone, timedelta
import gzip
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import uuid

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

from backup_mysql import compute_sha256, perform_mysql_backup, rotate_backups, verify_backup
from app.services.mqtt_ingest import MqttIngestionService, RejectedMqttRecord


def test_rnf11_mysql_backup_creation_and_integrity():
    """RNF-11: Respaldo MySQL lógico con compresión .gz y verificación SHA-256."""
    temp_dir = Path(tempfile.mkdtemp(prefix="simoa_backup_test_"))
    try:
        gz_path, sha_path, sha_hex = perform_mysql_backup(output_dir=temp_dir, retention_days=1)

        assert gz_path.exists(), "El archivo de respaldo .sql.gz debe existir"
        assert sha_path.exists(), "El archivo de suma SHA-256 debe existir"
        assert len(sha_hex) == 64, "El hash SHA-256 debe tener 64 caracteres hexadecimales"

        # Verificar que el contenido sea válido y descomprimible
        is_valid = verify_backup(gz_path, sha_path)
        assert is_valid is True, "El respaldo recién generado debe superar la verificación de integridad"

        # Verificar que el contenido SQL tenga la cabecera esperada
        with gzip.open(gz_path, "rt", encoding="utf-8") as f:
            first_lines = "".join(f.readline() for _ in range(5))
            assert "SIMOA Database Backup" in first_lines
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_rnf11_mysql_backup_detects_corrupted_archive():
    """RNF-11: La verificación de respaldo debe fallar si el archivo es alterado o corrompido."""
    temp_dir = Path(tempfile.mkdtemp(prefix="simoa_corrupt_test_"))
    try:
        gz_path, sha_path, sha_hex = perform_mysql_backup(output_dir=temp_dir, retention_days=1)

        # Corromper 1 byte al final del archivo
        with open(gz_path, "ab") as f:
            f.write(b"CORRUPTED_BYTES_INJECTED")

        # La verificación debe detectar la discrepancia de hash y/o fallo de descompresión gzip
        is_valid = verify_backup(gz_path, sha_path)
        assert is_valid is False, "La verificación debe fallar ante un archivo de respaldo adulterado"
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_rnf11_backup_rotation_policy():
    """RNF-11: Rotación automática de respaldos anteriores al período de retención."""
    temp_dir = Path(tempfile.mkdtemp(prefix="simoa_rotate_test_"))
    try:
        old_file = temp_dir / "simoa_backup_20200101_000000Z.sql.gz"
        old_file.write_bytes(b"old")
        old_sha = temp_dir / "simoa_backup_20200101_000000Z.sql.gz.sha256"
        old_sha.write_text("fakehash", encoding="utf-8")

        # Forzar fecha de modificación antigua
        old_time = (datetime.now(timezone.utc) - timedelta(days=30)).timestamp()
        os.utime(old_file, (old_time, old_time))

        new_file = temp_dir / "simoa_backup_20261121_120000Z.sql.gz"
        new_file.write_bytes(b"new")

        purged = rotate_backups(temp_dir, retention_days=7)
        assert old_file in purged
        assert not old_file.exists()
        assert not old_sha.exists()
        assert new_file.exists(), "El respaldo reciente no debe ser purgado"
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_rnf11_mqtt_dlq_isolates_corrupted_messages():
    """
    RNF-11: Mensajes corruptos deben ser aislados en la cola DLQ sin interrumpir
    el servicio ni lanzar excepciones no capturadas.
    """
    service = MqttIngestionService()

    class FakeMqttMessage:
        def __init__(self, topic: str, payload: bytes):
            self.topic = topic
            self.payload = payload
            self.retain = False

    # 1. Enviar mensaje con JSON corrupto
    corrupt_msg = FakeMqttMessage("simoa/dispositivos/ESP32-INV-01/telemetria", b"{not a json at all---")
    initial_dlq = service.dlq_queue.qsize()

    service._on_message(None, None, corrupt_msg)

    # Debe haber registrado un rechazo en DLQ sin fallar
    assert service.dlq_queue.qsize() == initial_dlq + 1
    rejected: RejectedMqttRecord = service.dlq_queue.get_nowait()
    assert rejected.motivo == "JSON_MALFORMADO"
    assert "simoa/dispositivos/ESP32-INV-01" in rejected.topico
