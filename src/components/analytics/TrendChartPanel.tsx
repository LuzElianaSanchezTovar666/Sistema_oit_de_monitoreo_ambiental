import React, { useMemo, useState } from 'react';
import { Thermometer, Droplets, AlertTriangle, Sparkles, Info } from 'lucide-react';
import { SkeletonBox } from '../common/SkeletonLoader';
import {
  computeTrendAxisBounds,
  getTrendInsufficientMessage,
  HistoricalTrendResponseDTO,
  TrendLimitMetaDTO,
  TrendPointDTO,
} from '../../services/sensorService';

interface SingleSeriesSvgChartProps {
  title: string;
  unit: '°C' | '%RH';
  isHumidity: boolean;
  strokeColor: string;
  points: TrendPointDTO[];
  limitMeta: TrendLimitMetaDTO;
  anomaliasDisponibles: boolean;
  icon: React.ReactNode;
}

const SingleSeriesSvgChart: React.FC<SingleSeriesSvgChartProps> = React.memo(
  ({ title, unit, isHumidity, strokeColor, points, limitMeta, anomaliasDisponibles, icon }) => {
    const [activeIdx, setActiveIdx] = useState<number | null>(null);

    const validEntries = useMemo(
      () =>
        points
          .map((p, idx) => {
            const val = isHumidity ? p.humedad : p.temperatura;
            return val !== null && Number.isFinite(val) ? { point: p, val, origIdx: idx } : null;
          })
          .filter((e): e is NonNullable<typeof e> => e !== null),
      [points, isHumidity]
    );

    const insufficientMsg = getTrendInsufficientMessage(validEntries.length);

    const width = 760;
    const height = 250;
    const pad = { top: 20, right: 24, bottom: 38, left: 52 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;

    const { yMin, yMax, coords, pathD, limitStartX } = useMemo(() => {
      const vals = validEntries.map((e) => e.val);
      const bounds = computeTrendAxisBounds(vals, limitMeta.min, limitMeta.max, isHumidity);
      const span = Math.max(0.1, bounds.max - bounds.min);

      if (validEntries.length === 0) {
        return { yMin: bounds.min, yMax: bounds.max, coords: [], pathD: '', limitStartX: pad.left };
      }

      const firstMs = new Date(validEntries[0].point.fecha_hora_utc).getTime();
      const lastMs = new Date(validEntries[validEntries.length - 1].point.fecha_hora_utc).getTime();
      const timeSpan = Math.max(1, lastMs - firstMs);

      const pts = validEntries.map((e, idx) => {
        const ms = new Date(e.point.fecha_hora_utc).getTime();
        const x =
          validEntries.length === 1
            ? pad.left + innerW / 2
            : lastMs > firstMs
              ? pad.left + ((ms - firstMs) / timeSpan) * innerW
              : pad.left + (idx / Math.max(1, validEntries.length - 1)) * innerW;
        const y = pad.top + innerH - ((e.val - bounds.min) / span) * innerH;
        return { x, y, val: e.val, point: e.point };
      });

      const field = isHumidity ? 'segmento_humedad' : 'segmento_temperatura';
      const d = pts.map((point, index) => {
        const pen = index === 0 || point.point[field] !== pts[index - 1].point[field] ? 'M' : 'L';
        return `${pen} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      }).join(' ');

      let limX = pad.left;
      if (!limitMeta.vigencia_completa && limitMeta.vigente_desde_utc && lastMs > firstMs) {
        const vigMs = new Date(limitMeta.vigente_desde_utc).getTime();
        if (vigMs > firstMs) {
          limX = Math.min(width - pad.right, Math.max(pad.left, pad.left + ((vigMs - firstMs) / timeSpan) * innerW));
        }
      }

      return { yMin: bounds.min, yMax: bounds.max, coords: pts, pathD: d, limitStartX: limX };
    }, [validEntries, limitMeta, isHumidity, innerW, innerH, pad.left, pad.top, width, pad.right]);

    const yToPx = (val: number) => pad.top + innerH - ((val - yMin) / Math.max(0.1, yMax - yMin)) * innerH;

    const activeCoord = activeIdx !== null && coords[activeIdx] ? coords[activeIdx] : null;

    const handlePointer = (clientX: number, rect: DOMRect) => {
      if (coords.length === 0) return;
      const svgX = ((clientX - rect.left) / Math.max(1, rect.width)) * width;
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < coords.length; i++) {
        const d = Math.abs(coords[i].x - svgX);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      setActiveIdx(bestIdx);
    };

    const handleKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
      if (coords.length === 0) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveIdx((prev) => (prev === null ? 0 : Math.min(coords.length - 1, prev + 1)));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveIdx((prev) => (prev === null ? coords.length - 1 : Math.max(0, prev - 1)));
      } else if (e.key === 'Escape') {
        setActiveIdx(null);
      }
    };

    const yTicks = [yMin, yMin + (yMax - yMin) * 0.5, yMax];
    const xLabelIndices =
      coords.length >= 3
        ? [0, Math.floor((coords.length - 1) / 2), coords.length - 1]
        : coords.map((_, idx) => idx);

    return (
      <div className="bg-sheet-white rounded-[16px] p-5 space-y-3 border border-sage-mist/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-bark flex items-center gap-2">
            {icon}
            <span>{title}</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
            {limitMeta.min !== null && limitMeta.max !== null ? (
              <span className="px-2 py-0.5 rounded-[6px] bg-cream-paper text-bark">
                Límites: {limitMeta.min} – {limitMeta.max} {unit}
                {!limitMeta.vigencia_completa && limitMeta.vigente_desde_utc
                  ? ` (desde ${new Date(limitMeta.vigente_desde_utc).toLocaleDateString()})`
                  : ''}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-[6px] bg-cream-paper text-slate inline-flex items-center gap-1">
                <Info className="w-3 h-3" />
                {limitMeta.motivo || 'Sin límites configurados'}
              </span>
            )}
          </div>
        </div>

        {insufficientMsg ? (
          <div className="bg-cream-paper rounded-[12px] p-6 text-center space-y-2">
            <p className="text-xs font-medium text-bark">{insufficientMsg}</p>
            {validEntries.length === 1 && (
              <div className="inline-flex flex-wrap items-center gap-3 px-3 py-1.5 rounded-[8px] bg-sheet-white text-xs font-mono text-canopy border border-sage-mist">
                <span>
                  Lectura única: {validEntries[0].val.toFixed(1)} {unit}
                </span>
                <span className="text-slate">
                  {new Date(validEntries[0].point.fecha_hora_utc).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="relative w-full bg-cream-paper rounded-[12px] p-2">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              tabIndex={0}
              role="img"
              aria-label={`${title}. Use flechas izquierda y derecha para recorrer puntos.`}
              onKeyDown={handleKeyDown}
              onMouseLeave={() => setActiveIdx(null)}
              onMouseMove={(e) => handlePointer(e.clientX, e.currentTarget.getBoundingClientRect())}
              onTouchStart={(e) => {
                if (e.touches[0]) handlePointer(e.touches[0].clientX, e.currentTarget.getBoundingClientRect());
              }}
              onTouchMove={(e) => {
                if (e.touches[0]) handlePointer(e.touches[0].clientX, e.currentTarget.getBoundingClientRect());
              }}
              className="w-full h-auto cursor-crosshair select-none focus:outline-none focus:ring-2 focus:ring-canopy rounded-[8px]"
            >
              {/* Rejilla Y */}
              {yTicks.map((tv, i) => {
                const y = yToPx(tv);
                return (
                  <g key={i}>
                    <line
                      x1={pad.left}
                      y1={y}
                      x2={width - pad.right}
                      y2={y}
                      stroke="#CBD5E1"
                      strokeOpacity="0.6"
                      strokeWidth="1"
                    />
                    <text
                      x={pad.left - 8}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-slate text-[10px] font-mono"
                    >
                      {tv.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* Líneas de límites operacionales reales */}
              {limitMeta.max !== null && (
                <>
                  <line
                    x1={limitStartX}
                    y1={yToPx(limitMeta.max)}
                    x2={width - pad.right}
                    y2={yToPx(limitMeta.max)}
                    stroke="#15803d"
                    strokeWidth="1.3"
                    strokeDasharray="5 4"
                  />
                  <text
                    x={width - pad.right}
                    y={yToPx(limitMeta.max) - 4}
                    textAnchor="end"
                    className="fill-[#15803d] text-[9px] font-mono font-semibold"
                  >
                    Máx {limitMeta.max}
                    {unit}
                  </text>
                </>
              )}
              {limitMeta.min !== null && (
                <>
                  <line
                    x1={limitStartX}
                    y1={yToPx(limitMeta.min)}
                    x2={width - pad.right}
                    y2={yToPx(limitMeta.min)}
                    stroke="#D97706"
                    strokeWidth="1.3"
                    strokeDasharray="5 4"
                  />
                  <text
                    x={width - pad.right}
                    y={yToPx(limitMeta.min) - 4}
                    textAnchor="end"
                    className="fill-[#D97706] text-[9px] font-mono font-semibold"
                  >
                    Mín {limitMeta.min}
                    {unit}
                  </text>
                </>
              )}

              {/* Línea principal */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-300 motion-reduce:transition-none"
                />
              )}

              {/* Marcadores fuera de rango y anomalías IA */}
              {coords.map((c, idx) => {
                const outOfBounds =
                  limitMeta.min !== null && limitMeta.max !== null
                    ? c.val < limitMeta.min || c.val > limitMeta.max
                    : Boolean(c.point.es_fuera_de_umbral);
                return (
                  <g key={`${c.point.id_medicion}-${idx}`}>
                    {outOfBounds && (
                      <circle
                        cx={c.x}
                        cy={c.y}
                        r="4"
                        fill="#15803d"
                        stroke="#FFFFFF"
                        strokeWidth="1.2"
                      />
                    )}
                    {c.point.es_anomalia_ia && (
                      <polygon
                        points={`${c.x},${c.y - 6} ${c.x + 5},${c.y} ${c.x},${c.y + 6} ${c.x - 5},${c.y}`}
                        fill="var(--color-signal-yellow)"
                        stroke="#FFFFFF"
                        strokeWidth="1.2"
                      />
                    )}
                  </g>
                );
              })}

              {/* Punto activo */}
              {activeCoord && (
                <g>
                  <line
                    x1={activeCoord.x}
                    y1={pad.top}
                    x2={activeCoord.x}
                    y2={height - pad.bottom}
                    stroke="#475569"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <circle
                    cx={activeCoord.x}
                    cy={activeCoord.y}
                    r="5.5"
                    fill={strokeColor}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                </g>
              )}

              {/* Eje X fecha/hora */}
              {xLabelIndices.map((idx) => {
                const c = coords[idx];
                if (!c) return null;
                return (
                  <text
                    key={idx}
                    x={c.x}
                    y={height - 10}
                    textAnchor={idx === 0 ? 'start' : idx === coords.length - 1 ? 'end' : 'middle'}
                    className="fill-slate text-[9px] font-mono"
                  >
                    {new Date(c.point.fecha_hora_utc).toLocaleString([], {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </text>
                );
              })}
            </svg>

            {/* Tooltip accesible */}
            {activeCoord && (
              <div
                className="mt-2 p-3 rounded-[10px] bg-sheet-white border border-sage-mist text-xs font-mono flex flex-wrap items-center justify-between gap-2"
                role="status"
              >
                <div className="space-y-0.5">
                  <div className="text-bark font-semibold">
                    {new Date(activeCoord.point.fecha_hora_utc).toLocaleString()}
                    {activeCoord.point.sensor_identificador
                      ? ` · ${activeCoord.point.sensor_identificador}`
                      : ''}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-canopy">
                      Temp:{' '}
                      {activeCoord.point.temperatura !== null
                        ? `${activeCoord.point.temperatura.toFixed(2)} °C`
                        : '—'}
                    </span>
                    <span className="text-garden-humidity">
                      Humedad:{' '}
                      {activeCoord.point.humedad !== null
                        ? `${activeCoord.point.humedad.toFixed(1)} %RH`
                        : '—'}
                    </span>
                    <span className="text-slate">Estado: {activeCoord.point.estado_evaluacion}</span>
                  </div>
                </div>
                {activeCoord.point.score_anomalia_ia !== null && activeCoord.point.score_anomalia_ia !== undefined && (
                  <span className="px-2 py-0.5 rounded-[5px] bg-brand-yellow text-brand-gold font-semibold">
                    IA Score: {activeCoord.point.score_anomalia_ia.toFixed(3)}
                    {activeCoord.point.es_anomalia_ia ? ' (Anomalía)' : ''}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Leyenda */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate pt-1">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full" style={{ backgroundColor: strokeColor }} />
              Tendencia ({unit})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#15803d]" />
              Fuera de umbral
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rotate-45 bg-signal-yellow" />
              {anomaliasDisponibles ? 'Anomalía IA (RF-18)' : 'Anomalía IA (RF-18 pendiente)'}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

interface TrendChartPanelProps {
  trendData: HistoricalTrendResponseDTO | null;
  loading: boolean;
  error: string;
}

export const TrendChartPanel: React.FC<TrendChartPanelProps> = React.memo(
  ({ trendData, loading, error }) => {
    if (loading) {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-sheet-white rounded-[16px] p-5">
            <SkeletonBox className="h-56 w-full" />
          </div>
          <div className="bg-sheet-white rounded-[16px] p-5">
            <SkeletonBox className="h-56 w-full" />
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-sheet-white rounded-[16px] p-5 text-xs text-[#15803d] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      );
    }

    const series = trendData?.series || [];
    const tempLimits = trendData?.limites.temperatura || {
      min: null,
      max: null,
      vigente_desde_utc: null,
      vigencia_completa: false,
      motivo: 'Sin límites configurados en el sistema',
    };
    const humLimits = trendData?.limites.humedad || {
      min: null,
      max: null,
      vigente_desde_utc: null,
      vigencia_completa: false,
      motivo: 'Sin límites configurados en el sistema',
    };

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h2 className="text-[15px] font-semibold text-bark flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-canopy" />
            <span>Gráficos de Tendencia Dinámicos (SVG · RF-11)</span>
          </h2>
          {trendData && (
            <span className="text-[11px] font-mono text-slate">
              {trendData.total_retornados} puntos graficados
              {trendData.reducido
                ? ` (agregación preservando extremos/anomalías desde ${trendData.total_original})`
                : ''}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SingleSeriesSvgChart
            title="Tendencia de Temperatura (°C)"
            unit="°C"
            isHumidity={false}
            strokeColor="var(--color-garden-temperature)"
            points={series}
            limitMeta={tempLimits}
            anomaliasDisponibles={Boolean(trendData?.anomalias_ia_disponibles)}
            icon={<Thermometer className="w-4 h-4 text-canopy" />}
          />

          <SingleSeriesSvgChart
            title="Tendencia de Humedad Relativa (%RH)"
            unit="%RH"
            isHumidity={true}
            strokeColor="var(--color-garden-humidity)"
            points={series}
            limitMeta={humLimits}
            anomaliasDisponibles={Boolean(trendData?.anomalias_ia_disponibles)}
            icon={<Droplets className="w-4 h-4 text-garden-humidity" />}
          />
        </div>
      </div>
    );
  }
);
