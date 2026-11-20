/**
 * Tipos y modelos de datos para el Sistema IoT de Monitoreo Ambiental
 * Conforme a especificaciones PRD, TRD y Modelo Entidad-Relación
 */

export type UserRole = 'admin' | 'cliente' | 'tecnico' | 'supervisor';

export interface Usuario {
  id_usuario: string;
  nombre: string;
  correo: string;
  rol: UserRole;
  cargo: string;
  empresa: string;
  avatar_url?: string;
  fecha_registro: string;
}

export interface Ubicacion {
  id_ubicacion: string;
  nombre: string;
  descripcion: string;
  codigo_area: string;
  temp_optima_min: number;
  temp_optima_max: number;
  hum_optima_min: number;
  hum_optima_max: number;
}

export type DeviceType = 'ESP32-WROOM' | 'ESP8266-NodeMCU' | 'Raspberry Pi Gateway 4B' | 'Industrial Gateway MQTTS';
export type DeviceState = 'ONLINE' | 'OFFLINE' | 'ADVERTENCIA' | 'ERROR';

export interface Dispositivo {
  id_dispositivo: string;
  mac_address: string;
  nombre: string;
  tipo: DeviceType;
  ubicacion_id: string;
  usuario_id: string;
  estado: DeviceState;
  ip_address: string;
  rssi_dbm: number;
  firmware_version: string;
  fecha_registro: string;
  ultimo_ping: string;
  mqtt_client_id: string;
  mqtt_topic: string;
}

export type SensorType = 'DHT22' | 'BME280' | 'DHT11' | 'SHT31';
export type SensorState = 'ACTIVO' | 'CALIBRACION' | 'FALLA';

export interface LimiteAmbiental {
  temp_min: number;
  temp_max: number;
  hum_min: number;
  hum_max: number;
  temp_critica_max: number;
  hum_critica_max: number;
}

export interface Sensor {
  id_sensor: string;
  dispositivo_id: string;
  tipo_sensor: SensorType;
  variables: ('temperatura' | 'humedad')[];
  unidad_temperatura: '°C';
  unidad_humedad: '%RH';
  estado: SensorState;
  fecha_instalacion: string;
  ultima_calibracion: string;
  limites: LimiteAmbiental;
}

export interface Medicion {
  id_medicion: string;
  sensor_id: string;
  dispositivo_id: string;
  ubicacion_id: string;
  temperatura: number;
  humedad: number;
  fecha_hora: string; // ISO 8601
  timestamp: number;
  valor_anomalo: boolean;
  score_anomalia_ia: number; // 0.0 - 1.0 (Isolation Forest estimate)
  z_score_temp: number;
  z_score_hum: number;
  es_fuera_de_umbral: boolean;
}

export type AlertSeverity = 'CRITICA' | 'ADVERTENCIA' | 'INFO';
export type AlertState = 'PENDIENTE' | 'ATENDIDA' | 'RESUELTA';

export interface Alerta {
  id_alerta: string;
  medicion_id?: string;
  dispositivo_id: string;
  sensor_id: string;
  ubicacion_id: string;
  tipo: 'LIMITE_SUPERADO' | 'ANOMALIA_IA' | 'DISPOSITIVO_OFFLINE' | 'ERROR_PAYLOAD';
  mensaje: string;
  variable_alterada?: 'temperatura' | 'humedad' | 'conexion';
  valor_registrado?: number;
  valor_limite?: number;
  nivel: AlertSeverity;
  fecha_hora: string;
  estado: AlertState;
  atendido_por?: string;
  motivo_resolucion?: string;
  notas_resolucion?: string;
  fecha_resolucion?: string;
}

export interface Mantenimiento {
  id_mantenimiento: string;
  dispositivo_id: string;
  sensor_id?: string;
  tecnico_id: string;
  tecnico_nombre: string;
  tipo_mantenimiento: 'CALIBRACION' | 'REEMPLAZO_BATERIA' | 'LIMPIEZA_SONDA' | 'ACTUALIZACION_FIRMWARE' | 'REVISION_GENERAL';
  descripcion: string;
  fecha_realizacion: string;
  proxima_fecha_sugerida: string;
  costo_estimado_usd?: number;
  estado: 'COMPLETADO' | 'PROGRAMADO';
}

export interface DLQEntry {
  id: string;
  topic: string;
  raw_payload: string;
  error_motivo: string;
  ip_origen: string;
  fecha_hora: string;
}

export interface AiDiagnosticReport {
  id: string;
  fecha: string;
  ubicacion: string;
  diagnostico_general: string;
  nivel_riesgo: 'BAJO' | 'MODERADO' | 'CRITICO';
  patrones_detectados: string[];
  recomendaciones_preventivas: string[];
  anomalias_detectadas: number;
  tiempo_inferencia_ms: number;
}
