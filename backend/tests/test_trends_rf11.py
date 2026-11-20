from datetime import datetime, timedelta, timezone
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
    email = "admin.rf11@simoa-ejemplo.org"
    pwd = "AdminPass123!"
    pwd_hash = hash_password(pwd)
    with db_cursor() as cursor:
        cursor.execute("SELECT id_usuario FROM usuarios WHERE correo = %s LIMIT 1", (email,))
        if cursor.fetchone() is None:
            cursor.execute(
                """
                INSERT INTO usuarios (id_usuario, nombre, correo, password_hash, rol, estado)
                VALUES (%s, %s, %s, %s, 'Administrador', 'activo')
                """,
                (f"usr-{uuid.uuid4().hex[:8]}", "Admin RF11", email, pwd_hash),
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
            "nombre": f"Recinto RF11 {suffix}",
            "codigo_area": f"RF11-{suffix}",
            "tipo": "Laboratorio",
            "descripcion": "Recinto prueba RF-11",
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
            "nombre": f"Nodo RF11 {suffix}",
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
            "identificador": f"SEN-RF11-{suffix}",
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


def test_rf11_tendencias_cronologia_umbrales_anomalias_reduccion_y_seguridad(monkeypatch):
    with TestClient(app) as client:
        # 1. Seguridad sin token -> 401
        assert client.get("/api/mediciones/tendencias").status_code == 401

        headers = _ensure_admin_and_login(client)
        uid = uuid.uuid4().hex[:4].upper()
        loc1, dev1, sen1 = _create_loc_dev_sensor(client, headers, uid)

        # 2. Cero mediciones -> serie vacía + límites reales presentes
        zero_res = client.get(f"/api/mediciones/tendencias?sensor_id={sen1}", headers=headers)
        assert zero_res.status_code == 200, zero_res.text
        assert zero_res.json()["total_original"] == 0
        assert zero_res.json()["series"] == []
        assert zero_res.json()["limites"]["temperatura"]["min"] == 18.0
        assert zero_res.json()["limites"]["humedad"]["max"] == 70.0

        # 3. Una sola medición -> total_retornados == 1
        base_dt = datetime(2026, 9, 1, 10, 0, 0, tzinfo=timezone.utc)
        measurement_persister.persist_event(
            {
                "dispositivo_id": dev1,
                "sensor_id": sen1,
                "ubicacion_id": loc1,
                "magnitudes": {"temperatura": 21.5, "humedad": 55.0},
                "captured_at": base_dt,
            }
        )
        one_res = client.get(f"/api/mediciones/tendencias?sensor_id={sen1}", headers=headers).json()
        assert one_res["total_retornados"] == 1
        assert one_res["anomalias_ia_disponibles"] is False

        # 4. Gran volumen (220 puntos) incluyendo fuera de umbral y anomalía IA dentro de rango
        with db_cursor() as cursor:
            rows_to_insert = []
            for i in range(1, 220):
                dt = (base_dt + timedelta(minutes=i)).replace(tzinfo=None)
                temp = 21.0 + (i % 5) * 0.2
                hum = 52.0 + (i % 6) * 0.5
                fuera = 0
                score_ia = None
                if i == 50:
                    temp = 29.8  # Extremo y fuera de umbral
                    fuera = 1
                elif i == 120:
                    temp = 22.0  # Dentro de umbral pero anómalo por IA RF-18
                    score_ia = 0.89
                rows_to_insert.append(
                    (dev1, sen1, loc1, temp, hum, 0, fuera, score_ia, f"rf11-{uid}-{i}", dt)
                )
            cursor.executemany(
                """
                INSERT INTO mediciones (
                  dispositivo_id, sensor_id, ubicacion_id, temperatura, humedad,
                  alerta_generada, es_fuera_de_umbral, score_anomalia_ia, clave_idempotencia, fecha_hora
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                rows_to_insert,
            )

        # Consultar con max_points=60 -> debe reducir volumen preservando extremo (29.8°C) y anomalía IA (0.89)
        trend_res = client.get(
            f"/api/mediciones/tendencias?ubicacion_id={loc1}&dispositivo_id={dev1}&sensor_id={sen1}&max_points=60",
            headers=headers,
        ).json()
        assert trend_res["total_original"] == 220
        assert trend_res["reducido"] is True
        assert trend_res["total_retornados"] < 220
        assert trend_res["anomalias_ia_disponibles"] is True

        series = trend_res["series"]
        # Orden cronológico estricto
        timestamps = [p["fecha_hora_utc"] for p in series]
        assert timestamps == sorted(timestamps)

        # Verificar que el pico fuera de rango (29.8) y la anomalía IA (0.89) fueron preservados
        assert any(p["temperatura"] == 29.8 and p["es_fuera_de_umbral"] is True for p in series)
        assert any(
            p["es_anomalia_ia"] is True and p["score_anomalia_ia"] == 0.89 and p["es_fuera_de_umbral"] is False
            for p in series
        )

        # Rechazo de fechas inválidas
        bad_res = client.get(
            "/api/mediciones/tendencias?fecha_inicio=2026-09-05&fecha_fin=2026-09-01",
            headers=headers,
        )
        assert bad_res.status_code == 400
        assert bad_res.json()["detail"] == "La fecha inicial no puede ser mayor a la final"

        # Sin límites configurados -> motivo informativo sin inventar límites
        with db_cursor() as cursor:
            cursor.execute("DELETE FROM umbrales_alerta WHERE sensor_id = %s", (sen1,))
        nolim = client.get(f"/api/mediciones/tendencias?sensor_id={sen1}", headers=headers).json()
        assert nolim["limites"]["temperatura"]["min"] is None
        assert nolim["limites"]["temperatura"]["motivo"] is not None

        # Error MySQL controlado -> 503
        def _broken():
            raise pymysql.err.OperationalError(2003, "Lost connection")

        monkeypatch.setattr(mediciones_router, "db_cursor", _broken)
        assert client.get("/api/mediciones/tendencias", headers=headers).status_code == 503
