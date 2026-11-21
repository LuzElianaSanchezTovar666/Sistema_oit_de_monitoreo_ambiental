ALTER TABLE mediciones
  ADD COLUMN IF NOT EXISTS valor_anomalo TINYINT(1) NULL DEFAULT NULL AFTER es_fuera_de_umbral;

ALTER TABLE mediciones
  ADD INDEX IF NOT EXISTS idx_mediciones_anomalia (valor_anomalo, sensor_id);

CREATE TABLE IF NOT EXISTS evaluaciones_ia (
  id_evaluacion BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  medicion_id BIGINT UNSIGNED NULL,
  sensor_id VARCHAR(64) NOT NULL,
  dispositivo_id VARCHAR(64) NULL,
  ubicacion_id VARCHAR(64) NULL,
  temperatura DECIMAL(5,2) NULL,
  humedad DECIMAL(5,2) NULL,
  es_anomalia TINYINT(1) NOT NULL DEFAULT 0,
  score_ia DECIMAL(6,4) NULL,
  z_score_temp DECIMAL(6,3) NULL,
  z_score_hum DECIMAL(6,3) NULL,
  metodo VARCHAR(32) NOT NULL DEFAULT 'Z_SCORE',
  modelo_version VARCHAR(32) NOT NULL DEFAULT 'v1.0.0-isolation-forest',
  tipo_anomalia VARCHAR(48) NOT NULL DEFAULT 'NORMAL',
  explicacion TEXT NULL,
  posibles_causas TEXT NULL,
  recomendaciones TEXT NULL,
  tiempo_inferencia_ms DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_evaluacion),
  KEY idx_eval_ia_sensor_fecha (sensor_id, fecha_hora),
  KEY idx_eval_ia_ubicacion (ubicacion_id),
  KEY idx_eval_ia_anomalia (es_anomalia)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
