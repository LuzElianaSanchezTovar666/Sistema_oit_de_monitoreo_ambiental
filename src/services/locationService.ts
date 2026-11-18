export type UbicacionEstado = 'ACTIVA' | 'INACTIVA';

export interface UbicacionDTO {
  ubicacion_id: string;
  nombre: string;
  codigo_area: string;
  tipo: string;
  descripcion?: string | null;
  estado: UbicacionEstado;
  dispositivos_count: number;
  dispositivos_activos_count: number;
  fecha_creacion?: string | null;
  fecha_actualizacion?: string | null;
}

export interface HistorialUbicacionDTO {
  id_historial: number;
  dispositivo_id: string;
  ubicacion_anterior_id?: string | null;
  ubicacion_anterior_nombre?: string | null;
  ubicacion_anterior_codigo?: string | null;
  ubicacion_nueva_id: string;
  ubicacion_nueva_nombre: string;
  ubicacion_nueva_codigo: string;
  usuario_responsable_id: number;
  usuario_responsable_nombre?: string | null;
  usuario_responsable_correo: string;
  motivo?: string | null;
  fecha_cambio: string;
}

export interface DashboardMedicionDTO {
  id_medicion: number;
  dispositivo_id: string;
  dispositivo_nombre: string;
  dispositivo_codigo?: string | null;
  ubicacion_id: string;
  ubicacion_nombre: string;
  ubicacion_codigo_area: string;
  temperatura: number;
  humedad: number;
  fecha_hora: string;
}

export interface DashboardUbicacionResumenDTO {
  ubicacion_id: string;
  ubicacion_nombre: string;
  codigo_area: string;
  total_mediciones: number;
  promedio_temp: number | null;
  promedio_hum: number | null;
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

export const AREA_CODE_REGEX = /^[A-Z0-9]+-[A-Z0-9]+$/;

export function isValidAreaCode(code: string): boolean {
  return AREA_CODE_REGEX.test(code.trim().toUpperCase());
}

export async function fetchUbicaciones(params?: {
  estado?: string;
  search?: string;
}): Promise<{ items: UbicacionDTO[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.estado && params.estado !== 'ALL') query.set('estado', params.estado);
  if (params?.search) query.set('search', params.search);
  const qs = query.toString();

  const res = await fetch(`/api/ubicaciones${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar el catálogo de ubicaciones.');
  }
  return data;
}

export async function createUbicacion(payload: {
  nombre: string;
  codigo_area: string;
  tipo: string;
  descripcion?: string;
}): Promise<{ message: string; ubicacion: UbicacionDTO }> {
  const res = await fetch('/api/ubicaciones', {
    method: 'POST',
    credentials: 'include',
    headers: buildMutationHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'No fue posible registrar la ubicación.');
  }
  return data;
}

export async function updateUbicacion(
  id: string,
  payload: {
    nombre: string;
    codigo_area: string;
    tipo: string;
    descripcion?: string;
  }
): Promise<{ message: string; ubicacion: UbicacionDTO }> {
  const res = await fetch(`/api/ubicaciones/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: buildMutationHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'No fue posible actualizar la ubicación.');
  }
  return data;
}

export async function toggleUbicacionEstado(
  id: string,
  estado: UbicacionEstado
): Promise<{ message: string; ubicacion: UbicacionDTO }> {
  const res = await fetch(`/api/ubicaciones/${encodeURIComponent(id)}/estado`, {
    method: 'PATCH',
    credentials: 'include',
    headers: buildMutationHeaders(),
    body: JSON.stringify({ estado }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'No fue posible cambiar el estado de la ubicación.');
  }
  return data;
}

export async function fetchDispositivosByUbicacion(ubicacionId: string): Promise<{
  ubicacion: UbicacionDTO;
  items: Array<{
    id_dispositivo: string;
    codigo: string;
    nombre: string;
    mac_address: string;
    tipo: string;
    estado: string;
    firmware_version: string;
  }>;
  total: number;
}> {
  const res = await fetch(`/api/ubicaciones/${encodeURIComponent(ubicacionId)}/dispositivos`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar dispositivos de la ubicación.');
  }
  return data;
}

export async function assignDispositivoUbicacion(
  dispositivoId: string,
  ubicacionId: string,
  motivo?: string
): Promise<{ message: string }> {
  const res = await fetch(`/api/dispositivos/${encodeURIComponent(dispositivoId)}/ubicacion`, {
    method: 'PUT',
    credentials: 'include',
    headers: buildMutationHeaders(),
    body: JSON.stringify({ ubicacion_id: ubicacionId, motivo }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'No fue posible reasignar la ubicación.');
  }
  return data;
}

export async function fetchHistorialUbicaciones(
  dispositivoId: string
): Promise<{ items: HistorialUbicacionDTO[]; total: number }> {
  const res = await fetch(
    `/api/dispositivos/${encodeURIComponent(dispositivoId)}/historial-ubicaciones`,
    {
      method: 'GET',
      credentials: 'include',
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar el historial de ubicaciones.');
  }
  return data;
}

export async function fetchDashboardMedicionesPorUbicacion(ubicacionId?: string): Promise<{
  mediciones: DashboardMedicionDTO[];
  resumen_por_ubicacion: DashboardUbicacionResumenDTO[];
}> {
  const qs = ubicacionId && ubicacionId !== 'ALL' ? `?ubicacion_id=${encodeURIComponent(ubicacionId)}` : '';
  const res = await fetch(`/api/ubicaciones/dashboard/mediciones${qs}`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar mediciones por ubicación.');
  }
  return data;
}
