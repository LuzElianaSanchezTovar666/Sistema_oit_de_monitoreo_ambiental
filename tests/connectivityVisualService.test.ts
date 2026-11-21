import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DeviceConnectivity,
  evaluateRssi,
  formatRelativeTime,
} from '../src/services/deviceService';
import {
  CONNECTIVITY_STATES_CONFIG,
  DeviceConnectivityBadge,
  DeviceConnectivityPanel,
  DeviceRssiBadge,
} from '../src/components/devices/DeviceConnectivity';

test('RF-19: evaluateRssi aplica regla de umbral estricto (< -80 dBm advertencia preventiva, >= -80 dBm sin advertencia)', () => {
  // Caso 1: Señal débil < -80 dBm (ej. -81 dBm, -85 dBm, -90 dBm)
  const weak81 = evaluateRssi(-81);
  assert.strictEqual(weak81.isWeak, true, '-81 dBm debe marcarse como señal débil');
  assert.strictEqual(weak81.isAvailable, true);
  assert.ok(weak81.text.includes('-81 dBm · Señal Débil'));

  const weak85 = evaluateRssi(-85);
  assert.strictEqual(weak85.isWeak, true, '-85 dBm debe marcarse como señal débil');

  // Caso 2: Señal exacta en límite -80 dBm NO debe marcarse como débil (regla estricta < -80)
  const exact80 = evaluateRssi(-80);
  assert.strictEqual(exact80.isWeak, false, '-80 dBm NO debe marcarse como débil');
  assert.strictEqual(exact80.text, '-80 dBm');

  // Caso 3: Señal normal >= -80 dBm (ej. -75 dBm, -65 dBm, -50 dBm)
  const normal75 = evaluateRssi(-75);
  assert.strictEqual(normal75.isWeak, false);
  assert.strictEqual(normal75.text, '-75 dBm');

  const normal50 = evaluateRssi(-50);
  assert.strictEqual(normal50.isWeak, false);
  assert.strictEqual(normal50.text, '-50 dBm');

  // Caso 4: Señal no disponible (null / undefined / NaN) nunca asume 0 dBm ni barras completas
  const nullRssi = evaluateRssi(null);
  assert.strictEqual(nullRssi.isAvailable, false);
  assert.strictEqual(nullRssi.text, 'Señal no disponible');

  const undefRssi = evaluateRssi(undefined);
  assert.strictEqual(undefRssi.isAvailable, false);
  assert.strictEqual(undefRssi.text, 'Señal no disponible');

  // Caso 5: Dispositivo OFFLINE marca claramente como última señal conocida
  const offlineRssi = evaluateRssi(-78, true);
  assert.strictEqual(offlineRssi.text, 'Última: -78 dBm');

  const offlineWeak = evaluateRssi(-84, true);
  assert.strictEqual(offlineWeak.text, 'Última: -84 dBm · Señal Débil');
  assert.strictEqual(offlineWeak.isWeak, true);
});

test('RF-19: formatRelativeTime formatea correctamente tiempos transcurridos en UTC/local', () => {
  const now = Date.now();
  assert.strictEqual(formatRelativeTime(null), 'Sin comunicación registrada');
  assert.strictEqual(formatRelativeTime(''), 'Sin comunicación registrada');

  // Hace 5 segundos
  const t5s = new Date(now - 5000).toISOString();
  assert.strictEqual(formatRelativeTime(t5s), 'Hace unos segundos');

  // Hace 35 segundos
  const t35s = new Date(now - 35000).toISOString();
  assert.strictEqual(formatRelativeTime(t35s), 'Hace 35s');

  // Hace 4 minutos
  const t4m = new Date(now - 4 * 60 * 1000).toISOString();
  assert.strictEqual(formatRelativeTime(t4m), 'Hace 4m');

  // Hace 2 horas
  const t2h = new Date(now - 2 * 3600 * 1000).toISOString();
  assert.strictEqual(formatRelativeTime(t2h), 'Hace 2h');
});

test('RN-21: DeviceConnectivityBadge y DeviceRssiBadge cumplen norma de accesibilidad (icono + texto obligatorio, nunca solo color)', () => {
  const states = ['ONLINE', 'ADVERTENCIA', 'OFFLINE', 'ERROR', 'PENDIENTE', 'INACTIVO'] as const;

  for (const st of states) {
    const html = renderToStaticMarkup(React.createElement(DeviceConnectivityBadge, { state: st }));
    // Debe contener etiqueta visible con el nombre textual del estado
    assert.ok(html.includes(`<span>${st}</span>`), `Estado ${st} debe tener texto visible`);
    // Debe incluir un icono SVG con aria-hidden="true"
    assert.ok(html.includes('<svg') && html.includes('aria-hidden="true"'), `Estado ${st} debe tener icono SVG`);
    // Debe tener role="status" y aria-label
    assert.ok(html.includes('role="status"'), `Estado ${st} debe tener role="status"`);
    assert.ok(html.includes('aria-label='), `Estado ${st} debe tener aria-label descriptivo`);
  }

  // Verificación de DeviceRssiBadge con advertencia < -80 dBm
  const rssiWeakHtml = renderToStaticMarkup(React.createElement(DeviceRssiBadge, { rssi: -84 }));
  assert.ok(rssiWeakHtml.includes('-84 dBm · Señal Débil'), 'Debe incluir texto explicativo de señal débil');
  assert.ok(rssiWeakHtml.includes('<svg'), 'Debe incluir icono de advertencia');
  assert.ok(rssiWeakHtml.includes('role="status"'), 'Debe tener role="status"');

  // Verificación de DeviceRssiBadge sin advertencia >= -80 dBm
  const rssiNormalHtml = renderToStaticMarkup(React.createElement(DeviceRssiBadge, { rssi: -65 }));
  assert.ok(rssiNormalHtml.includes('-65 dBm'), 'Debe mostrar dBm numérico');
  assert.ok(!rssiNormalHtml.includes('Señal Débil'), 'No debe mostrar advertencia con -65 dBm');

  // Verificación de DeviceRssiBadge nulo
  const rssiNullHtml = renderToStaticMarkup(React.createElement(DeviceRssiBadge, { rssi: null }));
  assert.ok(rssiNullHtml.includes('Señal no disponible'), 'Debe indicar claramente señal no disponible');
});

test('RF-19: DeviceConnectivityPanel calcula contador global y soporta filtros rápidos para diagnóstico en < 3 segundos', () => {
  const sampleDevices: DeviceConnectivity[] = [
    {
      id_dispositivo: 'dev-1',
      codigo: 'SIMOA-01',
      nombre: 'Nodo Central',
      ubicacion_id: 'ubi-1',
      ubicacion: 'Quirófano A',
      estado: 'ONLINE',
      activo_administrativamente: true,
      ultimo_ping: new Date().toISOString(),
      rssi_dbm: -65,
    },
    {
      id_dispositivo: 'dev-2',
      codigo: 'SIMOA-02',
      nombre: 'Nodo Incubadora',
      ubicacion_id: 'ubi-2',
      ubicacion: 'Bioterio',
      estado: 'ADVERTENCIA',
      activo_administrativamente: true,
      ultimo_ping: new Date(Date.now() - 40000).toISOString(),
      rssi_dbm: -82, // Señal débil
    },
    {
      id_dispositivo: 'dev-3',
      codigo: 'SIMOA-03',
      nombre: 'Nodo Pabellón',
      ubicacion_id: 'ubi-3',
      ubicacion: 'Pabellón Cirugía',
      estado: 'OFFLINE',
      activo_administrativamente: true,
      ultimo_ping: new Date(Date.now() - 200000).toISOString(),
      rssi_dbm: -88, // Señal débil e histórico
    },
    {
      id_dispositivo: 'dev-4',
      codigo: 'SIMOA-04',
      nombre: 'Nodo Desactivado',
      ubicacion_id: 'ubi-4',
      ubicacion: 'Almacén',
      estado: 'INACTIVO',
      activo_administrativamente: false,
      ultimo_ping: null,
      rssi_dbm: null,
    },
  ];

  const html = renderToStaticMarkup(React.createElement(DeviceConnectivityPanel, { devices: sampleDevices }));

  // Contador global: 1 ONLINE de 3 activos (el 4to es inactivo)
  assert.ok(html.includes('1'), 'Debe mostrar 1 nodo online');
  assert.ok(html.includes('3'), 'Debe mostrar 3 nodos activos en total');
  assert.ok(html.includes('Contador Global'), 'Debe renderizar encabezado de Contador Global');

  // Filtros rápidos para que el técnico identifique en < 3s
  assert.ok(html.includes('Conectados (1)'));
  assert.ok(html.includes('Desconectados (1)'));
  assert.ok(html.includes('Advertencia / Error (1)'));
  assert.ok(html.includes('Señal Débil &lt; -80 dBm (2)')); // dev-2 (-82) y dev-3 (-88)
});
