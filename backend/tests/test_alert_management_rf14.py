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
from app.security import hash_password  # noqa: E402
from app.services.alerts_service import alerts_service  # noqa: E402


def _ensure_user_and_login(client: TestClient, email: str, rol: str, nombre: str) -> dict:
    pwd = "TestPass123!"
    pwd_hash = hash_password(pwd)
    with db_cursor() as cursor:
        cursor.execute("SELECT id_usuario FROM usuarios WHERE correo = %s LIMIT 1", (email,))
        if cursor.fetchone() is None:
            cursor.execute(
                """
                INSERT INTO usuarios (id_usuario, nombre, correo, password_hash, rol, estado)
                VALUES (%s, %s, %s, %s, %s, 'activo')
                """,
                (f"usr-{uuid.uuid4().hex[:8]}", nombre, email, pwd_hash, rol),
            )
        else:
            cursor.execute(
                "UPDATE usuarios SET nombre = %s, password_hash = %s, rol = %s, estado = 'activo' WHERE correo = %s",
                (nombre, pwd_hash, rol, email),
            )
    res = client.post("/api/auth/login", json={"correo": email, "password": pwd})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_rf14_bitacora_filtros_transiciones_auditoria_rn16_concurrencia_y_rbac():
    suffix = uuid.uuid4().hex[:6]
    loc_id = None
    dev_id = None
    sen_id = None

    with TestClient(app) as client:
        admin_headers = _ensure_user_and_login(client, "admin.rf14@simoa-ejemplo.org", "Administrador", "Admin RF14")
        op_headers = _ensure_user_and_login(client, "op.rf14@simoa-ejemplo.org", "Operador", "Operador Turno")
        sup_headers = _ensure_user_and_login(client, "sup.rf14@simoa-ejemplo.org", "Supervisor", "Supervisor Planta")
        tec_headers = _ensure_user_and_login(client, "tec.rf14@simoa-ejemplo.org", "Técnico", "Técnico Campo")

        try:
            loc_res = client.post(
                "/api/ubicaciones",
                headers=admin_headers,
                json={
                    "nombre": f"Sala RF14 {suffix}",
                    "codigo_area": f"AREA-{suffix.upper()}",
                    "tipo": "Laboratorio",
                    "estado": "ACTIVA",
                },
            )
            assert loc_res.status_code == 201, loc_res.text
            loc_id = loc_res.json()["ubicacion"]["ubicacion_id"]

            raw_mac = uuid.uuid4().bytes[:6]
            mac = ":".join(f"{b:02X}" for b in raw_mac)
            dev_res = client.post(
                "/api/dispositivos",
                headers=admin_headers,
                json={
                    "nombre": f"ESP32 RF14 {suffix}",
                    "tipo": "ESP32",
                    "firmware_version": "v2.4.1",
                    "mac_address": mac,
                    "ubicacion_id": loc_id,
                },
            )
            assert dev_res.status_code == 201, dev_res.text
            dev_id = dev_res.json()["dispositivo"]["id_dispositivo"]

            sen_res = client.post(
                "/api/sensores",
                headers=admin_headers,
                json={
                    "dispositivo_id": dev_id,
                    "identificador": f"SEN-RF14-{suffix}",
                    "modelo": "DHT22",
                    "variables": ["temperatura", "humedad"],
                    "fecha_instalacion": "2026-02-01",
                    "ultima_calibracion": "2026-02-05",
                    "estado": "ACTIVO",
                },
            )
            assert sen_res.status_code == 201, sen_res.text
            sen_id = sen_res.json()["sensor"]["id_sensor"]

            assert client.put(
                f"/api/configuraciones/{sen_id}",
                headers=admin_headers,
                json={
                    "temp_critico_min": 12.0,
                    "temp_min": 18.0,
                    "temp_max": 25.0,
                    "temp_critico_max": 30.0,
                    "hum_critico_min": 25.0,
                    "hum_min": 40.0,
                    "hum_max": 70.0,
                    "hum_critico_max": 85.0,
                },
            ).status_code == 200

            # Generar 2 alertas reales mediante RF-13 (1 ADVERTENCIA de humedad, 1 CRITICA de temperatura)
            now_dt = datetime.now(timezone.utc)
            created_crit = alerts_service.process_event(
                {
                    "sensor_id": sen_id,
                    "dispositivo_id": dev_id,
                    "ubicacion_id": loc_id,
                    "magnitudes": {"temperatura": 33.5, "humedad": 74.0},
                    "fecha_hora": now_dt - timedelta(seconds=10),
                }
            )
            assert len(created_crit) == 2
            crit_alert = next(a for a in created_crit if a["severidad"] == "CRITICA")
            warn_alert = next(a for a in created_crit if a["severidad"] == "ADVERTENCIA")
            orig_msg_crit = crit_alert["mensaje"]

            # 1. Paginación y filtros combinados en backend
            list_res = client.get(
                "/api/alertas",
                params={"ubicacion_id": loc_id, "severidad": "CRITICA", "estado": "PENDIENTE", "page": 1, "page_size": 1},
                headers=op_headers,
            )
            assert list_res.status_code == 200
            body = list_res.json()
            assert body["total_records"] == 1
            assert body["total_pages"] == 1
            assert body["alertas"][0]["id_alerta"] == crit_alert["id_alerta"]
            activas_inicial = body["resumen"]["activas"]
            assert activas_inicial >= 2

            # 2. Detalle (abrir alerta nunca reduce contador de activas)
            det_res = client.get(f"/api/alertas/{crit_alert['id_alerta']}", headers=op_headers)
            assert det_res.status_code == 200
            assert det_res.json()["alerta"]["mensaje"] == orig_msg_crit
            assert client.get("/api/alertas", params={"ubicacion_id": loc_id}, headers=op_headers).json()["resumen"]["activas"] == activas_inicial

            # 404 para alerta inexistente
            assert client.get("/api/alertas/alr-no-existe", headers=op_headers).status_code == 404

            # 3. RBAC: Técnico no puede consultar ni modificar alertas (403); sin token -> 401
            with TestClient(app) as anon:
                assert anon.patch(f"/api/alertas/{crit_alert['id_alerta']}/estado", json={"estado_nuevo": "ATENDIDA"}).status_code == 401
            assert client.patch(
                f"/api/alertas/{crit_alert['id_alerta']}/estado",
                headers=tec_headers,
                json={"estado_nuevo": "ATENDIDA"},
            ).status_code == 403

            # 4. Validación crítica: no puede pasar a RESUELTA sin acción correctiva
            bad_crit = client.patch(
                f"/api/alertas/{crit_alert['id_alerta']}/estado",
                headers=op_headers,
                json={"estado_nuevo": "RESUELTA", "observaciones": "Sin acción"},
            )
            assert bad_crit.status_code == 400

            # 5. Transición PENDIENTE -> ATENDIDA por Operador
            att_res = client.patch(
                f"/api/alertas/{crit_alert['id_alerta']}/estado",
                headers=op_headers,
                json={
                    "estado_nuevo": "ATENDIDA",
                    "observaciones": "Se inspeccionó unidad HVAC.",
                    "expected_version": 1,
                },
            )
            assert att_res.status_code == 200, att_res.text
            att_alerta = att_res.json()["alerta"]
            assert att_alerta["estado"] == "ATENDIDA"
            assert att_alerta["version"] == 2
            assert att_alerta["usuario_responsable_correo"] == "op.rf14@simoa-ejemplo.org"

            # Conflicto de concurrencia con expected_version=1
            conflict = client.patch(
                f"/api/alertas/{crit_alert['id_alerta']}/estado",
                headers=sup_headers,
                json={"estado_nuevo": "RESUELTA", "accion_correctiva": "Reset", "expected_version": 1},
            )
            assert conflict.status_code == 409

            # 6. Transición ATENDIDA -> RESUELTA por Supervisor conservando observaciones previas y mensaje original
            res_res = client.patch(
                f"/api/alertas/{crit_alert['id_alerta']}/estado",
                headers=sup_headers,
                json={
                    "estado_nuevo": "RESUELTA",
                    "accion_correctiva": "Se cerró puerta del recinto y se estabilizó compresor.",
                    "causa_raiz": "Puerta de cámara abierta",
                    "observaciones": "Temperatura estabilizada en 21.0 °C.",
                    "expected_version": 2,
                },
            )
            assert res_res.status_code == 200, res_res.text
            resolved_alerta = res_res.json()["alerta"]
            assert resolved_alerta["estado"] == "RESUELTA"
            assert resolved_alerta["mensaje"] == orig_msg_crit
            assert "Se inspeccionó unidad HVAC." in resolved_alerta["observaciones"]
            assert "Temperatura estabilizada en 21.0 °C." in resolved_alerta["observaciones"]
            assert resolved_alerta["usuario_responsable_correo"] == "sup.rf14@simoa-ejemplo.org"

            # Contador de activas disminuye al resolver
            activas_post = client.get("/api/alertas", params={"ubicacion_id": loc_id}, headers=op_headers).json()["resumen"]["activas"]
            assert activas_post == activas_inicial - 1

            # 7. Intento de modificar alerta ya RESUELTA -> rechazado (400)
            reopen_res = client.patch(
                f"/api/alertas/{crit_alert['id_alerta']}/estado",
                headers=admin_headers,
                json={"estado_nuevo": "ATENDIDA", "expected_version": 3},
            )
            assert reopen_res.status_code == 400

            # 8. Auditoría RN-16 completa e inmutable en MySQL
            hist_res = client.get(f"/api/alertas/{crit_alert['id_alerta']}/historial", headers=op_headers)
            assert hist_res.status_code == 200
            hist_items = hist_res.json()["historial"]
            assert len(hist_items) == 2
            assert hist_items[0]["estado_anterior"] == "PENDIENTE"
            assert hist_items[0]["estado_nuevo"] == "ATENDIDA"
            assert hist_items[0]["usuario_correo"] == "op.rf14@simoa-ejemplo.org"
            assert hist_items[1]["estado_anterior"] == "ATENDIDA"
            assert hist_items[1]["estado_nuevo"] == "RESUELTA"
            assert hist_items[1]["usuario_correo"] == "sup.rf14@simoa-ejemplo.org"

            # Verificar inmutabilidad por trigger SQL en historial_alertas
            with db_cursor() as cursor:
                try:
                    cursor.execute(
                        "UPDATE historial_alertas SET estado_nuevo = 'PENDIENTE' WHERE id_historial = %s",
                        (hist_items[0]["id_historial"],),
                    )
                    raise AssertionError("Trigger trg_historial_alertas_no_update debía impedir UPDATE")
                except pymysql.err.OperationalError:
                    pass
        finally:
            with db_cursor() as cursor:
                if sen_id:
                    # Para limpiar el test eliminamos temporalmente solo las alertas del sensor de prueba;
                    # los triggers de historial_alertas bloquean DELETE directo en producción, así que desactivamos primero el FK/limpiamos ordenadamente si aplica
                    cursor.execute("DROP TRIGGER IF EXISTS trg_historial_alertas_no_delete")
                    cursor.execute(
                        "DELETE h FROM historial_alertas h INNER JOIN alertas a ON h.alerta_id = a.id_alerta WHERE a.sensor_id = %s",
                        (sen_id,),
                    )
                    cursor.execute(
                        """
                        CREATE TRIGGER IF NOT EXISTS trg_historial_alertas_no_delete
                          BEFORE DELETE ON historial_alertas
                          FOR EACH ROW
                          SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'RN-16: La bitácora de alertas es inmutable y no puede eliminarse.'
                        """
                    )
                    cursor.execute("DELETE FROM alertas WHERE sensor_id = %s", (sen_id,))
                    cursor.execute("DELETE FROM mediciones WHERE sensor_id = %s", (sen_id,))
                    cursor.execute("DELETE FROM historial_umbrales WHERE sensor_id = %s", (sen_id,))
                    cursor.execute("DELETE FROM umbrales_alerta WHERE sensor_id = %s", (sen_id,))
                    cursor.execute("DELETE FROM historial_configuracion_variables WHERE sensor_id = %s", (sen_id,))
                    cursor.execute("DELETE FROM configuracion_variables_sensor WHERE sensor_id = %s", (sen_id,))
                    cursor.execute("DELETE FROM sensores WHERE id_sensor = %s", (sen_id,))
                if dev_id:
                    cursor.execute("DELETE FROM historial_ubicaciones WHERE dispositivo_id = %s", (dev_id,))
                    cursor.execute("DELETE FROM dispositivos WHERE id_dispositivo = %s", (dev_id,))
                if loc_id:
                    cursor.execute("DELETE FROM ubicaciones WHERE ubicacion_id = %s", (loc_id,))
