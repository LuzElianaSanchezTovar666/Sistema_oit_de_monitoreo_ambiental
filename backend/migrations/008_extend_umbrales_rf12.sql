-- RF-12: Configuración de Límites y Umbrales Ambientales (MySQL / MariaDB)
-- Reutiliza `umbrales_alerta` sin duplicar tablas ni modificar mediciones históricas (RF-07).

ALTER TABLE umbrales_alerta
  ADD COLUMN IF NOT EXISTS temp_critico_min DECIMAL(5,2) NULL DEFAULT NULL AFTER temp_max,
  ADD COLUMN IF NOT EXISTS temp_critico_max DECIMAL(5,2) NULL DEFAULT NULL AFTER temp_critico_min,
  ADD COLUMN IF NOT EXISTS hum_critico_min DECIMAL(5,2) NULL DEFAULT NULL AFTER hum_max,
  ADD COLUMN IF NOT EXISTS hum_critico_max DECIMAL(5,2) NULL DEFAULT NULL AFTER hum_critico_min,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1 AFTER es_predeterminado;

ALTER TABLE umbrales_alerta
  ADD INDEX IF NOT EXISTS idx_umbrales_actualizacion (fecha_actualizacion);

CREATE TABLE IF NOT EXISTS historial_umbrales (
  id_historial VARCHAR(64) NOT NULL,
  sensor_id VARCHAR(64) NOT NULL,
  temp_min DECIMAL(5,2) NULL DEFAULT NULL,
  temp_max DECIMAL(5,2) NULL DEFAULT NULL,
  temp_critico_min DECIMAL(5,2) NULL DEFAULT NULL,
  temp_critico_max DECIMAL(5,2) NULL DEFAULT NULL,
  hum_min DECIMAL(5,2) NULL DEFAULT NULL,
  hum_max DECIMAL(5,2) NULL DEFAULT NULL,
  hum_critico_min DECIMAL(5,2) NULL DEFAULT NULL,
  hum_critico_max DECIMAL(5,2) NULL DEFAULT NULL,
  presion_min DECIMAL(6,2) NULL DEFAULT NULL,
  presion_max DECIMAL(6,2) NULL DEFAULT NULL,
  version INT NOT NULL DEFAULT 1,
  actualizado_por VARCHAR(160) NULL DEFAULT NULL,
  motivo VARCHAR(255) NULL DEFAULT NULL,
  vigente_desde DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  vigente_hasta DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (id_historial),
  INDEX idx_hist_umbrales_sensor_fecha (sensor_id, vigente_desde),
  CONSTRAINT fk_hist_umbrales_sensor FOREIGN KEY (sensor_id)
    REFERENCES sensores (id_sensor)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
