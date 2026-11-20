import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateThresholdBreachClient,
  mergeAlertsDeduplicated,
  LiveAlertRecord,
} from '../src/services/alertService';

test('RF-13: evaluateThresholdBreachClient evalúa límites exactos, ADVERTENCIA, CRITICA y rango físico humedad', () => {
  const limits = {
    temp_critico_min: 12,
    temp_min: 18,
    temp_max: 25,
    temp_critico_max: 30,
    hum_critico_min: 25,
    hum_min: 40,
    hum_max: 70,
    hum_critico_max: 85,
  };

  assert.equal(evaluateThresholdBreachClient('temperatura', 18, limits), null);
  assert.equal(evaluateThresholdBreachClient('temperatura', 25, limits), null);
  assert.equal(evaluateThresholdBreachClient('humedad', 40, limits), null);
  assert.equal(evaluateThresholdBreachClient('humedad', 70, limits), null);

  const warn = evaluateThresholdBreachClient('temperatura', 27.5, limits);
  assert.equal(warn?.severidad, 'ADVERTENCIA');

  const crit = evaluateThresholdBreachClient('temperatura', 30.0, limits);
  assert.equal(crit?.severidad, 'CRITICA');

  // Humedad fuera de [0, 100] es error de sensor, no alerta ambiental
  assert.equal(evaluateThresholdBreachClient('humedad', -1, limits), null);
  assert.equal(evaluateThresholdBreachClient('humedad', 102, limits), null);
});

test('RF-13: mergeAlertsDeduplicated evita duplicados al reconectar SSE', () => {
  const a1: LiveAlertRecord = {
    id_alerta: 'alr-1',
    dispositivo_id: 'dev-1',
    sensor_id: 'sen-1',
    ubicacion_id: 'loc-1',
    tipo: 'LIMITE_SUPERADO',
    mensaje: 'Alerta 1',
    nivel: 'ADVERTENCIA',
    fecha_hora: '2026-11-20T10:00:00Z',
    estado: 'PENDIENTE',
  };
  const a2: LiveAlertRecord = {
    ...a1,
    id_alerta: 'alr-2',
    nivel: 'CRITICA',
    fecha_hora: '2026-11-20T10:02:00Z',
  };
  const merged = mergeAlertsDeduplicated([a1], [a1, a2]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id_alerta, 'alr-2');
});
