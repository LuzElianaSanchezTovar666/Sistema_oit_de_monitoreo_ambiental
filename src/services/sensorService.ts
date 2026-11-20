export type SensorModelo = 'DHT22' | 'BME280' | 'SHT31';
export type SensorEstado = 'ACTIVO' | 'FALLA' | 'CALIBRACION' | 'INACTIVO';
export type VariableNombre = 'temperatura' | 'humedad' | 'presion';

export interface VariableMedida {
  variable: VariableNombre;
  unidad: string;
}

export interface SensorDTO {
  id_sensor: string;
  dispositivo_id: string;
  dispositivo_nombre?: string | null;
  dispositivo_codigo?: string | null;
  dispositivo_estado?: string | null;
  ubicacion_id?: string | null;
  ubicacion_nombre?: string | null;
  identificador: string;
  modelo: SensorModelo;
  variables_medidas: VariableMedida[];
  fecha_instalacion: string;
  ultima_calibracion: string;
  estado: SensorEstado;
  descripcion?: string | null;
  historial_mediciones_count: number;
  fecha_creacion?: string | null;
  fecha_actualizacion?: string | null;
}

export interface SensorConfiguracionDTO {
  sensor_id: string;
  temp_min: number | null;
  temp_max: number | null;
  hum_min: number | null;
  hum_max: number | null;
  presion_min: number | null;
  presion_max: number | null;
  es_predeterminado: boolean;
  actualizado_por?: string | null;
  fecha_actualizacion?: string | null;
}

export const MODEL_CAPABILITIES: Record<SensorModelo, VariableMedida[]> = {
  DHT22: [
    { variable: 'temperatura', unidad: '°C' },
    { variable: 'humedad', unidad: '%RH' },
  ],
  BME280: [
    { variable: 'temperatura', unidad: '°C' },
    { variable: 'humedad', unidad: '%RH' },
    { variable: 'presion', unidad: 'hPa' },
  ],
  SHT31: [
    { variable: 'temperatura', unidad: '°C' },
    { variable: 'humedad', unidad: '%RH' },
  ],
};

export function areSensorDatesCoherent(
  fechaInstalacion: string,
  ultimaCalibracion: string
): boolean {
  if (!fechaInstalacion || !ultimaCalibracion) return false;
  return ultimaCalibracion >= fechaInstalacion;
}

function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith('simoa_csrf='));
  return match ? decodeURIComponent(match.split('=')[1] || '') : '';
}

function buildMutationHeaders(): Record<string, string> {
  const csrf = getCsrfToken();
  return {
    'Content-Type': 'application/json',
    ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
  };
}

export async function fetchSensores(params?: {
  dispositivo_id?: string;
  modelo?: string;
  estado?: string;
  search?: string;
}): Promise<{ items: SensorDTO[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.dispositivo_id) query.set('dispositivo_id', params.dispositivo_id);
  if (params?.modelo && params.modelo !== 'ALL') query.set('modelo', params.modelo);
  if (params?.estado && params.estado !== 'ALL') query.set('estado', params.estado);
  if (params?.search) query.set('search', params.search);
  const qs = query.toString();

  const res = await fetch(`/api/sensores${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar sensores.');
  }
  return data;
}

export async function fetchSensoresByDispositivo(
  dispositivoId: string
): Promise<{ items: SensorDTO[]; total: number }> {
  const res = await fetch(`/api/dispositivos/${encodeURIComponent(dispositivoId)}/sensores`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar sensores del dispositivo.');
  }
  return data;
}

export async function createSensor(payload: {
  dispositivo_id: string;
  identificador: string;
  modelo: SensorModelo;
  variables: VariableNombre[];
  fecha_instalacion: string;
  ultima_calibracion: string;
  estado: SensorEstado;
  descripcion?: string;
}): Promise<{ message: string; sensor: SensorDTO }> {
  const res = await fetch('/api/sensores', {
    method: 'POST',
    credentials: 'include',
    headers: buildMutationHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'No fue posible registrar el sensor.');
  }
  return data;
}

export async function updateSensor(
  idSensor: string,
  payload: {
    identificador: string;
    modelo: SensorModelo;
    variables: VariableNombre[];
    fecha_instalacion: string;
    ultima_calibracion: string;
    descripcion?: string;
  }
): Promise<{ message: string; sensor: SensorDTO }> {
  const res = await fetch(`/api/sensores/${encodeURIComponent(idSensor)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: buildMutationHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'No fue posible actualizar el sensor.');
  }
  return data;
}

export async function changeSensorEstado(
  idSensor: string,
  estado: SensorEstado
): Promise<{ message: string; sensor: SensorDTO }> {
  const res = await fetch(`/api/sensores/${encodeURIComponent(idSensor)}/estado`, {
    method: 'PATCH',
    credentials: 'include',
    headers: buildMutationHeaders(),
    body: JSON.stringify({ estado }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'No fue posible cambiar el estado del sensor.');
  }
  return data;
}

export async function fetchSensorConfiguracion(
  idSensor: string
): Promise<{ configuracion: SensorConfiguracionDTO | null }> {
  const res = await fetch(`/api/sensores/${encodeURIComponent(idSensor)}/configuraciones`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar la configuración del sensor.');
  }
  return data;
}

// ============================================================
// RF-05: Configuración de Magnitudes y Variables Monitoreadas
// ============================================================

export interface SensorVariablesConfigDTO {
  id_configuracion: string;
  sensor_id: string;
  identificador: string;
  modelo: SensorModelo;
  estado: SensorEstado;
  dispositivo_id: string;
  dispositivo_nombre?: string | null;
  ubicacion_id?: string | null;
  ubicacion_nombre?: string | null;
  variables_disponibles: VariableMedida[];
  temperatura_habilitada: boolean;
  humedad_habilitada: boolean;
  presion_habilitada: boolean;
  unidad_temperatura: string;
  unidad_humedad: string;
  unidad_presion?: string | null;
  variables_habilitadas: VariableMedida[];
  actualizado_por?: string | null;
  fecha_creacion?: string | null;
  fecha_actualizacion?: string | null;
}

export interface SensorVariablesUpdatePayload {
  temperatura_habilitada: boolean;
  humedad_habilitada: boolean;
  presion_habilitada?: boolean;
  unidad_temperatura: '°C';
  unidad_humedad: '%RH';
  unidad_presion?: 'hPa' | null;
}

export interface SensorConfigHistoryItemDTO {
  id_historial: number;
  configuracion_id: string;
  sensor_id: string;
  temperatura_habilitada: boolean;
  humedad_habilitada: boolean;
  presion_habilitada: boolean;
  unidad_temperatura: string;
  unidad_humedad: string;
  unidad_presion?: string | null;
  variables_snapshot: VariableMedida[];
  usuario_responsable: string;
  fecha_cambio: string;
}

export interface DashboardTelemetrySensorDTO extends SensorVariablesConfigDTO {
  limites: {
    temp_min: number | null;
    temp_max: number | null;
    hum_min: number | null;
    hum_max: number | null;
    presion_min: number | null;
    presion_max: number | null;
  };
}

export interface DashboardTelemetryItemDTO {
  id_medicion: number;
  dispositivo_id: string;
  sensor_id: string | null;
  ubicacion_id: string | null;
  temperatura: number | null;
  humedad: number | null;
  presion: number | null;
  alerta_generada: boolean;
  configuracion_id?: string | null;
  variables_activas_snapshot?: string[] | null;
  fecha_hora: string;
}

export interface DashboardTelemetryResponseDTO {
  sensores: DashboardTelemetrySensorDTO[];
  mediciones: DashboardTelemetryItemDTO[];
}

export function validateSensorVariablesSelection(
  modelo: SensorModelo,
  temperaturaHabilitada: boolean,
  humedadHabilitada: boolean,
  presionHabilitada: boolean = false
): string | null {
  const caps = MODEL_CAPABILITIES[modelo] || [];
  const supportsPres = caps.some((c) => c.variable === 'presion');
  if (presionHabilitada && !supportsPres) {
    return `El modelo ${modelo} no admite la variable presión atmosférica.`;
  }
  if (!temperaturaHabilitada && !humedadHabilitada && !(presionHabilitada && supportsPres)) {
    return 'Debe seleccionar al menos una variable ambiental';
  }
  return null;
}

export async function fetchSensorVariables(
  idSensor: string
): Promise<{ configuracion: SensorVariablesConfigDTO }> {
  const res = await fetch(`/api/sensores/${encodeURIComponent(idSensor)}/variables`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar las variables del sensor.');
  }
  return data;
}

export async function updateSensorVariables(
  idSensor: string,
  payload: SensorVariablesUpdatePayload
): Promise<{ message: string; configuracion: SensorVariablesConfigDTO }> {
  const res = await fetch(`/api/sensores/${encodeURIComponent(idSensor)}/variables`, {
    method: 'PUT',
    credentials: 'include',
    headers: buildMutationHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'No fue posible actualizar la configuración de variables.');
  }
  return data;
}

export async function fetchSensorConfigHistory(
  idSensor: string
): Promise<{ items: SensorConfigHistoryItemDTO[]; total: number }> {
  const res = await fetch(`/api/sensores/${encodeURIComponent(idSensor)}/historial-configuraciones`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar el historial de configuraciones.');
  }
  return data;
}

export async function fetchDashboardTelemetry(filters?: {
  ubicacion_id?: string;
  dispositivo_id?: string;
  sensor_id?: string;
  limit?: number;
}): Promise<DashboardTelemetryResponseDTO> {
  const qs = new URLSearchParams();
  if (filters?.ubicacion_id) qs.set('ubicacion_id', filters.ubicacion_id);
  if (filters?.dispositivo_id) qs.set('dispositivo_id', filters.dispositivo_id);
  if (filters?.sensor_id) qs.set('sensor_id', filters.sensor_id);
  if (filters?.limit) qs.set('limit', String(filters.limit));

  const query = qs.toString();
  const res = await fetch(`/api/dashboard/telemetria${query ? `?${query}` : ''}`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar telemetría del dashboard.');
  }
  return data;
}

// ============================================================
// RF-08: Visualización en Tiempo Real de la Temperatura Actual (°C)
// ============================================================

export type ThermalStateRF08 = 'NOMINAL' | 'FUERA DE RANGO' | 'SIN_CONFIGURACION' | 'ESPERANDO_DATOS';

export interface LocationTemperatureSnapshotDTO {
  ubicacion_id: string;
  ubicacion_nombre: string;
  codigo_area: string;
  sensor_id: string | null;
  sensor_identificador: string | null;
  sensor_modelo: string | null;
  sensor_estado: string | null;
  dispositivo_id: string | null;
  temperatura_actual: number | null;
  unidad: '°C';
  temp_min: number | null;
  temp_max: number | null;
  estado_termico: ThermalStateRF08;
  estado_operativo: string;
  datos_recientes: boolean;
  antiguedad_max_segundos: number;
  z_score: number | null;
  z_score_disponible: boolean;
  z_score_motivo: string;
  z_score_muestras: number;
  fecha_hora_utc: string | null;
}

export function evaluateThermalStatus(
  temperatura: number | null,
  tempMin: number | null,
  tempMax: number | null
): ThermalStateRF08 {
  if (temperatura === null || !Number.isFinite(temperatura)) return 'ESPERANDO_DATOS';
  if (tempMin === null || tempMax === null) return 'SIN_CONFIGURACION';
  return temperatura >= tempMin && temperatura <= tempMax ? 'NOMINAL' : 'FUERA DE RANGO';
}

export interface ThermalGaugeGeometry {
  hasScale: boolean;
  scaleMin: number;
  scaleMax: number;
  nominalStartPct: number;
  nominalWidthPct: number;
  markerPct: number | null;
}

export function computeThermalGaugeGeometry(
  temperatura: number | null,
  tempMin: number | null,
  tempMax: number | null
): ThermalGaugeGeometry {
  if (tempMin === null || tempMax === null || tempMax <= tempMin) {
    return {
      hasScale: false,
      scaleMin: 0,
      scaleMax: 0,
      nominalStartPct: 0,
      nominalWidthPct: 0,
      markerPct: null,
    };
  }
  const margin = Math.max(2, (tempMax - tempMin) * 0.25);
  const scaleMin = tempMin - margin;
  const scaleMax = tempMax + margin;
  const span = scaleMax - scaleMin;
  const nominalStartPct = ((tempMin - scaleMin) / span) * 100;
  const nominalWidthPct = ((tempMax - tempMin) / span) * 100;
  const markerPct =
    temperatura !== null && Number.isFinite(temperatura)
      ? Math.min(100, Math.max(0, ((temperatura - scaleMin) / span) * 100))
      : null;

  return {
    hasScale: true,
    scaleMin,
    scaleMax,
    nominalStartPct,
    nominalWidthPct,
    markerPct,
  };
}

export async function fetchLocationTemperature(
  ubicacionId: string
): Promise<LocationTemperatureSnapshotDTO> {
  const res = await fetch(
    `/api/mediciones/ubicacion/${encodeURIComponent(ubicacionId)}/temperatura-actual`,
    {
      method: 'GET',
      credentials: 'include',
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar la temperatura actual de la ubicación.');
  }
  return data;
}
