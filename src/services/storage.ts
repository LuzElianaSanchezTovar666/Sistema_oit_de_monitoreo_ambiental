import {
  Usuario,
  Ubicacion,
  Dispositivo,
  Sensor,
  Alerta,
  Mantenimiento,
  DLQEntry,
} from '../types/iot';

export const USUARIOS_INICIALES: Usuario[] = [
  {
    id_usuario: 'usr-admin-1',
    nombre: 'Luz Eliana Sánchez Tovar',
    correo: 'admin@simoa-ejemplo.org',
    rol: 'admin',
    cargo: 'Desarrolladora & Administradora SIMOA',
    empresa: 'SIMOA · ADSO SENA',
    fecha_registro: '2026-01-10T08:00:00Z',
  },
  {
    id_usuario: 'usr-cliente-1',
    nombre: 'Dra. Elena Soto',
    correo: 'elena.soto@biolab-pharma.com',
    rol: 'cliente',
    cargo: 'Directora de Aseguramiento de Calidad',
    empresa: 'BioLab Pharma & Labs',
    fecha_registro: '2026-02-15T09:30:00Z',
  },
  {
    id_usuario: 'usr-tecnico-1',
    nombre: 'Rodrigo Ramos',
    correo: 'rodrigo.ramos@servicios-iot.com',
    rol: 'tecnico',
    cargo: 'Especialista de Campo & Calibración',
    empresa: 'Soporte Técnico Especializado',
    fecha_registro: '2026-03-01T10:15:00Z',
  },
  {
    id_usuario: 'usr-super-1',
    nombre: 'Lic. Mariana Vega',
    correo: 'mariana.vega@operaciones-planta.com',
    rol: 'supervisor',
    cargo: 'Supervisora General de Operaciones',
    empresa: 'EcoSense Systems HQ',
    fecha_registro: '2026-01-20T11:00:00Z',
  },
];

export const UBICACIONES_INICIALES: Ubicacion[] = [
  {
    id_ubicacion: 'ubi-lab-01',
    nombre: 'Zona de Germinación y Semilleros',
    descripcion: 'Área de propagación y plántulas del invernadero con control estricto de humedad y temperatura basal.',
    codigo_area: 'AREA-01',
    temp_optima_min: 20.0,
    temp_optima_max: 25.0,
    hum_optima_min: 65.0,
    hum_optima_max: 80.0,
  },
  {
    id_ubicacion: 'ubi-bio-02',
    nombre: 'Zona de Cultivo Hidropónico',
    descripcion: 'Nave central de producción vegetal y camas de cultivo hidropónico del invernadero.',
    codigo_area: 'AREA-02',
    temp_optima_min: 18.0,
    temp_optima_max: 26.0,
    hum_optima_min: 55.0,
    hum_optima_max: 75.0,
  },
  {
    id_ubicacion: 'ubi-cam-03',
    nombre: 'Zona de Ventilación y Nebulización',
    descripcion: 'Módulo de extractores, cortinas térmicas y aspersión para regulación microclimática del invernadero.',
    codigo_area: 'AREA-03',
    temp_optima_min: 18.0,
    temp_optima_max: 24.0,
    hum_optima_min: 60.0,
    hum_optima_max: 85.0,
  },
  {
    id_ubicacion: 'ubi-bod-04',
    nombre: 'Área de Fertirriego y Nutrientes',
    descripcion: 'Estación de preparación de soluciones nutritivas, tanques y bombeo de riego del invernadero.',
    codigo_area: 'AREA-04',
    temp_optima_min: 16.0,
    temp_optima_max: 22.0,
    hum_optima_min: 45.0,
    hum_optima_max: 65.0,
  },
];

export const DISPOSITIVOS_INICIALES: Dispositivo[] = [
  {
    id_dispositivo: 'dev-esp32-01',
    mac_address: '24:6F:28:B1:C0:04',
    nombre: 'Nodo Térmico Germinación 01',
    tipo: 'ESP32-WROOM',
    ubicacion_id: 'ubi-lab-01',
    usuario_id: 'usr-cliente-1',
    estado: 'ONLINE',
    ip_address: '192.168.10.45',
    rssi_dbm: -58,
    firmware_version: 'v2.4.1-esp32',
    fecha_registro: '2026-03-01T10:00:00Z',
    ultimo_ping: new Date().toISOString(),
    mqtt_client_id: 'esp32_germinacion_01',
    mqtt_topic: 'simoa/dispositivos/ESP32-GERM-01/telemetria',
  },
  {
    id_dispositivo: 'dev-esp32-02',
    mac_address: '30:AE:A4:79:3F:8A',
    nombre: 'Nodo Ambiental Cultivo Hidropónico 02',
    tipo: 'ESP32-WROOM',
    ubicacion_id: 'ubi-bio-02',
    usuario_id: 'usr-cliente-1',
    estado: 'ONLINE',
    ip_address: '192.168.10.48',
    rssi_dbm: -64,
    firmware_version: 'v2.4.1-esp32',
    fecha_registro: '2026-03-02T12:00:00Z',
    ultimo_ping: new Date().toISOString(),
    mqtt_client_id: 'esp32_cultivo_02',
    mqtt_topic: 'simoa/dispositivos/ESP32-CULT-02/telemetria',
  },
  {
    id_dispositivo: 'dev-esp8266-03',
    mac_address: '5C:CF:7F:1A:B9:90',
    nombre: 'Sonda Ventilación y Nebulización 03',
    tipo: 'ESP8266-NodeMCU',
    ubicacion_id: 'ubi-cam-03',
    usuario_id: 'usr-cliente-1',
    estado: 'ONLINE',
    ip_address: '192.168.10.52',
    rssi_dbm: -71,
    firmware_version: 'v1.9.8-nodemcu',
    fecha_registro: '2026-03-05T14:30:00Z',
    ultimo_ping: new Date().toISOString(),
    mqtt_client_id: 'nodemcu_ventilacion_03',
    mqtt_topic: 'simoa/dispositivos/ESP8266-VENT-03/telemetria',
  },
  {
    id_dispositivo: 'dev-rpi-04',
    mac_address: 'DC:A6:32:88:E1:1F',
    nombre: 'Gateway Fertirriego y Nutrientes 04',
    tipo: 'Raspberry Pi Gateway 4B',
    ubicacion_id: 'ubi-bod-04',
    usuario_id: 'usr-cliente-1',
    estado: 'ONLINE',
    ip_address: '192.168.10.2',
    rssi_dbm: -44,
    firmware_version: 'v3.1.0-gateway',
    fecha_registro: '2026-02-20T09:00:00Z',
    ultimo_ping: new Date().toISOString(),
    mqtt_client_id: 'gateway_fertirriego_04',
    mqtt_topic: 'simoa/dispositivos/GW-FERT-04/telemetria',
  },
];

export const SENSORES_INICIALES: Sensor[] = [
  {
    id_sensor: 'sens-dht22-01',
    dispositivo_id: 'dev-esp32-01',
    tipo_sensor: 'DHT22',
    variables: ['temperatura', 'humedad'],
    unidad_temperatura: '°C',
    unidad_humedad: '%RH',
    estado: 'ACTIVO',
    fecha_instalacion: '2026-03-01T10:00:00Z',
    ultima_calibracion: '2026-03-01T10:00:00Z',
    limites: {
      temp_min: 2.0,
      temp_max: 8.0,
      hum_min: 35.0,
      hum_max: 55.0,
      temp_critica_max: 10.0,
      hum_critica_max: 65.0,
    },
  },
  {
    id_sensor: 'sens-bme280-02',
    dispositivo_id: 'dev-esp32-02',
    tipo_sensor: 'BME280',
    variables: ['temperatura', 'humedad'],
    unidad_temperatura: '°C',
    unidad_humedad: '%RH',
    estado: 'ACTIVO',
    fecha_instalacion: '2026-03-02T12:00:00Z',
    ultima_calibracion: '2026-03-02T12:00:00Z',
    limites: {
      temp_min: 20.0,
      temp_max: 26.0,
      hum_min: 55.0,
      hum_max: 75.0,
      temp_critica_max: 30.0,
      hum_critica_max: 85.0,
    },
  },
  {
    id_sensor: 'sens-sht31-03',
    dispositivo_id: 'dev-esp8266-03',
    tipo_sensor: 'SHT31',
    variables: ['temperatura', 'humedad'],
    unidad_temperatura: '°C',
    unidad_humedad: '%RH',
    estado: 'ACTIVO',
    fecha_instalacion: '2026-03-05T14:30:00Z',
    ultima_calibracion: '2026-03-05T14:30:00Z',
    limites: {
      temp_min: -4.0,
      temp_max: 2.0,
      hum_min: 20.0,
      hum_max: 40.0,
      temp_critica_max: 4.0,
      hum_critica_max: 50.0,
    },
  },
  {
    id_sensor: 'sens-bme280-04',
    dispositivo_id: 'dev-rpi-04',
    tipo_sensor: 'BME280',
    variables: ['temperatura', 'humedad'],
    unidad_temperatura: '°C',
    unidad_humedad: '%RH',
    estado: 'ACTIVO',
    fecha_instalacion: '2026-02-20T09:00:00Z',
    ultima_calibracion: '2026-02-20T09:00:00Z',
    limites: {
      temp_min: 18.0,
      temp_max: 23.0,
      hum_min: 40.0,
      hum_max: 60.0,
      temp_critica_max: 27.0,
      hum_critica_max: 70.0,
    },
  },
];

export const ALERTAS_INICIALES: Alerta[] = [
  {
    id_alerta: 'alt-001',
    dispositivo_id: 'dev-esp32-01',
    sensor_id: 'sens-dht22-01',
    ubicacion_id: 'ub-vacunas-1',
    tipo: 'LIMITE_SUPERADO',
    mensaje: 'Temperatura sobrepasó el límite seguro operacional en Laboratorio de Vacunas B2 (8.4°C detectados, máx: 8.0°C).',
    variable_alterada: 'temperatura',
    valor_registrado: 8.4,
    valor_limite: 8.0,
    nivel: 'ADVERTENCIA',
    fecha_hora: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    estado: 'RESUELTA',
    atendido_por: 'Dra. Elena Soto',
    motivo_resolucion: 'Apertura momentánea para inventario matutino de reactivos',
    notas_resolucion: 'Cámara cerrada adecuadamente y retorno térmico a 4.2°C verificado.',
    fecha_resolucion: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
];

export const MANTENIMIENTOS_INICIALES: Mantenimiento[] = [
  {
    id_mantenimiento: 'mnt-001',
    dispositivo_id: 'dev-esp32-01',
    sensor_id: 'sens-dht22-01',
    tecnico_id: 'usr-tecnico-1',
    tecnico_nombre: 'Rodrigo Ramos',
    tipo_mantenimiento: 'CALIBRACION',
    descripcion: 'Calibración con higrómetro de referencia certificado Fluke 971 y cámara seca de calibración.',
    fecha_realizacion: '2026-03-01T11:00:00Z',
    proxima_fecha_sugerida: '2026-06-01T11:00:00Z',
    costo_estimado_usd: 120,
    estado: 'COMPLETADO',
  },
  {
    id_mantenimiento: 'mnt-002',
    dispositivo_id: 'dev-esp8266-03',
    sensor_id: 'sens-sht31-03',
    tecnico_id: 'usr-tecnico-1',
    tecnico_nombre: 'Rodrigo Ramos',
    tipo_mantenimiento: 'REEMPLAZO_BATERIA',
    descripcion: 'Sustitución de celda LiFePO4 de respaldo y verificación de estanqueidad IP67.',
    fecha_realizacion: '2026-03-05T15:00:00Z',
    proxima_fecha_sugerida: '2026-09-05T15:00:00Z',
    costo_estimado_usd: 65,
    estado: 'COMPLETADO',
  },
];

export const DLQ_INICIALES: DLQEntry[] = [];

// Helper functions for LocalStorage Persistence
const STORAGE_KEYS = {
  DISPOSITIVOS: 'ecosense_dispositivos',
  SENSORES: 'ecosense_sensores',
  UBICACIONES: 'ecosense_ubicaciones',
  ALERTAS: 'ecosense_alertas',
  MANTENIMIENTO: 'ecosense_mantenimiento',
  DLQ: 'ecosense_dlq',
  CURRENT_USER: 'ecosense_current_user',
  THEME: 'ecosense_theme',
};

export const getStoredDispositivos = (): Dispositivo[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DISPOSITIVOS);
    return raw ? JSON.parse(raw) : DISPOSITIVOS_INICIALES;
  } catch {
    return DISPOSITIVOS_INICIALES;
  }
};

export const saveStoredDispositivos = (items: Dispositivo[]) => {
  localStorage.setItem(STORAGE_KEYS.DISPOSITIVOS, JSON.stringify(items));
};

export const getStoredSensores = (): Sensor[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SENSORES);
    return raw ? JSON.parse(raw) : SENSORES_INICIALES;
  } catch {
    return SENSORES_INICIALES;
  }
};

export const saveStoredSensores = (items: Sensor[]) => {
  localStorage.setItem(STORAGE_KEYS.SENSORES, JSON.stringify(items));
};

export const getStoredAlertas = (): Alerta[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ALERTAS);
    return raw ? JSON.parse(raw) : ALERTAS_INICIALES;
  } catch {
    return ALERTAS_INICIALES;
  }
};

export const saveStoredAlertas = (items: Alerta[]) => {
  localStorage.setItem(STORAGE_KEYS.ALERTAS, JSON.stringify(items));
};

export const getStoredMantenimientos = (): Mantenimiento[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MANTENIMIENTO);
    return raw ? JSON.parse(raw) : MANTENIMIENTOS_INICIALES;
  } catch {
    return MANTENIMIENTOS_INICIALES;
  }
};

export const saveStoredMantenimientos = (items: Mantenimiento[]) => {
  localStorage.setItem(STORAGE_KEYS.MANTENIMIENTO, JSON.stringify(items));
};

export const getStoredDLQ = (): DLQEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DLQ);
    return raw ? JSON.parse(raw) : DLQ_INICIALES;
  } catch {
    return DLQ_INICIALES;
  }
};

export const saveStoredDLQ = (items: DLQEntry[]) => {
  localStorage.setItem(STORAGE_KEYS.DLQ, JSON.stringify(items));
};
