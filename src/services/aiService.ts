export interface AiDiagnosticDTO {
  sensor_id: string;
  sensor_identificador: string;
  ubicacion_id?: string | null;
  ubicacion_nombre: string;
  dispositivo_id?: string | null;
  temperatura?: number | null;
  humedad?: number | null;
  es_anomalia: boolean;
  score_ia?: number | null;
  z_score_temp?: number | null;
  z_score_hum?: number | null;
  metodo: 'ISOLATION_FOREST' | 'Z_SCORE' | 'DATOS_INSUFICIENTES' | string;
  modelo_version: string;
  tipo_anomalia:
    | 'NORMAL'
    | 'PICO_REPENTINO'
    | 'CAIDA_ABRUPTA'
    | 'DERIVA_TERMICA'
    | 'OSCILACION_INHABITUAL'
    | 'FALLO_SENSOR'
    | 'NO_EVALUADO'
    | string;
  explicacion: string;
  posibles_causas: string[];
  recomendaciones: string[];
  tiempo_inferencia_ms: number;
  fecha_hora: string;
}

export interface AiMetricsDTO {
  meta_latencia_ms: number;
  total_evaluaciones: number;
  total_anomalias: number;
  avg_inferencia_ms: number;
  max_inferencia_ms: number;
  modelo_version: string;
  algoritmo: string;
}

export async function fetchAiDiagnostic(
  sensorId?: string,
  ubicacionId?: string
): Promise<AiDiagnosticDTO> {
  const params = new URLSearchParams();
  if (sensorId) params.set('sensor_id', sensorId);
  if (ubicacionId) params.set('ubicacion_id', ubicacionId);

  const res = await fetch(`/api/ia/diagnostico?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Error al obtener diagnóstico de IA.');
  }

  return res.json();
}

export async function evaluateManualAi(
  sensorId: string,
  temperatura?: number,
  humedad?: number
): Promise<AiDiagnosticDTO> {
  const res = await fetch('/api/ia/evaluar', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sensor_id: sensorId,
      temperatura,
      humedad,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Error al evaluar medición en motor de IA.');
  }

  return res.json();
}

export async function retrainAiModel(sensorId?: string): Promise<{ status: string; mensaje: string }> {
  const params = new URLSearchParams();
  if (sensorId) params.set('sensor_id', sensorId);

  const res = await fetch(`/api/ia/reentrenar?${params.toString()}`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Error al solicitar reentrenamiento del modelo.');
  }

  return res.json();
}

export async function fetchAiMetrics(): Promise<AiMetricsDTO> {
  const res = await fetch('/api/ia/metricas', {
    method: 'GET',
    credentials: 'include',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Error al obtener métricas de IA.');
  }

  return res.json();
}
