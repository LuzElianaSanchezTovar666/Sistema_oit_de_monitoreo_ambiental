"""
Script para registrar/actualizar los usuarios demo de los 4 roles de SIMOA:
1. Administrador: admin@simoa.org / AdminPassword123!
2. Técnico: tecnico@simoa.org / TecnicoPassword123!
3. Operador: operador@simoa.org / OperadorPassword123!
4. Supervisor: supervisor@simoa.org / SupervisorPassword123!
"""

from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import db_cursor, run_migrations
from app.security import hash_password

DEMO_USERS = [
    {
        "nombre": "Administrador SIMOA",
        "correo": "admin@simoa.org",
        "password": "AdminPassword123!",
        "rol": "Administrador",
    },
    {
        "nombre": "Técnico de Mantenimiento",
        "correo": "tecnico@simoa.org",
        "password": "TecnicoPassword123!",
        "rol": "Técnico",
    },
    {
        "nombre": "Operador de Monitoreo",
        "correo": "operador@simoa.org",
        "password": "OperadorPassword123!",
        "rol": "Operador",
    },
    {
        "nombre": "Supervisor de Operaciones",
        "correo": "supervisor@simoa.org",
        "password": "SupervisorPassword123!",
        "rol": "Supervisor",
    },
    # 3 Administradores adicionales
    {"nombre": "Administrador Zona Norte", "correo": "admin2@simoa.org", "password": "Admin2Pass123!", "rol": "Administrador"},
    {"nombre": "Administrador Zona Sur", "correo": "admin3@simoa.org", "password": "Admin3Pass123!", "rol": "Administrador"},
    {"nombre": "Administrador de Seguridad", "correo": "admin4@simoa.org", "password": "Admin4Pass123!", "rol": "Administrador"},
    # 3 Técnicos adicionales
    {"nombre": "Técnico de Sensores", "correo": "tecnico2@simoa.org", "password": "Tecnico2Pass123!", "rol": "Técnico"},
    {"nombre": "Técnico de Climatización", "correo": "tecnico3@simoa.org", "password": "Tecnico3Pass123!", "rol": "Técnico"},
    {"nombre": "Técnico de Fertirriego", "correo": "tecnico4@simoa.org", "password": "Tecnico4Pass123!", "rol": "Técnico"},
    # 3 Operadores adicionales
    {"nombre": "Operador Turno Mañana", "correo": "operador2@simoa.org", "password": "Operador2Pass123!", "rol": "Operador"},
    {"nombre": "Operador Turno Tarde", "correo": "operador3@simoa.org", "password": "Operador3Pass123!", "rol": "Operador"},
    {"nombre": "Operador Turno Noche", "correo": "operador4@simoa.org", "password": "Operador4Pass123!", "rol": "Operador"},
    # 3 Supervisores adicionales
    {"nombre": "Supervisor de Calidad", "correo": "supervisor2@simoa.org", "password": "Supervisor2Pass123!", "rol": "Supervisor"},
    {"nombre": "Supervisor de Cultivos", "correo": "supervisor3@simoa.org", "password": "Supervisor3Pass123!", "rol": "Supervisor"},
    {"nombre": "Supervisor de Turno", "correo": "supervisor4@simoa.org", "password": "Supervisor4Pass123!", "rol": "Supervisor"},
]


def seed_demo_users() -> None:
    run_migrations()
    print("[SEED] Sembrando usuarios demo para cada rol en SIMOA...")

    with db_cursor() as cursor:
        for u in DEMO_USERS:
            pw_hash = hash_password(u["password"])
            cursor.execute("SELECT id_usuario FROM usuarios WHERE correo = %s", (u["correo"],))
            row = cursor.fetchone()

            if row is None:
                cursor.execute(
                    """
                    INSERT INTO usuarios (nombre, correo, password_hash, rol, estado)
                    VALUES (%s, %s, %s, %s, 'activo')
                    """,
                    (u["nombre"], u["correo"], pw_hash, u["rol"]),
                )
                print(f" [+] Creado: {u['rol']:13} -> {u['correo']} (Pass: {u['password']})")
            else:
                cursor.execute(
                    """
                    UPDATE usuarios
                    SET nombre = %s, password_hash = %s, rol = %s, estado = 'activo'
                    WHERE correo = %s
                    """,
                    (u["nombre"], pw_hash, u["rol"], u["correo"]),
                )
                print(f" [✓] Actualizado: {u['rol']:13} -> {u['correo']} (Pass: {u['password']})")

    print("[SEED] Sembrado completado exitosamente.")


if __name__ == "__main__":
    seed_demo_users()
