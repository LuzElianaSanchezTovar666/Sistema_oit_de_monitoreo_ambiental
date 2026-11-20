-- RF-13: Generación Automática de Alertas por Desborde de Límites (MySQL / MariaDB)
-- Prepara también la estructura base para consulta histórica en RF-14 sin duplicar datos recuperables por JOIN.

CREATE TABLE IF NOT EXISTS alertas (
  id_alerta VARCHAR(64) NOT NULL,
  medicion_id BIGINT UNSIGNED NULL DEFAULT NULL,
  dispositivo_id VARCHAR(64) NOT NULL,
  sensor_id VARCHAR(64) NOT NULL,
  ubicacion_id VARCHAR(64) NOT NULL,
  tipo VARCHAR(32) NOT NULL DEFAULT 'LIMITE_SUPERADO',
  variable VARCHAR(24) NOT NULL,
  condicion VARCHAR(24) NOT NULL,
  valor_detectado DECIMAL(8,2) NOT NULL,
  umbral_superado DECIMAL(8,2) NOT NULL,
  severidad ENUM('ADVERTENCIA', 'CRITICA') NOT NULL,
  estado ENUM('PENDIENTE', 'EN_ATENCION', 'RESUELTA') NOT NULL DEFAULT 'PENDIENTE',
  mensaje VARCHAR(500) NOT NULL,
  ocurrencias_en_ventana INT NOT NULL DEFAULT 1,
  ultimo_valor_detectado DECIMAL(8,2) NULL DEFAULT NULL,
  ultima_ocurrencia_utc DATETIME NULL DEFAULT NULL,
  clave_idempotencia VARCHAR(96) NULL DEFAULT NULL,
  fecha_hora DATETIME NOT NULL,
  PRIMARY KEY (id_alerta),
  UNIQUE INDEX uq_alertas_idempotencia (clave_idempotencia),
  INDEX idx_alertas_debounce (sensor_id, variable, condicion, fecha_hora),
  INDEX idx_alertas_estado_fecha (estado, fecha_hora),
  INDEX idx_alertas_ubicacion_fecha (ubicacion_id, fecha_hora),
  CONSTRAINT fk_alertas_medicion FOREIGN KEY (medicion_id)
    REFERENCES mediciones (id_medicion)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_alertas_dispositivo FOREIGN KEY (dispositivo_id)
    REFERENCES dispositivos (id_dispositivo)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_alertas_sensor FOREIGN KEY (sensor_id)
    REFERENCES sensores (id_sensor)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_alertas_ubicacion FOREIGN KEY (ubicacion_id)
    REFERENCES ubicaciones (ubicacion_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
