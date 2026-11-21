export interface EnvironmentalReportFilterPayload {
  formato: 'pdf' | 'excel' | 'xlsx';
  fecha_inicio?: string;
  fecha_fin?: string;
  tz_offset_minutes?: number;
  ubicacion_id?: string;
  dispositivo_id?: string;
  sensor_id?: string;
}

function getCsrfToken(): string {
  if (typeof document === 'undefined' || typeof document.cookie !== 'string') return '';
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith('simoa_csrf='));
  return match ? decodeURIComponent(match.split('=')[1] || '') : '';
}

export async function downloadEnvironmentalReport(
  payload: EnvironmentalReportFilterPayload
): Promise<{ filename: string; totalRecords?: number; conformidad?: string }> {
  const csrf = getCsrfToken();
  const tzOffset =
    payload.tz_offset_minutes !== undefined
      ? payload.tz_offset_minutes
      : typeof new Date().getTimezoneOffset === 'function'
      ? new Date().getTimezoneOffset()
      : 0;

  const res = await fetch('/api/reportes/ambientales', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
    body: JSON.stringify({
      ...payload,
      tz_offset_minutes: tzOffset,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message =
      errorData.detail ||
      (res.status === 403
        ? 'No tiene permisos suficientes (Se requiere rol Administrador o Supervisor).'
        : res.status === 404
        ? 'No se encontraron mediciones para el período y los filtros seleccionados.'
        : 'Error al generar el reporte ambiental.');
    throw new Error(message);
  }

  // Extraer nombre de archivo de cabecera Content-Disposition si está presente
  const disposition = res.headers.get('Content-Disposition') || '';
  let filename = '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  if (match && match[1]) {
    filename = match[1];
  } else {
    const ext = payload.formato === 'pdf' ? 'pdf' : 'xlsx';
    filename = `simoa_reporte_ambiental_${new Date().toISOString().replace(/[:.]/g, '_')}.${ext}`;
  }

  const totalRecordsHeader = res.headers.get('X-Report-Total-Records');
  const conformidadHeader = res.headers.get('X-Report-Conformidad');

  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(blobUrl);

  return {
    filename,
    totalRecords: totalRecordsHeader ? parseInt(totalRecordsHeader, 10) : undefined,
    conformidad: conformidadHeader || undefined,
  };
}

export interface CsvExportFilterPayload {
  fecha_inicio?: string;
  fecha_fin?: string;
  tz_offset_minutes?: number;
  ubicacion_id?: string;
  dispositivo_id?: string;
  sensor_id?: string;
}

export async function downloadCsvExport(
  payload: CsvExportFilterPayload
): Promise<{ filename: string; totalRecords?: number }> {
  const csrf = getCsrfToken();
  const tzOffset =
    payload.tz_offset_minutes !== undefined
      ? payload.tz_offset_minutes
      : typeof new Date().getTimezoneOffset === 'function'
      ? new Date().getTimezoneOffset()
      : 0;

  const res = await fetch('/api/mediciones/exportar/csv', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
    body: JSON.stringify({
      ...payload,
      tz_offset_minutes: tzOffset,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message =
      errorData.detail ||
      (res.status === 404
        ? 'No hay mediciones disponibles para exportar con los filtros seleccionados'
        : 'Error al exportar mediciones a CSV.');
    throw new Error(message);
  }

  const disposition = res.headers.get('Content-Disposition') || '';
  let filename = '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  if (match && match[1]) {
    filename = match[1];
  } else {
    filename = `simoa_reporte_${new Date().toISOString().replace(/[:.]/g, '_').slice(0, 15)}.csv`;
  }

  const totalRecordsHeader = res.headers.get('X-Report-Total-Records');

  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(blobUrl);

  return {
    filename,
    totalRecords: totalRecordsHeader ? parseInt(totalRecordsHeader, 10) : undefined,
  };
}
