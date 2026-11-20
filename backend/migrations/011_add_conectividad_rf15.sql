USE `simoa`;

ALTER TABLE dispositivos
  ADD COLUMN IF NOT EXISTS activo_administrativamente TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS estado_conectividad ENUM('PENDIENTE', 'ONLINE', 'ADVERTENCIA', 'OFFLINE') NOT NULL DEFAULT 'PENDIENTE',
  ADD COLUMN IF NOT EXISTS ultimo_ping DATETIME(6) NULL,
  ADD COLUMN IF NOT EXISTS ultima_evidencia_origen DATETIME(6) NULL,
  ADD COLUMN IF NOT EXISTS fecha_cambio_conectividad DATETIME(6) NULL,
  ADD COLUMN IF NOT EXISTS lecturas_desde_utc DATETIME(6) NULL,
  ADD KEY IF NOT EXISTS idx_dispositivos_conectividad (activo_administrativamente, estado_conectividad, ultimo_ping);

UPDATE dispositivos SET activo_administrativamente = 0, fecha_actualizacion = fecha_actualizacion
WHERE estado = 'INACTIVO' AND activo_administrativamente = 1;

CREATE TABLE IF NOT EXISTS historial_conectividad_dispositivos (
  id_evento BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  dispositivo_id VARCHAR(64) NOT NULL,
  estado_anterior VARCHAR(16) NOT NULL,
  estado_nuevo VARCHAR(16) NOT NULL,
  motivo VARCHAR(24) NOT NULL,
  fecha_cambio_utc DATETIME(6) NOT NULL,
  ultimo_ping DATETIME(6) NULL,
  PRIMARY KEY (id_evento),
  KEY idx_conectividad_dispositivo_fecha (dispositivo_id, fecha_cambio_utc),
  CONSTRAINT fk_conectividad_dispositivo FOREIGN KEY (dispositivo_id)
    REFERENCES dispositivos (id_dispositivo) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
