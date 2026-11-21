USE `simoa`;

ALTER TABLE dispositivos
  ADD COLUMN IF NOT EXISTS rssi_dbm INT NULL DEFAULT NULL AFTER ultimo_ping;

ALTER TABLE historial_conectividad_dispositivos
  ADD COLUMN IF NOT EXISTS rssi_dbm INT NULL DEFAULT NULL AFTER ultimo_ping;
