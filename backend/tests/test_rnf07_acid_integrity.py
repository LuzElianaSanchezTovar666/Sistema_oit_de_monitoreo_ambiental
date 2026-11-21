"""
Pruebas automatizadas para RNF-07: Integridad y Consistencia Transaccional (ACID).
Verifica:
1. Rollback atómico en operaciones compuestas (0 registros huérfanos tras fallos simulados).
2. Cumplimiento de integridad referencial (ON DELETE RESTRICT).
3. Cero registros huérfanos en la base de datos.
"""

import os
from pathlib import Path
import sys
import uuid

import pymysql
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("JWT_SECRET_KEY", "rnf07-pytest-secret-key-hs256-32bytes")

from app.database import db_cursor, run_migrations


@pytest.fixture(scope="module", autouse=True)
def setup_rnf07_env():
    run_migrations()


def test_rnf07_atomic_rollback_on_compound_failure():
    """
    RNF-07: Si una operación de escritura compuesta falla a la mitad,
    el bloque transaccional debe hacer ROLLBACK total, dejando 0 registros huérfanos.
    """
    dev_id = f"dev-test-acid-{uuid.uuid4().hex[:6]}"
    ubi_id = "ubi-lab-01"

    # Verificamos que no exista previamente
    with db_cursor() as cursor:
        cursor.execute("SELECT id_dispositivo FROM dispositivos WHERE id_dispositivo = %s", (dev_id,))
        assert cursor.fetchone() is None

    # Simulamos una transacción compuesta con fallo intencional en el segundo paso
    with pytest.raises(RuntimeError, match="Fallo simulado a mitad de transacción"):
        with db_cursor() as cursor:
            # 1. Inserción del dispositivo (éxito local dentro de la transacción)
            cursor.execute(
                """
                INSERT INTO dispositivos (
                    id_dispositivo, id_usuario, codigo, nombre, mac_address, tipo,
                    ubicacion_id, ubicacion, estado, firmware_version, creado_por
                )
                VALUES (%s, 1, %s, 'Dispositivo ACID Test', %s, 'ESP32', %s, 'Laboratorio', 'ACTIVO', 'v1.0', 'admin@simoa.org')
                """,
                (dev_id, f"COD-{dev_id[-6:]}", f"AA:BB:CC:{dev_id[-2:]}:{dev_id[-4:-2]}:EE", ubi_id),
            )
            # 2. Excepción simulada antes del commit
            raise RuntimeError("Fallo simulado a mitad de transacción")

    # Verificamos que el ROLLBACK total se haya ejecutado: el dispositivo NO debe existir
    with db_cursor() as cursor:
        cursor.execute("SELECT id_dispositivo FROM dispositivos WHERE id_dispositivo = %s", (dev_id,))
        result = cursor.fetchone()
        assert result is None, "El registro del dispositivo no se revirtió; fallo en atomicidad ACID!"


def test_rnf07_foreign_key_on_delete_restrict_prevents_orphan_sensors():
    """
    RNF-07: Las restricciones FOREIGN KEY deben impedir el borrado de registros padre
    cuando existen dependencias hijas (ON DELETE RESTRICT), impidiendo registros huérfanos.
    """
    dev_id = f"dev-acid-fk-{uuid.uuid4().hex[:6]}"
    sen_id = f"sen-acid-fk-{uuid.uuid4().hex[:6]}"
    mac = f"02:00:00:{uuid.uuid4().hex[:2]}:{uuid.uuid4().hex[:2]}:{uuid.uuid4().hex[:2]}"

    with db_cursor() as cursor:
        # Crear dispositivo
        cursor.execute(
            """
            INSERT INTO dispositivos (
                id_dispositivo, id_usuario, codigo, nombre, mac_address, tipo,
                ubicacion_id, ubicacion, estado, firmware_version, creado_por
            )
            VALUES (%s, 1, %s, 'Device Parent FK', %s, 'ESP32', 'ubi-lab-01', 'Laboratorio', 'ACTIVO', 'v1.0', 'admin@simoa.org')
            """,
            (dev_id, f"FK-{dev_id[-6:]}", mac),
        )
        # Crear sensor vinculado (tabla hija)
        cursor.execute(
            """
            INSERT INTO sensores (
                id_sensor, dispositivo_id, identificador, modelo, variables_medidas,
                fecha_instalacion, ultima_calibracion, estado
            )
            VALUES (%s, %s, %s, 'DHT22', '[]', '2026-01-01', '2026-01-01', 'ACTIVO')
            """,
            (sen_id, dev_id, f"IDEN-{sen_id[-6:]}"),
        )

    # Intentar eliminar el dispositivo padre teniendo un sensor dependiente
    with pytest.raises(pymysql.err.IntegrityError) as exc_info:
        with db_cursor() as cursor:
            cursor.execute("DELETE FROM dispositivos WHERE id_dispositivo = %s", (dev_id,))

    assert "foreign key constraint fails" in str(exc_info.value).lower() or "1451" in str(exc_info.value)

    # Limpieza limpia en orden inverso (hijo primero, luego padre)
    with db_cursor() as cursor:
        cursor.execute("DELETE FROM sensores WHERE id_sensor = %s", (sen_id,))
        cursor.execute("DELETE FROM dispositivos WHERE id_dispositivo = %s", (dev_id,))


def test_rnf07_zero_orphan_records_in_database():
    """
    RNF-07: Consulta de integridad referencial para verificar que no existen registros huérfanos
    en ninguna tabla dependiente del sistema.
    """
    with db_cursor() as cursor:
        # 1. Sensores sin dispositivo existente
        cursor.execute(
            """
            SELECT COUNT(*) AS orphans
            FROM sensores s
            LEFT JOIN dispositivos d ON s.dispositivo_id = d.id_dispositivo
            WHERE d.id_dispositivo IS NULL
            """
        )
        assert cursor.fetchone()["orphans"] == 0, "Existen sensores huérfanos sin dispositivo padre!"

        # 2. Mediciones sin dispositivo existente
        cursor.execute(
            """
            SELECT COUNT(*) AS orphans
            FROM mediciones m
            LEFT JOIN dispositivos d ON m.dispositivo_id = d.id_dispositivo
            WHERE d.id_dispositivo IS NULL
            """
        )
        assert cursor.fetchone()["orphans"] == 0, "Existen mediciones huérfanas sin dispositivo padre!"

        # 3. Historial de ubicaciones sin dispositivo existente
        cursor.execute(
            """
            SELECT COUNT(*) AS orphans
            FROM historial_ubicaciones h
            LEFT JOIN dispositivos d ON h.dispositivo_id = d.id_dispositivo
            WHERE d.id_dispositivo IS NULL
            """
        )
        assert cursor.fetchone()["orphans"] == 0, "Existen registros de historial huérfanos!"
