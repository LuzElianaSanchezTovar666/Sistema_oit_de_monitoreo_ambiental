import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  fetchAiDiagnostic,
  evaluateManualAi,
  retrainAiModel,
  fetchAiMetrics,
} from '../src/services/aiService';

test('RF-18: fetchAiDiagnostic mapea correctamente respuesta del motor de IA', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input: any) => {
      assert.ok(String(input).includes('/api/ia/diagnostico'));
      return new Response(
        JSON.stringify({
          sensor_id: 'sen-dht22-01',
          sensor_identificador: 'DHT22-INVERNADERO-1',
          ubicacion_id: 'ubi-inv-01',
          ubicacion_nombre: 'Invernadero Principal',
          temperatura: 34.5,
          humedad: 82.0,
          es_anomalia: true,
          score_ia: 0.825,
          z_score_temp: 3.2,
          z_score_hum: 2.1,
          metodo: 'ISOLATION_FOREST',
          modelo_version: 'v1.0.0-isolation-forest',
          tipo_anomalia: 'PICO_REPENTINO',
          explicacion: 'Se detectó un incremento térmico abrupto.',
          posibles_causas: ['Apertura de accesos', 'Falla de ventilación'],
          recomendaciones: ['Verificar sellado', 'Comprobar flujo de aire'],
          tiempo_inferencia_ms: 12.5,
          fecha_hora: '2026-11-21T12:00:00Z',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    const res = await fetchAiDiagnostic('sen-dht22-01');
    assert.equal(res.sensor_id, 'sen-dht22-01');
    assert.equal(res.es_anomalia, true);
    assert.equal(res.score_ia, 0.825);
    assert.equal(res.metodo, 'ISOLATION_FOREST');
    assert.equal(res.tipo_anomalia, 'PICO_REPENTINO');
    assert.ok(res.tiempo_inferencia_ms < 200.0, 'Inferencia debe ser inferior a 200 ms');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('RF-18: evaluateManualAi envía parámetros y propaga errores HTTP correctamente', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_input: any, init?: any) => {
      const body = JSON.parse(init?.body || '{}');
      assert.equal(body.sensor_id, 'sen-test-02');
      assert.equal(body.temperatura, 42.0);

      return new Response(
        JSON.stringify({
          detail: 'Sensor no encontrado para evaluación puntual',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    await assert.rejects(
      async () => {
        await evaluateManualAi('sen-test-02', 42.0, 30.0);
      },
      {
        name: 'Error',
        message: 'Sensor no encontrado para evaluación puntual',
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('RF-18: retrainAiModel y fetchAiMetrics reportan versión y meta de latencia <= 200ms', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input: any) => {
      const url = String(input);
      if (url.includes('/api/ia/reentrenar')) {
        return new Response(
          JSON.stringify({
            status: 'ok',
            mensaje: 'Caché de modelos reiniciada con éxito',
            modelo_version: 'v1.0.0-isolation-forest',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/api/ia/metricas')) {
        return new Response(
          JSON.stringify({
            meta_latencia_ms: 200.0,
            total_evaluaciones: 150,
            total_anomalias: 4,
            avg_inferencia_ms: 8.4,
            max_inferencia_ms: 45.2,
            modelo_version: 'v1.0.0-isolation-forest',
            algoritmo: 'Isolation Forest (scikit-learn) + Z-Score (3.0σ)',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('Not found', { status: 404 });
    };

    const retrainRes = await retrainAiModel();
    assert.equal(retrainRes.status, 'ok');

    const metrics = await fetchAiMetrics();
    assert.equal(metrics.meta_latencia_ms, 200.0);
    assert.ok(metrics.avg_inferencia_ms < 200.0);
    assert.ok(metrics.max_inferencia_ms < 200.0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
