USE `simoa`;

ALTER TABLE `dispositivos`
  ADD COLUMN IF NOT EXISTS `id_usuario` INT UNSIGNED NULL AFTER `id_dispositivo`,
  ADD COLUMN IF NOT EXISTS `codigo` VARCHAR(32) NULL AFTER `id_usuario`,
  ADD COLUMN IF NOT EXISTS `tipo` ENUM('ESP32', 'ESP8266', 'Gateway') NOT NULL DEFAULT 'ESP32' AFTER `mac_address`,
  ADD COLUMN IF NOT EXISTS `ubicacion` VARCHAR(120) NOT NULL DEFAULT '' AFTER `ubicacion_id`,
  ADD COLUMN IF NOT EXISTS `mqtt_client_id` VARCHAR(80) NULL AFTER `observacion_tecnica`,
  ADD COLUMN IF NOT EXISTS `mqtt_topic` VARCHAR(160) NULL AFTER `mqtt_client_id`,
  ADD COLUMN IF NOT EXISTS `mqtt_username` VARCHAR(80) NULL AFTER `mqtt_topic`,
  ADD COLUMN IF NOT EXISTS `mqtt_password_hash` VARCHAR(255) NULL AFTER `mqtt_username`,
  ADD COLUMN IF NOT EXISTS `fecha_registro` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `mqtt_password_hash`;

ALTER TABLE `dispositivos`
  MODIFY COLUMN `estado` ENUM('PENDIENTE', 'ONLINE', 'OFFLINE', 'ADVERTENCIA', 'ERROR', 'INACTIVO') NOT NULL DEFAULT 'PENDIENTE';

ALTER TABLE `dispositivos`
  ADD UNIQUE KEY IF NOT EXISTS `uq_dispositivos_codigo` (`codigo`),
  ADD UNIQUE KEY IF NOT EXISTS `uq_dispositivos_mqtt_client` (`mqtt_client_id`),
  ADD UNIQUE KEY IF NOT EXISTS `uq_dispositivos_mqtt_user` (`mqtt_username`);

CREATE TABLE IF NOT EXISTS `mediciones` (
  `id_medicion` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `dispositivo_id` VARCHAR(64) NOT NULL,
  `temperatura` DECIMAL(5,2) NOT NULL,
  `humedad` DECIMAL(5,2) NOT NULL,
  `fecha_hora` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_medicion`),
  KEY `idx_mediciones_disp_fecha` (`dispositivo_id`, `fecha_hora`),
  CONSTRAINT `fk_mediciones_dispositivo`
    FOREIGN KEY (`dispositivo_id`) REFERENCES `dispositivos`(`id_dispositivo`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
