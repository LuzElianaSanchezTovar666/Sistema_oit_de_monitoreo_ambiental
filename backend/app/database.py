from contextlib import contextmanager
from pathlib import Path
import queue
import re
from typing import Generator
import pymysql
from pymysql.cursors import DictCursor
from .config import get_settings

_DB_POOL: queue.LifoQueue[pymysql.connections.Connection] = queue.LifoQueue(maxsize=12)
_ALTER_TABLE = re.compile(r"^ALTER TABLE ([`\w]+)\s+", re.IGNORECASE)
_GUARDED_ADD = re.compile(
    r"^ADD (?:(COLUMN|(?:UNIQUE )?(?:KEY|INDEX)|FOREIGN KEY) IF NOT EXISTS ([`\w]+)"
    r"|CONSTRAINT ([`\w]+) FOREIGN KEY IF NOT EXISTS)(?=\s|\()",
    re.IGNORECASE,
)


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


def _execute_mysql_alter(cursor: DictCursor, statement: str) -> None:
    header = _ALTER_TABLE.match(statement)
    if header is None or "IF NOT EXISTS" not in statement.upper():
        cursor.execute(statement)
        return

    table = header[1].strip("`")
    clauses = re.split(r",(?=\s*\n\s*(?:ADD|MODIFY)\s)", statement[header.end():], flags=re.IGNORECASE)
    for raw_clause in clauses:
        clause = raw_clause.strip()
        guarded = _GUARDED_ADD.match(clause)
        if guarded:
            kind, name, constraint = guarded.groups()
            if constraint or kind.upper() == "FOREIGN KEY":
                metadata, identifier = "TABLE_CONSTRAINTS", "CONSTRAINT_NAME"
            elif kind.upper() == "COLUMN":
                metadata, identifier = "COLUMNS", "COLUMN_NAME"
            else:
                metadata, identifier = "STATISTICS", "INDEX_NAME"
            cursor.execute(
                f"SELECT 1 FROM information_schema.{metadata} "
                f"WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND {identifier} = %s LIMIT 1",
                (table, (constraint or name).strip("`")),
            )
            if cursor.fetchone():
                continue
            if kind and kind.upper() == "FOREIGN KEY":
                # MySQL declara el nombre de la restricción por separado del índice.
                clause = f"ADD CONSTRAINT {name} FOREIGN KEY{clause[guarded.end():]}"
            else:
                clause = re.sub(r" IF NOT EXISTS", "", clause, count=1, flags=re.IGNORECASE)
        cursor.execute(f"ALTER TABLE `{table}` {clause}")


def run_migrations() -> None:
    migrations_dir = Path(__file__).resolve().parents[1] / "migrations"
    sql_files = sorted(migrations_dir.glob("*.sql"))
    if not sql_files:
        return

    with db_cursor(use_database=False) as cursor:
        cursor.execute("SELECT VERSION() AS version")
        is_mysql = "mariadb" not in cursor.fetchone()["version"].lower()
        if is_mysql:
            lock_name = f"{get_settings().db_name[:53]}.migrations"
            cursor.execute("SELECT GET_LOCK(%s, 60) AS acquired", (lock_name,))
            if cursor.fetchone()["acquired"] != 1:
                raise RuntimeError("No se pudo obtener el bloqueo de migraciones de MySQL.")
        for sql_file in sql_files:
            raw_sql = sql_file.read_text(encoding="utf-8")
            raw_sql = "\n".join(line for line in raw_sql.splitlines() if not line.lstrip().startswith("--"))
            statements = [stmt.strip() for stmt in raw_sql.split(";") if stmt.strip()]
            for stmt in statements:
                if is_mysql:
                    _execute_mysql_alter(cursor, stmt)
                else:
                    cursor.execute(stmt)
