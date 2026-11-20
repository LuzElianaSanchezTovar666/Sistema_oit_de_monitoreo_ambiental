-- RF-07: Almacenamiento Persistente de Mediciones en Base de Datos (MySQL / MariaDB)
-- Reutiliza la tabla `mediciones` sin eliminar datos ni duplicar estructuras.
-- RN-09: En producción usar un usuario MySQL dedicado con privilegios mínimos:
--   GRANT SELECT, INSERT ON simoa.mediciones TO 'simoa_ingest'@'localhost';

ALTER TABLE mediciones
  ADD COLUMN IF NOT EXISTS es_fuera_de_umbral TINYINT(1) NULL DEFAULT NULL AFTER alerta_generada,
  ADD COLUMN IF NOT EXISTS score_anomalia_ia DECIMAL(6,4) NULL DEFAULT NULL AFTER es_fuera_de_umbral,
  ADD COLUMN IF NOT EXISTS clave_idempotencia VARCHAR(80) NULL DEFAULT NULL AFTER variables_activas_snapshot;

ALTER TABLE mediciones
  ADD UNIQUE INDEX IF NOT EXISTS uq_mediciones_idempotencia (clave_idempotencia),
  ADD INDEX IF NOT EXISTS idx_mediciones_sensor_fecha (sensor_id, fecha_hora);

ALTER TABLE mediciones
  ADD FOREIGN KEY IF NOT EXISTS fk_mediciones_sensor (sensor_id)
    REFERENCES sensores (id_sensor)
    ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE TRIGGER IF NOT EXISTS trg_mediciones_no_update
  BEFORE UPDATE ON mediciones
  FOR EACH ROW
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'RN-09: Las mediciones almacenadas son inmutables y no pueden modificarse.';
