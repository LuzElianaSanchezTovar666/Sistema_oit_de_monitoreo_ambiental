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
        className: 'bg-canopy/15 text-canopy',
        Icon: CheckCircle2,
      },
      'FUERA DE RANGO': {
        label: 'FUERA DE RANGO',
        className: 'bg-[#15803d]/20 text-[#15803d]',
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

    const badge = badgeConfig[humState];
    const BadgeIcon = badge.Icon;

    const valueColor =
      humState === 'FUERA DE RANGO'
        ? 'text-[#15803d]'
        : humState === 'NOMINAL'
          ? 'text-canopy'
          : 'text-slate';

    const zScoreDisplay =
      effectiveHum !== null && snapshot?.z_score_disponible && snapshot.z_score !== null
        ? `${snapshot.z_score >= 0 ? '+' : ''}${snapshot.z_score.toFixed(2)}σ`
        : 'No disponible';

    const barPct = effectiveHum !== null ? Math.min(100, Math.max(0, effectiveHum)) : 0;

    return (
      <div
        className="bg-sheet-white rounded-[16px] p-[16px] space-y-3 flex flex-col justify-between transition-all duration-300"
        aria-label={`Humedad relativa actual en ${locationName}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[12px] font-semibold text-slate flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-canopy shrink-0" />
              <span>Humedad Relativa</span>
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
            {effectiveHum !== null ? effectiveHum.toFixed(1) : '--'}
            <span className="text-[20px] font-normal text-slate ml-1">%RH</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate mt-2 font-mono">
            <span>
              {humMin !== null && humMax !== null
                ? `Rango óptimo: ${humMin.toFixed(0)} % - ${humMax.toFixed(0)} %`
                : 'Rango óptimo: Sin configuración'}
            </span>
            <span title={snapshot?.z_score_motivo || 'Z-Score higrométrico RF-09'}>
              Z: {zScoreDisplay}
            </span>
          </div>
        </div>

        {/* Barra proporcional 0% - 100% RH */}
        <div className="space-y-1.5">
          <div
            className="relative w-full bg-cream-paper rounded-full h-2 overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={effectiveHum !== null ? effectiveHum : undefined}
            aria-label="Humedad relativa en escala 0 a 100 %RH"
          >
            {humMin !== null && humMax !== null && humMax > humMin && (
              <div
                className="absolute top-0 bottom-0 bg-canopy/20 transition-all duration-300"
                style={{
                  left: `${Math.max(0, humMin)}%`,
                  width: `${Math.min(100, humMax) - Math.max(0, humMin)}%`,
                }}
              />
            )}
            <div
              className={`h-full transition-all duration-300 ${
                humState === 'FUERA DE RANGO' ? 'bg-[#15803d]' : 'bg-canopy'
              }`}
              style={{ width: `${barPct}%` }}
            />
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
              {snapshot?.fecha_hora_utc && effectiveHum !== null
                ? new Date(snapshot.fecha_hora_utc).toLocaleTimeString()
                : 'Sin lectura reciente'}
            </span>
          </div>
        </div>
      </div>
    );
  }
);
