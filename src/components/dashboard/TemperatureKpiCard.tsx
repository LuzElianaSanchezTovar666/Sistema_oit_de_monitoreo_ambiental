import React from 'react';
import { Thermometer, CheckCircle2, AlertTriangle, Clock, Radio } from 'lucide-react';
import {
  computeThermalGaugeGeometry,
  evaluateThermalStatus,
  LocationTemperatureSnapshotDTO,
  ThermalStateRF08,
} from '../../services/sensorService';

interface TemperatureKpiCardProps {
  snapshot: LocationTemperatureSnapshotDTO | null;
  locationName: string;
  streamConnected: boolean;
  isStale: boolean;
}

export const TemperatureKpiCard: React.FC<TemperatureKpiCardProps> = React.memo(
  ({ snapshot, locationName, streamConnected, isStale }) => {
    const effectiveTemp =
      snapshot && snapshot.datos_recientes && !isStale && snapshot.temperatura_actual !== null
        ? snapshot.temperatura_actual
        : null;

    const tempMin = snapshot?.temp_min ?? null;
    const tempMax = snapshot?.temp_max ?? null;

    const thermalState: ThermalStateRF08 =
      effectiveTemp === null
        ? 'ESPERANDO_DATOS'
        : evaluateThermalStatus(effectiveTemp, tempMin, tempMax);

    const gauge = computeThermalGaugeGeometry(effectiveTemp, tempMin, tempMax);

    const badgeConfig: Record<
      ThermalStateRF08,
      { label: string; className: string; Icon: React.FC<{ className?: string }> }
    > = {
      NOMINAL: {
        label: 'NOMINAL',
        className: 'bg-canopy/15 text-canopy',
        Icon: CheckCircle2,
      },
      'FUERA DE RANGO': {
        label: 'FUERA DE RANGO',
        className: 'bg-[#DC2626]/20 text-[#DC2626]',
        Icon: AlertTriangle,
      },
      SIN_CONFIGURACION: {
        label: 'Sin configuración',
        className: 'bg-cream-paper text-slate',
        Icon: Clock,
      },
      ESPERANDO_DATOS: {
        label: 'ESPERANDO DATOS',
        className: 'bg-cream-paper text-slate',
        Icon: Clock,
      },
    };

    const badge = badgeConfig[thermalState];
    const BadgeIcon = badge.Icon;

    const valueColor =
      thermalState === 'FUERA DE RANGO'
        ? 'text-[#DC2626]'
        : thermalState === 'NOMINAL'
          ? 'text-canopy'
          : 'text-slate';

    const zScoreDisplay =
      effectiveTemp !== null && snapshot?.z_score_disponible && snapshot.z_score !== null
        ? `${snapshot.z_score >= 0 ? '+' : ''}${snapshot.z_score.toFixed(2)}σ`
        : 'No disponible';

    return (
      <div
        className="bg-sheet-white rounded-[16px] p-[16px] space-y-3 flex flex-col justify-between transition-all duration-300"
        aria-label={`Temperatura actual en ${locationName}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[12px] font-semibold text-slate flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-canopy shrink-0" />
              <span>Temperatura</span>
            </span>
            <p className="text-[11px] text-slate truncate mt-0.5" title={locationName}>
              {snapshot?.ubicacion_nombre || locationName}
              {snapshot?.sensor_identificador ? ` · ${snapshot.sensor_identificador}` : ''}
            </p>
          </div>

          <span
            className={`text-[11px] font-mono px-2 py-0.5 rounded-[5px] font-semibold inline-flex items-center gap-1 shrink-0 transition-colors duration-300 ${badge.className}`}
          >
            <BadgeIcon className="w-3 h-3" aria-hidden="true" />
            <span>{badge.label}</span>
          </span>
        </div>

        <div>
          <div className={`apple-metric-display tabular-nums transition-colors duration-300 ${valueColor}`}>
            {effectiveTemp !== null ? effectiveTemp.toFixed(1) : '--'}
            <span className="text-[20px] font-normal text-slate ml-1">°C</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate mt-2 font-mono">
            <span>
              {tempMin !== null && tempMax !== null
                ? `Óptimo: ${tempMin.toFixed(1)}° - ${tempMax.toFixed(1)}°C`
                : 'Rango: Sin configuración'}
            </span>
            <span title={snapshot?.z_score_motivo || 'Z-Score estadístico RF-08'}>
              Z: {zScoreDisplay}
            </span>
          </div>
        </div>

        {/* Indicador visual térmico coherente respecto al rango configurado */}
        <div className="space-y-1.5">
          <div
            className="relative w-full bg-cream-paper rounded-full h-2 overflow-hidden"
            role="progressbar"
            aria-valuemin={gauge.hasScale ? gauge.scaleMin : undefined}
            aria-valuemax={gauge.hasScale ? gauge.scaleMax : undefined}
            aria-valuenow={effectiveTemp !== null ? effectiveTemp : undefined}
            aria-label="Indicador térmico respecto al rango óptimo"
          >
            {gauge.hasScale && (
              <div
                className="absolute top-0 bottom-0 bg-canopy/25 transition-all duration-300"
                style={{
                  left: `${gauge.nominalStartPct}%`,
                  width: `${gauge.nominalWidthPct}%`,
                }}
              />
            )}
            {gauge.markerPct !== null && (
              <div
                className={`absolute top-0 bottom-0 w-2 rounded-full transition-all duration-300 ${
                  thermalState === 'FUERA DE RANGO' ? 'bg-[#DC2626]' : 'bg-canopy'
                }`}
                style={{
                  left: `calc(${gauge.markerPct}% - 4px)`,
                }}
              />
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate">
            <span className="inline-flex items-center gap-1">
              <Radio
                className={`w-2.5 h-2.5 ${streamConnected ? 'text-canopy' : 'text-slate'}`}
                aria-hidden="true"
              />
              {streamConnected ? 'EN VIVO' : 'RECONECTANDO'}
            </span>
            <span>
              {snapshot?.fecha_hora_utc && effectiveTemp !== null
                ? new Date(snapshot.fecha_hora_utc).toLocaleTimeString()
                : 'Sin lectura reciente'}
            </span>
          </div>
        </div>
      </div>
    );
  }
);
