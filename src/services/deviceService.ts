export type DispositivoTipo = 'ESP32' | 'ESP8266' | 'Gateway';
export type DispositivoEstado =
  | 'PENDIENTE'
  | 'ONLINE'
  | 'OFFLINE'
  | 'ADVERTENCIA'
  | 'ERROR'
  | 'INACTIVO';

export interface DeviceConnectivity {
  id_dispositivo: string;
  codigo: string | null;
  nombre: string;
  ubicacion_id: string | null;
  ubicacion: string;
  estado: DispositivoEstado;
  activo_administrativamente?: boolean;
  estado_conectividad?: Exclude<DispositivoEstado, 'ERROR' | 'INACTIVO'>;
  ultimo_ping?: string | null;
  fecha_cambio_conectividad?: string | null;
  silencio_segundos?: number | null;
  tiempo_silencio_segundos?: number | null;
  tolerancia_maxima_segundos?: number;
  rssi_dbm?: number | null;
  alerta_senal_debil?: boolean;
}

export interface DispositivoDTO extends DeviceConnectivity {
  id_usuario?: number | null;
  codigo: string;
  nombre: string;
  mac_address: string;
  ip_address?: string | null;
  tipo: DispositivoTipo;
  firmware_version: string;
  ubicacion_id: string;
  ubicacion: string;
  codigo_area?: string;
  estado: DispositivoEstado;
  observacion_tecnica?: string | null;
  mqtt_client_id?: string | null;
  mqtt_topic?: string | null;
  mqtt_username?: string | null;
  historial_mediciones_count: number;
  fecha_registro?: string | null;
  fecha_actualizacion?: string | null;
}

export interface MqttCredentialsOnce {
  codigo: string;
  mqtt_client_id: string;
  mqtt_topic: string;
  mqtt_username: string;
  mqtt_password: string;
}

export interface DispositivosListResponse {
  items: DispositivoDTO[];
  total: number;
  mqtt_broker_disponible: boolean;
  mqtt_broker_host: string;
  mqtt_broker_port: number;
  mqtt_broker_mensaje: string;
}

export interface CreateDispositivoPayload {
  nombre: string;
  mac_address: string;
  tipo: DispositivoTipo;
  firmware_version: string;
  ubicacion_id?: string;
  ubicacion?: string;
  ip_address?: string;
  observacion_tecnica?: string;
}

export interface CreateDispositivoResponse {
  message: string;
  dispositivo: DispositivoDTO;
  mqtt_credentials_once: MqttCredentialsOnce;
  mqtt_broker_disponible: boolean;
  mqtt_broker_mensaje: string;
}

export const MAC_ADDRESS_REGEX = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
export const INVALID_MAC_MESSAGE = 'La dirección MAC ya existe o no tiene formato válido';

export function isValidMacFormat(mac: string): boolean {
  return MAC_ADDRESS_REGEX.test(mac.trim());
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

export async function fetchDispositivos(params?: {
  search?: string;
  estado?: string;
  tipo?: string;
}): Promise<DispositivosListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.estado && params.estado !== 'ALL') query.set('estado', params.estado);
  if (params?.tipo && params.tipo !== 'ALL') query.set('tipo', params.tipo);

  const qs = query.toString();
  const res = await fetch(`/api/dispositivos${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar el inventario de dispositivos.');
  }
  return data as DispositivosListResponse;
}

export function watchDeviceConnectivity(onSnapshot: (items: DeviceConnectivity[] | null) => void): () => void {
  const stream = typeof EventSource === 'undefined'
    ? null
    : new EventSource('/api/mediciones/stream/temperatura?conectividad=true', { withCredentials: true });
  let active = true;
  let streamHealthy = false;
  let loading = false;
  let lastEvent = Date.now();
  const poll = async () => {
    if (streamHealthy && Date.now() - lastEvent > 25_000) {
      streamHealthy = false;
      onSnapshot(null);
    }
    if (streamHealthy || loading) return;
    loading = true;
    try {
      const inventory = await fetchDispositivos();
      if (active && !streamHealthy) onSnapshot(inventory.items);
    } catch {
      if (active && !streamHealthy) onSnapshot(null);
    } finally {
      loading = false;
    }
  };
  const unavailable = () => {
    if (!active) return;
    streamHealthy = false;
    onSnapshot(null);
    void poll();
  };
  stream?.addEventListener('conectividad', (event) => {
    try {
      const items = JSON.parse((event as MessageEvent).data) as DeviceConnectivity[];
      if (!Array.isArray(items) || !active) return;
      streamHealthy = true;
      lastEvent = Date.now();
      onSnapshot(items);
    } catch {
      unavailable();
    }
  });
  stream?.addEventListener('conectividad_no_disponible', unavailable);
  stream?.addEventListener('heartbeat', () => { lastEvent = Date.now(); });
  if (stream) stream.onerror = unavailable;
  void poll();
  const interval = window.setInterval(poll, 5_000);
  return () => {
    active = false;
    window.clearInterval(interval);
    stream?.close();
  };
}

export interface ConnectivitySummaryDTO {
  online: number;
  offline: number;
  advertencia: number;
  error: number;
  pendiente: number;
  inactivo: number;
  senal_debil: number;
  total_activos: number;
  total_registrados: number;
  porcentaje_online: number;
  texto_resumen: string;
}

export interface RssiEvaluation {
  raw: number | null;
  text: string;
  isWeak: boolean;
  qualityLabel: string;
  qualityColor: string;
  isAvailable: boolean;
}

export function evaluateRssi(rssi?: number | null, isOffline = false): RssiEvaluation {
  if (rssi === null || rssi === undefined || isNaN(Number(rssi))) {
    return {
      raw: null,
      text: 'Señal no disponible',
      isWeak: false,
      qualityLabel: 'No disponible',
      qualityColor: 'text-slate-text bg-graphite-fill/40 border-graphite-fill',
      isAvailable: false,
    };
  }
  const val = Math.round(Number(rssi));
  const isWeak = val < -80; // RN-21 / RF-19: Advertencia preventiva si RSSI < -80 dBm. >= -80 no es advertencia.
  let label = 'Excelente';
  let color = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (val < -85) {
    label = 'Muy Débil';
    color = 'text-red-400 bg-red-500/10 border-red-500/30';
  } else if (val < -80) {
    label = 'Débil (Preventiva)';
    color = 'text-signal-yellow bg-signal-yellow/10 border-signal-yellow/30';
  } else if (val < -70) {
    label = 'Aceptable';
    color = 'text-sky-300 bg-sky-500/10 border-sky-500/30';
  } else if (val < -60) {
    label = 'Buena';
    color = 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
  }

  const prefix = isOffline ? 'Última: ' : '';
  const suffix = isWeak ? ' · Señal Débil' : '';
  return {
    raw: val,
    text: `${prefix}${val} dBm${suffix}`,
    isWeak,
    qualityLabel: label,
    qualityColor: color,
    isAvailable: true,
  };
}

export function formatRelativeTime(dateOrIso?: string | null): string {
  if (!dateOrIso) return 'Sin comunicación registrada';
  const dt = new Date(dateOrIso);
  if (isNaN(dt.getTime())) return 'Sin comunicación registrada';
  const diffSec = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 1000));
  if (diffSec < 10) return 'Hace unos segundos';
  if (diffSec < 60) return `Hace ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Hace ${diffMin}m`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `Hace ${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  return `Hace ${diffDays}d`;
}

export async function fetchConnectivitySummary(): Promise<ConnectivitySummaryDTO> {
  const res = await fetch('/api/dispositivos/resumen-conectividad', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar resumen de conectividad.');
  }
  return data as ConnectivitySummaryDTO;
}

export async function simulateDevicePing(
  id: string,
  rssi_dbm?: number | null
): Promise<{ message: string; exito: boolean }> {
  const res = await fetch(`/api/dispositivos/${encodeURIComponent(id)}/ping`, {
    method: 'POST',
    credentials: 'include',
    headers: buildMutationHeaders(),
    body: JSON.stringify({ rssi_dbm: rssi_dbm ?? null }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al simular ping del dispositivo.');
  }
  return data;
}

export function formatLastContact(value?: string | null): string {
  return value ? new Date(value).toLocaleString('es-CO') : 'Sin contacto registrado';
}

export async function fetchDispositivoDetail(id: string): Promise<{
  dispositivo: DispositivoDTO;
  mqtt_broker_disponible: boolean;
  mqtt_broker_mensaje: string;
}> {
  const res = await fetch(`/api/dispositivos/${encodeURIComponent(id)}`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar el detalle del dispositivo.');
  }
  return data;
}

export async function createDispositivo(
  payload: CreateDispositivoPayload
): Promise<CreateDispositivoResponse> {
  const res = await fetch('/api/dispositivos', {
    method: 'POST',
    credentials: 'include',
    headers: buildMutationHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'No fue posible registrar el dispositivo.');
  }
  return data as CreateDispositivoResponse;
}

export async function updateDispositivo(
  id: string,
  payload: CreateDispositivoPayload
): Promise<{ message: string; dispositivo: DispositivoDTO }> {
  const res = await fetch(`/api/dispositivos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: buildMutationHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'No fue posible actualizar el dispositivo.');
  }
  return data;
}

export async function deactivateDispositivo(
  id: string
): Promise<{ message: string; dispositivo: DispositivoDTO }> {
  const res = await fetch(`/api/dispositivos/${encodeURIComponent(id)}/desactivar`, {
    method: 'PATCH',
    credentials: 'include',
    headers: buildMutationHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'No fue posible desactivar el dispositivo.');
  }
  return data;
}

// ============================================================================
// RF-20: FICHA TÉCNICA DETALLADA E HISTORIAL POR DISPOSITIVO (RN-22)
// ============================================================================

export type MaintenanceType =
  | 'PREVENTIVO'
  | 'CORRECTIVO'
  | 'CALIBRACION'
  | 'REEMPLAZO_BATERIA'
  | 'LIMPIEZA_SONDA'
  | 'ACTUALIZACION_FIRMWARE'
  | 'REVISION_GENERAL';

export type MaintenanceResult = 'EXITOSO' | 'PENDIENTE' | 'EN_OBSERVACION';
export type MaintenanceStatus = 'COMPLETADO' | 'PROGRAMADO' | 'EN_CURSO';

export interface MantenimientoDTO {
  id_mantenimiento: string;
  dispositivo_id: string;
  sensor_id?: string | null;
  id_usuario_responsable?: number | null;
  tecnico_id: string;
  tecnico_nombre: string;
  tipo_mantenimiento: MaintenanceType;
  fecha_intervencion: string;
  fecha_realizacion: string;
  descripcion: string;
  actividades_realizadas?: string | null;
  resultado: MaintenanceResult;
  observaciones?: string | null;
  proxima_fecha_sugerida?: string | null;
  costo_estimado_usd: number;
  id_alerta_relacionada?: string | null;
  estado: MaintenanceStatus;
  fecha_registro?: string | null;
  dispositivo_nombre?: string;
  dispositivo_codigo?: string;
}

export interface FichaSensorDTO {
  id_sensor: string;
  dispositivo_id: string;
  identificador: string;
  modelo: 'DHT22' | 'BME280' | 'SHT31';
  variables_medidas: string[];
  fecha_instalacion: string;
  ultima_calibracion: string;
  estado: string;
  descripcion?: string | null;
  historial_mediciones_count: number;
}

export interface FichaAlertaDTO {
  id_alerta: string;
  tipo: string;
  severidad?: string;
  nivel?: string;
  estado: string;
  mensaje: string;
  fecha_hora: string;
}

export interface DeviceFichaTecnicaDTO {
  dispositivo: DispositivoDTO;
  conectividad: DeviceConnectivity;
  mqtt: {
    client_id: string;
    topic_telemetria: string;
    topic_heartbeat: string;
    broker_host: string;
    broker_port: number;
    broker_disponible: boolean;
    broker_mensaje: string;
  };
  sensores: FichaSensorDTO[];
  sensores_count: number;
  mantenimientos: MantenimientoDTO[];
  mantenimientos_count: number;
  alertas_recientes: FichaAlertaDTO[];
  permisos: {
    puede_editar_tecnico: boolean;
    puede_registrar_mantenimiento: boolean;
    rol_actual: string;
  };
  advertencia_hardware: string;
}

export interface UpdateDeviceTechnicalPayload {
  nombre?: string;
  firmware_version?: string;
  ubicacion_id?: string;
  ip_address?: string;
  observacion_tecnica?: string;
}

export interface CreateMantenimientoPayload {
  dispositivo_id: string;
  sensor_id?: string;
  tipo_mantenimiento: MaintenanceType;
  fecha_intervencion?: string;
  descripcion: string;
  actividades_realizadas?: string;
  resultado?: MaintenanceResult;
  observaciones?: string;
  proxima_fecha_sugerida?: string;
  costo_estimado_usd?: number;
  id_alerta_relacionada?: string;
  estado?: MaintenanceStatus;
}

export async function fetchDeviceFichaTecnica(id: string): Promise<DeviceFichaTecnicaDTO> {
  const res = await fetch(`/api/dispositivos/${encodeURIComponent(id)}/ficha-tecnica`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar la ficha técnica del dispositivo.');
  }
  return data as DeviceFichaTecnicaDTO;
}

export async function fetchDeviceMaintenances(
  id: string
): Promise<{ items: MantenimientoDTO[]; total: number }> {
  const res = await fetch(`/api/dispositivos/${encodeURIComponent(id)}/mantenimientos`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar el historial de mantenimientos.');
  }
  return data;
}

export async function createDeviceMaintenance(
  id: string,
  payload: CreateMantenimientoPayload
): Promise<{ message: string; mantenimiento: MantenimientoDTO }> {
  const res = await fetch(`/api/dispositivos/${encodeURIComponent(id)}/mantenimientos`, {
    method: 'POST',
    credentials: 'include',
    headers: buildMutationHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'No fue posible registrar la intervención técnica.');
  }
  return data;
}

export async function patchDeviceTechnicalConfig(
  id: string,
  payload: UpdateDeviceTechnicalPayload
): Promise<{ message: string; dispositivo: DispositivoDTO }> {
  const res = await fetch(`/api/dispositivos/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: buildMutationHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'No fue posible actualizar los parámetros técnicos.');
  }
  return data;
}

export async function fetchAllMaintenances(params?: {
  dispositivo_id?: string;
  tipo?: string;
}): Promise<{ items: MantenimientoDTO[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.dispositivo_id && params.dispositivo_id !== 'ALL') {
    query.set('dispositivo_id', params.dispositivo_id);
  }
  if (params?.tipo && params.tipo !== 'ALL') {
    query.set('tipo', params.tipo);
  }
  const qs = query.toString();
  const res = await fetch(`/api/mantenimientos${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar mantenimientos.');
  }
  return data;
}

export async function createGlobalMaintenance(
  payload: CreateMantenimientoPayload
): Promise<{ message: string; mantenimiento: MantenimientoDTO }> {
  const res = await fetch('/api/mantenimientos', {
    method: 'POST',
    credentials: 'include',
    headers: buildMutationHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'No fue posible registrar el mantenimiento.');
  }
  return data;
}
