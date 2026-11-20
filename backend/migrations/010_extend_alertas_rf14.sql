-- RF-14: Bitácora y Gestión de Eventos de Alerta (MySQL / MariaDB)
-- Reutiliza `alertas` sin eliminar datos existentes y crea `historial_alertas` inmutable (RN-16).

ALTER TABLE alertas
  MODIFY COLUMN estado ENUM('PENDIENTE', 'ATENDIDA', 'EN_ATENCION', 'RESUELTA') NOT NULL DEFAULT 'PENDIENTE';

UPDATE alertas SET estado = 'ATENDIDA' WHERE estado = 'EN_ATENCION';

ALTER TABLE alertas
  MODIFY COLUMN estado ENUM('PENDIENTE', 'ATENDIDA', 'RESUELTA') NOT NULL DEFAULT 'PENDIENTE';

ALTER TABLE alertas
  ADD COLUMN IF NOT EXISTS usuario_responsable_id INT UNSIGNED NULL DEFAULT NULL AFTER estado,
  ADD COLUMN IF NOT EXISTS usuario_responsable_correo VARCHAR(160) NULL DEFAULT NULL AFTER usuario_responsable_id,
  ADD COLUMN IF NOT EXISTS fecha_atencion DATETIME NULL DEFAULT NULL AFTER usuario_responsable_correo,
  ADD COLUMN IF NOT EXISTS fecha_resolucion DATETIME NULL DEFAULT NULL AFTER fecha_atencion,
  ADD COLUMN IF NOT EXISTS accion_correctiva TEXT NULL DEFAULT NULL AFTER fecha_resolucion,
  ADD COLUMN IF NOT EXISTS causa_raiz VARCHAR(255) NULL DEFAULT NULL AFTER accion_correctiva,
  ADD COLUMN IF NOT EXISTS observaciones TEXT NULL DEFAULT NULL AFTER causa_raiz,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1 AFTER observaciones;

ALTER TABLE alertas
  MODIFY COLUMN usuario_responsable_id INT UNSIGNED NULL DEFAULT NULL;

ALTER TABLE alertas
  ADD CONSTRAINT fk_alertas_usuario_resp FOREIGN KEY IF NOT EXISTS (usuario_responsable_id)
    REFERENCES usuarios (id_usuario)
    ON UPDATE CASCADE ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS historial_alertas (
  id_historial VARCHAR(64) NOT NULL,
  alerta_id VARCHAR(64) NOT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  usuario_correo VARCHAR(160) NOT NULL,
  usuario_nombre VARCHAR(160) NOT NULL,
  estado_anterior VARCHAR(24) NOT NULL,
  estado_nuevo VARCHAR(24) NOT NULL,
  accion_correctiva TEXT NULL DEFAULT NULL,
  causa_raiz VARCHAR(255) NULL DEFAULT NULL,
  observaciones TEXT NULL DEFAULT NULL,
  fecha_hora_utc DATETIME NOT NULL,
  PRIMARY KEY (id_historial),
  INDEX idx_hist_alertas_alerta_fecha (alerta_id, fecha_hora_utc),
  CONSTRAINT fk_hist_alertas_alerta FOREIGN KEY (alerta_id)
    REFERENCES alertas (id_alerta)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_hist_alertas_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id_usuario)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TRIGGER IF NOT EXISTS trg_historial_alertas_no_update
  BEFORE UPDATE ON historial_alertas
  FOR EACH ROW
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'RN-16: La bitácora de alertas es inmutable y no puede modificarse.';

CREATE TRIGGER IF NOT EXISTS trg_historial_alertas_no_delete
  BEFORE DELETE ON historial_alertas
  FOR EACH ROW
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'RN-16: La bitácora de alertas es inmutable y no puede eliminarse.';
