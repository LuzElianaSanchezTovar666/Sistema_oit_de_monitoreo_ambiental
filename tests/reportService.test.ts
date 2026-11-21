import assert from 'node:assert/strict';
import { test } from 'node:test';
import { downloadEnvironmentalReport, downloadCsvExport } from '../src/services/reportService';
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

test('RF-17: downloadCsvExport propaga error 404 con mensaje exacto cuando no hay mediciones', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          detail: 'No hay mediciones disponibles para exportar con los filtros seleccionados',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );

    await assert.rejects(
      async () => {
        await downloadCsvExport({
          ubicacion_id: 'ubi-vacia',
        });
      },
      {
        name: 'Error',
        message: 'No hay mediciones disponibles para exportar con los filtros seleccionados',
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('RF-17: downloadCsvExport procesa Content-Disposition y X-Report-Total-Records', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as any).window;
  const originalDocument = (globalThis as any).document;

  try {
    let clicked = false;
    let downloadedFilename = '';

    (globalThis as any).window = {
      URL: {
        createObjectURL: () => 'blob:mock-url',
        revokeObjectURL: () => {},
      },
    };

    (globalThis as any).document = {
      createElement: (tag: string) => {
        if (tag === 'a') {
          return {
            href: '',
            download: '',
            click: () => {
              clicked = true;
            },
          };
        }
        return {};
      },
      body: {
        appendChild: (el: any) => {
          downloadedFilename = el.download;
        },
        removeChild: () => {},
      },
    };

    globalThis.fetch = async (_input: any, init?: any) => {
      const parsedBody = JSON.parse(init?.body || '{}');
      assert.equal(parsedBody.ubicacion_id, 'ubi-123');
      assert.ok('tz_offset_minutes' in parsedBody);

      return new Response('fake-csv-data', {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="simoa_reporte_20261121_120000.csv"',
          'X-Report-Total-Records': '42',
        },
      });
    };

    const result = await downloadCsvExport({ ubicacion_id: 'ubi-123' });
    assert.equal(result.filename, 'simoa_reporte_20261121_120000.csv');
    assert.equal(result.totalRecords, 42);
    assert.equal(downloadedFilename, 'simoa_reporte_20261121_120000.csv');
    assert.equal(clicked, true);
  } finally {
    globalThis.fetch = originalFetch;
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
  }
});
