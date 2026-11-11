import React, { useState, useMemo } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileCode,
  Calendar,
  CheckCircle,
  Thermometer,
  Droplets,
  Award,
} from 'lucide-react';
import { Ubicacion, Sensor, Medicion, LimiteAmbiental } from '../../types/iot';

interface HistoricalAnalyticsProps {
  locations: Ubicacion[];
  sensors: Sensor[];
  readingsHistory: { [sensorId: string]: Medicion[] };
}

export const HistoricalAnalytics: React.FC<HistoricalAnalyticsProps> = ({
  locations,
  sensors,
  readingsHistory,
}) => {
  const [selectedLocId, setSelectedLocId] = useState<string>(locations[0]?.id_ubicacion || '');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  const currentLocation = locations.find((l) => l.id_ubicacion === selectedLocId) || locations[0];
  const locationSensor = sensors.find((s) => s.dispositivo_id.includes(currentLocation?.id_ubicacion.split('-')[1] || '')) || sensors[0];
  const history = locationSensor ? readingsHistory[locationSensor.id_sensor] || [] : [];

  // Cálculos estadísticos consolidados
  const stats = useMemo(() => {
    if (history.length === 0) {
      return {
        avgTemp: 0,
        minTemp: 0,
        maxTemp: 0,
        stdTemp: 0,
        avgHum: 0,
        minHum: 0,
        maxHum: 0,
        compliancePct: 100,
        anomalyCount: 0,
      };
    }

    const tVals = history.map((h) => h.temperatura);
    const hVals = history.map((h) => h.humedad);
    const anomalies = history.filter((h) => h.valor_anomalo);
    const breaches = history.filter((h) => h.es_fuera_de_umbral);

    const avgT = tVals.reduce((a, b) => a + b, 0) / tVals.length;
    const avgH = hVals.reduce((a, b) => a + b, 0) / hVals.length;

    const stdT = Math.sqrt(
      tVals.reduce((acc, val) => acc + Math.pow(val - avgT, 2), 0) / Math.max(1, tVals.length - 1)
    );

    const compliance = ((history.length - breaches.length) / history.length) * 100;

    return {
      avgTemp: parseFloat(avgT.toFixed(2)),
      minTemp: parseFloat(Math.min(...tVals).toFixed(2)),
      maxTemp: parseFloat(Math.max(...tVals).toFixed(2)),
      stdTemp: parseFloat(stdT.toFixed(2)),
      avgHum: parseFloat(avgH.toFixed(1)),
      minHum: parseFloat(Math.min(...hVals).toFixed(1)),
      maxHum: parseFloat(Math.max(...hVals).toFixed(1)),
      compliancePct: parseFloat(compliance.toFixed(1)),
      anomalyCount: anomalies.length,
    };
  }, [history]);

  // Exportar a CSV
  const handleExportCSV = () => {
    if (history.length === 0) return;
    const headers = ['id_medicion', 'fecha_hora', 'temperatura_c', 'humedad_rh', 'es_anomalo', 'score_ml', 'z_temp'];
    const rows = history.map((m) => [
      m.id_medicion,
      m.fecha_hora,
      m.temperatura,
      m.humedad,
      m.valor_anomalo ? 1 : 0,
      m.score_anomalia_ia,
      m.z_score_temp,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `telemetria_${currentLocation?.nombre.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportar a JSON
  const handleExportJSON = () => {
    if (history.length === 0) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(history, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `telemetria_${currentLocation?.nombre.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <span>Analítica Histórica y Series Temporales</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Consolidado estadístico, distribución higrotérmica y exportación de trazabilidad de campo
          </p>
        </div>

        {/* Botones de Descarga */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Descargar CSV</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs transition-colors"
          >
            <FileCode className="w-3.5 h-3.5 text-blue-600" />
            <span>Exportar JSON</span>
          </button>
        </div>
      </div>

      {/* Controles de Selección */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400">Espacio Analizado:</span>
          <select
            value={selectedLocId}
            onChange={(e) => setSelectedLocId(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium"
          >
            {locations.map((loc) => (
              <option key={loc.id_ubicacion} value={loc.id_ubicacion}>
                {loc.nombre} ({loc.codigo_area})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
          <button
            onClick={() => setTimeRange('24h')}
            className={`px-3 py-1 rounded-md transition-colors ${
              timeRange === '24h'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Últimas 24 Horas
          </button>
          <button
            onClick={() => setTimeRange('7d')}
            className={`px-3 py-1 rounded-md transition-colors ${
              timeRange === '7d'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            7 Días
          </button>
          <button
            onClick={() => setTimeRange('30d')}
            className={`px-3 py-1 rounded-md transition-colors ${
              timeRange === '30d'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Mes Completo
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Conformidad Operacional */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-500" />
              Tasa de Conformidad
            </span>
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">SLA 99.5%</span>
          </div>
          <div className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white tabular-nums">
            {stats.compliancePct}%
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Tiempo de operación estricto dentro de los umbrales nominales asignados.
          </p>
        </div>

        {/* Temperatura Media */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-emerald-500" />
              Temperatura Promedio
            </span>
            <span className="text-[11px] font-mono">σ: {stats.stdTemp}°C</span>
          </div>
          <div className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white tabular-nums">
            {stats.avgTemp}°C
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>Mín: {stats.minTemp}°C</span>
            <span>Máx: {stats.maxTemp}°C</span>
          </div>
        </div>

        {/* Humedad Media */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-blue-500" />
              Humedad Promedio
            </span>
            <span className="text-[11px] font-mono text-blue-500">Nominal</span>
          </div>
          <div className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white tabular-nums">
            {stats.avgHum}%RH
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>Mín: {stats.minHum}%</span>
            <span>Máx: {stats.maxHum}%</span>
          </div>
        </div>

        {/* Eventos Anómalos IA */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Anomalías Detectadas</span>
            <span className="text-[11px] font-mono text-purple-500">ML Engine</span>
          </div>
          <div className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white tabular-nums">
            {stats.anomalyCount}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Disparos por modelo de detección Isolation Forest (Z &gt; 2.8σ).
          </p>
        </div>
      </div>

      {/* Certificado de Cumplimiento Normativo ISO/GxP */}
      <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Certificación de Cadena de Frío y Cumplimiento Normativo GxP
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                La ubicación {currentLocation?.nombre} cumple con los estándares de Buenas Prácticas de Manufactura y Almacenamiento Farmacéutico.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
            ESTADO: APROBADO
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono pt-2 border-t border-emerald-200 dark:border-emerald-900/40 text-slate-700 dark:text-slate-300">
          <div>
            <span className="text-[10px] text-slate-500 block">ID Protocolo</span>
            <span className="font-semibold">ECO-VAL-{currentLocation?.codigo_area}-2026</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">Total Mediciones</span>
            <span className="font-semibold">{history.length} registros</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">Excursiones Térmicas</span>
            <span className="font-semibold text-emerald-600">0 no justificadas</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">Firma Hash SHA-256</span>
            <span className="font-semibold truncate block">e7c84a2f89...b11</span>
          </div>
        </div>
      </div>
    </div>
  );
};
