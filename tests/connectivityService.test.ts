import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DeviceConnectivityPanel } from '../src/components/devices/DeviceConnectivity';
import { TemperatureKpiCard } from '../src/components/dashboard/TemperatureKpiCard';
import { HumidityKpiCard } from '../src/components/dashboard/HumidityKpiCard';
import { DeviceConnectivity } from '../src/services/deviceService';

test('RF-15 muestra estados, identificador y último contacto sin depender del color', () => {
  const device: DeviceConnectivity = {
    id_dispositivo: 'dev-15',
    codigo: 'SIMOA-15',
    nombre: 'Nodo laboratorio',
    ubicacion_id: 'lab',
    ubicacion: 'Laboratorio',
    estado: 'ADVERTENCIA',
    ultimo_ping: '2026-11-20T12:00:00Z',
  };
  const render = (items: DeviceConnectivity[] | null) =>
    renderToStaticMarkup(React.createElement(DeviceConnectivityPanel, { devices: items }));

  const warning = render([device]);
  for (const text of ['SIMOA-15', 'Nodo laboratorio', 'Laboratorio', 'ADVERTENCIA', 'Retraso en la comunicación', 'Último contacto']) {
    assert.ok(warning.includes(text), text);
  }
  assert.match(render([{ ...device, estado: 'OFFLINE' }]), /OFFLINE.*Comunicación interrumpida/);
  assert.match(render([{ ...device, estado: 'ONLINE' }]), /ONLINE/);
  assert.match(render([{ ...device, estado: 'INACTIVO' }]), /INACTIVO/);
  assert.match(render(null), /Estado de conectividad no disponible/);
});

test('RF-08 y RF-09 muestran el marcador de dato ausente durante una desconexión', () => {
  const props = { snapshot: null, locationName: 'Laboratorio', streamConnected: true, isStale: true };
  assert.match(renderToStaticMarkup(React.createElement(TemperatureKpiCard, props)), />--<span[^>]*>°C<\/span>/);
  assert.match(renderToStaticMarkup(React.createElement(HumidityKpiCard, props)), />--<span[^>]*>%RH<\/span>/);
});
