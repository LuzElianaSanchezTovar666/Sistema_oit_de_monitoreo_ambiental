import React from 'react';
import { Droplets, CheckCircle2, AlertTriangle, Clock, Radio } from 'lucide-react';
import {
  evaluateHumidityStatus,
  LocationHumiditySnapshotDTO,
  ThermalStateRF08,
} from '../../services/sensorService';

interface HumidityKpiCardProps {
  snapshot: LocationHumiditySnapshotDTO | null;
  locationName: string;
  streamConnected: boolean;
  isStale: boolean;
}

export const HumidityKpiCard: React.FC<HumidityKpiCardProps> = React.memo(
  ({ snapshot, locationName, streamConnected, isStale }) => {
    const rawHum =
      snapshot && snapshot.datos_recientes && !isStale && snapshot.humedad_actual !== null
        ? snapshot.humedad_actual
        : null;

    const effectiveHum =
      rawHum !== null && Number.isFinite(rawHum) && rawHum >= 0 && rawHum <= 100 ? rawHum : null;

    const humMin = snapshot?.hum_min ?? null;
    const humMax = snapshot?.hum_max ?? null;

    const humState: ThermalStateRF08 =
      effectiveHum === null
        ? 'ESPERANDO_DATOS'
        : evaluateHumidityStatus(effectiveHum, humMin, humMax);

    const badgeConfig: Record<
      ThermalStateRF08,
      { label: string; className: string; Icon: React.FC<{ className?: string }> }
    > = {
      NOMINAL: {
        label: 'NOMINAL',
        className: 'bg-[#f2f2f3] text-[#17191c]',
        Icon: CheckCircle2,
      },
      'FUERA DE RANGO': {
        label: 'FUERA DE RANGO',
        className: 'bg-[#fbe1d1] text-[#5d2a1a]',
        Icon: AlertTriangle,
      },
      SIN_CONFIGURACION: {
        label: 'Sin configuración',
        className: 'bg-[#f2f2f3] text-[#777b86]',
        Icon: Clock,
      },
      ESPERANDO_DATOS: {
        label: 'ESPERANDO DATOS',
        className: 'bg-[#f2f2f3] text-[#777b86]',
        Icon: Clock,
      },
    };

    const badge = badgeConfig[humState];
    const BadgeIcon = badge.Icon;

    const valueColor =
      humState === 'FUERA DE RANGO'
        ? 'text-[#DC2626]'
        : 'text-[#0D3B1E]';

    const zScoreDisplay =
      effectiveHum !== null && snapshot?.z_score_disponible && snapshot.z_score !== null
        ? `${snapshot.z_score >= 0 ? '+' : ''}${snapshot.z_score.toFixed(2)}σ`
        : 'No disponible';

    const barPct = effectiveHum !== null ? Math.min(100, Math.max(0, effectiveHum)) : 0;

    return (
      <div
        className="bg-sheet-white rounded-[28px] p-5 border border-[#C8E6C9] shadow-[0_4px_20px_rgba(13,59,30,0.06)] space-y-4 flex flex-col justify-between font-sans"
        aria-label={`Humedad relativa actual en ${locationName}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 basis-full">
            <span className="text-[13px] font-semibold text-[#1B5E20] flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-[#1B5E20] shrink-0" />
              <span>Humedad Relativa</span>
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
            {effectiveHum !== null ? effectiveHum.toFixed(1) : '--'}
            <span className="text-[18px] font-normal text-[#3B694C] ml-1">%RH</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1 text-[12px] text-[#3B694C] mt-2 font-mono">
            <span>
              {humMin !== null && humMax !== null
                ? `Banda: ${humMin.toFixed(0)}% - ${humMax.toFixed(0)}%`
                : 'Rango: Sin configurar'}
            </span>
            <span title={snapshot?.z_score_motivo || 'Z-Score estadístico RF-09'}>
              Z: {zScoreDisplay}
            </span>
          </div>
        </div>

        {/* Indicador de barra para humedad relativa SIMOA */}
        <div className="space-y-1.5">
          <div
            className="relative w-full bg-[#E8F5E9] rounded-full h-2 overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={effectiveHum !== null ? effectiveHum : undefined}
            aria-label="Indicador de humedad relativa"
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                humState === 'FUERA DE RANGO' ? 'bg-[#DC2626]' : 'bg-[#16A34A]'
              }`}
              style={{ width: `${barPct}%` }}
            />
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
              {snapshot?.fecha_hora_utc && effectiveHum !== null
                ? new Date(snapshot.fecha_hora_utc).toLocaleTimeString()
                : 'Sin lectura'}
            </span>
          </div>
        </div>
      </div>
    );
  }
);
