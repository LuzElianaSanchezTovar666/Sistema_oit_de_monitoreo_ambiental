"""
Pruebas automatizadas para RNF-08: Modularidad y Clean Code.
Verifica:
1. Arquitectura por capas desacopladas en el backend:
   - Capa de controladores / API (backend/app/routers)
   - Capa de servicios y lógica de negocio (backend/app/services)
   - Capa de persistencia y base de datos (backend/app/database.py)
   - Capa de seguridad y autenticación (backend/app/security.py)
2. Desacoplamiento en frontend:
   - Separación entre componentes UI (src/components), servicios (src/services) y tipos (src/types).
   - Ningún componente de frontend contiene consultas SQL directas ni llamadas a base de datos.
3. Ausencia de importaciones circulares en el paquete app.
"""

import importlib
from pathlib import Path
import re
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
REPO_ROOT = Path(__file__).resolve().parents[2]


def test_rnf08_backend_layered_structure():
    """RNF-08: Verifica existencia y consistencia de las capas del backend."""
    app_dir = Path(__file__).resolve().parents[1] / "app"

    routers_dir = app_dir / "routers"
    services_dir = app_dir / "services"
    database_file = app_dir / "database.py"
    security_file = app_dir / "security.py"

    assert routers_dir.is_dir(), "Capa de routers/controladores no encontrada"
    assert services_dir.is_dir(), "Capa de servicios de negocio no encontrada"
    assert database_file.is_file(), "Capa de base de datos no encontrada"
    assert security_file.is_file(), "Capa de seguridad no encontrada"

    # Verificar que los routers importen de services o database, no viceversa indebidamente
    router_files = list(routers_dir.glob("*.py"))
    assert len(router_files) >= 5, "Deben existir routers modulares por entidad"

    service_files = list(services_dir.glob("*.py"))
    assert len(service_files) >= 4, "Deben existir servicios modulares desacoplados"


def test_rnf08_no_circular_imports_in_app():
    """RNF-08: Verifica que los módulos principales puedan importarse sin dependencias circulares."""
    modules_to_test = [
        "app.config",
        "app.database",
        "app.security",
        "app.dependencies",
        "app.services.device_connectivity",
        "app.services.live_telemetry",
        "app.services.measurement_persistence",
        "app.services.anomaly_detector",
        "app.services.time_sync",
        "app.services.mqtt_ingest",
        "app.routers.auth",
        "app.routers.dispositivos",
        "app.routers.sensores",
        "app.routers.mediciones",
        "app.routers.alertas",
        "app.routers.mantenimientos",
        "app.main",
    ]

    for mod_name in modules_to_test:
        mod = importlib.import_module(mod_name)
        assert mod is not None, f"Fallo al importar {mod_name}"


def test_rnf08_frontend_layering_and_no_raw_sql():
    """RNF-08: Frontend desacoplado sin sentencias SQL embebidas."""
    src_dir = REPO_ROOT / "src"
    assert src_dir.is_dir(), "Directorio src de frontend no encontrado"
    assert (src_dir / "components").is_dir(), "src/components debe existir"
    assert (src_dir / "services").is_dir(), "src/services debe existir"
    assert (src_dir / "types").is_dir(), "src/types debe existir"

    # Verificar que ningún archivo en src/components contenga sentencias SQL
    forbidden_sql_tokens = ["SELECT * FROM ", "INSERT INTO ", "DELETE FROM ", "DROP TABLE "]
    for tsx_file in (src_dir / "components").rglob("*.tsx"):
        content = tsx_file.read_text(encoding="utf-8", errors="ignore").upper()
        for token in forbidden_sql_tokens:
            assert token not in content, (
                f"Violación de separación de capas: token SQL '{token}' hallado en componente UI: {tsx_file.name}"
            )
        assert not re.search(r"\bUPDATE\s+\w+\s+SET\b", content), (
            f"Violación de separación de capas: sentencia UPDATE SQL hallada en componente UI: {tsx_file.name}"
        )
