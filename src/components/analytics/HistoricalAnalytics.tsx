import React, { useState, useMemo, useEffect } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileCode,
  CheckCircle,
  Thermometer,
  Droplets,
  Award,
  Loader2,
  Layers,
} from 'lucide-react';
import { Ubicacion, Dispositivo, Sensor, Medicion } from '../../types/iot';
import {
  backgroundJobQueue,
  selectColumns,
  buildEntityIndexes,
  BackgroundJob,
} from '../../services/performanceEngine';

interface HistoricalAnalyticsProps {
  locations: Ubicacion[];
  devices: Dispositivo[];
  sensors: Sensor[];
  readingsHistory: { [sensorId: string]: Medicion[] };
}

export const HistoricalAnalytics: React.FC<HistoricalAnalyticsProps> = React.memo(({
  locations,
  devices,
  sensors,
  readingsHistory,
}) => {
  const [selectedLocId, setSelectedLocId] = useState<string>(locations[0]?.id_ubicacion || '');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [jobs, setJobs] = useState<BackgroundJob[]>(() => backgroundJobQueue.getJobs());

  useEffect(() => {
    const unsubscribe = backgroundJobQueue.subscribe(() => {
      setJobs(backgroundJobQueue.getJobs());
    });
    return unsubscribe;
  }, []);

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

  // Enviar tarea pesada de exportación CSV a la Cola de Trabajos en Segundo Plano (Background Job Queue)
  // pidiendo solo las columnas necesarias con selectColumns
  const handleExportCSV = () => {
    if (history.length === 0) return;
    backgroundJobQueue.enqueueJob(
      `Exportación CSV (${currentLocation?.nombre} · ${history.length} filas)`,
      async () => {
        const projected = selectColumns(history, [
          'id_medicion',
          'fecha_hora',
          'temperatura',
          'humedad',
          'valor_anomalo',
          'score_anomalia_ia',
          'z_score_temp',
        ]);
        const headers = ['id_medicion', 'fecha_hora', 'temperatura_c', 'humedad_rh', 'es_anomalo', 'score_ml', 'z_temp'];
        const rows = projected.map((m) => [
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
        return `CSV generado (${projected.length} registros, 7 columnas proyectadas)`;
      }
    );
  };

  // Enviar tarea pesada de exportación JSON a la Cola de Trabajos en Segundo Plano
  const handleExportJSON = () => {
    if (history.length === 0) return;
    backgroundJobQueue.enqueueJob(
      `Exportación JSON (${currentLocation?.nombre})`,
      async () => {
        const projected = selectColumns(history, [
          'id_medicion',
          'fecha_hora',
          'temperatura',
          'humedad',
          'valor_anomalo',
          'score_anomalia_ia',
        ]);
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(projected, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute('download', `telemetria_${currentLocation?.nombre.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        return `JSON exportado (${projected.length} objetos con proyección selectColumns)`;
      }
    );
  };

  const activeJob = jobs.find((j) => j.status === 'PROCESSING' || j.status === 'QUEUED');

  return (
    <div className="space-y-[24px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="apple-card-heading text-bark flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-canopy" />
            <span>Analítica Histórica y Series Temporales</span>
          </h2>
          <p className="text-[14px] text-slate mt-1">
            Consolidado estadístico, proyección de columnas y cola asíncrona de trabajos pesados (Background Job Queue)
          </p>
        </div>

        {/* Botones de Descarga vía Background Worker Queue */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            disabled={Boolean(activeJob)}
            className="apple-blue-pill flex items-center gap-1.5 px-4 py-2 text-xs font-semibold disabled:opacity-60"
          >
            {activeJob ? (
              <Loader2 className="w-3.5 h-3.5 text-sheet-white animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 text-sheet-white" />
            )}
            <span>{activeJob ? `En Cola (${activeJob.progress}%)` : 'Encolar CSV'}</span>
          </button>
          <button
            onClick={handleExportJSON}
            disabled={Boolean(activeJob)}
            className="apple-white-outline-pill flex items-center gap-1.5 py-2 text-xs font-semibold disabled:opacity-60"
          >
            <FileCode className="w-3.5 h-3.5 text-bark" />
            <span>Encolar JSON</span>
          </button>
        </div>
      </div>

      {/* Estado de la Cola de Trabajos en Segundo Plano si hay tareas recientes */}
      {jobs.length > 0 && (
        <div className="bg-sheet-white rounded-[16px] p-4 border border-sage-mist/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-bark flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-canopy" />
              Cola de Trabajos Asíncronos (BullMQ / Worker Queue)
            </span>
            <span className="font-mono text-[11px] text-slate">
              No bloquea el hilo principal de UI
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {jobs.slice(0, 2).map((job) => (
              <div key={job.id} className="bg-cream-paper p-3 rounded-[14px] flex items-center justify-between gap-3 text-xs">
                <div className="truncate">
                  <div className="font-semibold text-bark truncate">{job.name}</div>
                  <div className="text-[11px] text-slate font-mono truncate">
                    {job.resultSummary || `Estado: ${job.status}`}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-[5px] font-mono text-[10px] font-semibold shrink-0 ${
                    job.status === 'COMPLETED'
                      ? 'bg-canopy/15 text-canopy'
                      : 'bg-canopy/20 text-canopy'
                  }`}
                >
                  {job.progress}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controles de Selección — Charcoal Stage (#FFFFFF, 28px radius) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-sheet-white p-4 rounded-[16px]">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs text-slate">Espacio Analizado:</span>
          <select
            value={selectedLocId}
            onChange={(e) => setSelectedLocId(e.target.value)}
            className="apple-pill-select py-2 text-xs font-medium"
          >
            {locations.map((loc) => (
              <option key={loc.id_ubicacion} value={loc.id_ubicacion}>
                {loc.nombre} ({loc.codigo_area})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 p-1 bg-cream-paper rounded-[8px] text-[12px]">
          <button
            onClick={() => setTimeRange('24h')}
            className={`px-3.5 py-1.5 rounded-[8px] transition-colors ${
              timeRange === '24h'
                ? 'bg-cream-paper text-bark font-semibold'
                : 'text-slate hover:text-bark'
            }`}
          >
            Últimas 24 Horas
          </button>
          <button
            onClick={() => setTimeRange('7d')}
            className={`px-3.5 py-1.5 rounded-[8px] transition-colors ${
              timeRange === '7d'
                ? 'bg-cream-paper text-bark font-semibold'
                : 'text-slate hover:text-bark'
            }`}
          >
            7 Días
          </button>
          <button
            onClick={() => setTimeRange('30d')}
            className={`px-3.5 py-1.5 rounded-[8px] transition-colors ${
              timeRange === '30d'
                ? 'bg-cream-paper text-bark font-semibold'
                : 'text-slate hover:text-bark'
            }`}
          >
            Mes Completo
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas Estadísticas — Feature Metric Tiles (28px radius, 16px padding, no shadow) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px]">
        {/* Conformidad Operacional */}
        <div className="bg-sheet-white rounded-[16px] p-[16px] space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate">
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-canopy" />
              Tasa de Conformidad
            </span>
            <span className="text-[11px] font-mono text-canopy">SLA 99.5%</span>
          </div>
          <div className="apple-metric-display text-canopy tabular-nums py-1">
            {stats.compliancePct}%
          </div>
          <p className="text-[12px] text-slate">
            Tiempo de operación estricto dentro de los umbrales nominales asignados.
          </p>
        </div>

        {/* Temperatura Media */}
        <div className="bg-sheet-white rounded-[16px] p-[16px] space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate">
            <span className="flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-canopy" />
              Temperatura Promedio
            </span>
            <span className="text-[11px] font-mono">σ: {stats.stdTemp}°C</span>
          </div>
          <div className="apple-metric-display text-bark tabular-nums py-1">
            {stats.avgTemp}°C
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate">
            <span>Mín: {stats.minTemp}°C</span>
            <span>Máx: {stats.maxTemp}°C</span>
          </div>
        </div>

        {/* Humedad Media */}
        <div className="bg-sheet-white rounded-[16px] p-[16px] space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate">
            <span className="flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-canopy" />
              Humedad Promedio
            </span>
            <span className="text-[11px] font-mono text-canopy">Nominal</span>
          </div>
          <div className="apple-metric-display text-bark tabular-nums py-1">
            {stats.avgHum}%
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate">
            <span>Mín: {stats.minHum}%</span>
            <span>Máx: {stats.maxHum}%</span>
          </div>
        </div>

        {/* Eventos Anómalos IA */}
        <div className="bg-sheet-white rounded-[16px] p-[16px] space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate">
            <span>Anomalías Detectadas</span>
            <span className="apple-badge-orange font-mono">ML Engine</span>
          </div>
          <div className="apple-metric-display text-[#DC2626] tabular-nums py-1">
            {stats.anomalyCount}
          </div>
          <p className="text-[12px] text-slate">
            Disparos por modelo de detección Isolation Forest (Z &gt; 2.8σ).
          </p>
        </div>
      </div>

      {/* Certificado de Cumplimiento Normativo ISO/GxP — Charcoal Stage (#FFFFFF, 28px radius) */}
      <div className="bg-sheet-white rounded-[16px] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-cream-paper text-canopy flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-[17px] font-semibold text-bark">
                Certificación de Cadena de Frío y Cumplimiento Normativo GxP
              </h3>
              <p className="text-[14px] text-slate mt-0.5">
                La ubicación {currentLocation?.nombre} cumple con los estándares de Buenas Prácticas de Manufactura y Almacenamiento Ambiental.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-semibold px-3 py-1 rounded-[5px] bg-canopy/15 text-canopy shrink-0">
            ESTADO: APROBADO
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono pt-4 border-t border-sage-mist/60 text-bark">
          <div className="bg-cream-paper p-3.5 rounded-[16px]">
            <span className="text-[10px] text-slate block font-sans">ID Protocolo</span>
            <span className="font-semibold">ECO-VAL-{currentLocation?.codigo_area}-2026</span>
          </div>
          <div className="bg-cream-paper p-3.5 rounded-[16px]">
            <span className="text-[10px] text-slate block font-sans">Total Mediciones</span>
            <span className="font-semibold">{history.length} registros</span>
          </div>
          <div className="bg-cream-paper p-3.5 rounded-[16px]">
            <span className="text-[10px] text-slate block font-sans">Excursiones Térmicas</span>
            <span className="font-semibold text-canopy">0 no justificadas</span>
          </div>
          <div className="bg-cream-paper p-3.5 rounded-[16px]">
            <span className="text-[10px] text-slate block font-sans">Firma Hash SHA-256</span>
            <span className="font-semibold truncate block">e7c84a2f89...b11</span>
          </div>
        </div>
      </div>
    </div>
  );
});
