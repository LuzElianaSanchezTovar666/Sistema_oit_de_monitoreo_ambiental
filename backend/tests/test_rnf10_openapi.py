"""
Pruebas automatizadas para RNF-10: Mantenibilidad y Documentación OpenAPI (Swagger).
Verifica:
1. 100% de los endpoints registrados en FastAPI cuentan con documentación OpenAPI 3.0.
2. Cada endpoint cuenta con summary, tags y esquemas de respuesta definidos.
3. El esquema interactivo OpenAPI (/openapi.json) es accesible y válido.
"""

from pathlib import Path
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app


def test_rnf10_openapi_json_accessible():
    """RNF-10: La especificación OpenAPI 3.0 debe ser servida en /openapi.json."""
    with TestClient(app) as client:
        res = client.get("/openapi.json")
        assert res.status_code == 200
        schema = res.json()
        assert schema.get("openapi", "").startswith("3.")
        assert "info" in schema
        assert "paths" in schema
        assert len(schema["paths"]) > 0


def test_rnf10_100_percent_endpoints_documented():
    """
    RNF-10: El 100% de las rutas públicas y privadas deben contar con
    tags temáticos, summary descriptivo y códigos de respuesta esperados.
    """
    schema = app.openapi()
    paths = schema.get("paths", {})
    assert len(paths) > 0, "No se encontraron rutas en el esquema OpenAPI"

    undocumented_endpoints = []
    total_operations = 0

    for path_key, methods in paths.items():
        for method, operation in methods.items():
            if method.lower() not in ("get", "post", "put", "patch", "delete"):
                continue
            total_operations += 1
            op_summary = operation.get("summary")
            op_tags = operation.get("tags")
            op_responses = operation.get("responses")

            issues = []
            if not op_summary or not op_summary.strip():
                issues.append("Falta summary")
            if not op_tags or len(op_tags) == 0:
                issues.append("Faltan tags")
            if not op_responses or len(op_responses) == 0:
                issues.append("Faltan responses")

            if issues:
                undocumented_endpoints.append((method.upper(), path_key, issues))

    coverage_pct = ((total_operations - len(undocumented_endpoints)) / total_operations) * 100.0
    assert len(undocumented_endpoints) == 0, (
        f"Cobertura OpenAPI ({coverage_pct:.1f}%): Endpoints con documentación incompleta:\n"
        + "\n".join(f"- {m} {p}: {', '.join(iss)}" for m, p, iss in undocumented_endpoints)
    )
