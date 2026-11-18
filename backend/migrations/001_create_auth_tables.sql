CREATE DATABASE IF NOT EXISTS `simoa`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `simoa`;

CREATE TABLE IF NOT EXISTS `usuarios` (
  `id_usuario` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(120) NOT NULL,
  `correo` VARCHAR(160) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `rol` ENUM('Administrador', 'Operador', 'Técnico', 'Supervisor') NOT NULL DEFAULT 'Operador',
  `estado` ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
  `fecha_creacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `uq_usuarios_correo` (`correo`),
  KEY `idx_usuarios_rol_estado` (`rol`, `estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `revoked_tokens` (
  `jti` VARCHAR(64) NOT NULL,
  `id_usuario` INT UNSIGNED NULL,
  `expires_at` DATETIME NOT NULL,
  `revoked_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`jti`),
  KEY `idx_revoked_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `login_attempts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `attempt_key` VARCHAR(220) NOT NULL,
  `attempted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_login_attempts_key_time` (`attempt_key`, `attempted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dispositivos` (
  `id_dispositivo` VARCHAR(64) NOT NULL,
  `nombre` VARCHAR(120) NOT NULL,
  `mac_address` VARCHAR(32) NOT NULL,
  `ubicacion_id` VARCHAR(64) NOT NULL,
  `estado` ENUM('ONLINE', 'OFFLINE', 'ADVERTENCIA', 'ERROR') NOT NULL DEFAULT 'ONLINE',
  `firmware_version` VARCHAR(32) NOT NULL DEFAULT 'v2.4.0',
  `observacion_tecnica` VARCHAR(255) NULL,
  `creado_por` VARCHAR(160) NULL,
  `fecha_actualizacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_dispositivo`),
  UNIQUE KEY `uq_dispositivos_mac` (`mac_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `umbrales_alerta` (
  `sensor_id` VARCHAR(64) NOT NULL,
  `temp_min` DECIMAL(5,2) NOT NULL,
  `temp_max` DECIMAL(5,2) NOT NULL,
  `actualizado_por` VARCHAR(160) NULL,
  `fecha_actualizacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`sensor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
