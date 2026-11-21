from datetime import datetime, timezone
import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.database import db_cursor
from app.dependencies import require_roles
from app.services.anomaly_detector import anomaly_service

logger = logging.getLogger("simoa.router.ia")

router = APIRouter(prefix="/api/ia", tags=["Inteligencia Artificial (RF-18)"])


class EvaluateManualRequest(BaseModel):
    sensor_id: str = Field(..., min_length=1, max_length=64)
    temperatura: Optional[float] = Field(None, ge=-50.0, le=100.0)
    humedad: Optional[float] = Field(None, ge=0.0, le=100.0)


@router.get("/diagnostico")
def get_diagnostico_ia(
    sensor_id: Optional[str] = Query(None, max_length=64),
    ubicacion_id: Optional[str] = Query(None, max_length=64),
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    """RF-18: Obtiene el diagnóstico de IA más reciente para un sensor o ubicación."""
    with db_cursor() as cursor:
        # 1. Si no se especificó sensor_id pero sí ubicacion_id, buscar el primer sensor de esa ubicación
        target_sensor_id = sensor_id
        if not target_sensor_id and ubicacion_id:
            cursor.execute(
                """
                SELECT s.id_sensor
                FROM sensores s
                INNER JOIN dispositivos d ON d.id_dispositivo = s.dispositivo_id
                WHERE d.ubicacion_id = %s AND s.estado = 'ACTIVO'
                LIMIT 1
                """,
                (ubicacion_id,),
            )
            s_row = cursor.fetchone()
            if s_row:
                target_sensor_id = s_row["id_sensor"]

        # Si aún no hay sensor_id, tomar el primer sensor activo global
        if not target_sensor_id:
            cursor.execute("SELECT id_sensor FROM sensores WHERE estado = 'ACTIVO' LIMIT 1")
            s_row = cursor.fetchone()
            if s_row:
                target_sensor_id = s_row["id_sensor"]

        if not target_sensor_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró ningún sensor activo disponible para diagnóstico.",
            )

        # 2. Buscar la última evaluación persistida en evaluaciones_ia
        cursor.execute(
            """
            SELECT
              e.id_evaluacion, e.medicion_id, e.sensor_id, e.dispositivo_id, e.ubicacion_id,
              e.temperatura, e.humedad, e.es_anomalia, e.score_ia,
              e.z_score_temp, e.z_score_hum, e.metodo, e.modelo_version,
              e.tipo_anomalia, e.explicacion, e.posibles_causas, e.recomendaciones,
              e.tiempo_inferencia_ms, e.fecha_hora,
              u.nombre AS ubicacion_nombre,
              s.identificador AS sensor_identificador
            FROM evaluaciones_ia e
            LEFT JOIN ubicaciones u ON u.ubicacion_id = e.ubicacion_id
            LEFT JOIN sensores s ON s.id_sensor = e.sensor_id
            WHERE e.sensor_id = %s
            ORDER BY e.fecha_hora DESC, e.id_evaluacion DESC
            LIMIT 1
            """,
            (target_sensor_id,),
        )
        eval_row = cursor.fetchone()

        if eval_row:
            posibles_causas = []
            if eval_row.get("posibles_causas"):
                try:
                    posibles_causas = json.loads(eval_row["posibles_causas"])
                except Exception:
                    posibles_causas = [eval_row["posibles_causas"]]

            recomendaciones = []
            if eval_row.get("recomendaciones"):
                try:
                    recomendaciones = json.loads(eval_row["recomendaciones"])
                except Exception:
                    recomendaciones = [eval_row["recomendaciones"]]

            fh = eval_row["fecha_hora"]
            fecha_iso = (
                fh.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
                if hasattr(fh, "isoformat")
                else str(fh)
            )

            return {
                "sensor_id": eval_row["sensor_id"],
                "sensor_identificador": eval_row.get("sensor_identificador") or eval_row["sensor_id"],
                "ubicacion_id": eval_row.get("ubicacion_id"),
                "ubicacion_nombre": eval_row.get("ubicacion_nombre") or "Recinto Monitoreado",
                "dispositivo_id": eval_row.get("dispositivo_id"),
                "temperatura": float(eval_row["temperatura"]) if eval_row.get("temperatura") is not None else None,
                "humedad": float(eval_row["humedad"]) if eval_row.get("humedad") is not None else None,
                "es_anomalia": bool(eval_row["es_anomalia"]),
                "score_ia": float(eval_row["score_ia"]) if eval_row.get("score_ia") is not None else None,
                "z_score_temp": float(eval_row["z_score_temp"]) if eval_row.get("z_score_temp") is not None else None,
                "z_score_hum": float(eval_row["z_score_hum"]) if eval_row.get("z_score_hum") is not None else None,
                "metodo": eval_row["metodo"],
                "modelo_version": eval_row["modelo_version"],
                "tipo_anomalia": eval_row["tipo_anomalia"],
                "explicacion": eval_row["explicacion"],
                "posibles_causas": posibles_causas,
                "recomendaciones": recomendaciones,
                "tiempo_inferencia_ms": float(eval_row["tiempo_inferencia_ms"]),
                "fecha_hora": fecha_iso,
            }

        # 3. Si no hay evaluación persistida todavía, evaluar la última medición del sensor
        cursor.execute(
            """
            SELECT m.id_medicion, m.sensor_id, m.dispositivo_id, m.ubicacion_id,
                   m.temperatura, m.humedad, m.fecha_hora,
                   u.nombre AS ubicacion_nombre, s.identificador AS sensor_identificador
            FROM mediciones m
            LEFT JOIN ubicaciones u ON u.ubicacion_id = m.ubicacion_id
            LEFT JOIN sensores s ON s.id_sensor = m.sensor_id
            WHERE m.sensor_id = %s
            ORDER BY m.fecha_hora DESC, m.id_medicion DESC
            LIMIT 1
            """,
            (target_sensor_id,),
        )
        last_med = cursor.fetchone()

        if not last_med:
            # Sensor sin mediciones todavía
            return {
                "sensor_id": target_sensor_id,
                "sensor_identificador": target_sensor_id,
                "ubicacion_id": ubicacion_id,
                "ubicacion_nombre": "Sin ubicación",
                "dispositivo_id": None,
                "temperatura": None,
                "humedad": None,
                "es_anomalia": False,
                "score_ia": None,
                "z_score_temp": None,
                "z_score_hum": None,
                "metodo": "DATOS_INSUFICIENTES",
                "modelo_version": anomaly_service.MODEL_VERSION,
                "tipo_anomalia": "NO_EVALUADO",
                "explicacion": "No hay mediciones registradas para este sensor todavía.",
                "posibles_causas": ["Sensor recién instalado sin telemetría activa."],
                "recomendaciones": ["Esperar el envío de lecturas periódicas del nodo IoT."],
                "tiempo_inferencia_ms": 0.0,
                "fecha_hora": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }

        eval_res = anomaly_service.evaluate_measurement(
            sensor_id=target_sensor_id,
            target_medicion=last_med,
        )

        anomaly_service.record_evaluation(
            medicion_id=last_med["id_medicion"],
            sensor_id=target_sensor_id,
            target_medicion=last_med,
            eval_result=eval_res,
            cursor=cursor,
        )

        fh = last_med["fecha_hora"]
        fecha_iso = (
            fh.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
            if hasattr(fh, "isoformat")
            else str(fh)
        )

        return {
            "sensor_id": target_sensor_id,
            "sensor_identificador": last_med.get("sensor_identificador") or target_sensor_id,
            "ubicacion_id": last_med.get("ubicacion_id"),
            "ubicacion_nombre": last_med.get("ubicacion_nombre") or "Recinto Monitoreado",
            "dispositivo_id": last_med.get("dispositivo_id"),
            "temperatura": float(last_med["temperatura"]) if last_med.get("temperatura") is not None else None,
            "humedad": float(last_med["humedad"]) if last_med.get("humedad") is not None else None,
            "es_anomalia": bool(eval_res.is_anomaly),
            "score_ia": eval_res.score,
            "z_score_temp": eval_res.z_score_temp,
            "z_score_hum": eval_res.z_score_hum,
            "metodo": eval_res.method,
            "modelo_version": eval_res.model_version,
            "tipo_anomalia": eval_res.pattern_type,
            "explicacion": eval_res.explanation,
            "posibles_causas": eval_res.possible_causes,
            "recomendaciones": eval_res.recommendations,
            "tiempo_inferencia_ms": eval_res.inference_time_ms,
            "fecha_hora": fecha_iso,
        }


@router.post("/evaluar")
def evaluar_medicion_manual(
    req: EvaluateManualRequest,
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    """RF-18: Evaluación analítica en tiempo real de una lectura puntual (Inferencia < 200 ms)."""
    target = {
        "temperatura": req.temperatura,
        "humedad": req.humedad,
        "fecha_hora": datetime.now(timezone.utc),
    }
    res = anomaly_service.evaluate_measurement(
        sensor_id=req.sensor_id,
        target_medicion=target,
    )
    return {
        "sensor_id": req.sensor_id,
        "temperatura": req.temperatura,
        "humedad": req.humedad,
        "es_anomalia": res.is_anomaly,
        "score_ia": res.score,
        "z_score_temp": res.z_score_temp,
        "z_score_hum": res.z_score_hum,
        "metodo": res.method,
        "modelo_version": res.model_version,
        "tipo_anomalia": res.pattern_type,
        "explicacion": res.explanation,
        "posibles_causas": res.possible_causes,
        "recomendaciones": res.recommendations,
        "tiempo_inferencia_ms": res.inference_time_ms,
        "muestras_entrenamiento": res.training_sample_count,
    }


@router.post("/reentrenar")
def reentrenar_modelo(
    sensor_id: Optional[str] = Query(None, max_length=64),
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Supervisor")
    ),
) -> Dict[str, Any]:
    """RF-18: Reentrenamiento controlado del modelo Isolation Forest."""
    anomaly_service.clear_cache()
    return {
        "status": "ok",
        "mensaje": f"Caché de modelos reiniciada con éxito para reentrenamiento ({sensor_id or 'todos los sensores'}).",
        "modelo_version": anomaly_service.MODEL_VERSION,
    }


@router.get("/metricas")
def get_metricas_ia(
    _current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Operador", "Técnico", "Supervisor")
    ),
) -> Dict[str, Any]:
    """RF-18: Métricas de desempeño y cumplimiento de latencia (< 200 ms)."""
    with db_cursor() as cursor:
        cursor.execute(
            """
            SELECT
              COUNT(*) AS total_evaluaciones,
              SUM(CASE WHEN es_anomalia = 1 THEN 1 ELSE 0 END) AS total_anomalias,
              AVG(tiempo_inferencia_ms) AS avg_inferencia_ms,
              MAX(tiempo_inferencia_ms) AS max_inferencia_ms
            FROM evaluaciones_ia
            """
        )
        stats = cursor.fetchone() or {}

    return {
        "meta_latencia_ms": 200.0,
        "total_evaluaciones": int(stats.get("total_evaluaciones") or 0),
        "total_anomalias": int(stats.get("total_anomalias") or 0),
        "avg_inferencia_ms": round(float(stats.get("avg_inferencia_ms") or 0.0), 2),
        "max_inferencia_ms": round(float(stats.get("max_inferencia_ms") or 0.0), 2),
        "modelo_version": anomaly_service.MODEL_VERSION,
        "algoritmo": "Isolation Forest (scikit-learn) + Z-Score (3.0σ)",
    }
