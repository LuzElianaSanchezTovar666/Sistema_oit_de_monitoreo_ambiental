#!/usr/bin/env python3
"""
Script de respaldo automatizado de base de datos MySQL para SIMOA (RNF-11).
Características:
- Respaldo lógico completo de la base de datos (DDL y DML).
- Compresión en formato .sql.gz mediante gzip.
- Generación de suma de comprobación SHA-256 para verificación criptográfica de integridad.
- Verificación automática de integridad post-generación.
- Política de rotación automática (purga de respaldos con antigüedad mayor a N días).
- Seguridad de credenciales: lectura desde variables de entorno o app.config (nunca expuestas en argv).
"""

import argparse
from datetime import datetime, timezone, timedelta
import gzip
import hashlib
import os
from pathlib import Path
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

# Agregar raíz de backend al sys.path para reutilizar configuración si está disponible
CURRENT_DIR = Path(__file__).resolve().parent
REPO_ROOT = CURRENT_DIR.parent
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    from app.config import get_settings
    _SETTINGS = get_settings()
    DEFAULT_HOST = _SETTINGS.db_host
    DEFAULT_PORT = _SETTINGS.db_port
    DEFAULT_USER = _SETTINGS.db_user
    DEFAULT_PASS = _SETTINGS.db_password
    DEFAULT_NAME = _SETTINGS.db_name
except Exception:
    DEFAULT_HOST = os.environ.get("DB_HOST", "127.0.0.1")
    DEFAULT_PORT = int(os.environ.get("DB_PORT", "3306"))
    DEFAULT_USER = os.environ.get("DB_USER", "root")
    DEFAULT_PASS = os.environ.get("DB_PASSWORD", "")
    DEFAULT_NAME = os.environ.get("DB_NAME", "simoa")

import pymysql


def compute_sha256(file_path: Path) -> str:
    """Calcula el hash SHA-256 de un archivo en bloques para no saturar memoria."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def verify_backup(backup_gz_path: Path, sha256_path: Optional[Path] = None) -> bool:
    """Verifica que el archivo .gz exista, sea descomprimible y coincida con su hash SHA-256."""
    if not backup_gz_path.exists():
        return False

    # 1. Verificar hash SHA-256 si existe archivo .sha256
    expected_hash_path = sha256_path or backup_gz_path.with_suffix(".gz.sha256")
    if expected_hash_path.exists():
        expected_hash = expected_hash_path.read_text(encoding="utf-8").strip().split()[0]
        actual_hash = compute_sha256(backup_gz_path)
        if actual_hash.lower() != expected_hash.lower():
            return False

    # 2. Verificar integridad del archivo gzip descomprimiendo el flujo
    try:
        with gzip.open(backup_gz_path, "rb") as f_gz:
            while f_gz.read(65536):
                pass
        return True
    except Exception:
        return False


def rotate_backups(backup_dir: Path, retention_days: int = 7) -> List[Path]:
    """Elimina respaldos más antiguos que el período de retención especificado."""
    purged: List[Path] = []
    if not backup_dir.exists():
        return purged

    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    for gz_file in backup_dir.glob("simoa_backup_*.sql.gz"):
        mtime = datetime.fromtimestamp(gz_file.stat().st_mtime, tz=timezone.utc)
        if mtime < cutoff:
            gz_file.unlink(missing_ok=True)
            sha_file = gz_file.with_name(f"{gz_file.name}.sha256")
            sha_file.unlink(missing_ok=True)
            purged.append(gz_file)
    return purged


def perform_mysql_backup(
    output_dir: Optional[Path] = None,
    host: str = DEFAULT_HOST,
    port: int = DEFAULT_PORT,
    user: str = DEFAULT_USER,
    password: str = DEFAULT_PASS,
    database: str = DEFAULT_NAME,
    retention_days: int = 7,
) -> Tuple[Path, Path, str]:
    """
    Ejecuta el respaldo lógico de MySQL, comprimido con gzip, generando suma SHA-256.
    Devuelve (backup_gz_path, sha256_path, sha256_hex).
    """
    out_dir = output_dir or (REPO_ROOT / "backups")
    out_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    backup_filename = f"simoa_backup_{timestamp}.sql.gz"
    backup_path = out_dir / backup_filename
    sha256_path = out_dir / f"{backup_filename}.sha256"

    # Conectar a MySQL de forma segura
    conn = pymysql.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.Cursor,
    )

    try:
        with gzip.open(backup_path, "wt", encoding="utf-8") as gz:
            gz.write(f"-- SIMOA Database Backup (RNF-11)\n")
            gz.write(f"-- Fecha de generación (UTC): {timestamp}\n")
            gz.write(f"-- Base de datos: {database}\n")
            gz.write("SET FOREIGN_KEY_CHECKS = 0;\n\n")

            with conn.cursor() as cursor:
                cursor.execute("SHOW TABLES")
                tables = [row[0] for row in cursor.fetchall()]

                for table in tables:
                    gz.write(f"-- Estructura de tabla `{table}`\n")
                    gz.write(f"DROP TABLE IF EXISTS `{table}`;\n")
                    cursor.execute(f"SHOW CREATE TABLE `{table}`")
                    create_stmt = cursor.fetchone()[1]
                    gz.write(f"{create_stmt};\n\n")

                    # Volcar datos
                    cursor.execute(f"SELECT * FROM `{table}`")
                    rows = cursor.fetchall()
                    if rows:
                        gz.write(f"-- Datos para tabla `{table}` ({len(rows)} registros)\n")
                        for row in rows:
                            escaped_vals = [conn.escape(val) for val in row]
                            gz.write(f"INSERT INTO `{table}` VALUES ({', '.join(escaped_vals)});\n")
                        gz.write("\n")

            gz.write("SET FOREIGN_KEY_CHECKS = 1;\n")
            gz.write("-- Fin del respaldo\n")
    finally:
        conn.close()

    # Generar hash SHA-256
    sha256_hex = compute_sha256(backup_path)
    sha256_path.write_text(f"{sha256_hex}  {backup_filename}\n", encoding="utf-8")

    # Ejecutar rotación de respaldos antiguos
    rotate_backups(out_dir, retention_days=retention_days)

    return backup_path, sha256_path, sha256_hex


def main() -> int:
    parser = argparse.ArgumentParser(description="Respaldo automatizado de MySQL para SIMOA (RNF-11)")
    parser.add_argument("--output-dir", type=Path, default=None, help="Directorio destino de respaldos")
    parser.add_argument("--retention-days", type=int, default=7, help="Días de retención antes de purga")
    parser.add_argument("--verify", action="store_true", help="Verificar integridad inmediatamente tras respaldo")
    args = parser.parse_args()

    print(f"[RNF-11] Iniciando respaldo de base de datos MySQL '{DEFAULT_NAME}'...")
    try:
        gz_path, sha_path, sha_hex = perform_mysql_backup(
            output_dir=args.output_dir,
            retention_days=args.retention_days,
        )
        print(f"[RNF-11] Respaldo generado con éxito:")
        print(f"         Archivo: {gz_path.name} ({gz_path.stat().st_size} bytes)")
        print(f"         SHA-256: {sha_hex}")
        print(f"         Checksum: {sha_path.name}")

        if args.verify:
            ok = verify_backup(gz_path, sha_path)
            if ok:
                print("[RNF-11] Verificación de integridad SHA-256 y descompresión GZIP: EXITOSA.")
            else:
                print("[RNF-11] ERROR: Falló la verificación de integridad del respaldo.")
                return 1
        return 0
    except Exception as exc:
        print(f"[RNF-11] ERROR en respaldo de base de datos: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
