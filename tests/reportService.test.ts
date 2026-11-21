import assert from 'node:assert/strict';
import { test } from 'node:test';
import { downloadEnvironmentalReport } from '../src/services/reportService';
import { validateHistoricalDateRange } from '../src/services/sensorService';

test('RF-16: validateHistoricalDateRange rechaza fecha inicial mayor a final con mensaje exacto', () => {
  const err = validateHistoricalDateRange('2026-11-20', '2026-11-10');
  assert.equal(err, 'La fecha inicial no puede ser mayor a la final');
  assert.equal(validateHistoricalDateRange('2026-11-10', '2026-11-20'), null);
  assert.equal(validateHistoricalDateRange('', ''), null);
});

test('RF-16: downloadEnvironmentalReport propaga mensajes de error amigables según status HTTP', async () => {
  const originalFetch = globalThis.fetch;
  try {
    // 1. Simular 403 Forbidden
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ detail: 'No tiene permisos suficientes para realizar esta operación.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });

    await assert.rejects(
      async () => {
        await downloadEnvironmentalReport({ formato: 'pdf' });
      },
      {
        name: 'Error',
        message: 'No tiene permisos suficientes para realizar esta operación.',
      }
    );

    // 2. Simular 404 Not Found
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          detail: 'No se encontraron mediciones para el período y los filtros seleccionados',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );

    await assert.rejects(
      async () => {
        await downloadEnvironmentalReport({ formato: 'excel', fecha_inicio: '2026-01-01' });
      },
      {
        name: 'Error',
        message: 'No se encontraron mediciones para el período y los filtros seleccionados',
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
