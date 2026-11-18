import React, { useState, useCallback, useMemo } from 'react';
import {
  Sparkles,
  BrainCircuit,
  Zap,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  Clock,
  RefreshCw,
  Radio,
} from 'lucide-react';
import { Ubicacion, Dispositivo, Sensor, Medicion, Alerta, AiDiagnosticReport } from '../../types/iot';
import { runAiDiagnostic } from '../../services/geminiService';
import { buildEntityIndexes } from '../../services/performanceEngine';

interface AiDiagnosticPanelProps {
  locations: Ubicacion[];
  devices: Dispositivo[];
  sensors: Sensor[];
  readingsHistory: { [sensorId: string]: Medicion[] };
  activeAlerts: Alerta[];
}

export const AiDiagnosticPanel: React.FC<AiDiagnosticPanelProps> = React.memo(({
  locations,
  devices,
  sensors,
  readingsHistory,
  activeAlerts,
}) => {
  const [selectedLocId, setSelectedLocId] = useState<string>(locations[0]?.id_ubicacion || '');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AiDiagnosticReport | null>(null);
  const [streamedText, setStreamedText] = useState<string>('');
  const [streamedTokensCount, setStreamedTokensCount] = useState<number>(0);

  const indexes = useMemo(
    () => buildEntityIndexes(locations, devices, sensors),
    [locations, devices, sensors]
  );

  const currentLocation = indexes.locationById.get(selectedLocId) || locations[0];
  const currentDevice = currentLocation
    ? indexes.devicesByLocationId.get(currentLocation.id_ubicacion)?.[0]
    : undefined;
  const locationSensor =
    (currentDevice ? indexes.sensorByDeviceId.get(currentDevice.id_dispositivo) : undefined) ||
    sensors[0];
  const history = locationSensor ? readingsHistory[locationSensor.id_sensor] || [] : [];

  const handleRunDiagnosis = useCallback(
    async (bypassCache = false) => {
      if (!currentLocation || !locationSensor) return;
      setLoading(true);
      setStreamedText('');
      setStreamedTokensCount(0);
      try {
        const result = await runAiDiagnostic(
          currentLocation,
          locationSensor,
          history,
          activeAlerts.filter((a) => a.ubicacion_id === currentLocation.id_ubicacion),
          {
            bypassCache,
            onTokenStream: (partial, count) => {
              setStreamedText(partial);
              setStreamedTokensCount(count);
            },
          }
        );
        setReport(result);
        setStreamedText(result.diagnostico_general);
      } finally {
        setLoading(false);
      }
    },
    [currentLocation, locationSensor, history, activeAlerts]
  );

  React.useEffect(() => {
    if (!report && currentLocation && locationSensor && history.length > 0) {
      handleRunDiagnosis(false);
    }
  }, [selectedLocId]);

  return (
    <div className="space-y-[24px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="apple-card-heading text-bark flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-canopy" />
            <span>Motor Predictivo de IA y Detección de Anomalías</span>
          </h2>
          <p className="text-[14px] text-slate mt-1">
            Streaming de IA token a token · Timeout 6s · Caché Redis & Deduplicación de llamadas en vuelo
          </p>
        </div>

        <button
          onClick={() => handleRunDiagnosis(true)}
          disabled={loading}
          className="apple-blue-pill flex items-center gap-2 px-5 py-2.5 text-xs font-semibold disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? `Transmitiendo (${streamedTokensCount} tokens)...` : 'Ejecutar Diagnóstico IA Token-a-Token'}</span>
        </button>
      </div>

      {/* Selector de Ubicación — Charcoal Stage (#FFFFFF, 28px radius) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-sheet-white p-4 rounded-[16px]">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate">Espacio Seleccionado:</span>
          <select
            value={selectedLocId}
            onChange={(e) => {
              setSelectedLocId(e.target.value);
              setReport(null);
            }}
            className="apple-pill-select py-2 text-xs font-medium"
          >
            {locations.map((loc) => (
              <option key={loc.id_ubicacion} value={loc.id_ubicacion}>
                {loc.nombre} ({loc.codigo_area})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-canopy">
          <Radio className={`w-3.5 h-3.5 ${loading ? 'animate-ping text-canopy' : 'text-canopy'}`} />
          <span>{loading ? `STREAMING TOKEN #${streamedTokensCount}` : 'STREAMING TOKEN-A-TOKEN LISTO'}</span>
        </div>
      </div>

      {/* Vista en vivo del Streaming Token a Token mientras se genera */}
      {(loading || report) && (
        <div className="space-y-4">
          <div
            className={`rounded-[16px] bg-sheet-white p-6 space-y-5 ${
              report?.nivel_riesgo === 'CRITICO'
                ? 'border border-[#DC2626]/50'
                : report?.nivel_riesgo === 'MODERADO'
                ? 'border border-[#D97706]/50'
                : ''
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center ${
                    report?.nivel_riesgo === 'CRITICO'
                      ? 'bg-[#DC2626] text-sheet-white'
                      : report?.nivel_riesgo === 'MODERADO'
                      ? 'bg-cream-paper text-[#D97706]'
                      : 'bg-canopy/15 text-canopy'
                  }`}
                >
                  {report?.nivel_riesgo === 'CRITICO' ? (
                    <ShieldAlert className="w-6 h-6" />
                  ) : (
                    <ShieldCheck className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold uppercase tracking-wider font-mono ${
                        report?.nivel_riesgo === 'CRITICO'
                          ? 'text-[#DC2626]'
                          : report?.nivel_riesgo === 'MODERADO'
                          ? 'text-[#D97706]'
                          : 'text-canopy'
                      }`}
                    >
                      Nivel de Riesgo Operacional: {report?.nivel_riesgo || 'EVALUANDO...'}
                    </span>
                    <span className="text-slate">·</span>
                    <span className="text-xs text-slate font-mono">
                      {currentLocation?.nombre}
                    </span>
                  </div>
                  <h3 className="text-[17px] font-semibold text-bark mt-0.5">
                    Evaluación Termodinámica e Higrométrica (Stream en Vivo)
                  </h3>
                </div>
              </div>

              {report && (
                <div className="flex items-center gap-3 text-xs font-mono text-slate">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-canopy" />
                    Inferencia: {report.tiempo_inferencia_ms}ms
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(report.fecha).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>

            {/* Salida Token a Token con cursor activo */}
            <div className="apple-body text-bark bg-cream-paper p-5 rounded-[16px] font-sans">
              <span>{streamedText || report?.diagnostico_general}</span>
              {loading && (
                <span className="inline-block w-2 h-4 ml-1 bg-canopy animate-pulse align-middle" />
              )}
            </div>

            {/* Dos Columnas: Patrones y Recomendaciones */}
            {report && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
                <div className="bg-cream-paper rounded-[16px] p-5 space-y-3">
                  <h4 className="text-[14px] font-semibold text-bark flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-canopy" />
                    <span>Patrones en Series Temporales</span>
                  </h4>
                  <ul className="space-y-2 text-[14px] text-slate">
                    {report.patrones_detectados.map((pat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-canopy font-bold shrink-0 mt-0.5">›</span>
                        <span>{pat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-cream-paper rounded-[16px] p-5 space-y-3">
                  <h4 className="text-[14px] font-semibold text-bark flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-canopy" />
                    <span>Recomendaciones Preventivas</span>
                  </h4>
                  <ul className="space-y-2 text-[14px] text-slate">
                    {report.recomendaciones_preventivas.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-canopy font-bold shrink-0 mt-0.5">✓</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tarjeta Explicativa de Arquitectura IA */}
      <div className="bg-sheet-white rounded-[16px] p-6 space-y-4">
        <h4 className="text-[14px] font-semibold text-bark">
          Métricas de Desempeño del Motor de IA
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-[16px] text-xs font-mono">
          <div className="p-[16px] rounded-[16px] bg-cream-paper space-y-1">
            <span className="text-[11px] text-slate block font-sans">Meta de Latencia Inferencia</span>
            <span className="apple-metric-display text-canopy block py-1">&le;200ms</span>
            <span className="text-[11px] text-slate block font-sans">Streaming Token-a-Token</span>
          </div>
          <div className="p-[16px] rounded-[16px] bg-cream-paper space-y-1">
            <span className="text-[11px] text-slate block font-sans">Timeout API Externa</span>
            <span className="apple-metric-display text-canopy block py-1">6.0s</span>
            <span className="text-[11px] text-slate block font-sans">AbortController + Fallback</span>
          </div>
          <div className="p-[16px] rounded-[16px] bg-cream-paper space-y-1">
            <span className="text-[11px] text-slate block font-sans">Algoritmo Híbrido</span>
            <span className="apple-metric-display text-bark block py-1">3.0σ</span>
            <span className="text-[11px] text-slate block font-sans">Isolation Forest + Z-Score</span>
          </div>
        </div>
      </div>
    </div>
  );
});

AiDiagnosticPanel.displayName = 'AiDiagnosticPanel';
