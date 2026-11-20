import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areSensorDatesCoherent,
  computeThermalGaugeGeometry,
  evaluateThermalStatus,
  MODEL_CAPABILITIES,
  validateSensorVariablesSelection,
} from '../src/services/sensorService';

test('MODEL_CAPABILITIES define variables y unidades exactas por modelo RF-04', () => {
  assert.deepEqual(
    MODEL_CAPABILITIES.DHT22.map((v) => `${v.variable}:${v.unidad}`),
    ['temperatura:°C', 'humedad:%RH']
  );
  assert.deepEqual(
    MODEL_CAPABILITIES.BME280.map((v) => `${v.variable}:${v.unidad}`),
    ['temperatura:°C', 'humedad:%RH', 'presion:hPa']
  );
  assert.deepEqual(
    MODEL_CAPABILITIES.SHT31.map((v) => `${v.variable}:${v.unidad}`),
    ['temperatura:°C', 'humedad:%RH']
  );
});

test('areSensorDatesCoherent impide calibración anterior a instalación', () => {
  assert.equal(areSensorDatesCoherent('2026-01-10', '2026-01-10'), true);
  assert.equal(areSensorDatesCoherent('2026-01-10', '2026-02-01'), true);
  assert.equal(areSensorDatesCoherent('2026-02-10', '2026-01-01'), false);
});

test('validateSensorVariablesSelection exige al menos una variable con mensaje exacto RF-05', () => {
  assert.equal(
    validateSensorVariablesSelection('DHT22', false, false, false),
    'Debe seleccionar al menos una variable ambiental'
  );
  assert.equal(validateSensorVariablesSelection('DHT22', true, false, false), null);
  assert.equal(validateSensorVariablesSelection('DHT22', false, true, false), null);
  assert.equal(validateSensorVariablesSelection('BME280', false, false, true), null);
  assert.notEqual(validateSensorVariablesSelection('SHT31', true, false, true), null);
});

test('evaluateThermalStatus y computeThermalGaugeGeometry evalúan límites exactos y ausencia RF-08', () => {
  assert.equal(evaluateThermalStatus(20.0, 18.0, 25.0), 'NOMINAL');
  assert.equal(evaluateThermalStatus(18.0, 18.0, 25.0), 'NOMINAL');
  assert.equal(evaluateThermalStatus(25.0, 18.0, 25.0), 'NOMINAL');
  assert.equal(evaluateThermalStatus(17.9, 18.0, 25.0), 'FUERA DE RANGO');
  assert.equal(evaluateThermalStatus(25.1, 18.0, 25.0), 'FUERA DE RANGO');
  assert.equal(evaluateThermalStatus(22.0, null, null), 'SIN_CONFIGURACION');
  assert.equal(evaluateThermalStatus(null, 18.0, 25.0), 'ESPERANDO_DATOS');

  const gaugeLow = computeThermalGaugeGeometry(10.0, 18.0, 25.0);
  assert.equal(gaugeLow.hasScale, true);
  assert.equal(gaugeLow.markerPct, 0);

  const gaugeHigh = computeThermalGaugeGeometry(40.0, 18.0, 25.0);
  assert.equal(gaugeHigh.markerPct, 100);

  const gaugeNoCfg = computeThermalGaugeGeometry(22.0, null, null);
  assert.equal(gaugeNoCfg.hasScale, false);
  assert.equal(gaugeNoCfg.markerPct, null);
});
