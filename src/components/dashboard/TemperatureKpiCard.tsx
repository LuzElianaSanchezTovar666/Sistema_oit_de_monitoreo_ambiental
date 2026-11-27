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
        className: 'bg-garden-mint text-garden-deep',
        Icon: CheckCircle2,
      },
      'FUERA DE RANGO': {
        label: 'FUERA DE RANGO',
        className: 'bg-[#fbe1d1] text-[#5d2a1a]',
        Icon: AlertTriangle,
      },
      SIN_CONFIGURACION: {
        label: 'Sin configuración',
        className: 'bg-garden-mint text-slate',
        Icon: Clock,
      },
      ESPERANDO_DATOS: {
        label: 'ESPERANDO DATOS',
        className: 'bg-garden-mint text-slate',
        Icon: Clock,
      },
    };

    const badge = badgeConfig[thermalState];
    const BadgeIcon = badge.Icon;

    const valueColor =
      thermalState === 'FUERA DE RANGO'
        ? 'text-[#DC2626]'
        : 'text-[#0D3B1E]';

    const zScoreDisplay =
      effectiveTemp !== null && snapshot?.z_score_disponible && snapshot.z_score !== null
        ? `${snapshot.z_score >= 0 ? '+' : ''}${snapshot.z_score.toFixed(2)}σ`
        : 'No disponible';

    return (
      <div
        className="bg-sheet-white rounded-[28px] p-5 border border-[#C8E6C9] shadow-[0_4px_20px_rgba(13,59,30,0.06)] space-y-4 flex flex-col justify-between font-sans"
        aria-label={`Temperatura actual en ${locationName}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 basis-full">
            <span className="text-[13px] font-semibold text-[#1B5E20] flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-[#1B5E20] shrink-0" />
              <span>Temperatura</span>
            </span>
            <p className="text-[12px] text-[#3B694C] truncate mt-0.5" title={locationName}>
              {snapshot?.ubicacion_nombre || locationName}
              {snapshot?.sensor_identificador ? ` · ${snapshot.sensor_identificador}` : ''}
            </p>
          </div>

          <span
            className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 shrink-0 ${badge.className}`}
          >
            <BadgeIcon className="w-3 h-3" aria-hidden="true" />
            <span>{badge.label}</span>
          </span>
        </div>

        <div>
          <div className={`text-[36px] font-semibold tabular-nums leading-none ${valueColor}`}>
            {effectiveTemp !== null ? effectiveTemp.toFixed(1) : '--'}
            <span className="text-[18px] font-normal text-[#3B694C] ml-1">°C</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1 text-[12px] text-[#3B694C] mt-2 font-mono">
            <span>
              {tempMin !== null && tempMax !== null
                ? `Banda: ${tempMin.toFixed(1)}° - ${tempMax.toFixed(1)}°C`
                : 'Rango: Sin configurar'}
            </span>
            <span title={snapshot?.z_score_motivo || 'Z-Score estadístico RF-08'}>
              Z: {zScoreDisplay}
            </span>
          </div>
        </div>

        {/* Indicador visual térmico SIMOA */}
        <div className="space-y-1.5">
          <div
            className="relative w-full bg-[#E8F5E9] rounded-full h-2 overflow-hidden"
            role="progressbar"
            aria-valuemin={gauge.hasScale ? gauge.scaleMin : undefined}
            aria-valuemax={gauge.hasScale ? gauge.scaleMax : undefined}
            aria-valuenow={effectiveTemp !== null ? effectiveTemp : undefined}
            aria-label="Indicador térmico respecto al rango óptimo"
          >
            {gauge.hasScale && (
              <div
                className="absolute top-0 bottom-0 bg-[#A5D6A7] transition-all duration-300"
                style={{
                  left: `${gauge.nominalStartPct}%`,
                  width: `${gauge.nominalWidthPct}%`,
                }}
              />
            )}
            {gauge.markerPct !== null && (
              <div
                className={`absolute top-0 bottom-0 w-2 rounded-full transition-all duration-300 ${
                  thermalState === 'FUERA DE RANGO' ? 'bg-[#DC2626]' : 'bg-[#16A34A]'
                }`}
                style={{
                  left: `calc(${gauge.markerPct}% - 4px)`,
                }}
              />
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-[#777b86]">
            <span className="inline-flex items-center gap-1.5">
              <Radio
                className={`w-2.5 h-2.5 ${streamConnected ? 'text-[#17191c]' : 'text-[#a3a6af]'}`}
                aria-hidden="true"
              />
              {streamConnected ? 'EN VIVO' : 'RECONECTANDO'}
            </span>
            <span>
              {snapshot?.fecha_hora_utc && effectiveTemp !== null
                ? new Date(snapshot.fecha_hora_utc).toLocaleTimeString()
                : 'Sin lectura'}
            </span>
          </div>
        </div>
      </div>
    );
  }
);
