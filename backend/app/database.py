from contextlib import contextmanager
from pathlib import Path
import queue
from typing import Generator
import pymysql
from pymysql.cursors import DictCursor
from .config import get_settings

_DB_POOL: queue.LifoQueue[pymysql.connections.Connection] = queue.LifoQueue(maxsize=12)


def _open_new_connection(use_database: bool = True) -> pymysql.connections.Connection:
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


def get_connection(use_database: bool = True) -> pymysql.connections.Connection:
    if not use_database:
        return _open_new_connection(use_database=False)

    while True:
        try:
            conn = _DB_POOL.get_nowait()
        except queue.Empty:
            return _open_new_connection(use_database=True)
        try:
            conn.ping(reconnect=False)
            return conn
        except Exception:
            try:
                conn.close()
            except Exception:
                pass


def release_connection(conn: pymysql.connections.Connection, broken: bool = False) -> None:
    if broken:
        try:
            conn.close()
        except Exception:
            pass
        return
    try:
        _DB_POOL.put_nowait(conn)
    except queue.Full:
        try:
            conn.close()
        except Exception:
            pass


@contextmanager
def db_cursor(use_database: bool = True) -> Generator[DictCursor, None, None]:
    conn = get_connection(use_database=use_database)
    broken = False
    try:
        with conn.cursor() as cursor:
            yield cursor
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            broken = True
        raise
    finally:
        if not use_database:
            try:
                conn.close()
            except Exception:
                pass
        else:
            release_connection(conn, broken=broken)


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
