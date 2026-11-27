from pathlib import Path
import sys
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import db_cursor, run_migrations
from app.main import app
from app.security import hash_password


def test_site_data_revisions_follow_committed_api_and_sql_changes():
    suffix = uuid4().hex[:8]
    password = "ApiSyncTest123!"
    password_hash = hash_password(password)
    emails = [f"sync-{role}-{suffix}@example.org" for role in ("admin", "tecnico")]

    with TestClient(app) as writer:
        observer = TestClient(app)
        assert observer.get("/api/cambios").status_code == 401
        with db_cursor() as cursor:
            cursor.executemany(
                "INSERT INTO usuarios (nombre, correo, password_hash, rol) VALUES (%s, %s, %s, %s)",
                [
                    ("Prueba de sincronización", emails[0], password_hash, "Administrador"),
                    ("Prueba de permisos", emails[1], password_hash, "Técnico"),
                ],
            )

        location_id = None
        try:
            def login(client, email):
                response = client.post("/api/auth/login", json={"correo": email, "password": password})
                assert response.status_code == 200
                return {"Authorization": f"Bearer {response.json()['access_token']}"}

            admin = login(writer, emails[0])
            technician = login(observer, emails[1])

            def read_revision():
                response = observer.get("/api/cambios", headers=technician)
                assert response.status_code == 200
                assert response.headers["Cache-Control"] == "no-store"
                assert "alertas" not in response.json()
                return int(response.json()["ubicaciones"])

            initial_revision = read_revision()
            creation = writer.post(
                "/api/ubicaciones",
                headers=admin,
                json={"nombre": f"Prueba de sincronización {suffix}", "codigo_area": f"SYNC-{suffix}", "tipo": "Cultivo"},
            )
            assert creation.status_code == 201
            location_id = creation.json()["ubicacion"]["ubicacion_id"]
            assert read_revision() > initial_revision

            committed_revision = read_revision()
            with pytest.raises(RuntimeError, match="rollback"):
                with db_cursor() as cursor:
                    cursor.execute("UPDATE ubicaciones SET nombre = %s WHERE ubicacion_id = %s", ("Cambio temporal", location_id))
                    assert read_revision() == committed_revision
                    raise RuntimeError("rollback")
            assert read_revision() == committed_revision

            renamed = f"Ubicación actualizada {suffix}"
            with db_cursor() as cursor:
                cursor.execute("UPDATE ubicaciones SET nombre = %s WHERE ubicacion_id = %s", (renamed, location_id))
            assert read_revision() > committed_revision
            detail = observer.get(f"/api/ubicaciones/{location_id}", headers=technician)
            assert detail.json()["ubicacion"]["nombre"] == renamed
        finally:
            observer.close()
            with db_cursor() as cursor:
                if location_id:
                    cursor.execute("DELETE FROM ubicaciones WHERE ubicacion_id = %s", (location_id,))
                cursor.execute("DELETE FROM usuarios WHERE correo IN %s", (tuple(emails),))


def test_reapplying_migrations_preserves_edited_default_location():
    run_migrations()
    location_id = "ubi-lab-01"
    with db_cursor() as cursor:
        cursor.execute("SELECT nombre FROM ubicaciones WHERE ubicacion_id = %s", (location_id,))
        original = cursor.fetchone()["nombre"]
        cursor.execute("UPDATE ubicaciones SET nombre = %s WHERE ubicacion_id = %s", ("Zona ajustada", location_id))
    try:
        run_migrations()
        with db_cursor() as cursor:
            cursor.execute("SELECT nombre FROM ubicaciones WHERE ubicacion_id = %s", (location_id,))
            assert cursor.fetchone()["nombre"] == "Zona ajustada"
    finally:
        with db_cursor() as cursor:
            cursor.execute("UPDATE ubicaciones SET nombre = %s WHERE ubicacion_id = %s", (original, location_id))
