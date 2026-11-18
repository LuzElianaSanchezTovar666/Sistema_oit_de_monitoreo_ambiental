from contextlib import contextmanager
from pathlib import Path
from typing import Generator
import pymysql
from pymysql.cursors import DictCursor
from .config import get_settings


def get_connection(use_database: bool = True) -> pymysql.connections.Connection:
    settings = get_settings()
    kwargs = {
        "host": settings.db_host,
        "port": settings.db_port,
        "user": settings.db_user,
        "password": settings.db_password,
        "charset": "utf8mb4",
        "cursorclass": DictCursor,
        "autocommit": False,
    }
    if use_database:
        kwargs["database"] = settings.db_name
    return pymysql.connect(**kwargs)


@contextmanager
def db_cursor(use_database: bool = True) -> Generator[DictCursor, None, None]:
    conn = get_connection(use_database=use_database)
    try:
        with conn.cursor() as cursor:
            yield cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def run_migrations() -> None:
    migrations_dir = Path(__file__).resolve().parents[1] / "migrations"
    sql_files = sorted(migrations_dir.glob("*.sql"))
    if not sql_files:
        return

    with db_cursor(use_database=False) as cursor:
        for sql_file in sql_files:
            raw_sql = sql_file.read_text(encoding="utf-8")
            statements = [stmt.strip() for stmt in raw_sql.split(";") if stmt.strip()]
            for stmt in statements:
                cursor.execute(stmt)
