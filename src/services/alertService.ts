import { Alerta, AlertSeverity, AlertState } from '../types/iot';
import { buildMutationHeaders } from './sensorService';

export interface BackendAlertaDTO {
  id_alerta: string;
  medicion_id?: number | null;
  dispositivo_id: string;
  sensor_id: string;
  ubicacion_id: string;
  ubicacion_nombre?: string | null;
  dispositivo_nombre?: string | null;
  sensor_identificador?: string | null;
  sensor_modelo?: string | null;
  tipo: string;
  variable: 'temperatura' | 'humedad' | 'conexion';
  condicion?: string;
  valor_detectado?: number;
  umbral_superado?: number;
  severidad: 'ADVERTENCIA' | 'CRITICA';
  estado: AlertState;
  usuario_responsable_id?: number | null;
  usuario_responsable_correo?: string | null;
  usuario_responsable_nombre?: string | null;
  atendido_por?: string | null;
  fecha_atencion?: string | null;
  fecha_resolucion?: string | null;
  accion_correctiva?: string | null;
  causa_raiz?: string | null;
  observaciones?: string | null;
  version?: number;
  mensaje: string;
  ocurrencias_en_ventana?: number;
  fecha_hora: string;
  persistida?: boolean;
  provisional?: boolean;
}

export interface LiveAlertRecord extends Alerta {
  ubicacion_nombre?: string | null;
  dispositivo_nombre?: string | null;
  sensor_identificador?: string | null;
  sensor_modelo?: string | null;
  usuario_responsable_correo?: string | null;
  usuario_responsable_nombre?: string | null;
  fecha_atencion?: string | null;
  accion_correctiva?: string | null;
  causa_raiz?: string | null;
  observaciones?: string | null;
  version?: number;
  persistida?: boolean;
  provisional?: boolean;
  ocurrencias_en_ventana?: number;
}

export interface AlertResumenDTO {
  total: number;
  pendientes: number;
  atendidas: number;
  resueltas: number;
  criticas: number;
  criticas_activas: number;
  activas: number;
}

export interface AlertPaginatedResponseDTO {
  alertas: LiveAlertRecord[];
  page: number;
  page_size: number;
  total_records: number;
  total_pages: number;
  resumen: AlertResumenDTO;
}

export interface AlertHistorialItemDTO {
  id_historial: string;
  alerta_id: string;
  usuario_id: number;
  usuario_correo: string;
  usuario_nombre: string;
  estado_anterior: string;
  estado_nuevo: string;
  accion_correctiva?: string | null;
  causa_raiz?: string | null;
  observaciones?: string | null;
  fecha_hora_utc: string;
}

export interface AlertQueryFilters {
  estado?: AlertState | '';
  severidad?: 'ADVERTENCIA' | 'CRITICA' | '';
  ubicacion_id?: string;
  dispositivo_id?: string;
  sensor_id?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface AlertEstadoUpdatePayload {
  estado_nuevo: 'ATENDIDA' | 'RESUELTA';
  accion_correctiva?: string;
  causa_raiz?: string;
  observaciones?: string;
  expected_version?: number;
}

export interface ThresholdBreachResult {
  variable: 'temperatura' | 'humedad';
  condicion: 'BAJO_MINIMO' | 'SOBRE_MAXIMO';
  valor_detectado: number;
  umbral_superado: number;
  severidad: 'ADVERTENCIA' | 'CRITICA';
}

export function evaluateThresholdBreachClient(
  variable: 'temperatura' | 'humedad',
  valor: number | null | undefined,
  limits: {
    temp_min?: number | null;
    temp_max?: number | null;
    temp_critico_min?: number | null;
    temp_critico_max?: number | null;
    hum_min?: number | null;
    hum_max?: number | null;
    hum_critico_min?: number | null;
    hum_critico_max?: number | null;
  } | null
): ThresholdBreachResult | null {
  if (valor === null || valor === undefined || !Number.isFinite(valor) || !limits) {
    return null;
  }
  const val = Math.round(valor * 100) / 100;

  if (variable === 'temperatura') {
    const tMin = limits.temp_min;
    const tMax = limits.temp_max;
    if (tMin === null || tMin === undefined || tMax === null || tMax === undefined) return null;
    if (val >= tMin && val <= tMax) return null;
    if (val < tMin) {
      const cMin = limits.temp_critico_min;
      if (cMin !== null && cMin !== undefined && val <= cMin) {
        return {
          variable,
          condicion: 'BAJO_MINIMO',
          valor_detectado: val,
          umbral_superado: cMin,
          severidad: 'CRITICA',
        };
      }
      return {
        variable,
        condicion: 'BAJO_MINIMO',
        valor_detectado: val,
        umbral_superado: tMin,
        severidad: 'ADVERTENCIA',
      };
    }
    const cMax = limits.temp_critico_max;
    if (cMax !== null && cMax !== undefined && val >= cMax) {
      return {
        variable,
        condicion: 'SOBRE_MAXIMO',
        valor_detectado: val,
        umbral_superado: cMax,
        severidad: 'CRITICA',
      };
    }
    return {
      variable,
      condicion: 'SOBRE_MAXIMO',
      valor_detectado: val,
      umbral_superado: tMax,
      severidad: 'ADVERTENCIA',
    };
  }

  if (val < 0 || val > 100) return null;
  const hMin = limits.hum_min;
  const hMax = limits.hum_max;
  if (hMin === null || hMin === undefined || hMax === null || hMax === undefined) return null;
  if (val >= hMin && val <= hMax) return null;
  if (val < hMin) {
    const cMin = limits.hum_critico_min;
    if (cMin !== null && cMin !== undefined && val <= cMin) {
      return {
        variable,
        condicion: 'BAJO_MINIMO',
        valor_detectado: val,
        umbral_superado: cMin,
        severidad: 'CRITICA',
      };
    }
    return {
      variable,
      condicion: 'BAJO_MINIMO',
      valor_detectado: val,
      umbral_superado: hMin,
      severidad: 'ADVERTENCIA',
    };
  }
  const cMax = limits.hum_critico_max;
  if (cMax !== null && cMax !== undefined && val >= cMax) {
    return {
      variable,
      condicion: 'SOBRE_MAXIMO',
      valor_detectado: val,
      umbral_superado: cMax,
      severidad: 'CRITICA',
    };
  }
  return {
    variable,
    condicion: 'SOBRE_MAXIMO',
    valor_detectado: val,
    umbral_superado: hMax,
    severidad: 'ADVERTENCIA',
  };
}

export function mapBackendAlertaToUi(dto: BackendAlertaDTO): LiveAlertRecord {
  const normalizedState: AlertState =
    (dto.estado as string) === 'EN_ATENCION' ? 'ATENDIDA' : dto.estado || 'PENDIENTE';
  return {
    id_alerta: dto.id_alerta,
    medicion_id: dto.medicion_id ? String(dto.medicion_id) : undefined,
    dispositivo_id: dto.dispositivo_id,
    sensor_id: dto.sensor_id,
    ubicacion_id: dto.ubicacion_id,
    ubicacion_nombre: dto.ubicacion_nombre,
    dispositivo_nombre: dto.dispositivo_nombre,
    sensor_identificador: dto.sensor_identificador,
    sensor_modelo: dto.sensor_modelo,
    tipo: (dto.tipo as Alerta['tipo']) || 'LIMITE_SUPERADO',
    mensaje: dto.mensaje,
    variable_alterada: dto.variable,
    valor_registrado: dto.valor_detectado,
    valor_limite: dto.umbral_superado,
    nivel: (dto.severidad as AlertSeverity) || 'ADVERTENCIA',
    fecha_hora: dto.fecha_hora,
    estado: normalizedState,
    usuario_responsable_correo: dto.usuario_responsable_correo,
    usuario_responsable_nombre: dto.usuario_responsable_nombre,
    atendido_por: dto.atendido_por || dto.usuario_responsable_nombre || dto.usuario_responsable_correo || undefined,
    fecha_atencion: dto.fecha_atencion,
    fecha_resolucion: dto.fecha_resolucion || undefined,
    accion_correctiva: dto.accion_correctiva,
    causa_raiz: dto.causa_raiz,
    motivo_resolucion: dto.causa_raiz || undefined,
    observaciones: dto.observaciones,
    notas_resolucion: dto.observaciones || undefined,
    version: dto.version ?? 1,
    persistida: dto.persistida ?? true,
    provisional: dto.provisional ?? false,
    ocurrencias_en_ventana: dto.ocurrencias_en_ventana ?? 1,
  };
}

export function mergeAlertsDeduplicated(
  existing: LiveAlertRecord[],
  incoming: LiveAlertRecord[]
): LiveAlertRecord[] {
  const byId = new Map<string, LiveAlertRecord>();
  for (const item of existing) {
    byId.set(item.id_alerta, item);
  }
  for (const item of incoming) {
    const prev = byId.get(item.id_alerta);
    byId.set(item.id_alerta, prev ? { ...prev, ...item } : item);
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime()
  );
}

export async function fetchAlertas(): Promise<LiveAlertRecord[]> {
  const res = await fetch('/api/alertas?page=1&page_size=100', {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar alertas del sistema.');
  }
  return Array.isArray(data.alertas) ? data.alertas.map(mapBackendAlertaToUi) : [];
}

export function validateAlertTransitionClient(
  alerta: Pick<LiveAlertRecord, 'estado' | 'nivel' | 'accion_correctiva'>,
  estadoNuevo: 'ATENDIDA' | 'RESUELTA',
  accionCorrectiva: string
): string | null {
  if (alerta.estado === 'RESUELTA') {
    return 'Una alerta RESUELTA no puede modificarse ni reabrirse.';
  }
  if (alerta.estado === estadoNuevo) {
    return `La alerta ya se encuentra en estado ${estadoNuevo}.`;
  }
  if (alerta.nivel === 'CRITICA' && estadoNuevo === 'RESUELTA') {
    const effective = accionCorrectiva.trim() || (alerta.accion_correctiva || '').trim();
    if (!effective) {
      return 'Las alertas críticas no pueden pasar a RESUELTA sin describir la acción correctiva.';
    }
  }
  return null;
}

export async function fetchAlertasPaginated(
  filters: AlertQueryFilters
): Promise<AlertPaginatedResponseDTO> {
  const qs = new URLSearchParams();
  if (filters.estado) qs.set('estado', filters.estado);
  if (filters.severidad) qs.set('severidad', filters.severidad);
  if (filters.ubicacion_id) qs.set('ubicacion_id', filters.ubicacion_id);
  if (filters.dispositivo_id) qs.set('dispositivo_id', filters.dispositivo_id);
  if (filters.sensor_id) qs.set('sensor_id', filters.sensor_id);
  if (filters.fecha_inicio) qs.set('fecha_inicio', filters.fecha_inicio);
  if (filters.fecha_fin) qs.set('fecha_fin', filters.fecha_fin);
  if (filters.search?.trim()) qs.set('search', filters.search.trim());
  qs.set('page', String(filters.page ?? 1));
  qs.set('page_size', String(filters.page_size ?? 10));
  qs.set('tz_offset_minutes', String(new Date().getTimezoneOffset()));

  const res = await fetch(`/api/alertas?${qs.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar la bitácora de alertas.');
  }
  return {
    alertas: Array.isArray(data.alertas) ? data.alertas.map(mapBackendAlertaToUi) : [],
    page: data.page ?? 1,
    page_size: data.page_size ?? 10,
    total_records: data.total_records ?? 0,
    total_pages: data.total_pages ?? 0,
    resumen: data.resumen ?? {
      total: 0,
      pendientes: 0,
      atendidas: 0,
      resueltas: 0,
      criticas: 0,
      criticas_activas: 0,
      activas: 0,
    },
  };
}

export async function fetchAlertaDetail(alertaId: string): Promise<LiveAlertRecord> {
  const res = await fetch(`/api/alertas/${encodeURIComponent(alertaId)}`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.alerta) {
    throw new Error(data.detail || 'Error al consultar el detalle de la alerta.');
  }
  return mapBackendAlertaToUi(data.alerta);
}

export async function fetchAlertaHistorial(alertaId: string): Promise<AlertHistorialItemDTO[]> {
  const res = await fetch(`/api/alertas/${encodeURIComponent(alertaId)}/historial`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar el historial de auditoría.');
  }
  return Array.isArray(data.historial) ? data.historial : [];
}

export async function updateAlertaEstado(
  alertaId: string,
  payload: AlertEstadoUpdatePayload
): Promise<{ message: string; alerta: LiveAlertRecord }> {
  const res = await fetch(`/api/alertas/${encodeURIComponent(alertaId)}/estado`, {
    method: 'PATCH',
    credentials: 'include',
    headers: buildMutationHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.alerta) {
    const err = new Error(data.detail || 'No fue posible actualizar el estado de la alerta.') as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return {
    message: data.message || 'Estado actualizado correctamente.',
    alerta: mapBackendAlertaToUi(data.alerta),
  };
}
