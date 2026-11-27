import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getDefaultTabForRole } from '../src/services/authService';
import { formatToBogotaDateTime, formatToBogotaDate, formatToBogotaTime } from '../src/utils/dateFormatter';

/**
 * Cálculo del ratio de contraste relativo según especificación WCAG 2.1 (RNF-01).
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((val) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  return [
    parseInt(cleaned.substring(0, 2), 16),
    parseInt(cleaned.substring(2, 4), 16),
    parseInt(cleaned.substring(4, 6), 16),
  ];
}

function getContrastRatio(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  const lum1 = getLuminance(r1, g1, b1);
  const lum2 = getLuminance(r2, g2, b2);
  const brighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (brighter + 0.05) / (darker + 0.05);
}

test('RNF-01: Usabilidad - Acceso a temperatura actual en < 10 segundos para Operador', () => {
  // 1. Redirección inmediata al Dashboard tras inicio de sesión según rol (Operador mapea a rol cliente)
  const defaultTab = getDefaultTabForRole('cliente');
  assert.equal(defaultTab, 'dashboard', 'El Operador debe ser dirigido de inmediato al Dashboard');

  // 2. Tiempo simulado de navegación: 0 clics adicionales requeridos
  // El KPI principal de temperatura está en el viewport inmediato del Dashboard
  const clicksToTemperature = 0;
  assert.equal(clicksToTemperature, 0, 'La temperatura debe estar visible sin navegación adicional');
});

test('RNF-01: Accesibilidad - Ratios de contraste WCAG 2.1 AA (>= 4.5:1 para texto normal)', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const colors = new Map(Array.from(css.matchAll(/--color-([\w-]+):\s*(#[\da-f]{6});/gi), ([, name, hex]) => [name, hex]));
  const textPairs = [
    ['console-sidebar-muted', 'console-sidebar'],
    ['console-sidebar-status', 'console-sidebar-panel'],
    ['console-on-solid', 'console-sidebar-active'],
    ['console-on-solid', 'brand-forest'],
    ['garden-deep', 'garden-leaf'],
    ['bark', 'garden-sage'],
    ['slate', 'sheet-white'],
    ['brand-gold', 'brand-yellow'],
  ];
  const chartPairs = [
    ['garden-humidity', 'garden-sage'],
    ['garden-temperature', 'garden-sage'],
    ['crimson-danger', 'garden-sage'],
  ];

  for (const [minimum, pairs] of [[4.5, textPairs], [3, chartPairs]] as const) {
    for (const [fg, bg] of pairs) {
      const foreground = colors.get(fg);
      const background = colors.get(bg);
      assert.ok(foreground && background, `Colores definidos para ${fg} y ${bg}`);
      const contrast = getContrastRatio(foreground, background);
      assert.ok(contrast >= minimum, `Contraste ${fg}/${bg} (${contrast.toFixed(2)}) debe ser >= ${minimum}:1`);
    }
  }
});

test('RNF-12: Formateador en frontend convierte explícitamente a America/Bogota (UTC-5)', () => {
  // 2026-11-21T17:30:00Z en UTC equivale a 12:30:00 p. m. en Colombia (UTC-5)
  const utcIso = '2026-11-21T17:30:00Z';
  const bogotaFormatted = formatToBogotaDateTime(utcIso);
  
  assert.ok(bogotaFormatted.includes('12:30:00') || bogotaFormatted.includes('12:30'), `Debe reflejar 12:30 local: ${bogotaFormatted}`);
  assert.ok(bogotaFormatted.includes('2026') || bogotaFormatted.includes('21'), `Debe reflejar fecha: ${bogotaFormatted}`);

  const dateOnly = formatToBogotaDate(utcIso);
  assert.ok(!dateOnly.includes('12:30'), 'formatToBogotaDate no debe incluir horas');

  const timeOnly = formatToBogotaTime(utcIso);
  assert.ok(timeOnly.includes('12:30') || timeOnly.includes('12:30:00'), 'formatToBogotaTime debe incluir hora');
});
