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
  temp_critico_min?: number | null;
  temp_critico_max?: number | null;
  hum_min: number | null;
  hum_max: number | null;
  hum_critico_min?: number | null;
  hum_critico_max?: number | null;
  presion_min: number | null;
  presion_max: number | null;
  es_predeterminado: boolean;
  version?: number;
  actualizado_por?: string | null;
  fecha_actualizacion?: string | null;
}

export const MODEL_TEMP_RANGES: Record<SensorModelo, { min: number; max: number }> = {
  DHT22: { min: -40, max: 80 },
  BME280: { min: -40, max: 85 },
  SHT31: { min: -40, max: 125 },
};

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

export function buildMutationHeaders(): Record<string, string> {
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
  score_anomalia_ia?: number | null;
  es_fuera_de_umbral?: boolean;
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
      cache: 'no-store',
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar la temperatura actual de la ubicación.');
  }
  return data;
}

// ============================================================
// RF-09: Visualización en Tiempo Real de la Humedad Relativa (%RH)
// ============================================================

export interface LocationHumiditySnapshotDTO {
  ubicacion_id: string;
  ubicacion_nombre: string;
  codigo_area: string;
  sensor_id: string | null;
  sensor_identificador: string | null;
  sensor_modelo: string | null;
  sensor_estado: string | null;
  dispositivo_id: string | null;
  humedad_actual: number | null;
  unidad: '%RH';
  hum_min: number | null;
  hum_max: number | null;
  estado_humedad: ThermalStateRF08;
  estado_operativo: string;
  datos_recientes: boolean;
  antiguedad_max_segundos: number;
  z_score: number | null;
  z_score_disponible: boolean;
  z_score_motivo: string;
  z_score_muestras: number;
  fecha_hora_utc: string | null;
}

export function evaluateHumidityStatus(
  humedad: number | null,
  humMin: number | null,
  humMax: number | null
): ThermalStateRF08 {
  if (humedad === null || !Number.isFinite(humedad) || humedad < 0 || humedad > 100) {
    return 'ESPERANDO_DATOS';
  }
  return evaluateThermalStatus(humedad, humMin, humMax);
}

export async function fetchLocationHumidity(
  ubicacionId: string
): Promise<LocationHumiditySnapshotDTO> {
  const res = await fetch(
    `/api/mediciones/ubicacion/${encodeURIComponent(ubicacionId)}/humedad-actual`,
    {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar la humedad actual de la ubicación.');
  }
  return data;
}

// ============================================================
// RF-10: Consulta y Filtrado Histórico de Mediciones
// ============================================================

export interface HistoricalMeasurementItemDTO {
  id_medicion: number;
  dispositivo_id: string;
  dispositivo_nombre?: string | null;
  dispositivo_codigo?: string | null;
  sensor_id?: string | null;
  sensor_identificador?: string | null;
  sensor_modelo?: string | null;
  ubicacion_id?: string | null;
  ubicacion_nombre?: string | null;
  ubicacion_codigo_area?: string | null;
  temperatura: number | null;
  humedad: number | null;
  presion: number | null;
  es_fuera_de_umbral: boolean | null;
  estado_evaluacion: 'Conforme' | 'Fuera de umbral' | 'No evaluable';
  fecha_hora_utc: string;
}

export interface HistoricalVariableStatsDTO {
  muestras: number;
  unidad: string;
  minimo: number | null;
  maximo: number | null;
  promedio: number | null;
  desviacion_estandar: number | null;
}

export interface HistoricalStatsDTO {
  total_registros_filtrados: number;
  desviacion_tipo: 'muestral';
  criterio_cumplimiento: string;
  temperatura: HistoricalVariableStatsDTO;
  humedad: HistoricalVariableStatsDTO;
  cumplimiento: {
    mediciones_evaluables: number;
    mediciones_conformes: number;
    porcentaje: number | null;
  };
}

export interface HistoricalQueryParams {
  fecha_inicio?: string;
  fecha_fin?: string;
  ubicacion_id?: string;
  dispositivo_id?: string;
  sensor_id?: string;
  page?: number;
  page_size?: number;
}

export interface HistoricalQueryResponseDTO {
  items: HistoricalMeasurementItemDTO[];
  page: number;
  page_size: number;
  total_records: number;
  total_pages: number;
  estadisticas: HistoricalStatsDTO;
  zona_horaria: 'UTC';
}

export function validateHistoricalDateRange(fechaInicio?: string, fechaFin?: string): string | null {
  if (fechaInicio && fechaFin && fechaInicio.trim() && fechaFin.trim()) {
    if (fechaInicio.trim() > fechaFin.trim()) {
      return 'La fecha inicial no puede ser mayor a la final';
    }
  }
  return null;
}

export async function fetchHistoricalMeasurements(
  params: HistoricalQueryParams,
  signal?: AbortSignal
): Promise<HistoricalQueryResponseDTO> {
  const qs = new URLSearchParams();
  if (params.fecha_inicio) qs.set('fecha_inicio', params.fecha_inicio);
  if (params.fecha_fin) qs.set('fecha_fin', params.fecha_fin);
  if (params.ubicacion_id) qs.set('ubicacion_id', params.ubicacion_id);
  if (params.dispositivo_id) qs.set('dispositivo_id', params.dispositivo_id);
  if (params.sensor_id) qs.set('sensor_id', params.sensor_id);
  qs.set('page', String(params.page ?? 1));
  qs.set('page_size', String(params.page_size ?? 20));
  qs.set('tz_offset_minutes', String(new Date().getTimezoneOffset()));

  const res = await fetch(`/api/mediciones/historico?${qs.toString()}`, {
    method: 'GET',
    credentials: 'include',
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar el historial de mediciones.');
  }
  return data;
}

// ============================================================
// RF-11: Generación de Gráficos de Tendencia Dinámicos (SVG)
// ============================================================

export interface TrendPointDTO {
  segmento_temperatura?: number | null;
  segmento_humedad?: number | null;
  id_medicion: number;
  sensor_id: string | null;
  sensor_identificador?: string | null;
  sensor_modelo?: string | null;
  dispositivo_id: string;
  ubicacion_id: string | null;
  temperatura: number | null;
  humedad: number | null;
  es_fuera_de_umbral: boolean | null;
  estado_evaluacion: 'Conforme' | 'Fuera de umbral' | 'No evaluable';
  score_anomalia_ia: number | null;
  es_anomalia_ia: boolean;
  fecha_hora_utc: string;
}

export interface TrendLimitMetaDTO {
  min: number | null;
  max: number | null;
  vigente_desde_utc: string | null;
  vigencia_completa: boolean;
  motivo: string | null;
}

export interface HistoricalTrendResponseDTO {
  series: TrendPointDTO[];
  total_original: number;
  total_retornados: number;
  reducido: boolean;
  estrategia_reduccion: 'none' | 'extremes_and_anomalies_bucket';
  anomalias_ia_disponibles: boolean;
  limites: {
    temperatura: TrendLimitMetaDTO;
    humedad: TrendLimitMetaDTO;
  };
  zona_horaria: 'UTC';
}

export const INSUFFICIENT_TREND_MESSAGE =
  'Recolección inicial de datos en curso. Aún no hay suficientes mediciones para visualizar una tendencia';

export function getTrendInsufficientMessage(validCount: number): string | null {
  return validCount < 2 ? INSUFFICIENT_TREND_MESSAGE : null;
}

export function computeTrendAxisBounds(
  values: number[],
  limitMin: number | null,
  limitMax: number | null,
  isHumidity: boolean
): { min: number; max: number } {
  const candidates = [...values];
  if (limitMin !== null) candidates.push(limitMin);
  if (limitMax !== null) candidates.push(limitMax);

  if (candidates.length === 0) {
    return isHumidity ? { min: 0, max: 100 } : { min: 15, max: 30 };
  }

  let rawMin = Math.min(...candidates);
  let rawMax = Math.max(...candidates);
  if (rawMax - rawMin < 2) {
    rawMin -= 1;
    rawMax += 1;
  } else {
    const pad = (rawMax - rawMin) * 0.12;
    rawMin -= pad;
    rawMax += pad;
  }

  if (isHumidity) {
    rawMin = Math.max(0, Math.floor(rawMin));
    rawMax = Math.min(100, Math.ceil(rawMax));
    if (rawMax <= rawMin) {
      return { min: 0, max: 100 };
    }
    return { min: rawMin, max: rawMax };
  }

  return { min: Math.floor(rawMin * 10) / 10, max: Math.ceil(rawMax * 10) / 10 };
}

export async function fetchHistoricalTrends(
  params: Omit<HistoricalQueryParams, 'page' | 'page_size'> & { max_points?: number },
  signal?: AbortSignal
): Promise<HistoricalTrendResponseDTO> {
  const qs = new URLSearchParams();
  if (params.fecha_inicio) qs.set('fecha_inicio', params.fecha_inicio);
  if (params.fecha_fin) qs.set('fecha_fin', params.fecha_fin);
  if (params.ubicacion_id) qs.set('ubicacion_id', params.ubicacion_id);
  if (params.dispositivo_id) qs.set('dispositivo_id', params.dispositivo_id);
  if (params.sensor_id) qs.set('sensor_id', params.sensor_id);
  qs.set('max_points', String(params.max_points ?? 300));
  qs.set('tz_offset_minutes', String(new Date().getTimezoneOffset()));

  const res = await fetch(`/api/mediciones/tendencias?${qs.toString()}`, {
    method: 'GET',
    credentials: 'include',
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar las tendencias de telemetría.');
  }
  return data;
}

// ============================================================
// RF-12: Configuración de Límites y Umbrales Ambientales
// ============================================================

export interface ThresholdFormValues {
  temp_min: string;
  temp_max: string;
  temp_critico_min: string;
  temp_critico_max: string;
  hum_min: string;
  hum_max: string;
  hum_critico_min: string;
  hum_critico_max: string;
  presion_min: string;
  presion_max: string;
  motivo?: string;
}

export interface ThresholdUpsertPayload {
  temp_min?: number | null;
  temp_max?: number | null;
  temp_critico_min?: number | null;
  temp_critico_max?: number | null;
  hum_min?: number | null;
  hum_max?: number | null;
  hum_critico_min?: number | null;
  hum_critico_max?: number | null;
  presion_min?: number | null;
  presion_max?: number | null;
  expected_version?: number | null;
  motivo?: string | null;
}

export interface ThresholdEffectiveResponse {
  message?: string;
  precedencia: string;
  sensor: {
    id_sensor: string;
    identificador: string;
    modelo: SensorModelo;
    estado: SensorEstado;
    variables_medidas: VariableNombre[];
    rango_modelo_temperatura: { min: number; max: number };
    dispositivo_id: string;
    dispositivo_nombre?: string | null;
    ubicacion_id?: string | null;
    ubicacion_nombre?: string | null;
    codigo_area?: string | null;
  };
  configuracion: SensorConfiguracionDTO | null;
}

export interface ThresholdHistoryItemDTO extends SensorConfiguracionDTO {
  id_historial: string;
  motivo?: string | null;
  vigente_desde?: string | null;
  vigente_hasta?: string | null;
}

export const RF12_MIN_MAX_ERROR = 'El límite mínimo debe ser estrictamente menor que el límite máximo';

function parseFiniteField(raw: string, label: string): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: `El campo '${label}' es obligatorio y debe ser un número finito.` };
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    return { ok: false, error: `El campo '${label}' debe ser un número finito válido.` };
  }
  return { ok: true, value: Math.round(num * 100) / 100 };
}

export function validateThresholdsClient(
  modelo: SensorModelo,
  measuredVars: VariableNombre[],
  form: ThresholdFormValues
): { valid: true; payload: ThresholdUpsertPayload } | { valid: false; error: string } {
  const payload: ThresholdUpsertPayload = {
    motivo: form.motivo?.trim() || undefined,
  };

  if (measuredVars.includes('temperatura')) {
    const tMin = parseFiniteField(form.temp_min, 'Temperatura mínima operacional');
    if (!tMin.ok) return { valid: false, error: tMin.error };
    const tMax = parseFiniteField(form.temp_max, 'Temperatura máxima operacional');
    if (!tMax.ok) return { valid: false, error: tMax.error };

    if (tMin.value >= tMax.value) {
      return { valid: false, error: RF12_MIN_MAX_ERROR };
    }

    const tCritMin = parseFiniteField(form.temp_critico_min, 'Temperatura crítica inferior');
    if (!tCritMin.ok) return { valid: false, error: tCritMin.error };
    const tCritMax = parseFiniteField(form.temp_critico_max, 'Temperatura crítica superior');
    if (!tCritMax.ok) return { valid: false, error: tCritMax.error };

    if (!(tCritMin.value < tMin.value && tMin.value < tMax.value && tMax.value < tCritMax.value)) {
      return {
        valid: false,
        error: 'La temperatura debe cumplir: critico_inferior < temp_min < temp_max < critico_superior.',
      };
    }

    const bounds = MODEL_TEMP_RANGES[modelo] ?? { min: -40, max: 85 };
    for (const [label, val] of [
      ['Temperatura crítica inferior', tCritMin.value],
      ['Temperatura mínima operacional', tMin.value],
      ['Temperatura máxima operacional', tMax.value],
      ['Temperatura crítica superior', tCritMax.value],
    ] as const) {
      if (val < bounds.min || val > bounds.max) {
        return {
          valid: false,
          error: `${label} (${val} °C) está fuera del rango del modelo ${modelo} (${bounds.min} °C a ${bounds.max} °C).`,
        };
      }
    }

    payload.temp_min = tMin.value;
    payload.temp_max = tMax.value;
    payload.temp_critico_min = tCritMin.value;
    payload.temp_critico_max = tCritMax.value;
  }

  if (measuredVars.includes('humedad')) {
    const hMin = parseFiniteField(form.hum_min, 'Humedad mínima operacional');
    if (!hMin.ok) return { valid: false, error: hMin.error };
    const hMax = parseFiniteField(form.hum_max, 'Humedad máxima operacional');
    if (!hMax.ok) return { valid: false, error: hMax.error };

    if (hMin.value >= hMax.value) {
      return { valid: false, error: RF12_MIN_MAX_ERROR };
    }

    const hCritMin = parseFiniteField(form.hum_critico_min, 'Humedad crítica inferior');
    if (!hCritMin.ok) return { valid: false, error: hCritMin.error };
    const hCritMax = parseFiniteField(form.hum_critico_max, 'Humedad crítica superior');
    if (!hCritMax.ok) return { valid: false, error: hCritMax.error };

    if (!(hCritMin.value < hMin.value && hMin.value < hMax.value && hMax.value < hCritMax.value)) {
      return {
        valid: false,
        error: 'La humedad relativa debe cumplir: critico_inferior < hum_min < hum_max < critico_superior.',
      };
    }

    for (const [label, val] of [
      ['Humedad crítica inferior', hCritMin.value],
      ['Humedad mínima operacional', hMin.value],
      ['Humedad máxima operacional', hMax.value],
      ['Humedad crítica superior', hCritMax.value],
    ] as const) {
      if (val < 0 || val > 100) {
        return {
          valid: false,
          error: `${label} (${val} %RH) debe estar entre 0 % y 100 %.`,
        };
      }
    }

    payload.hum_min = hMin.value;
    payload.hum_max = hMax.value;
    payload.hum_critico_min = hCritMin.value;
    payload.hum_critico_max = hCritMax.value;
  }

  if (measuredVars.includes('presion')) {
    const hasPresMin = form.presion_min.trim().length > 0;
    const hasPresMax = form.presion_max.trim().length > 0;
    if (hasPresMin || hasPresMax) {
      const pMin = parseFiniteField(form.presion_min, 'Presión mínima');
      if (!pMin.ok) return { valid: false, error: pMin.error };
      const pMax = parseFiniteField(form.presion_max, 'Presión máxima');
      if (!pMax.ok) return { valid: false, error: pMax.error };
      if (pMin.value >= pMax.value) {
        return { valid: false, error: RF12_MIN_MAX_ERROR };
      }
      if (pMin.value < 300 || pMax.value > 1100) {
        return { valid: false, error: 'La presión debe estar entre 300 hPa y 1100 hPa.' };
      }
      payload.presion_min = pMin.value;
      payload.presion_max = pMax.value;
    }
  }

  return { valid: true, payload };
}

export async function fetchThresholdConfig(sensorId: string): Promise<ThresholdEffectiveResponse> {
  const res = await fetch(`/api/configuraciones/${encodeURIComponent(sensorId)}`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar la configuración de umbrales.');
  }
  return data;
}

export async function saveThresholdConfig(
  sensorId: string,
  payload: ThresholdUpsertPayload
): Promise<ThresholdEffectiveResponse> {
  const res = await fetch(`/api/configuraciones/${encodeURIComponent(sensorId)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: buildMutationHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.detail || 'No fue posible guardar los umbrales ambientales.') as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function fetchThresholdHistory(sensorId: string): Promise<{
  sensor_id: string;
  historial: ThresholdHistoryItemDTO[];
  total: number;
}> {
  const res = await fetch(`/api/configuraciones/${encodeURIComponent(sensorId)}/historial`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar el historial de umbrales.');
  }
  return data;
}
