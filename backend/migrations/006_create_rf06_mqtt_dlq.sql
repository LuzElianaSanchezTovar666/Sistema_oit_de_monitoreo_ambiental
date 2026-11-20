-- RF-06: Cola persistente de mensajes MQTT rechazados / cuarentena (DLQ)
-- Mantiene trazabilidad sin crecer ilimitadamente (retención controlada desde el servicio).

CREATE TABLE IF NOT EXISTS mqtt_mensajes_rechazados (
  id_rechazo BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  topico VARCHAR(180) NOT NULL,
  codigo_dispositivo VARCHAR(64) NULL,
  motivo VARCHAR(120) NOT NULL,
  detalle VARCHAR(255) NOT NULL,
  payload_resumido TEXT NULL,
  fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_rechazo),
  INDEX idx_dlq_fecha (fecha_hora),
  INDEX idx_dlq_motivo (motivo),
  INDEX idx_dlq_codigo (codigo_dispositivo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
