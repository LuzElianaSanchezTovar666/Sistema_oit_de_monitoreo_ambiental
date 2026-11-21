import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles,
  BrainCircuit,
  Zap,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  Clock,
  RefreshCw,
  Thermometer,
  Droplets,
  AlertTriangle,
  RotateCcw,
  Cpu,
} from 'lucide-react';
import { Ubicacion, Dispositivo, Sensor, Medicion, Alerta } from '../../types/iot';
import { buildEntityIndexes } from '../../services/performanceEngine';
import {
  fetchAiDiagnostic,
  retrainAiModel,
  AiDiagnosticDTO,
} from '../../services/aiService';

interface AiDiagnosticPanelProps {
  locations: Ubicacion[];
  devices: Dispositivo[];
  sensors: Sensor[];
  readingsHistory?: { [sensorId: string]: Medicion[] };
  activeAlerts?: Alerta[];
}

export const AiDiagnosticPanel: React.FC<AiDiagnosticPanelProps> = React.memo(({
  locations,
  devices,
  sensors,
}) => {
  const [selectedLocId, setSelectedLocId] = useState<string>(locations[0]?.id_ubicacion || '');
  const [selectedSensorId, setSelectedSensorId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [report, setReport] = useState<AiDiagnosticDTO | null>(null);
  const [error, setError] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  const indexes = useMemo(
    () => buildEntityIndexes(locations, devices, sensors),
    [locations, devices, sensors]
  );

  const currentLocation = indexes.locationById.get(selectedLocId) || locations[0];
  const locationDevices = currentLocation
    ? indexes.devicesByLocationId.get(currentLocation.id_ubicacion) || []
    : [];

  const locationSensors = useMemo(() => {
    if (!currentLocation) return sensors;
    const devIds = new Set(locationDevices.map((d) => d.id_dispositivo));
    const matched = sensors.filter((s) => devIds.has(s.dispositivo_id));
    return matched.length > 0 ? matched : sensors;
  }, [currentLocation, locationDevices, sensors]);

  const activeSensorId = selectedSensorId || locationSensors[0]?.id_sensor || '';

  const loadDiagnosis = useCallback(async () => {
    if (!activeSensorId && !selectedLocId) return;
    setLoading(true);
    setError('');
    setStatusMessage('');
    try {
      const data = await fetchAiDiagnostic(activeSensorId || undefined, selectedLocId || undefined);
      setReport(data);
    } catch (err: any) {
      setError(err?.message || 'Error al conectar con el servicio de IA.');
    } finally {
      setLoading(false);
    }
  }, [activeSensorId, selectedLocId]);

  useEffect(() => {
    loadDiagnosis();
  }, [loadDiagnosis]);

  const handleRetrain = async () => {
    setRetraining(true);
    setStatusMessage('Reentrenando modelo Isolation Forest...');
    try {
      const res = await retrainAiModel(activeSensorId || undefined);
      setStatusMessage(res.mensaje || 'Modelo reentrenado con éxito.');
      await loadDiagnosis();
    } catch (err: any) {
      setError(err?.message || 'Fallo al reentrenar modelo.');
    } finally {
      setRetraining(false);
    }
  };

  const getPatternBadge = (type: string) => {
    switch (type) {
      case 'PICO_REPENTINO':
        return { label: 'Pico Repentino Térmico', color: 'bg-rose-100 text-rose-800 border-rose-300' };
      case 'CAIDA_ABRUPTA':
        return { label: 'Caída Abrupta Térmica', color: 'bg-sky-100 text-sky-800 border-sky-300' };
      case 'DERIVA_TERMICA':
        return { label: 'Deriva Térmica Progresiva', color: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'OSCILACION_INHABITUAL':
        return { label: 'Oscilación Higrométrica Inhabitual', color: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'FALLO_SENSOR':
        return { label: 'Posible Fallo de Sensor', color: 'bg-red-100 text-red-900 border-red-400 font-bold' };
      case 'DATOS_INSUFICIENTES':
      case 'NO_EVALUADO':
        return { label: 'Datos Insuficientes (<50)', color: 'bg-slate-100 text-slate-700 border-slate-300' };
      default:
        return { label: 'Comportamiento Nominal', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    }
  };

  const badge = getPatternBadge(report?.tipo_anomalia || 'NORMAL');

  return (
    <div className="space-y-[24px] animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-sheet-white p-6 rounded-[16px]">
        <div>
          <div className="flex items-center gap-2">
            <span className="apple-badge-blue text-[10px]">RF-18 · RN-20</span>
            <span className="text-xs font-mono text-slate">Desacoplado de Umbrales</span>
          </div>
          <h2 className="apple-card-heading text-bark flex items-center gap-2.5 mt-1">
            <Sparkles className="w-6 h-6 text-canopy" />
            <span>Diagnóstico IA · Detección de Anomalías</span>
          </h2>
          <p className="text-[14px] text-slate mt-1">
            Algoritmo Isolation Forest (scikit-learn) y control estadístico Z-Score (3.0σ) con inferencia &lt; 200 ms.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadDiagnosis}
            disabled={loading || retraining}
            className="apple-blue-pill flex items-center gap-2 px-4 py-2 text-xs font-semibold disabled:opacity-50 cursor-pointer"
            title="Actualizar evaluación con la última telemetría del sensor"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Analizando...' : 'Actualizar Diagnóstico'}</span>
          </button>
          <button
            onClick={handleRetrain}
            disabled={loading || retraining}
            className="px-4 py-2 rounded-[56px] bg-cream-paper border border-sage-mist hover:border-canopy text-bark text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
            title="Reentrenar modelo Isolation Forest en memoria"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${retraining ? 'animate-spin text-canopy' : ''}`} />
            <span>Reentrenar</span>
          </button>
        </div>
      </div>

      {/* Selectores de Ubicación y Sensor */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-sheet-white p-4 rounded-[16px]">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="ai-loc" className="text-xs text-slate font-medium">
            Ubicación:
          </label>
          <select
            id="ai-loc"
            value={selectedLocId}
            onChange={(e) => {
              setSelectedLocId(e.target.value);
              setSelectedSensorId('');
            }}
            className="apple-pill-select py-1.5 px-3 text-xs font-medium"
          >
            {locations.map((loc) => (
              <option key={loc.id_ubicacion} value={loc.id_ubicacion}>
                {loc.nombre} ({loc.codigo_area})
              </option>
            ))}
          </select>

          <label htmlFor="ai-sen" className="text-xs text-slate font-medium ml-2">
            Sensor:
          </label>
          <select
            id="ai-sen"
            value={activeSensorId}
            onChange={(e) => setSelectedSensorId(e.target.value)}
            className="apple-pill-select py-1.5 px-3 text-xs font-medium"
          >
            {locationSensors.map((s) => (
              <option key={s.id_sensor} value={s.id_sensor}>
                {(s as any).identificador || s.id_sensor} ({s.tipo_sensor || (s as any).modelo || 'DHT22'})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate">
          {report && (
            <>
              <span className="flex items-center gap-1 text-canopy font-semibold">
                <Zap className="w-3.5 h-3.5" />
                {report.tiempo_inferencia_ms.toFixed(1)} ms
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5" />
                {report.metodo}
              </span>
            </>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-[10px] bg-sky-50 border border-sky-200 text-sky-800 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-sky-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-[10px] bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tarjeta de Diagnóstico Principal */}
      {report && (
        <div
          className={`rounded-[16px] bg-sheet-white p-6 space-y-5 border ${
            report.es_anomalia
              ? 'border-purple-300 shadow-sm'
              : 'border-sage-mist/60'
          }`}
        >
          {/* Fila superior: Estado, Riesgo y Parámetros */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  report.es_anomalia
                    ? 'bg-purple-600 text-pure-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {report.es_anomalia ? (
                  <ShieldAlert className="w-6 h-6" />
                ) : (
                  <ShieldCheck className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-[6px] border font-semibold ${badge.color}`}
                  >
                    {badge.label}
                  </span>
                  <span className="text-slate">·</span>
                  <span className="text-xs text-slate font-mono">
                    {report.sensor_identificador} ({report.ubicacion_nombre})
                  </span>
                </div>
                <h3 className="text-[17px] font-semibold text-bark mt-1">
                  {report.es_anomalia
                    ? 'Comportamiento Estadísticamente Atípico Detectado'
                    : 'Comportamiento Ambiental Estable y Nominal'}
                </h3>
              </div>
            </div>

            {/* Métricas clave en chips */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <div className="px-3 py-1.5 rounded-[8px] bg-cream-paper border border-sage-mist flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5 text-canopy" />
                <span>
                  {report.temperatura !== null && report.temperatura !== undefined
                    ? `${report.temperatura.toFixed(1)} °C`
                    : 'N/A'}
                </span>
                {report.z_score_temp !== null && report.z_score_temp !== undefined && (
                  <span className="text-slate text-[10px]">
                    (Z: {report.z_score_temp > 0 ? `+${report.z_score_temp}` : report.z_score_temp}σ)
                  </span>
                )}
              </div>

              <div className="px-3 py-1.5 rounded-[8px] bg-cream-paper border border-sage-mist flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-canopy" />
                <span>
                  {report.humedad !== null && report.humedad !== undefined
                    ? `${report.humedad.toFixed(1)} %RH`
                    : 'N/A'}
                </span>
                {report.z_score_hum !== null && report.z_score_hum !== undefined && (
                  <span className="text-slate text-[10px]">
                    (Z: {report.z_score_hum > 0 ? `+${report.z_score_hum}` : report.z_score_hum}σ)
                  </span>
                )}
              </div>

              <div
                className={`px-3 py-1.5 rounded-[8px] border font-bold ${
                  report.score_ia !== null && report.score_ia !== undefined && report.score_ia >= 0.7
                    ? 'bg-purple-100 text-purple-900 border-purple-300'
                    : 'bg-cream-paper text-slate border-sage-mist'
                }`}
                title="Puntuación de anomalía calculada por Isolation Forest / Z-Score [0.0 - 1.0]"
              >
                Score IA: {report.score_ia !== null && report.score_ia !== undefined ? report.score_ia.toFixed(4) : 'N/A'}
              </div>
            </div>
          </div>

          {/* Explicación Técnica */}
          <div className="bg-cream-paper p-5 rounded-[12px] space-y-2">
            <h4 className="text-xs font-semibold text-bark font-mono uppercase tracking-wider flex items-center gap-1.5">
              <BrainCircuit className="w-4 h-4 text-canopy" />
              Explicación del Comportamiento Detectado
            </h4>
            <p className="text-xs text-bark leading-relaxed font-sans">
              {report.explicacion}
            </p>
          </div>

          {/* Dos Columnas: Posibles Causas (Hipótesis) y Recomendaciones Operativas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Posibles Causas */}
            <div className="bg-cream-paper rounded-[12px] p-5 space-y-3">
              <h4 className="text-xs font-semibold text-bark flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Posibles Causas Orientativas (Hipótesis)</span>
              </h4>
              <ul className="space-y-2 text-xs text-slate">
                {report.posibles_causas.map((causa, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-canopy font-bold shrink-0 mt-0.5">›</span>
                    <span className="text-bark">{causa}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recomendaciones Operativas */}
            <div className="bg-cream-paper rounded-[12px] p-5 space-y-3">
              <h4 className="text-xs font-semibold text-bark flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Recomendaciones Operativas</span>
              </h4>
              <ul className="space-y-2 text-xs text-slate">
                {report.recomendaciones.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-canopy font-bold shrink-0 mt-0.5">✓</span>
                    <span className="text-bark">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Pie de metadatos de inferencia */}
          <div className="pt-2 border-t border-sage-mist/40 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate">
            <span>
              Modelo: <strong className="text-bark">{report.modelo_version}</strong> ({report.metodo})
            </span>
            <span>
              Latencia de Inferencia:{' '}
              <strong className={report.tiempo_inferencia_ms <= 200 ? 'text-canopy' : 'text-amber-600'}>
                {report.tiempo_inferencia_ms.toFixed(2)} ms
              </strong>{' '}
              (&lt;200 ms meta RF-18)
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(report.fecha_hora).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Tarjeta de Metadatos de Arquitectura del Motor */}
      <div className="bg-sheet-white rounded-[16px] p-6 space-y-4 border border-sage-mist/60">
        <h4 className="text-xs font-semibold text-bark uppercase tracking-wider font-mono">
          Especificación de Arquitectura de IA (RF-18 · RN-20)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-4 rounded-[12px] bg-cream-paper space-y-1">
            <span className="text-[11px] text-slate block font-sans">Meta Inferencia</span>
            <span className="text-base font-semibold text-canopy block">&le; 200 ms</span>
            <span className="text-[11px] text-slate block font-sans">En memoria por lectura</span>
          </div>
          <div className="p-4 rounded-[12px] bg-cream-paper space-y-1">
            <span className="text-[11px] text-slate block font-sans">Umbral Muestras ML</span>
            <span className="text-base font-semibold text-bark block">&ge; 50 muestras</span>
            <span className="text-[11px] text-slate block font-sans">Isolation Forest activo</span>
          </div>
          <div className="p-4 rounded-[12px] bg-cream-paper space-y-1">
            <span className="text-[11px] text-slate block font-sans">Alternativa Local</span>
            <span className="text-base font-semibold text-bark block">&ge; 3.0 σ</span>
            <span className="text-[11px] text-slate block font-sans">Control estadístico Z-Score</span>
          </div>
          <div className="p-4 rounded-[12px] bg-cream-paper space-y-1">
            <span className="text-[11px] text-slate block font-sans">Regla RN-20</span>
            <span className="text-base font-semibold text-canopy block">Desacoplado</span>
            <span className="text-[11px] text-slate block font-sans">No bloquea umbrales RF-13</span>
          </div>
        </div>
      </div>
    </div>
  );
});

AiDiagnosticPanel.displayName = 'AiDiagnosticPanel';
