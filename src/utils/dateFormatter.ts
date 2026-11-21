/**
 * Utilidades para formateo y visualización de fechas en zona horaria local (RNF-12).
 * Todas las fechas se almacenan y transmiten en UTC (ISO-8601).
 * La conversión a la zona horaria local 'America/Bogota' (UTC-5) se efectúa explícitamente aquí.
 */

export const BOGOTA_TIMEZONE = 'America/Bogota';

/**
 * Convierte una fecha UTC (ISO string o Date) a formato de fecha y hora local de Colombia.
 * Ejemplo: "21/11/2026, 12:30:45 p. m."
 */
export function formatToBogotaDateTime(
  dateInput: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '—';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '—';

    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: BOGOTA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      ...options,
    };

    return new Intl.DateTimeFormat('es-CO', defaultOptions).format(d);
  } catch {
    return '—';
  }
}

/**
 * Convierte una fecha UTC a formato solo fecha local (DD/MM/YYYY).
 */
export function formatToBogotaDate(
  dateInput: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  return formatToBogotaDateTime(dateInput, {
    hour: undefined,
    minute: undefined,
    second: undefined,
    hour12: undefined,
    ...options,
  });
}

/**
 * Convierte una fecha UTC a formato solo hora local (HH:MM:SS am/pm).
 */
export function formatToBogotaTime(
  dateInput: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  return formatToBogotaDateTime(dateInput, {
    year: undefined,
    month: undefined,
    day: undefined,
    ...options,
  });
}
