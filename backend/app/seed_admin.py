"""Script controlado para registrar el primer usuario Administrador desde variables de entorno."""

import os
import sys

from .database import db_cursor, run_migrations
from .security import hash_password


def seed_initial_admin() -> None:
    name = os.getenv("ADMIN_INIT_NAME", "").strip()
    email = os.getenv("ADMIN_INIT_EMAIL", "").strip().lower()
    password = os.getenv("ADMIN_INIT_PASSWORD", "")

    if not name or not email or not password:
        print(
            "Error: define ADMIN_INIT_NAME, ADMIN_INIT_EMAIL y ADMIN_INIT_PASSWORD en el entorno o .env",
            file=sys.stderr,
        )
        sys.exit(1)

    run_migrations()

    with db_cursor() as cursor:
        cursor.execute(
            "SELECT id_usuario FROM usuarios WHERE rol = 'Administrador' AND estado = 'activo' LIMIT 1 FOR UPDATE"
        )
        if cursor.fetchone():
            print("Ya existe un administrador activo en SIMOA.")
            return

        cursor.execute("SELECT id_usuario FROM usuarios WHERE correo = %s LIMIT 1", (email,))
        existing = cursor.fetchone()
        if existing:
            print(f"El administrador '{email}' ya existe (id={existing['id_usuario']}).")
            return

        cursor.execute(
            """
            INSERT INTO usuarios (nombre, correo, password_hash, rol, estado)
            VALUES (%s, %s, %s, 'Administrador', 'activo')
            """,
            (name, email, hash_password(password)),
        )
        print(f"Administrador inicial creado exitosamente: {email} (id={cursor.lastrowid})")


if __name__ == "__main__":
    seed_initial_admin()
