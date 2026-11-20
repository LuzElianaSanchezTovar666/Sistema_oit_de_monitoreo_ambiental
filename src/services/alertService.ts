import { Alerta, AlertSeverity, AlertState } from '../types/iot';

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
  persistida?: boolean;
  provisional?: boolean;
  ocurrencias_en_ventana?: number;
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
  return {
    id_alerta: dto.id_alerta,
    medicion_id: dto.medicion_id ? String(dto.medicion_id) : undefined,
    dispositivo_id: dto.dispositivo_id,
    sensor_id: dto.sensor_id,
    ubicacion_id: dto.ubicacion_id,
    ubicacion_nombre: dto.ubicacion_nombre,
    dispositivo_nombre: dto.dispositivo_nombre,
    sensor_identificador: dto.sensor_identificador,
    tipo: (dto.tipo as Alerta['tipo']) || 'LIMITE_SUPERADO',
    mensaje: dto.mensaje,
    variable_alterada: dto.variable,
    valor_registrado: dto.valor_detectado,
    valor_limite: dto.umbral_superado,
    nivel: (dto.severidad as AlertSeverity) || 'ADVERTENCIA',
    fecha_hora: dto.fecha_hora,
    estado: dto.estado || 'PENDIENTE',
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
  const res = await fetch('/api/alertas?limit=100', {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Error al consultar alertas del sistema.');
  }
  return Array.isArray(data.alertas) ? data.alertas.map(mapBackendAlertaToUi) : [];
}
