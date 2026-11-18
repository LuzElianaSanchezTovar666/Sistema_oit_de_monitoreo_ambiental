USE `simoa`;

CREATE TABLE IF NOT EXISTS `sensores` (
  `id_sensor` VARCHAR(64) NOT NULL,
  `dispositivo_id` VARCHAR(64) NOT NULL,
  `identificador` VARCHAR(64) NOT NULL,
  `modelo` ENUM('DHT22', 'BME280', 'SHT31') NOT NULL,
  `variables_medidas` TEXT NOT NULL,
  `fecha_instalacion` DATE NOT NULL,
  `ultima_calibracion` DATE NOT NULL,
  `estado` ENUM('ACTIVO', 'FALLA', 'CALIBRACION', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  `descripcion` VARCHAR(255) NULL,
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_sensor`),
  UNIQUE KEY `uq_sensores_identificador` (`identificador`),
  KEY `idx_sensores_dispositivo_estado` (`dispositivo_id`, `estado`),
  KEY `idx_sensores_modelo` (`modelo`),
  CONSTRAINT `fk_sensores_dispositivo`
    FOREIGN KEY (`dispositivo_id`) REFERENCES `dispositivos`(`id_dispositivo`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `umbrales_alerta`
  MODIFY COLUMN `temp_min` DECIMAL(5,2) NULL,
  MODIFY COLUMN `temp_max` DECIMAL(5,2) NULL,
  ADD COLUMN IF NOT EXISTS `hum_min` DECIMAL(5,2) NULL AFTER `temp_max`,
  ADD COLUMN IF NOT EXISTS `hum_max` DECIMAL(5,2) NULL AFTER `hum_min`,
  ADD COLUMN IF NOT EXISTS `presion_min` DECIMAL(6,2) NULL AFTER `hum_max`,
  ADD COLUMN IF NOT EXISTS `presion_max` DECIMAL(6,2) NULL AFTER `presion_min`,
  ADD COLUMN IF NOT EXISTS `es_predeterminado` TINYINT(1) NOT NULL DEFAULT 1 AFTER `presion_max`;

ALTER TABLE `mediciones`
  MODIFY COLUMN `temperatura` DECIMAL(5,2) NULL,
  MODIFY COLUMN `humedad` DECIMAL(5,2) NULL,
  ADD COLUMN IF NOT EXISTS `sensor_id` VARCHAR(64) NULL AFTER `dispositivo_id`,
  ADD COLUMN IF NOT EXISTS `presion` DECIMAL(6,2) NULL AFTER `humedad`,
  ADD COLUMN IF NOT EXISTS `alerta_generada` TINYINT(1) NOT NULL DEFAULT 0 AFTER `presion`,
  ADD KEY IF NOT EXISTS `idx_mediciones_sensor_fecha` (`sensor_id`, `fecha_hora`);
