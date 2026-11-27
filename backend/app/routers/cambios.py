from typing import Any

from fastapi import APIRouter, Depends

from ..database import db_cursor
from ..dependencies import require_roles

router = APIRouter(prefix="/api/cambios", tags=["Sincronización de datos"])


@router.get("", summary="Consulta las versiones del inventario y de las mediciones")
def list_revisions(
    user: dict[str, Any] = Depends(require_roles("Administrador", "Operador", "Técnico", "Supervisor")),
) -> dict[str, str]:
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT recurso, version FROM revisiones_datos
            WHERE recurso <> 'alertas' OR %s IN ('Administrador', 'Operador', 'Supervisor')
            """,
            (user["rol"],),
        )
        versions = {row["recurso"]: str(row["version"]) for row in cursor.fetchall()}
        cursor.execute("SELECT COALESCE(MAX(id_medicion), 0) AS id FROM mediciones")
        versions["mediciones"] = str(cursor.fetchone()["id"])
    return versions
