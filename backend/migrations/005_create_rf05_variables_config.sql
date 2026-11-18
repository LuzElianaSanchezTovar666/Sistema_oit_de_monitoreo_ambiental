-- RF-05: Configuración de Magnitudes y Variables Monitoreadas (MySQL / MariaDB)
-- Reutiliza sensores, dispositivos y mediciones sin duplicar estructuras.

CREATE TABLE IF NOT EXISTS configuracion_variables_sensor (
  id_configuracion VARCHAR(64) NOT NULL,
  sensor_id VARCHAR(64) NOT NULL,
  temperatura_habilitada TINYINT(1) NOT NULL DEFAULT 1,
  humedad_habilitada TINYINT(1) NOT NULL DEFAULT 1,
  presion_habilitada TINYINT(1) NOT NULL DEFAULT 0,
  unidad_temperatura VARCHAR(16) NOT NULL DEFAULT '°C',
  unidad_humedad VARCHAR(16) NOT NULL DEFAULT '%RH',
  unidad_presion VARCHAR(16) NULL DEFAULT NULL,
  actualizado_por VARCHAR(160) NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_configuracion),
  UNIQUE KEY uq_cfg_vars_sensor (sensor_id),
  CONSTRAINT fk_cfg_vars_sensor
    FOREIGN KEY (sensor_id) REFERENCES sensores (id_sensor)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS historial_configuracion_variables (
  id_historial BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  configuracion_id VARCHAR(64) NOT NULL,
  sensor_id VARCHAR(64) NOT NULL,
  temperatura_habilitada TINYINT(1) NOT NULL,
  humedad_habilitada TINYINT(1) NOT NULL,
  presion_habilitada TINYINT(1) NOT NULL DEFAULT 0,
  unidad_temperatura VARCHAR(16) NOT NULL DEFAULT '°C',
  unidad_humedad VARCHAR(16) NOT NULL DEFAULT '%RH',
  unidad_presion VARCHAR(16) NULL DEFAULT NULL,
  variables_snapshot TEXT NOT NULL,
  usuario_responsable VARCHAR(160) NOT NULL,
  fecha_cambio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_historial),
  INDEX idx_hist_cfg_sensor_fecha (sensor_id, fecha_cambio),
  CONSTRAINT fk_hist_cfg_sensor
    FOREIGN KEY (sensor_id) REFERENCES sensores (id_sensor)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE mediciones
  ADD COLUMN IF NOT EXISTS configuracion_id VARCHAR(64) NULL AFTER alerta_generada,
  ADD COLUMN IF NOT EXISTS variables_activas_snapshot VARCHAR(255) NULL AFTER configuracion_id;

ALTER TABLE mediciones
  ADD INDEX IF NOT EXISTS idx_mediciones_sensor_cfg (sensor_id, configuracion_id, fecha_hora);
