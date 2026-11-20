import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areSensorDatesCoherent,
  computeThermalGaugeGeometry,
  computeTrendAxisBounds,
  evaluateHumidityStatus,
  evaluateThermalStatus,
  getTrendInsufficientMessage,
  INSUFFICIENT_TREND_MESSAGE,
  MODEL_CAPABILITIES,
  RF12_MIN_MAX_ERROR,
  validateHistoricalDateRange,
  validateSensorVariablesSelection,
  validateThresholdsClient,
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

test('evaluateHumidityStatus valida rango físico [0, 100] %RH y banda óptima RF-09', () => {
  assert.equal(evaluateHumidityStatus(55.0, 40.0, 70.0), 'NOMINAL');
  assert.equal(evaluateHumidityStatus(40.0, 40.0, 70.0), 'NOMINAL');
  assert.equal(evaluateHumidityStatus(70.0, 40.0, 70.0), 'NOMINAL');
  assert.equal(evaluateHumidityStatus(39.9, 40.0, 70.0), 'FUERA DE RANGO');
  assert.equal(evaluateHumidityStatus(70.1, 40.0, 70.0), 'FUERA DE RANGO');
  assert.equal(evaluateHumidityStatus(-5.0, 40.0, 70.0), 'ESPERANDO_DATOS');
  assert.equal(evaluateHumidityStatus(105.0, 40.0, 70.0), 'ESPERANDO_DATOS');
  assert.equal(evaluateHumidityStatus(55.0, null, null), 'SIN_CONFIGURACION');
  assert.equal(evaluateHumidityStatus(null, 40.0, 70.0), 'ESPERANDO_DATOS');
});

test('validateHistoricalDateRange rechaza fecha inicial mayor a final con mensaje exacto RF-10', () => {
  assert.equal(
    validateHistoricalDateRange('2026-11-20', '2026-11-19'),
    'La fecha inicial no puede ser mayor a la final'
  );
  assert.equal(validateHistoricalDateRange('2026-11-19', '2026-11-20'), null);
  assert.equal(validateHistoricalDateRange('2026-11-20', '2026-11-20'), null);
  assert.equal(validateHistoricalDateRange('', '2026-11-20'), null);
});

test('RF-11: getTrendInsufficientMessage y computeTrendAxisBounds respetan límites y 0-100 %RH', () => {
  assert.equal(getTrendInsufficientMessage(0), INSUFFICIENT_TREND_MESSAGE);
  assert.equal(getTrendInsufficientMessage(1), INSUFFICIENT_TREND_MESSAGE);
  assert.equal(getTrendInsufficientMessage(2), null);

  const humBounds = computeTrendAxisBounds([-5, 50, 105], 40, 70, true);
  assert.equal(humBounds.min, 0);
  assert.equal(humBounds.max, 100);

  const tempBounds = computeTrendAxisBounds([20.0, 22.0], 18.0, 25.0, false);
  assert.ok(tempBounds.min <= 18.0);
  assert.ok(tempBounds.max >= 25.0);
});

test('RF-12: validateThresholdsClient valida min<max, criticidad, humedad 0-100 y rango de modelo', () => {
  const baseForm = {
    temp_critico_min: '10',
    temp_min: '18',
    temp_max: '25',
    temp_critico_max: '32',
    hum_critico_min: '25',
    hum_min: '40',
    hum_max: '70',
    hum_critico_max: '85',
    presion_min: '',
    presion_max: '',
  };

  const ok = validateThresholdsClient('DHT22', ['temperatura', 'humedad'], baseForm);
  assert.equal(ok.valid, true);

  const minEqMax = validateThresholdsClient('DHT22', ['temperatura', 'humedad'], {
    ...baseForm,
    temp_min: '25',
    temp_max: '25',
  });
  assert.equal(minEqMax.valid, false);
  if (!minEqMax.valid) {
    assert.equal(minEqMax.error, RF12_MIN_MAX_ERROR);
  }

  const badCritOrder = validateThresholdsClient('DHT22', ['temperatura'], {
    ...baseForm,
    temp_critico_min: '19',
  });
  assert.equal(badCritOrder.valid, false);

  const badHumidity = validateThresholdsClient('DHT22', ['humedad'], {
    ...baseForm,
    hum_critico_max: '105',
  });
  assert.equal(badHumidity.valid, false);

  const badModelTemp = validateThresholdsClient('DHT22', ['temperatura'], {
    ...baseForm,
    temp_critico_max: '95',
  });
  assert.equal(badModelTemp.valid, false);

  // SHT31 soporta hasta 125 °C
  const okSht31 = validateThresholdsClient('SHT31', ['temperatura'], {
    ...baseForm,
    temp_critico_max: '95',
  });
  assert.equal(okSht31.valid, true);
});
