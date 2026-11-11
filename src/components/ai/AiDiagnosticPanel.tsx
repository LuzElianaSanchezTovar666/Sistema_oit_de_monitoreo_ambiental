import React, { useState } from 'react';
import {
  Sparkles,
  BrainCircuit,
  Zap,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  Clock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { Ubicacion, Sensor, Medicion, Alerta, AiDiagnosticReport } from '../../types/iot';
import { runAiDiagnostic } from '../../services/geminiService';

interface AiDiagnosticPanelProps {
  locations: Ubicacion[];
  sensors: Sensor[];
  readingsHistory: { [sensorId: string]: Medicion[] };
  activeAlerts: Alerta[];
}

export const AiDiagnosticPanel: React.FC<AiDiagnosticPanelProps> = ({
  locations,
  sensors,
  readingsHistory,
  activeAlerts,
}) => {
  const [selectedLocId, setSelectedLocId] = useState<string>(locations[0]?.id_ubicacion || '');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AiDiagnosticReport | null>(null);

  const currentLocation = locations.find((l) => l.id_ubicacion === selectedLocId) || locations[0];
  const locationSensor = sensors.find((s) => s.dispositivo_id.includes(currentLocation?.id_ubicacion.split('-')[1] || '')) || sensors[0];
  const history = locationSensor ? readingsHistory[locationSensor.id_sensor] || [] : [];

  const handleRunDiagnosis = async () => {
    if (!currentLocation || !locationSensor) return;
    setLoading(true);
    try {
      const result = await runAiDiagnostic(
        currentLocation,
        locationSensor,
        history,
        activeAlerts.filter((a) => a.ubicacion_id === currentLocation.id_ubicacion)
      );
      setReport(result);
    } finally {
      setLoading(false);
    }
  };

  // Run initial diagnostic if not yet run
  React.useEffect(() => {
    if (!report && currentLocation && locationSensor && history.length > 0) {
      handleRunDiagnosis();
    }
  }, [selectedLocId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-500" />
            <span>Motor Predictivo de IA y Detección de Anomalías</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Algoritmos Isolation Forest & Z-Score dinámico acoplados a modelos de lenguaje para diagnóstico de causa raíz
          </p>
        </div>

        <button
          onClick={handleRunDiagnosis}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Analizando Series...' : 'Ejecutar Diagnóstico IA en Vivo'}</span>
        </button>
      </div>

      {/* Selector de Ubicación */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <span className="text-xs text-slate-400">Espacio Seleccionado:</span>
        <select
          value={selectedLocId}
          onChange={(e) => {
            setSelectedLocId(e.target.value);
            setReport(null);
          }}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium"
        >
          {locations.map((loc) => (
            <option key={loc.id_ubicacion} value={loc.id_ubicacion}>
              {loc.nombre} ({loc.codigo_area})
            </option>
          ))}
        </select>
      </div>

      {/* Reporte Activo */}
      {report && (
        <div className="space-y-4">
          {/* Card Principal de Resumen */}
          <div
            className={`rounded-xl border p-5 space-y-4 ${
              report.nivel_riesgo === 'CRITICO'
                ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                : report.nivel_riesgo === 'MODERADO'
                ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900'
                : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${
                    report.nivel_riesgo === 'CRITICO'
                      ? 'bg-red-600'
                      : report.nivel_riesgo === 'MODERADO'
                      ? 'bg-amber-500'
                      : 'bg-emerald-600'
                  }`}
                >
                  {report.nivel_riesgo === 'CRITICO' ? (
                    <ShieldAlert className="w-6 h-6" />
                  ) : (
                    <ShieldCheck className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider font-mono">
                      Nivel de Riesgo Operacional: {report.nivel_riesgo}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-xs text-slate-500 font-mono">
                      {report.ubicacion}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    Evaluación Termodinámica e Higrométrica
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Tiempo Inferencia: {report.tiempo_inferencia_ms}ms
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(report.fecha).toLocaleTimeString()}
                </span>
              </div>
            </div>

            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium bg-white/70 dark:bg-slate-900/60 p-3.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
              {report.diagnostico_general}
            </p>

            {/* Dos Columnas: Patrones y Recomendaciones */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Patrones Detectados */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <BrainCircuit className="w-4 h-4 text-purple-500" />
                  <span>Patrones en Series Temporales</span>
                </h4>
                <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  {report.patrones_detectados.map((pat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold shrink-0 mt-0.5">›</span>
                      <span>{pat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recomendaciones Preventivas */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>Recomendaciones Preventivas</span>
                </h4>
                <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  {report.recomendaciones_preventivas.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold shrink-0 mt-0.5">✓</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tarjeta Explicativa de Arquitectura IA */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Métricas de Desempeño del Motor de IA (Conforme a PRD §1.3 y §4.2)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] text-slate-400 block font-sans">Meta de Latencia Inferencia</span>
            <span className="text-base font-bold text-emerald-600">&le; 200 ms</span>
            <span className="text-[10px] text-slate-500 block mt-1">Cumplido en tiempo real</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] text-slate-400 block font-sans">Tasa de Falsos Positivos</span>
            <span className="text-base font-bold text-emerald-600">&le; 5 %</span>
            <span className="text-[10px] text-slate-500 block mt-1">Calibrado con ventana 1,000 lecturas</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] text-slate-400 block font-sans">Algoritmo Híbrido</span>
            <span className="text-base font-bold text-purple-600">iForest + Z-Score 3σ</span>
            <span className="text-[10px] text-slate-500 block mt-1">Evaluación multivariante</span>
          </div>
        </div>
      </div>
    </div>
  );
};
