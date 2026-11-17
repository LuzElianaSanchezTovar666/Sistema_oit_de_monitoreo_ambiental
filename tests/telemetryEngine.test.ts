import test from 'node:test';
import assert from 'node:assert/strict';
import { TelemetryEngine } from '../src/services/telemetryEngine';
import { Dispositivo, Sensor, Alerta } from '../src/types/iot';

const mockDevices: Dispositivo[] = [
  {
    id_dispositivo: 'dev-test-1',
    mac_address: 'AA:BB:CC:DD:EE:01',
    nombre: 'Nodo Test ESP32',
    tipo: 'ESP32-WROOM',
    ubicacion_id: 'loc-test-1',
    usuario_id: 'usr-admin-1',
    estado: 'ONLINE',
    ip_address: '192.168.1.50',
    rssi_dbm: -58,
    firmware_version: 'v2.4.0',
    fecha_registro: '2026-01-10T08:00:00Z',
    ultimo_ping: new Date().toISOString(),
    mqtt_client_id: 'simoa-test-1',
    mqtt_topic: 'simoa/test/1',
  },
];

const mockSensors: Sensor[] = [
  {
    id_sensor: 'sen-test-1',
    dispositivo_id: 'dev-test-1',
    tipo_sensor: 'DHT22',
    variables: ['temperatura', 'humedad'],
    unidad_temperatura: '°C',
    unidad_humedad: '%RH',
    estado: 'ACTIVO',
    fecha_instalacion: '2026-01-10',
    ultima_calibracion: '2026-01-10',
    limites: {
      temp_min: 18,
      temp_max: 26,
      hum_min: 40,
      hum_max: 70,
      temp_critica_max: 30,
      hum_critica_max: 85,
    },
  },
];

test('generateInitialHistory crea historial nominal para sensores activos', () => {
  const engine = new TelemetryEngine();
  const buffer = engine.generateInitialHistory(mockDevices, mockSensors);
  const history = buffer['sen-test-1'];

  assert.ok(Array.isArray(history), 'Debe generar arreglo de mediciones');
  assert.equal(history.length, 49, 'Debe generar 49 puntos históricos');
  assert.equal(history.every((m) => !m.es_fuera_de_umbral), true, 'Los puntos iniciales deben estar en banda nominal');
});

test('tick detecta excursión térmica y dispara alerta con Isolation Forest / Z-Score', () => {
  const engine = new TelemetryEngine();
  engine.generateInitialHistory(mockDevices, mockSensors);
  engine.injectFault('sen-test-1', { tempOffset: 15, forceAnomaly: true });

  const alerts: Alerta[] = [];
  const latest = engine.tick(mockDevices, mockSensors, (a) => alerts.push(a));
  const reading = latest['sen-test-1'];

  assert.ok(reading, 'Debe retornar la lectura del sensor');
  assert.equal(reading.es_fuera_de_umbral, true, 'Debe marcar lectura fuera de umbral');
  assert.equal(reading.valor_anomalo, true, 'Debe marcar valor anómalo');
  assert.equal(alerts.length, 1, 'Debe emitir exactamente 1 alerta');
  assert.equal(alerts[0].nivel, 'CRITICA', 'Debe clasificar como alerta CRITICA');
});

test('debouncing evita alertas duplicadas dentro de la ventana de 5 minutos', () => {
  const engine = new TelemetryEngine();
  engine.generateInitialHistory(mockDevices, mockSensors);
  engine.injectFault('sen-test-1', { tempOffset: 12 });

  const alerts: Alerta[] = [];
  engine.tick(mockDevices, mockSensors, (a) => alerts.push(a));
  engine.tick(mockDevices, mockSensors, (a) => alerts.push(a));

  assert.equal(alerts.length, 1, 'Solo debe emitirse una alerta dentro de la ventana de debouncing');
});

test('clearFault elimina la falla simulada activa', () => {
  const engine = new TelemetryEngine();
  engine.injectFault('sen-test-1', { tempOffset: 10 });
  assert.ok(engine.getActiveFaults()['sen-test-1']);

  engine.clearFault('sen-test-1');
  assert.equal(engine.getActiveFaults()['sen-test-1'], undefined);
});
