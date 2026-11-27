USE `simoa`;

CREATE TABLE IF NOT EXISTS revisiones_datos (
  recurso VARCHAR(32) NOT NULL PRIMARY KEY,
  version BIGINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO revisiones_datos (recurso) VALUES
  ('ubicaciones'), ('dispositivos'), ('sensores'), ('umbrales'), ('mantenimientos'), ('alertas');

-- Las versiones se actualizan en la misma transacción que el dato.

CREATE TRIGGER IF NOT EXISTS rev_ubicaciones_insert
AFTER INSERT ON ubicaciones FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'ubicaciones';

CREATE TRIGGER IF NOT EXISTS rev_ubicaciones_update
AFTER UPDATE ON ubicaciones FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'ubicaciones';

CREATE TRIGGER IF NOT EXISTS rev_ubicaciones_delete
AFTER DELETE ON ubicaciones FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'ubicaciones';

CREATE TRIGGER IF NOT EXISTS rev_dispositivos_insert
AFTER INSERT ON dispositivos FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'dispositivos';

CREATE TRIGGER IF NOT EXISTS rev_dispositivos_update
AFTER UPDATE ON dispositivos FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'dispositivos'
  AND NOT (
    (OLD.id_dispositivo <=> NEW.id_dispositivo)
    AND (OLD.id_usuario <=> NEW.id_usuario)
    AND (OLD.codigo <=> NEW.codigo)
    AND (CAST(OLD.nombre AS BINARY) <=> CAST(NEW.nombre AS BINARY))
    AND (OLD.mac_address <=> NEW.mac_address)
    AND (OLD.tipo <=> NEW.tipo)
    AND (OLD.ubicacion_id <=> NEW.ubicacion_id)
    AND (CAST(OLD.ubicacion AS BINARY) <=> CAST(NEW.ubicacion AS BINARY))
    AND (OLD.estado <=> NEW.estado)
    AND (CAST(OLD.firmware_version AS BINARY) <=> CAST(NEW.firmware_version AS BINARY))
    AND (CAST(OLD.observacion_tecnica AS BINARY) <=> CAST(NEW.observacion_tecnica AS BINARY))
    AND (CAST(OLD.mqtt_client_id AS BINARY) <=> CAST(NEW.mqtt_client_id AS BINARY))
    AND (CAST(OLD.mqtt_topic AS BINARY) <=> CAST(NEW.mqtt_topic AS BINARY))
    AND (CAST(OLD.mqtt_username AS BINARY) <=> CAST(NEW.mqtt_username AS BINARY))
    AND (OLD.ip_address <=> NEW.ip_address)
  );

CREATE TRIGGER IF NOT EXISTS rev_dispositivos_delete
AFTER DELETE ON dispositivos FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'dispositivos';

CREATE TRIGGER IF NOT EXISTS rev_sensores_insert
AFTER INSERT ON sensores FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'sensores';

CREATE TRIGGER IF NOT EXISTS rev_sensores_update
AFTER UPDATE ON sensores FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'sensores';

CREATE TRIGGER IF NOT EXISTS rev_sensores_delete
AFTER DELETE ON sensores FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'sensores';

CREATE TRIGGER IF NOT EXISTS rev_configuracion_variables_sensor_insert
AFTER INSERT ON configuracion_variables_sensor FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'sensores';

CREATE TRIGGER IF NOT EXISTS rev_configuracion_variables_sensor_update
AFTER UPDATE ON configuracion_variables_sensor FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'sensores';

CREATE TRIGGER IF NOT EXISTS rev_configuracion_variables_sensor_delete
AFTER DELETE ON configuracion_variables_sensor FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'sensores';

CREATE TRIGGER IF NOT EXISTS rev_umbrales_alerta_insert
AFTER INSERT ON umbrales_alerta FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'umbrales';

CREATE TRIGGER IF NOT EXISTS rev_umbrales_alerta_update
AFTER UPDATE ON umbrales_alerta FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'umbrales';

CREATE TRIGGER IF NOT EXISTS rev_umbrales_alerta_delete
AFTER DELETE ON umbrales_alerta FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'umbrales';

CREATE TRIGGER IF NOT EXISTS rev_mantenimientos_insert
AFTER INSERT ON mantenimientos FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'mantenimientos';

CREATE TRIGGER IF NOT EXISTS rev_mantenimientos_update
AFTER UPDATE ON mantenimientos FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'mantenimientos';

CREATE TRIGGER IF NOT EXISTS rev_mantenimientos_delete
AFTER DELETE ON mantenimientos FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'mantenimientos';

CREATE TRIGGER IF NOT EXISTS rev_alertas_insert
AFTER INSERT ON alertas FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'alertas';

CREATE TRIGGER IF NOT EXISTS rev_alertas_update
AFTER UPDATE ON alertas FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'alertas';

CREATE TRIGGER IF NOT EXISTS rev_alertas_delete
AFTER DELETE ON alertas FOR EACH ROW
UPDATE revisiones_datos SET version = version + 1 WHERE recurso = 'alertas';
