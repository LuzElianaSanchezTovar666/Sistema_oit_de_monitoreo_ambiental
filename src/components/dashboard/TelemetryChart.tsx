import React, { useState, useMemo } from 'react';
import { Medicion, LimiteAmbiental } from '../../types/iot';
import { AlertCircle } from 'lucide-react';

interface TelemetryChartProps {
  readings: Medicion[];
  limites: LimiteAmbiental;
  sensorType: string;
  locationName: string;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  readings,
  limites,
  sensorType,
  locationName,
}) => {
  const [metricMode, setMetricMode] = useState<'temp' | 'hum' | 'dual'>('temp');
  const [timeWindow, setTimeWindow] = useState<'1h' | '4h' | '24h'>('4h');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Filtrar lecturas según la ventana de tiempo seleccionada
  const filteredReadings = useMemo(() => {
    if (!readings || readings.length === 0) return [];
    const count = timeWindow === '1h' ? 12 : timeWindow === '4h' ? 48 : readings.length;
    return readings.slice(-count);
  }, [readings, timeWindow]);

  // Dimensiones del canvas SVG
  const width = 800;
  const height = 280;
  const padding = { top: 25, right: 30, bottom: 35, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Cálculos de escalas para Temperatura
  const { minTemp, maxTemp, tempPoints, humPoints } = useMemo(() => {
    if (filteredReadings.length === 0) {
      return { minTemp: 0, maxTemp: 30, tempPoints: [], humPoints: [] };
    }

    const tVals = filteredReadings.map((r) => r.temperatura);
    const hVals = filteredReadings.map((r) => r.humedad);

    // Margen holgado para temperatura considerando límites
    const rawMinT = Math.min(...tVals, limites.temp_min - 2);
    const rawMaxT = Math.max(...tVals, limites.temp_max + 2);
    const minT = Math.floor(rawMinT);
    const maxT = Math.ceil(rawMaxT);

    // Humedad de 0 a 100%
    const minH = 0;
    const maxH = 100;

    const tPoints = filteredReadings.map((r, i) => {
      const x = padding.left + (i / Math.max(1, filteredReadings.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((r.temperatura - minT) / Math.max(1, maxT - minT)) * chartHeight;
      return { x, y, reading: r };
    });

    const hPoints = filteredReadings.map((r, i) => {
      const x = padding.left + (i / Math.max(1, filteredReadings.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((r.humedad - minH) / (maxH - minH)) * chartHeight;
      return { x, y, reading: r };
    });

    return { minTemp: minT, maxTemp: maxT, tempPoints: tPoints, humPoints: hPoints };
  }, [filteredReadings, limites, chartWidth, chartHeight, padding.left, padding.top]);

  // Líneas SVG en formato Path
  const tempPath = useMemo(() => {
    if (tempPoints.length === 0) return '';
    return tempPoints.reduce((acc, curr, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`, '');
  }, [tempPoints]);

  const tempAreaPath = useMemo(() => {
    if (tempPoints.length === 0) return '';
    const firstX = tempPoints[0].x;
    const lastX = tempPoints[tempPoints.length - 1].x;
    const bottomY = padding.top + chartHeight;
    return `${tempPath} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;
  }, [tempPath, tempPoints, padding.top, chartHeight]);

  const humPath = useMemo(() => {
    if (humPoints.length === 0) return '';
    return humPoints.reduce((acc, curr, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`, '');
  }, [humPoints]);

  // Líneas de referencia para límites operacionales de temperatura
  const tempMaxY = padding.top + chartHeight - ((limites.temp_max - minTemp) / Math.max(1, maxTemp - minTemp)) * chartHeight;
  const tempMinY = padding.top + chartHeight - ((limites.temp_min - minTemp) / Math.max(1, maxTemp - minTemp)) * chartHeight;

  const activePoint = hoverIndex !== null && filteredReadings[hoverIndex] ? filteredReadings[hoverIndex] : null;

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
      {/* Controles de métrica y tiempo */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Serie Temporal de Telemetría</span>
            <span className="text-xs text-slate-400 font-normal">· {locationName} ({sensorType})</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Streaming en vivo con detección de anomalías Isolation Forest
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Selector de Métrica */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
            <button
              onClick={() => setMetricMode('temp')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                metricMode === 'temp'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Temp (°C)
            </button>
            <button
              onClick={() => setMetricMode('hum')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                metricMode === 'hum'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Humedad (%)
            </button>
            <button
              onClick={() => setMetricMode('dual')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                metricMode === 'dual'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Ambas
            </button>
          </div>

          {/* Selector de Rango de Tiempo */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
            {(['1h', '4h', '24h'] as const).map((w) => (
              <button
                key={w}
                onClick={() => setTimeWindow(w)}
                className={`px-2.5 py-1 rounded-md transition-colors uppercase ${
                  timeWindow === w
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Canvas del Gráfico SVG */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair select-none"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * width;
            if (mouseX >= padding.left && mouseX <= width - padding.right) {
              const fraction = (mouseX - padding.left) / chartWidth;
              const idx = Math.min(
                filteredReadings.length - 1,
                Math.max(0, Math.round(fraction * (filteredReadings.length - 1)))
              );
              setHoverIndex(idx);
            }
          }}
        >
          <defs>
            <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="humGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Cuadrícula horizontal */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = padding.top + chartHeight * pct;
            const val = maxTemp - pct * (maxTemp - minTemp);
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-100 dark:text-slate-800/80"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono tabular-nums"
                >
                  {val.toFixed(1)}°
                </text>
              </g>
            );
          })}

          {/* Líneas de Límites Operacionales de Temperatura */}
          {(metricMode === 'temp' || metricMode === 'dual') && (
            <>
              {/* Límite Máximo */}
              <line
                x1={padding.left}
                y1={tempMaxY}
                x2={width - padding.right}
                y2={tempMaxY}
                stroke="#ef4444"
                strokeWidth="1.2"
                strokeDasharray="4 4"
              />
              <text
                x={width - padding.right}
                y={tempMaxY - 4}
                textAnchor="end"
                className="fill-red-500 text-[9px] font-mono font-medium"
              >
                Máx {limites.temp_max}°C
              </text>

              {/* Límite Mínimo */}
              <line
                x1={padding.left}
                y1={tempMinY}
                x2={width - padding.right}
                y2={tempMinY}
                stroke="#f59e0b"
                strokeWidth="1.2"
                strokeDasharray="4 4"
              />
              <text
                x={width - padding.right}
                y={tempMinY - 4}
                textAnchor="end"
                className="fill-amber-500 text-[9px] font-mono font-medium"
              >
                Mín {limites.temp_min}°C
              </text>
            </>
          )}

          {/* Área sombreada y línea de Temperatura */}
          {(metricMode === 'temp' || metricMode === 'dual') && (
            <>
              <path d={tempAreaPath} fill="url(#tempGradient)" />
              <path
                d={tempPath}
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* Línea de Humedad */}
          {(metricMode === 'hum' || metricMode === 'dual') && (
            <path
              d={humPath}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray={metricMode === 'dual' ? '2 2' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Puntos de anomalía destacados en el trazado */}
          {tempPoints.map((pt, i) => {
            if (!pt.reading.valor_anomalo) return null;
            return (
              <g key={`anom-${i}`}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="5"
                  fill="#ef4444"
                  className="animate-pulse"
                />
                <circle cx={pt.x} cy={pt.y} r="2.5" fill="#ffffff" />
              </g>
            );
          })}

          {/* Línea de cursor interactivo */}
          {hoverIndex !== null && tempPoints[hoverIndex] && (
            <g>
              <line
                x1={tempPoints[hoverIndex].x}
                y1={padding.top}
                x2={tempPoints[hoverIndex].x}
                y2={padding.top + chartHeight}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={tempPoints[hoverIndex].x}
                cy={tempPoints[hoverIndex].y}
                r="4.5"
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Tooltip flotante */}
        {activePoint && hoverIndex !== null && tempPoints[hoverIndex] && (
          <div
            className="absolute top-2 pointer-events-none z-10 px-3 py-2 rounded-lg bg-slate-900/95 text-white text-xs shadow-xl border border-slate-700 space-y-1 font-mono"
            style={{
              left: `${Math.min(75, Math.max(10, (tempPoints[hoverIndex].x / width) * 100))}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="text-[11px] text-slate-400 font-sans">
              {new Date(activePoint.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-emerald-400 font-bold">
                {activePoint.temperatura.toFixed(2)}°C
              </span>
              <span className="text-blue-400 font-bold">
                {activePoint.humedad.toFixed(1)}%RH
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-300">
              <span>Z: {activePoint.z_score_temp}σ</span>
              <span>·</span>
              <span>Score IA: {activePoint.score_anomalia_ia}</span>
            </div>
            {activePoint.valor_anomalo && (
              <div className="flex items-center gap-1 text-[10px] text-red-400 font-sans font-semibold pt-0.5">
                <AlertCircle className="w-3 h-3" />
                <span>Lectura catalogada anómala</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Leyenda y Notas del Gráfico */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-emerald-500 rounded-full" />
            <span>Temperatura (°C)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-blue-500 rounded-full" />
            <span>Humedad (%RH)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span>Anomalía ML detectada</span>
          </div>
        </div>
        <div className="font-mono text-[11px]">
          Frecuencia: <span className="font-semibold text-slate-700 dark:text-slate-300">1 muestra / 3 seg</span>
        </div>
      </div>
    </div>
  );
};
