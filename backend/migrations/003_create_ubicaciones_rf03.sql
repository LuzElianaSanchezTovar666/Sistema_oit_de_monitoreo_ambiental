USE `simoa`;

CREATE TABLE IF NOT EXISTS `ubicaciones` (
  `ubicacion_id` VARCHAR(64) NOT NULL,
  `nombre` VARCHAR(120) NOT NULL,
  `codigo_area` VARCHAR(32) NOT NULL,
  `tipo` VARCHAR(60) NOT NULL,
  `descripcion` VARCHAR(255) NULL,
  `estado` ENUM('ACTIVA', 'INACTIVA') NOT NULL DEFAULT 'ACTIVA',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ubicacion_id`),
  UNIQUE KEY `uq_ubicaciones_nombre` (`nombre`),
  UNIQUE KEY `uq_ubicaciones_codigo_area` (`codigo_area`),
  KEY `idx_ubicaciones_estado_tipo` (`estado`, `tipo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `ubicaciones` (`ubicacion_id`, `nombre`, `codigo_area`, `tipo`, `descripcion`, `estado`) VALUES
  ('ubi-lab-01', 'Laboratorio', 'AREA-01', 'Laboratorio', 'Laboratorio principal de control ambiental', 'ACTIVA'),
  ('ubi-bio-02', 'Bioterio', 'AREA-02', 'Bioterio', 'Recinto biológico de temperatura controlada', 'ACTIVA'),
  ('ubi-cam-03', 'Cámara fría', 'AREA-03', 'Cámara fría', 'Unidad de refrigeración y cadena de frío', 'ACTIVA'),
  ('ubi-bod-04', 'Bodega', 'AREA-04', 'Bodega', 'Almacenamiento general de insumos', 'ACTIVA');

ALTER TABLE `dispositivos`
  ADD KEY IF NOT EXISTS `idx_dispositivos_ubicacion` (`ubicacion_id`);

ALTER TABLE `mediciones`
  ADD COLUMN IF NOT EXISTS `ubicacion_id` VARCHAR(64) NULL AFTER `dispositivo_id`,
  ADD KEY IF NOT EXISTS `idx_mediciones_ubicacion_fecha` (`ubicacion_id`, `fecha_hora`);

CREATE TABLE IF NOT EXISTS `historial_ubicaciones` (
  `id_historial` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `dispositivo_id` VARCHAR(64) NOT NULL,
  `ubicacion_anterior_id` VARCHAR(64) NULL,
  `ubicacion_nueva_id` VARCHAR(64) NOT NULL,
  `usuario_responsable_id` INT UNSIGNED NOT NULL,
  `usuario_responsable_correo` VARCHAR(160) NOT NULL,
  `motivo` VARCHAR(255) NULL,
  `fecha_cambio` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_historial`),
  KEY `idx_hist_ubi_disp_fecha` (`dispositivo_id`, `fecha_cambio`),
  CONSTRAINT `fk_hist_ubi_dispositivo`
    FOREIGN KEY (`dispositivo_id`) REFERENCES `dispositivos`(`id_dispositivo`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_hist_ubi_anterior`
    FOREIGN KEY (`ubicacion_anterior_id`) REFERENCES `ubicaciones`(`ubicacion_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_hist_ubi_nueva`
    FOREIGN KEY (`ubicacion_nueva_id`) REFERENCES `ubicaciones`(`ubicacion_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_hist_ubi_usuario`
    FOREIGN KEY (`usuario_responsable_id`) REFERENCES `usuarios`(`id_usuario`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
