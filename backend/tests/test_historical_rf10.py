from datetime import datetime, timezone
import os
from pathlib import Path
import sys
import uuid

from fastapi.testclient import TestClient
import pymysql

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DB_HOST", "127.0.0.1")
os.environ.setdefault("DB_PORT", "3306")
os.environ.setdefault("DB_USER", "root")
os.environ.setdefault("DB_PASSWORD", "")
os.environ.setdefault("DB_NAME", "simoa")

from app.database import db_cursor  # noqa: E402
from app.main import app  # noqa: E402
import app.routers.mediciones as mediciones_router  # noqa: E402
from app.security import hash_password  # noqa: E402
from app.services.measurement_persistence import measurement_persister  # noqa: E402


def _ensure_admin_and_login(client: TestClient) -> dict:
    email = "admin.rf10@simoa-ejemplo.org"
    pwd = "AdminPass123!"
    pwd_hash = hash_password(pwd)
    with db_cursor() as cursor:
        cursor.execute("SELECT id_usuario FROM usuarios WHERE correo = %s LIMIT 1", (email,))
        if cursor.fetchone() is None:
            cursor.execute(
                """
                INSERT INTO usuarios (nombre, correo, password_hash, rol, estado)
                VALUES (%s, %s, %s, 'Administrador', 'activo')
                """,
                ("Admin RF10", email, pwd_hash),
            )
        else:
            cursor.execute(
                "UPDATE usuarios SET password_hash = %s, rol = 'Administrador', estado = 'activo' WHERE correo = %s",
                (pwd_hash, email),
            )
    res = client.post("/api/auth/login", json={"correo": email, "password": pwd})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def _create_loc_dev_sensor(client: TestClient, headers: dict, suffix: str):
    loc_res = client.post(
        "/api/ubicaciones",
        headers=headers,
        json={
            "nombre": f"Recinto RF10 {suffix}",
            "codigo_area": f"RF10-{suffix}",
            "tipo": "Laboratorio",
            "descripcion": "Recinto prueba RF-10",
        },
    )
    assert loc_res.status_code == 201, loc_res.text
    loc_id = loc_res.json()["ubicacion"]["ubicacion_id"]

    raw_mac = uuid.uuid4().bytes[:6]
    mac = ":".join(f"{b:02X}" for b in raw_mac)
    dev_res = client.post(
        "/api/dispositivos",
        headers=headers,
        json={
            "nombre": f"Nodo RF10 {suffix}",
            "tipo": "ESP32",
            "firmware_version": "v2.4.1",
            "mac_address": mac,
            "ubicacion_id": loc_id,
        },
    )
    assert dev_res.status_code == 201, dev_res.text
    dev = dev_res.json()["dispositivo"]

    sen_res = client.post(
        "/api/sensores",
        headers=headers,
        json={
            "dispositivo_id": dev["id_dispositivo"],
            "identificador": f"SEN-RF10-{suffix}",
            "modelo": "DHT22",
            "variables": ["temperatura", "humedad"],
            "fecha_instalacion": "2026-02-01",
            "ultima_calibracion": "2026-02-05",
            "estado": "ACTIVO",
        },
    )
    assert sen_res.status_code == 201, sen_res.text
    sen_id = sen_res.json()["sensor"]["id_sensor"]
    return loc_id, dev["id_dispositivo"], sen_id


def test_rf10_historico_filtros_paginacion_estadisticas_fechas_y_seguridad(monkeypatch):
    with TestClient(app) as client:
        # Seguridad: sin token rechaza con 401
        assert client.get("/api/mediciones/historico").status_code == 401

        headers = _ensure_admin_and_login(client)
        uid1 = uuid.uuid4().hex[:4].upper()
        loc1, dev1, sen1 = _create_loc_dev_sensor(client, headers, uid1)

        # Insertar 5 mediciones controladas (3 conformes, 1 fuera de umbral, 1 no evaluable)
        # Día 2026-10-10 en UTC-5 (tz_offset=300): 2026-10-11T04:30:00Z corresponde a 2026-10-10 23:30:00 local!
        samples = [
            (20.0, 50.0, datetime(2026, 10, 10, 12, 0, 0, tzinfo=timezone.utc)),  # Conforme
            (22.0, 55.0, datetime(2026, 10, 10, 14, 0, 0, tzinfo=timezone.utc)),  # Conforme
            (24.0, 60.0, datetime(2026, 10, 10, 16, 0, 0, tzinfo=timezone.utc)),  # Conforme
            (29.0, 80.0, datetime(2026, 10, 11, 4, 30, 0, tzinfo=timezone.utc)),  # Fuera de umbral (2026-10-10 23:30 local)
        ]
        for temp, hum, dt in samples:
            ok, _id, _dup = measurement_persister.persist_event(
                {
                    "dispositivo_id": dev1,
                    "sensor_id": sen1,
                    "ubicacion_id": loc1,
                    "magnitudes": {"temperatura": temp, "humedad": hum},
                    "captured_at": dt,
                }
            )
            assert ok is True

        # 5ta medición sin umbrales (No evaluable) el día 2026-10-11
        with db_cursor() as cursor:
            cursor.execute("DELETE FROM umbrales_alerta WHERE sensor_id = %s", (sen1,))
        ok5, _id5, _dup5 = measurement_persister.persist_event(
            {
                "dispositivo_id": dev1,
                "sensor_id": sen1,
                "ubicacion_id": loc1,
                "magnitudes": {"temperatura": 21.0, "humedad": 52.0},
                "captured_at": datetime(2026, 10, 11, 15, 0, 0, tzinfo=timezone.utc),
            }
        )
        assert ok5 is True

        # 1. Rechazo fecha_inicio > fecha_fin con mensaje exacto
        bad_range = client.get(
            "/api/mediciones/historico?fecha_inicio=2026-10-12&fecha_fin=2026-10-10",
            headers=headers,
        )
        assert bad_range.status_code == 400
        assert bad_range.json()["detail"] == "La fecha inicial no puede ser mayor a la final"

        # Rechazo formato de fecha inválido y page_size > 100
        assert client.get("/api/mediciones/historico?fecha_inicio=fecha-mala", headers=headers).status_code == 400
        assert client.get("/api/mediciones/historico?page_size=101", headers=headers).status_code == 422

        # 2. Inclusión correcta del último día en UTC-5 (tz_offset_minutes=300)
        # El 2026-10-10 local incluye hasta 2026-10-11 04:59:59Z -> debe incluir las 4 primeras pero NO la de 15:00Z!
        day10_res = client.get(
            f"/api/mediciones/historico?ubicacion_id={loc1}&fecha_inicio=2026-10-10&fecha_fin=2026-10-10&tz_offset_minutes=300",
            headers=headers,
        )
        assert day10_res.status_code == 200, day10_res.text
        assert day10_res.json()["total_records"] == 4

        # 3. Paginación en backend (page_size=2 sobre 5 registros => 3 páginas) + estadísticas sobre TODOS los 5 filtrados
        p1 = client.get(
            f"/api/mediciones/historico?ubicacion_id={loc1}&dispositivo_id={dev1}&sensor_id={sen1}&page=1&page_size=2",
            headers=headers,
        ).json()
        assert p1["page"] == 1
        assert p1["page_size"] == 2
        assert p1["total_records"] == 5
        assert p1["total_pages"] == 3
        assert len(p1["items"]) == 2
        # Orden cronológico descendente
        assert p1["items"][0]["fecha_hora_utc"] > p1["items"][1]["fecha_hora_utc"]

        # Estadísticas sobre los 5 registros filtrados (no solo los 2 de la página 1)
        st = p1["estadisticas"]
        assert st["total_registros_filtrados"] == 5
        assert st["temperatura"]["minimo"] == 20.0
        assert st["temperatura"]["maximo"] == 29.0
        assert st["temperatura"]["promedio"] == 23.2
        assert st["temperatura"]["desviacion_estandar"] is not None and st["temperatura"]["desviacion_estandar"] > 0
        assert st["humedad"]["minimo"] == 50.0
        assert st["humedad"]["maximo"] == 80.0
        assert st["humedad"]["promedio"] == 59.4
        # Cumplimiento: 3 conformes de 4 evaluables (la 5ta es No evaluable) => 75.0%
        assert st["cumplimiento"]["mediciones_evaluables"] == 4
        assert st["cumplimiento"]["mediciones_conformes"] == 3
        assert st["cumplimiento"]["porcentaje"] == 75.0

        # 4. Consulta vacía
        empty_res = client.get(
            f"/api/mediciones/historico?sensor_id={sen1}&fecha_inicio=2025-01-01&fecha_fin=2025-01-02",
            headers=headers,
        ).json()
        assert empty_res["total_records"] == 0
        assert empty_res["total_pages"] == 0
        assert empty_res["items"] == []
        assert empty_res["estadisticas"]["temperatura"]["promedio"] is None
        assert empty_res["estadisticas"]["cumplimiento"]["porcentaje"] is None

        # 5. Prevención de inyección SQL
        sqli_res = client.get(
            "/api/mediciones/historico?ubicacion_id=' OR '1'='1",
            headers=headers,
        )
        assert sqli_res.status_code == 200
        assert sqli_res.json()["total_records"] == 0

        # 6. Inmutabilidad RN-09
        assert client.put("/api/mediciones/historico", headers=headers, json={}).status_code == 405
        assert client.delete("/api/mediciones/historico", headers=headers).status_code == 405

        # 7. Manejo controlado de error MySQL (503 sin filtrar secretos)
        def _broken_cursor():
            raise pymysql.err.OperationalError(2003, "Lost connection")

        monkeypatch.setattr(mediciones_router, "db_cursor", _broken_cursor)
        err_res = client.get("/api/mediciones/historico", headers=headers)
        assert err_res.status_code == 503
        assert "base de datos" in err_res.json()["detail"].lower()
