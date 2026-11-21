from dataclasses import dataclass
from datetime import datetime, timezone
import logging
import math
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sklearn.ensemble import IsolationForest

from app.database import db_cursor

logger = logging.getLogger("simoa.anomaly_detector")


@dataclass
class AnomalyEvaluationResult:
    is_anomaly: Optional[bool]
    score: Optional[float]
    z_score_temp: Optional[float]
    z_score_hum: Optional[float]
    method: str  # "ISOLATION_FOREST", "Z_SCORE", "DATOS_INSUFICIENTES"
    model_version: str
    pattern_type: str
    explanation: str
    possible_causes: List[str]
    recommendations: List[str]
    inference_time_ms: float
    training_sample_count: int


@dataclass
class CachedModel:
    model: IsolationForest
    scaler_mean: np.ndarray
    scaler_scale: np.ndarray
    trained_at: datetime
    sample_count: int
    version: str


class AnomalyDetectionService:
    """RF-18: Servicio de Detección de Anomalías con Machine Learning (Isolation Forest y Z-Score).
    RN-20: Capa analítica desacoplada de umbrales fijos; ambas capas operan en paralelo.
    """

    MODEL_VERSION = "v1.0.0-isolation-forest"
    MIN_SAMPLES_ISOLATION_FOREST = 50
    MIN_SAMPLES_ZSCORE = 5
    WINDOW_SIZE = 50
    ANOMALY_SCORE_THRESHOLD = 0.70
    ZSCORE_THRESHOLD = 3.0

    def __init__(self, window_size: int = WINDOW_SIZE):
        self.window_size = window_size
        self._models_lock = threading.Lock()
        self._models_by_sensor: Dict[str, CachedModel] = {}

    def clear_cache(self) -> None:
        with self._models_lock:
            self._models_by_sensor.clear()

    # --------------------------------------------------------------------------
    # 1. Recuperación de Historial y Ventana Temporal por Sensor
    # --------------------------------------------------------------------------
    def _fetch_recent_sensor_window(
        self, sensor_id: str, limit: int = 60
    ) -> List[Dict[str, Any]]:
        """Recupera la ventana temporal de mediciones válidas para el sensor especificado,
        ordenadas cronológicamente en UTC ascendente (evitando mezclar sensores).
        """
        with db_cursor() as cursor:
            cursor.execute(
                """
                SELECT id_medicion, sensor_id, dispositivo_id, ubicacion_id,
                       temperatura, humedad, presion, fecha_hora
                FROM mediciones
                WHERE sensor_id = %s
                  AND (temperatura IS NOT NULL OR humedad IS NOT NULL)
                ORDER BY fecha_hora DESC, id_medicion DESC
                LIMIT %s
                """,
                (sensor_id, limit),
            )
            rows = list(cursor.fetchall())

        # Ordenar cronológicamente (antiguas -> recientes)
        rows.reverse()
        return rows

    # --------------------------------------------------------------------------
    # 2. Control Estadístico Local: Z-Score (RN-20 / Sección 8)
    # --------------------------------------------------------------------------
    @staticmethod
    def compute_z_score(
        current_val: Optional[float], baseline_vals: List[float]
    ) -> Optional[float]:
        """Calcula el Z-score de un valor respecto a una ventana histórica de referencia.
        Z = (x - media) / desviacion_estandar
        Maneja casos especiales: sigma=0, datos insuficientes, valores nulos.
        """
        if current_val is None or len(baseline_vals) < 5:
            return None

        clean_vals = [float(v) for v in baseline_vals if v is not None and not math.isnan(v)]
        if len(clean_vals) < 5:
            return None

        mean = float(np.mean(clean_vals))
        std = float(np.std(clean_vals, ddof=1))

        if std <= 1e-6:
            # Desviación cero o casi nula (lecturas idénticas repetidas):
            # Una microfluctuación menor a 1.5 (cuantización del sensor) es nominal (Z=0.0);
            # solo saltos reales (>= 1.5) se consideran estadísticamente divergentes.
            return 0.0 if abs(current_val - mean) < 1.5 else 3.5

        return round(float((current_val - mean) / std), 3)

    # --------------------------------------------------------------------------
    # 3. Preparación de Características (Feature Engineering)
    # --------------------------------------------------------------------------
    @staticmethod
    def _extract_feature_vector(
        target_row: Dict[str, Any], prev_row: Optional[Dict[str, Any]]
    ) -> np.ndarray:
        temp = float(target_row["temperatura"]) if target_row.get("temperatura") is not None else 22.0
        hum = float(target_row["humedad"]) if target_row.get("humedad") is not None else 50.0

        if prev_row is not None:
            prev_temp = float(prev_row["temperatura"]) if prev_row.get("temperatura") is not None else temp
            prev_hum = float(prev_row["humedad"]) if prev_row.get("humedad") is not None else hum
            delta_temp = temp - prev_temp
            delta_hum = hum - prev_hum

            t_curr = target_row.get("fecha_hora")
            t_prev = prev_row.get("fecha_hora")
            if hasattr(t_curr, "timestamp") and hasattr(t_prev, "timestamp"):
                delta_s = max(1.0, float(t_curr.timestamp() - t_prev.timestamp()))
            else:
                delta_s = 60.0
        else:
            delta_temp = 0.0
            delta_hum = 0.0
            delta_s = 60.0

        rate_temp = delta_temp / delta_s
        rate_hum = delta_hum / delta_s

        return np.array([temp, hum, delta_temp, delta_hum, delta_s, rate_temp, rate_hum], dtype=np.float32)

    def _build_dataset_from_window(
        self, window: List[Dict[str, Any]]
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        X_list = []
        for i in range(len(window)):
            prev = window[i - 1] if i > 0 else None
            feat = self._extract_feature_vector(window[i], prev)
            X_list.append(feat)

        X = np.array(X_list, dtype=np.float32)
        mean = np.mean(X, axis=0)
        scale = np.std(X, axis=0)
        scale[scale < 1e-5] = 1.0
        X_scaled = (X - mean) / scale
        return X_scaled, mean, scale

    # --------------------------------------------------------------------------
    # 4. Modelo Isolation Forest con Reutilización en Memoria (Sección 7)
    # --------------------------------------------------------------------------
    def _get_or_train_model(
        self, sensor_id: str, window: List[Dict[str, Any]]
    ) -> Optional[CachedModel]:
        count = len(window)
        if count < self.MIN_SAMPLES_ISOLATION_FOREST:
            return None

        with self._models_lock:
            cached = self._models_by_sensor.get(sensor_id)
            # Reutilizar modelo en memoria si ya existe y la cantidad de datos no ha crecido > 100 muestras
            if cached and (count - cached.sample_count < 100):
                return cached

            # Entrenar modelo reproducible
            X_scaled, mean, scale = self._build_dataset_from_window(window)
            model = IsolationForest(
                n_estimators=100,
                contamination=0.05,
                random_state=42,
                n_jobs=1,
            )
            model.fit(X_scaled)

            cached_entry = CachedModel(
                model=model,
                scaler_mean=mean,
                scaler_scale=scale,
                trained_at=datetime.now(timezone.utc),
                sample_count=count,
                version=self.MODEL_VERSION,
            )
            self._models_by_sensor[sensor_id] = cached_entry
            return cached_entry

    # --------------------------------------------------------------------------
    # 5. Clasificación de Patrones y Generación de Explicaciones / Causa Raíz
    # --------------------------------------------------------------------------
    @staticmethod
    def _diagnose_pattern(
        is_anomaly: bool,
        temp_val: Optional[float],
        hum_val: Optional[float],
        delta_temp: float,
        delta_hum: float,
        z_temp: Optional[float],
        z_hum: Optional[float],
        delta_time_s: float,
    ) -> Tuple[str, str, List[str], List[str]]:
        if not is_anomaly:
            return (
                "NORMAL",
                "Las variables ambientales se mantienen dentro de la distribución estadística habitual con fluctuaciones nominales.",
                ["Operación nominal estable del recinto y sus sistemas de acondicionamiento."],
                [
                    "Mantener rutina de monitoreo continuo y supervisión ordinaria.",
                    "Registrar logs periódicos de confirmación de estado.",
                ],
            )

        # 1. Posible fallo de sensor: salto instantáneo físicamente inverosímil
        if delta_time_s < 20.0 and (abs(delta_temp) > 12.0 or abs(delta_hum) > 35.0):
            return (
                "FALLO_SENSOR",
                "La variación registrada presenta características estadísticas incompatibles con la inercia física del entorno.",
                [
                    "Posible ruido electromagnético en el bus de datos o microcorte de alimentación.",
                    "Contacto intermitente en cableado o degradación física de la sonda.",
                ],
                [
                    "Se recomienda inspeccionar visualmente el cableado y conexión del sensor.",
                    "Verificar la estabilidad de la fuente de alimentación del nodo IoT.",
                    "Programar verificación o recalibración física con instrumental patrón.",
                ],
            )

        # 2. Pico repentino (Spike ascendente)
        if (delta_temp >= 2.5 and (z_temp is not None and z_temp >= 2.5)) or (z_temp is not None and z_temp >= 3.0):
            return (
                "PICO_REPENTINO",
                "Se detectó un incremento térmico abrupto respecto a las lecturas recientes del sensor.",
                [
                    "Patrón compatible con apertura prolongada de accesos o puertas del recinto.",
                    "Sobrecarga térmica por maquinaria interna o exposición a radiación directa.",
                    "Falla momentánea o desconexión del sistema de ventilación/refrigeración.",
                ],
                [
                    "Se recomienda verificar inmediatamente el sellado de compuertas y accesos.",
                    "Comprobar el encendido y flujo de aire de los ventiladores o chiller.",
                    "Confirmar que la sonda no esté recibiendo fuentes directas de calor.",
                ],
            )

        # 3. Caída repentina (Drop descendente)
        if (delta_temp <= -2.5 and (z_temp is not None and z_temp <= -2.5)) or (z_temp is not None and z_temp <= -3.0):
            return (
                "CAIDA_ABRUPTA",
                "Se detectó un descenso térmico abrupto respecto a las lecturas precedentes.",
                [
                    "Patrón compatible con flujo convectivo directo de aire frío sobre la sonda.",
                    "Apertura de compuertas exteriores durante condiciones de baja temperatura externa.",
                    "Ciclo forzado o sobreenfriamiento por desajuste del termostato.",
                ],
                [
                    "Se recomienda comprobar la dirección de toberas de descarga de aire frío.",
                    "Verificar el setpoint del termostato de control de sala.",
                    "Inspeccionar compuertas automáticas de ventilación.",
                ],
            )

        # 4. Oscilación higrométrica inusual
        if (z_hum is not None and abs(z_hum) >= 2.8) or abs(delta_hum) >= 25.0:
            return (
                "OSCILACION_INHABITUAL",
                "Se detectó una alteración higrométrica estadísticamente significativa en el recinto.",
                [
                    "Patrón compatible con saturación o corte súbito de humidificación/deshumidificación.",
                    "Infiltración de humedad exterior o condensación sobre el elemento sensor.",
                ],
                [
                    "Se recomienda revisar los filtros y bandejas de condensado del humidificador.",
                    "Comprobar que la sonda higrométrica no presente gotas de condensación superficial.",
                ],
            )

        # 5. Deriva térmica / anomalía multivariable
        return (
            "DERIVA_TERMICA",
            "Se observa un patrón atípico multivariable en la relación temperatura-humedad respecto al modelo base.",
            [
                "Patrón compatible con variación sostenida de carga térmica ambiental.",
                "Pérdida paulatina de aislamiento o desbalance en el lazo de climatización.",
            ],
            [
                "Se recomienda monitorear la tendencia durante los próximos ciclos de lectura.",
                "Comparar las lecturas con otros sensores del mismo recinto.",
                "Verificar los registros de mantenimiento preventivo del sistema HVAC.",
            ],
        )

    # --------------------------------------------------------------------------
    # 6. Evaluación Principal de una Medición (Inferencia < 200 ms)
    # --------------------------------------------------------------------------
    def evaluate_measurement(
        self,
        sensor_id: str,
        target_medicion: Dict[str, Any],
        historical_window: Optional[List[Dict[str, Any]]] = None,
    ) -> AnomalyEvaluationResult:
        t0 = time.perf_counter()

        if historical_window is None:
            historical_window = self._fetch_recent_sensor_window(
                sensor_id, limit=self.window_size + 10
            )

        # Filtrar mediciones del mismo sensor
        sensor_history = [
            m for m in historical_window if str(m.get("sensor_id")) == str(sensor_id)
        ]

        # Separar valores para el baseline estadístico (excluyendo la medición evaluada)
        target_id = target_medicion.get("id_medicion")
        baseline = [
            m for m in sensor_history
            if target_id is None or m.get("id_medicion") != target_id
        ]

        temp_curr = float(target_medicion["temperatura"]) if target_medicion.get("temperatura") is not None else None
        hum_curr = float(target_medicion["humedad"]) if target_medicion.get("humedad") is not None else None

        # 1. Calcular Z-Score
        baseline_temps = [float(m["temperatura"]) for m in baseline if m.get("temperatura") is not None]
        baseline_hums = [float(m["humedad"]) for m in baseline if m.get("humedad") is not None]

        z_temp = self.compute_z_score(temp_curr, baseline_temps)
        z_hum = self.compute_z_score(hum_curr, baseline_hums)

        prev_row = baseline[-1] if baseline else None
        prev_temp = float(prev_row["temperatura"]) if prev_row and prev_row.get("temperatura") is not None else temp_curr
        prev_hum = float(prev_row["humedad"]) if prev_row and prev_row.get("humedad") is not None else hum_curr

        delta_temp = (temp_curr - prev_temp) if (temp_curr is not None and prev_temp is not None) else 0.0
        delta_hum = (hum_curr - prev_hum) if (hum_curr is not None and prev_hum is not None) else 0.0

        delta_s = 60.0
        if prev_row:
            t_c = target_medicion.get("fecha_hora")
            t_p = prev_row.get("fecha_hora")
            if hasattr(t_c, "timestamp") and hasattr(t_p, "timestamp"):
                delta_s = max(1.0, float(t_c.timestamp() - t_p.timestamp()))

        sample_count = len(baseline)

        # 2. Selección de Método según cantidad de muestras disponibles
        if sample_count < self.MIN_SAMPLES_ZSCORE:
            # Datos insuficientes: no es posible calcular Z-Score ni Isolation Forest
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            return AnomalyEvaluationResult(
                is_anomaly=None,
                score=None,
                z_score_temp=None,
                z_score_hum=None,
                method="DATOS_INSUFICIENTES",
                model_version=self.MODEL_VERSION,
                pattern_type="NO_EVALUADO",
                explanation=f"Muestras insuficientes ({sample_count}/{self.MIN_SAMPLES_ZSCORE}) para evaluación estadística confiable.",
                possible_causes=["Fase inicial de adquisición de datos del sensor."],
                recommendations=["Continuar acumulando mediciones ambientales periódicas."],
                inference_time_ms=round(elapsed_ms, 2),
                training_sample_count=sample_count,
            )

        cached_model = self._get_or_train_model(sensor_id, baseline)

        if cached_model is not None:
            # 3. Isolation Forest disponible (>= 50 muestras)
            method_used = "ISOLATION_FOREST"
            feat_raw = self._extract_feature_vector(target_medicion, prev_row)
            feat_scaled = (feat_raw - cached_model.scaler_mean) / cached_model.scaler_scale
            feat_2d = feat_scaled.reshape(1, -1)

            # Inferencia rápida (reutilizando modelo en memoria)
            dec_func = float(cached_model.model.decision_function(feat_2d)[0])
            pred_raw = int(cached_model.model.predict(feat_2d)[0])  # -1 anómalo, 1 nominal

            # Mapeo no lineal a score normalizado [0.0, 1.0]
            # dec_func positivo es normal, negativo es anómalo
            score_norm = 1.0 / (1.0 + math.exp(np.clip(10.0 * dec_func, -15.0, 15.0)))
            score_val = round(float(np.clip(score_norm, 0.0, 1.0)), 4)

            # Evaluación híbrida:
            # Si las variables están en el centro de la distribución (Z < 2.0 y deltas normales), es nominal.
            is_statistically_normal = bool(
                (z_temp is not None and abs(z_temp) < 2.0) and
                (z_hum is not None and abs(z_hum) < 2.0) and
                abs(delta_temp) < 2.0 and abs(delta_hum) < 5.0
            )

            if is_statistically_normal:
                is_anomaly = False
                score_val = min(score_val, 0.3500)
            else:
                is_anomaly = bool(
                    score_val >= self.ANOMALY_SCORE_THRESHOLD or
                    (z_temp is not None and abs(z_temp) >= self.ZSCORE_THRESHOLD) or
                    (z_hum is not None and abs(z_hum) >= self.ZSCORE_THRESHOLD) or
                    (pred_raw == -1 and (
                        (z_temp is not None and abs(z_temp) >= 2.0) or
                        (z_hum is not None and abs(z_hum) >= 2.0) or
                        abs(delta_temp) >= 2.5
                    ))
                )
                if is_anomaly and score_val < 0.70:
                    score_val = 0.7500
        else:
            # 4. Evaluación Estadística Local Z-Score (< 50 muestras)
            method_used = "Z_SCORE"
            max_abs_z = 0.0
            if z_temp is not None:
                max_abs_z = max(max_abs_z, abs(z_temp))
            if z_hum is not None:
                max_abs_z = max(max_abs_z, abs(z_hum))

            is_anomaly = bool(max_abs_z >= self.ZSCORE_THRESHOLD)
            # Mapeo proporcional de Z-score a escala [0.0, 1.0]
            score_val = round(float(np.clip(max_abs_z / 4.0, 0.0, 1.0)), 4)

        pat_type, expl, causes, recs = self._diagnose_pattern(
            is_anomaly=is_anomaly,
            temp_val=temp_curr,
            hum_val=hum_curr,
            delta_temp=delta_temp,
            delta_hum=delta_hum,
            z_temp=z_temp,
            z_hum=z_hum,
            delta_time_s=delta_s,
        )

        elapsed_ms = (time.perf_counter() - t0) * 1000.0

        return AnomalyEvaluationResult(
            is_anomaly=is_anomaly,
            score=score_val,
            z_score_temp=z_temp,
            z_score_hum=z_hum,
            method=method_used,
            model_version=self.MODEL_VERSION,
            pattern_type=pat_type,
            explanation=expl,
            possible_causes=causes,
            recommendations=recs,
            inference_time_ms=round(elapsed_ms, 2),
            training_sample_count=sample_count,
        )

    # --------------------------------------------------------------------------
    # 7. Integración Ingestión y Persistencia Segura (RN-20)
    # --------------------------------------------------------------------------
    def record_evaluation(
        self,
        medicion_id: Optional[int],
        sensor_id: str,
        target_medicion: Dict[str, Any],
        eval_result: AnomalyEvaluationResult,
        cursor: Any,
    ) -> None:
        """Registra la auditoría en `evaluaciones_ia` de forma no bloqueante (RN-20)."""
        import json
        try:
            cursor.execute(
                """
                INSERT INTO evaluaciones_ia (
                  medicion_id, sensor_id, dispositivo_id, ubicacion_id,
                  temperatura, humedad, es_anomalia, score_ia,
                  z_score_temp, z_score_hum, metodo, modelo_version,
                  tipo_anomalia, explicacion, posibles_causas, recomendaciones,
                  tiempo_inferencia_ms, fecha_hora
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    medicion_id,
                    sensor_id,
                    target_medicion.get("dispositivo_id"),
                    target_medicion.get("ubicacion_id"),
                    target_medicion.get("temperatura"),
                    target_medicion.get("humedad"),
                    1 if eval_result.is_anomaly else 0,
                    eval_result.score,
                    eval_result.z_score_temp,
                    eval_result.z_score_hum,
                    eval_result.method,
                    eval_result.model_version,
                    eval_result.pattern_type,
                    eval_result.explanation,
                    json.dumps(eval_result.possible_causes, ensure_ascii=False),
                    json.dumps(eval_result.recommendations, ensure_ascii=False),
                    eval_result.inference_time_ms,
                    target_medicion.get("fecha_hora") or datetime.now(timezone.utc),
                ),
            )
        except Exception as exc:
            logger.warning("Fallo no bloqueante al persistir evaluación IA (RN-20): %s", exc)


# Instancia singleton del servicio
anomaly_service = AnomalyDetectionService()
