export type DispositivoTipo = 'ESP32' | 'ESP8266' | 'Gateway';
export type DispositivoEstado =
  | 'PENDIENTE'
  | 'ONLINE'
  | 'OFFLINE'
  | 'ADVERTENCIA'
  | 'ERROR'
  | 'INACTIVO';

export interface DispositivoDTO {
  id_dispositivo: string;
  id_usuario?: number | null;
  codigo: string;
  nombre: string;
  mac_address: string;
  tipo: DispositivoTipo;
  firmware_version: string;
  ubicacion: string;
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
  ubicacion: string;
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
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar el inventario de dispositivos.');
  }
  return data as DispositivosListResponse;
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
