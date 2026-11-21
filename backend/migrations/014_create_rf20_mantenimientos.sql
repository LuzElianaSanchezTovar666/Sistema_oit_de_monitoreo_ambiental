USE `simoa`;

ALTER TABLE dispositivos
  ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45) NULL DEFAULT NULL AFTER mac_address;

CREATE TABLE IF NOT EXISTS mantenimientos (
  id_mantenimiento VARCHAR(64) NOT NULL,
  dispositivo_id VARCHAR(64) NOT NULL,
  sensor_id VARCHAR(64) NULL DEFAULT NULL,
  id_usuario_responsable INT UNSIGNED NOT NULL,
  tecnico_nombre VARCHAR(160) NOT NULL,
  tipo_mantenimiento ENUM(
    'PREVENTIVO',
    'CORRECTIVO',
    'CALIBRACION',
    'REEMPLAZO_BATERIA',
    'LIMPIEZA_SONDA',
    'ACTUALIZACION_FIRMWARE',
    'REVISION_GENERAL'
  ) NOT NULL DEFAULT 'PREVENTIVO',
  fecha_intervencion DATETIME NOT NULL,
  descripcion TEXT NOT NULL,
  actividades_realizadas TEXT NULL,
  resultado ENUM('EXITOSO', 'PENDIENTE', 'EN_OBSERVACION') NOT NULL DEFAULT 'EXITOSO',
  observaciones TEXT NULL,
  proxima_fecha_sugerida DATE NULL DEFAULT NULL,
  costo_estimado_usd DECIMAL(10,2) NULL DEFAULT 0.00,
  id_alerta_relacionada VARCHAR(64) NULL DEFAULT NULL,
  estado ENUM('COMPLETADO', 'PROGRAMADO', 'EN_CURSO') NOT NULL DEFAULT 'COMPLETADO',
  fecha_registro DATETIME NOT NULL,
  PRIMARY KEY (id_mantenimiento),
  KEY idx_mnt_dispositivo (dispositivo_id, fecha_intervencion),
  KEY idx_mnt_usuario (id_usuario_responsable),
  KEY idx_mnt_alerta (id_alerta_relacionada),
  CONSTRAINT fk_mnt_dispositivo FOREIGN KEY (dispositivo_id)
    REFERENCES dispositivos (id_dispositivo) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_mnt_usuario FOREIGN KEY (id_usuario_responsable)
    REFERENCES usuarios (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
