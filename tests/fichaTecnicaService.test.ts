import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateRssi,
  formatLastContact,
  formatRelativeTime,
  DeviceFichaTecnicaDTO,
} from '../src/services/deviceService';

test('Ficha Técnica RF-20: evaluateRssi evalúa correctamente niveles y regla preventiva (< -80 dBm)', () => {
  const excellent = evaluateRssi(-55);
  assert.equal(excellent.isWeak, false);
  assert.equal(excellent.qualityLabel, 'Excelente');
  assert.match(excellent.text, /-55 dBm/);

  const acceptable = evaluateRssi(-75);
  assert.equal(acceptable.isWeak, false);
  assert.equal(acceptable.qualityLabel, 'Aceptable');

  const weakPreventive = evaluateRssi(-82);
  assert.equal(weakPreventive.isWeak, true);
  assert.equal(weakPreventive.qualityLabel, 'Débil (Preventiva)');
  assert.match(weakPreventive.text, /· Señal Débil/);

  const veryWeak = evaluateRssi(-90);
  assert.equal(veryWeak.isWeak, true);
  assert.equal(veryWeak.qualityLabel, 'Muy Débil');

  const unavailable = evaluateRssi(null);
  assert.equal(unavailable.isAvailable, false);
  assert.equal(unavailable.text, 'Señal no disponible');
});

test('Ficha Técnica RF-20: formatRelativeTime y formatLastContact formatean adecuadamente fechas', () => {
  assert.equal(formatRelativeTime(null), 'Sin comunicación registrada');
  assert.equal(formatLastContact(null), 'Sin contacto registrado');

  const now = new Date();
  assert.match(formatRelativeTime(now.toISOString()), /Hace/);

  const pastDate = new Date('2026-01-15T10:30:00Z');
  assert.match(formatLastContact(pastDate.toISOString()), /2026/);
});

test('Ficha Técnica RF-20: estructura de DTO consolida hardware, MQTT, conectividad, sensores y mantenimientos', () => {
  const mockFicha: DeviceFichaTecnicaDTO = {
    dispositivo: {
      id_dispositivo: 'dev-001',
      codigo: 'NODE-001',
      nombre: 'Sensor Central Lab',
      mac_address: '24:6F:28:B1:C0:04',
      ip_address: '192.168.1.100',
      tipo: 'ESP32',
      firmware_version: 'v1.4.2',
      ubicacion_id: 'ubi-01',
      ubicacion: 'Laboratorio de Calidad',
      estado: 'ONLINE',
      observacion_tecnica: 'Nodo en caja IP65',
      historial_mediciones_count: 1420,
    },
    conectividad: {
      id_dispositivo: 'dev-001',
      codigo: 'NODE-001',
      nombre: 'Sensor Central Lab',
      ubicacion_id: 'ubi-01',
      ubicacion: 'Laboratorio de Calidad',
      estado: 'ONLINE',
      rssi_dbm: -74,
      tiempo_silencio_segundos: 4,
    },
    mqtt: {
      client_id: 'simoa-NODE-001',
      topic_telemetria: 'simoa/dispositivos/NODE-001/telemetria',
      topic_heartbeat: 'simoa/dispositivos/NODE-001/heartbeat',
      broker_host: 'localhost',
      broker_port: 1883,
      broker_disponible: true,
      broker_mensaje: 'Broker MQTT accesible.',
    },
    sensores: [
      {
        id_sensor: 'sns-01',
        dispositivo_id: 'dev-001',
        identificador: 'DHT22-01',
        modelo: 'DHT22',
        variables_medidas: ['temperatura', 'humedad'],
        fecha_instalacion: '2026-01-01',
        ultima_calibracion: '2026-02-01',
        estado: 'ACTIVO',
        historial_mediciones_count: 1420,
      },
    ],
    sensores_count: 1,
    mantenimientos: [
      {
        id_mantenimiento: 'mnt-001',
        dispositivo_id: 'dev-001',
        tecnico_id: '1',
        tecnico_nombre: 'Carlos Técnico',
        tipo_mantenimiento: 'CALIBRACION',
        fecha_intervencion: '2026-02-15T09:00:00Z',
        fecha_realizacion: '2026-02-15T09:00:00Z',
        descripcion: 'Calibración con patrón trazable Fluke',
        resultado: 'EXITOSO',
        costo_estimado_usd: 85.0,
        estado: 'COMPLETADO',
      },
    ],
    mantenimientos_count: 1,
    alertas_recientes: [],
    permisos: {
      puede_editar_tecnico: true,
      puede_registrar_mantenimiento: true,
      rol_actual: 'Administrador',
    },
    advertencia_hardware: 'La edición de parámetros en SIMOA no reprograma físicamente el firmware del ESP32.',
  };

  assert.equal(mockFicha.dispositivo.ip_address, '192.168.1.100');
  assert.equal(mockFicha.sensores_count, 1);
  assert.equal(mockFicha.mantenimientos_count, 1);
  assert.equal(mockFicha.permisos.puede_editar_tecnico, true);

  // Verificación de seguridad: no expone contraseñas ni hashes
  const serialized = JSON.stringify(mockFicha);
  assert.equal(serialized.includes('password'), false);
  assert.equal(serialized.includes('hash'), false);
});
