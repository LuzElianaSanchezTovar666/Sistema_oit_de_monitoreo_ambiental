import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  RotateCcw,
  Thermometer,
  Droplets,
  Award,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useSiteDataVersion } from '../../services/siteData';
import { SkeletonBox } from '../common/SkeletonLoader';
import { TrendChartPanel } from './TrendChartPanel';
import { fetchUbicaciones, UbicacionDTO } from '../../services/locationService';
import { DispositivoDTO, fetchDispositivos } from '../../services/deviceService';
import { downloadEnvironmentalReport, downloadCsvExport } from '../../services/reportService';
import {
  fetchHistoricalMeasurements,
  fetchHistoricalTrends,
  fetchSensores,
  HistoricalQueryResponseDTO,
  HistoricalTrendResponseDTO,
  SensorDTO,
  validateHistoricalDateRange,
} from '../../services/sensorService';

interface HistoricalFilters {
  ubicacion_id: string;
  dispositivo_id: string;
  sensor_id: string;
  fecha_inicio: string;
  fecha_fin: string;
}

export const HistoricalAnalytics: React.FC = React.memo(() => {
  const [ubicaciones, setUbicaciones] = useState<UbicacionDTO[]>([]);
  const [dispositivos, setDispositivos] = useState<DispositivoDTO[]>([]);
  const [sensores, setSensores] = useState<SensorDTO[]>([]);

  // Filtros controlados
  const [ubicacionId, setUbicacionId] = useState<string>('');
  const [dispositivoId, setDispositivoId] = useState<string>('');
  const [sensorId, setSensorId] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<HistoricalQueryResponseDTO | null>(null);
  const [trendData, setTrendData] = useState<HistoricalTrendResponseDTO | null>(null);
  const [liveFollow, setLiveFollow] = useState(true);
  const catalogRevision = useSiteDataVersion('ubicaciones', 'dispositivos', 'sensores');
  const historyRevision = useSiteDataVersion('mediciones', 'umbrales');

  // RF-16 y RF-17: Estados de generación y descarga de reportes y exportación CSV
  const [reportFormat, setReportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [reportLoading, setReportLoading] = useState<boolean>(false);
  const [csvLoading, setCsvLoading] = useState<boolean>(false);
  const [reportStatus, setReportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [reportMessage, setReportMessage] = useState<string>('');

  const abortRef = useRef<AbortController | null>(null);
  const pendingRefresh = useRef(false);
  const lastQuery = useRef<{ page: number; size: number; filters: HistoricalFilters } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchUbicaciones().catch(() => ({ items: [] as UbicacionDTO[] })),
      fetchDispositivos().catch(() => ({ items: [] as DispositivoDTO[] })),
      fetchSensores().catch(() => ({ items: [] as SensorDTO[] })),
    ]).then(([uRes, dRes, sRes]) => {
      if (!active) return;
      setUbicaciones(uRes.items);
      setDispositivos(dRes.items);
      setSensores(sRes.items);
    });
    return () => {
      active = false;
    };
  }, [catalogRevision]);

  // Selectores dependientes respetando relaciones reales en MySQL
  const filteredDispositivos = useMemo(() => {
    if (!ubicacionId) return dispositivos;
    return dispositivos.filter((d) => d.ubicacion_id === ubicacionId);
  }, [dispositivos, ubicacionId]);

  const filteredSensores = useMemo(() => {
    if (dispositivoId) {
      return sensores.filter((s) => s.dispositivo_id === dispositivoId);
    }
    if (ubicacionId) {
      const validDevIds = new Set(filteredDispositivos.map((d) => d.id_dispositivo));
      return sensores.filter((s) => validDevIds.has(s.dispositivo_id));
    }
    return sensores;
  }, [sensores, dispositivoId, ubicacionId, filteredDispositivos]);

  const handleUbicacionChange = (newUbiId: string) => {
    setUbicacionId(newUbiId);
    if (newUbiId && dispositivoId) {
      const dev = dispositivos.find((d) => d.id_dispositivo === dispositivoId);
      if (!dev || dev.ubicacion_id !== newUbiId) {
        setDispositivoId('');
        setSensorId('');
      }
    }
    if (newUbiId && sensorId && !dispositivoId) {
      const sen = sensores.find((s) => s.id_sensor === sensorId);
      const dev = sen ? dispositivos.find((d) => d.id_dispositivo === sen.dispositivo_id) : null;
      if (!dev || dev.ubicacion_id !== newUbiId) {
        setSensorId('');
      }
    }
  };

  const handleDispositivoChange = (newDevId: string) => {
    setDispositivoId(newDevId);
    if (newDevId && sensorId) {
      const sen = sensores.find((s) => s.id_sensor === sensorId);
      if (!sen || sen.dispositivo_id !== newDevId) {
        setSensorId('');
      }
    }
  };

  const executeQuery = useCallback(
    async (
      targetPage: number,
      targetPageSize: number,
      overrides: Partial<HistoricalFilters> = {},
      background = false,
    ): Promise<void> => {
      if (background && abortRef.current) {
        pendingRefresh.current = true;
        return;
      }
      const filters: HistoricalFilters = {
        ubicacion_id: overrides.ubicacion_id ?? ubicacionId,
        dispositivo_id: overrides.dispositivo_id ?? dispositivoId,
        sensor_id: overrides.sensor_id ?? sensorId,
        fecha_inicio: overrides.fecha_inicio ?? fechaInicio,
        fecha_fin: overrides.fecha_fin ?? fechaFin,
      };
      const { fecha_inicio: fIni, fecha_fin: fFin } = filters;
      const rangeErr = validateHistoricalDateRange(fIni, fFin);
      if (rangeErr) {
        setError(rangeErr);
        return;
      }

      // RN-12: Cancelar solicitud anterior para evitar estados inconsistentes
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      lastQuery.current = { page: targetPage, size: targetPageSize, filters };
      if (!background) setLoading(true);
      setError('');
      try {
        const filterPayload = {
          ubicacion_id: filters.ubicacion_id || undefined,
          dispositivo_id: filters.dispositivo_id || undefined,
          sensor_id: filters.sensor_id || undefined,
          fecha_inicio: fIni || undefined,
          fecha_fin: fFin || undefined,
        };
        const [res, trends] = await Promise.all([
          fetchHistoricalMeasurements(
            {
              ...filterPayload,
              page: targetPage,
              page_size: targetPageSize,
            },
            controller.signal
          ),
          fetchHistoricalTrends(filterPayload, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setResult(res);
        setTrendData(trends);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setError(err?.message || 'Error al consultar el historial de mediciones.');
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setLoading(false);
          if (pendingRefresh.current) {
            pendingRefresh.current = false;
            const query = lastQuery.current;
            if (query) void executeQuery(query.page, query.size, query.filters, true);
          }
        }
      }
    },
    [ubicacionId, dispositivoId, sensorId, fechaInicio, fechaFin]
  );

  useEffect(() => {
    executeQuery(1, pageSize);
    return () => {
      pendingRefresh.current = false;
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const lastRevision = useRef(historyRevision);
  useEffect(() => {
    if (lastRevision.current === historyRevision) return;
    lastRevision.current = historyRevision;
    const query = lastQuery.current;
    if (liveFollow && query) void executeQuery(query.page, query.size, query.filters, true);
  }, [historyRevision, liveFollow, executeQuery]);

  const handleConsultar = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    executeQuery(1, pageSize);
  };

  const handleLimpiarFiltros = () => {
    setUbicacionId('');
    setDispositivoId('');
    setSensorId('');
    setFechaInicio('');
    setFechaFin('');
    setPage(1);
    setError('');
    executeQuery(1, pageSize, {
      ubicacion_id: '',
      dispositivo_id: '',
      sensor_id: '',
      fecha_inicio: '',
      fecha_fin: '',
    });
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    executeQuery(nextPage, pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    executeQuery(1, newSize);
  };

  const handleGenerateReport = async () => {
    if (reportLoading) return;
    const rangeErr = validateHistoricalDateRange(fechaInicio, fechaFin);
    if (rangeErr) {
      setReportStatus('error');
      setReportMessage(rangeErr);
      return;
    }
    if (result && result.estadisticas.total_registros_filtrados === 0) {
      setReportStatus('error');
      setReportMessage('No se encontraron mediciones para el período y los filtros seleccionados.');
      return;
    }

    setReportLoading(true);
    setReportStatus('idle');
    setReportMessage('Preparando y generando reporte ambiental consolidado...');
    try {
      const res = await downloadEnvironmentalReport({
        formato: reportFormat,
        fecha_inicio: fechaInicio || undefined,
        fecha_fin: fechaFin || undefined,
        ubicacion_id: ubicacionId || undefined,
        dispositivo_id: dispositivoId || undefined,
        sensor_id: sensorId || undefined,
      });
      setReportStatus('success');
      setReportMessage(`Reporte descargado correctamente (${res.filename}).`);
      setTimeout(() => {
        setReportStatus('idle');
        setReportMessage('');
      }, 5000);
    } catch (err: any) {
      setReportStatus('error');
      setReportMessage(err?.message || 'Error al generar el reporte.');
    } finally {
      setReportLoading(false);
    }
  };

  const handleExportCsv = async () => {
    if (csvLoading || reportLoading) return;
    const rangeErr = validateHistoricalDateRange(fechaInicio, fechaFin);
    if (rangeErr) {
      setReportStatus('error');
      setReportMessage(rangeErr);
      return;
    }
    if (result && result.estadisticas.total_registros_filtrados === 0) {
      setReportStatus('error');
      setReportMessage('No hay mediciones disponibles para exportar con los filtros seleccionados');
      return;
    }

    setCsvLoading(true);
    setReportStatus('idle');
    setReportMessage('Generando y descargando exportación CSV estándar...');
    try {
      const res = await downloadCsvExport({
        fecha_inicio: fechaInicio || undefined,
        fecha_fin: fechaFin || undefined,
        ubicacion_id: ubicacionId || undefined,
        dispositivo_id: dispositivoId || undefined,
        sensor_id: sensorId || undefined,
      });
      setReportStatus('success');
      setReportMessage(
        `Exportación CSV descargada exitosamente (${res.filename}${
          res.totalRecords !== undefined ? ` · ${res.totalRecords} registros` : ''
        }).`
      );
      setTimeout(() => {
        setReportStatus('idle');
        setReportMessage('');
      }, 5000);
    } catch (err: any) {
      setReportStatus('error');
      setReportMessage(err?.message || 'Error al exportar mediciones a CSV.');
    } finally {
      setCsvLoading(false);
    }
  };

  const stats = result?.estadisticas;
  const tempStats = stats?.temperatura;
  const humStats = stats?.humedad;
  const compStats = stats?.cumplimiento;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-sheet-white p-6 rounded-[16px]">
        <div>
          <p className="sauce-eyebrow text-canopy">RF-10 · REGISTROS INMUTABLES EN MYSQL</p>
          <h1 className="apple-card-heading text-bark mt-1">Analítica Histórica</h1>
          <p className="text-[14px] text-slate mt-1">
            Consulta paginada de mediciones ambientales almacenadas en UTC y estadísticas consolidadas sobre todo el conjunto filtrado.
          </p>
        </div>
        <div className="text-[11px] font-mono text-slate bg-cream-paper px-3 py-2 rounded-[8px] flex items-center gap-1.5 self-start sm:self-auto">
          <Database className="w-3.5 h-3.5 text-canopy" />
          <span>Solo lectura (RN-09) · Paginación servidor (RN-12)</span>
        </div>
      </div>

      {/* Panel de Filtros */}
      <form onSubmit={handleConsultar} className="bg-sheet-white p-6 rounded-[16px] space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label htmlFor="rf10-ubi" className="block text-xs text-slate font-medium mb-1">
              Ubicación
            </label>
            <select
              id="rf10-ubi"
              value={ubicacionId}
              onChange={(e) => handleUbicacionChange(e.target.value)}
              className="w-full px-3 py-2 rounded-[8px] bg-cream-paper border border-sage-mist text-xs text-bark"
            >
              <option value="">Todas las ubicaciones</option>
              {ubicaciones.map((u) => (
                <option key={u.ubicacion_id} value={u.ubicacion_id}>
                  {u.nombre} ({u.codigo_area})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rf10-dev" className="block text-xs text-slate font-medium mb-1">
              Dispositivo
            </label>
            <select
              id="rf10-dev"
              value={dispositivoId}
              onChange={(e) => handleDispositivoChange(e.target.value)}
              className="w-full px-3 py-2 rounded-[8px] bg-cream-paper border border-sage-mist text-xs text-bark"
            >
              <option value="">Todos los dispositivos</option>
              {filteredDispositivos.map((d) => (
                <option key={d.id_dispositivo} value={d.id_dispositivo}>
                  {d.nombre} ({d.codigo})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rf10-sen" className="block text-xs text-slate font-medium mb-1">
              Sensor
            </label>
            <select
              id="rf10-sen"
              value={sensorId}
              onChange={(e) => setSensorId(e.target.value)}
              className="w-full px-3 py-2 rounded-[8px] bg-cream-paper border border-sage-mist text-xs text-bark"
            >
              <option value="">Todos los sensores</option>
              {filteredSensores.map((s) => (
                <option key={s.id_sensor} value={s.id_sensor}>
                  {s.identificador} ({s.modelo})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rf10-fini" className="block text-xs text-slate font-medium mb-1">
              Fecha inicial
            </label>
            <input
              id="rf10-fini"
              type="date"
              value={fechaInicio}
              onChange={(e) => {
                setFechaInicio(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 rounded-[8px] bg-cream-paper border border-sage-mist text-xs text-bark font-mono"
            />
          </div>

          <div>
            <label htmlFor="rf10-ffin" className="block text-xs text-slate font-medium mb-1">
              Fecha final
            </label>
            <input
              id="rf10-ffin"
              type="date"
              value={fechaFin}
              onChange={(e) => {
                setFechaFin(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 rounded-[8px] bg-cream-paper border border-sage-mist text-xs text-bark font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={loading}
              className="apple-blue-pill px-5 py-2 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              Consultar
            </button>
            <button
              type="button"
              onClick={handleLimpiarFiltros}
              className="px-4 py-2 rounded-[56px] bg-cream-paper border border-sage-mist text-xs text-bark hover:border-canopy inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpiar filtros
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate">
            {ubicacionId && (
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-bark">
                <input
                  type="checkbox"
                  checked={liveFollow}
                  onChange={(e) => setLiveFollow(e.target.checked)}
                  className="accent-canopy"
                />
                <span>Actualizar historial automáticamente</span>
              </label>
            )}
            <label htmlFor="rf10-psize">Filas por página:</label>
            <select
              id="rf10-psize"
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="px-2.5 py-1 rounded-[8px] bg-cream-paper border border-sage-mist text-xs text-bark font-mono"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-[10px] bg-[#15803d]/10 border border-[#15803d]/40 text-xs text-[#15803d] flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </form>

      {/* RF-16 y RF-17: Sección de Exportación y Descarga de Reportes Ambientales */}
      <div className="bg-sheet-white rounded-[16px] p-5 border border-sage-mist/60 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="apple-badge-blue text-[10px]">RF-16 · RF-17 · RN-18 · RN-19</span>
              <h2 className="text-sm font-semibold text-bark">
                Reportes y Exportación de Mediciones
              </h2>
            </div>
            <p className="text-xs text-slate mt-0.5">
              Descarga reportes estadísticos en PDF o Excel (RF-16) o exporta todas las mediciones filtradas a CSV estándar (RF-17).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex rounded-[8px] bg-cream-paper border border-sage-mist p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setReportFormat('pdf')}
                className={`px-3 py-1.5 rounded-[6px] font-medium transition-all inline-flex items-center gap-1.5 ${
                  reportFormat === 'pdf'
                    ? 'bg-canopy text-console-on-solid shadow-sm'
                    : 'text-slate hover:text-bark'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                PDF
              </button>
              <button
                type="button"
                onClick={() => setReportFormat('excel')}
                className={`px-3 py-1.5 rounded-[6px] font-medium transition-all inline-flex items-center gap-1.5 ${
                  reportFormat === 'excel'
                    ? 'bg-canopy text-console-on-solid shadow-sm'
                    : 'text-slate hover:text-bark'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel (.xlsx)
              </button>
            </div>

            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={reportLoading || csvLoading || loading}
              className="apple-blue-pill px-4 py-2 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Descargar reporte ambiental estadístico consolidado"
            >
              {reportLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generando reporte...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar {reportFormat.toUpperCase()}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={reportLoading || csvLoading || loading}
              className="px-4 py-2 rounded-[56px] bg-cream-paper border border-sage-mist hover:border-canopy text-bark text-xs font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-colors"
              title="Exportar todas las mediciones filtradas en formato tabular CSV estándar"
            >
              {csvLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-canopy" />
                  <span>Exportando CSV...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-canopy" />
                  <span>Exportar CSV</span>
                </>
              )}
            </button>
          </div>
        </div>

        {reportMessage && (
          <div
            role="status"
            className={`p-2.5 rounded-[8px] text-xs flex items-center gap-2 animate-fadeIn ${
              reportStatus === 'error'
                ? 'bg-[#15803d]/10 border border-[#15803d]/30 text-[#15803d]'
                : reportStatus === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-console-accent'
                : 'bg-sky-50 border border-sky-200 text-console-info'
            }`}
          >
            {reportStatus === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
            {reportStatus === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-console-accent" />}
            {(reportLoading || csvLoading) && <Loader2 className="w-4 h-4 shrink-0 animate-spin text-console-info" />}
            <span>{reportMessage}</span>
          </div>
        )}
      </div>

      {/* Tarjetas KPI Consolidadas (sobre todos los registros filtrados) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-sheet-white rounded-[16px] p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-canopy" />
              Temperatura (°C)
            </span>
            <span className="text-[11px] font-mono text-slate">
              {tempStats?.muestras ?? 0} muestras
            </span>
          </div>
          <div className="text-2xl font-semibold text-canopy font-mono tabular-nums">
            {tempStats?.promedio !== null && tempStats?.promedio !== undefined
              ? `${tempStats.promedio.toFixed(2)} °C`
              : 'No disponible'}
          </div>
          <div className="text-[11px] font-mono text-slate flex flex-wrap gap-x-3 gap-y-1">
            <span>
              Mín: {tempStats?.minimo !== null && tempStats?.minimo !== undefined ? `${tempStats.minimo} °C` : 'No disponible'}
            </span>
            <span>
              Máx: {tempStats?.maximo !== null && tempStats?.maximo !== undefined ? `${tempStats.maximo} °C` : 'No disponible'}
            </span>
            <span>
              σ (muestral):{' '}
              {tempStats?.desviacion_estandar !== null && tempStats?.desviacion_estandar !== undefined
                ? `${tempStats.desviacion_estandar} °C`
                : 'No disponible'}
            </span>
          </div>
        </div>

        <div className="bg-sheet-white rounded-[16px] p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-canopy" />
              Humedad Relativa (%RH)
            </span>
            <span className="text-[11px] font-mono text-slate">
              {humStats?.muestras ?? 0} muestras
            </span>
          </div>
          <div className="text-2xl font-semibold text-bark font-mono tabular-nums">
            {humStats?.promedio !== null && humStats?.promedio !== undefined
              ? `${humStats.promedio.toFixed(2)} %RH`
              : 'No disponible'}
          </div>
          <div className="text-[11px] font-mono text-slate flex flex-wrap gap-x-3 gap-y-1">
            <span>
              Mín: {humStats?.minimo !== null && humStats?.minimo !== undefined ? `${humStats.minimo} %RH` : 'No disponible'}
            </span>
            <span>
              Máx: {humStats?.maximo !== null && humStats?.maximo !== undefined ? `${humStats.maximo} %RH` : 'No disponible'}
            </span>
            <span>
              σ (muestral):{' '}
              {humStats?.desviacion_estandar !== null && humStats?.desviacion_estandar !== undefined
                ? `${humStats.desviacion_estandar} %RH`
                : 'No disponible'}
            </span>
          </div>
        </div>

        <div className="bg-sheet-white rounded-[16px] p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate flex items-center gap-1.5">
              <Award className="w-4 h-4 text-canopy" />
              Cumplimiento Ambiental
            </span>
            <span className="text-[11px] font-mono text-slate">Evaluación RF-07</span>
          </div>
          <div className="text-2xl font-semibold text-canopy font-mono tabular-nums">
            {compStats?.porcentaje !== null && compStats?.porcentaje !== undefined
              ? `${compStats.porcentaje.toFixed(1)} %`
              : 'No disponible'}
          </div>
          <div className="text-[11px] font-mono text-slate">
            {compStats && compStats.mediciones_evaluables > 0
              ? `${compStats.mediciones_conformes} conformes de ${compStats.mediciones_evaluables} evaluables`
              : 'Sin mediciones evaluables en el rango'}
          </div>
        </div>
      </div>

      {/* Gráficos de Tendencia Dinámicos SVG (RF-11) */}
      <TrendChartPanel trendData={trendData} loading={loading} error={error} />

      {/* Tabla Paginada de Resultados */}
      <div className="bg-sheet-white rounded-[16px] overflow-hidden">
        <div className="px-6 py-4 border-b border-sage-mist/60 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[16px] font-semibold text-bark">
            Resultados ({result?.total_records ?? 0} registros)
          </h2>
          <span className="text-xs font-mono text-slate">
            Página {result?.total_pages ? result.page : 0} de {result?.total_pages ?? 0}
          </span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            <SkeletonBox className="h-10 w-full" />
            <SkeletonBox className="h-10 w-full" />
            <SkeletonBox className="h-10 w-full" />
            <SkeletonBox className="h-10 w-full" />
            <SkeletonBox className="h-10 w-full" />
          </div>
        ) : !result || result.items.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate">
            No se encontraron mediciones para los filtros seleccionados
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-cream-paper text-slate font-mono uppercase tracking-wider border-b border-sage-mist/60">
                  <th className="py-3 px-4">Fecha y hora</th>
                  <th className="py-3 px-4">Ubicación</th>
                  <th className="py-3 px-4">Dispositivo</th>
                  <th className="py-3 px-4">Sensor</th>
                  <th className="py-3 px-4 text-right">Temperatura (°C)</th>
                  <th className="py-3 px-4 text-right">Humedad (%RH)</th>
                  <th className="py-3 px-4 text-center">Estado Umbral</th>
                  <th className="py-3 px-4 text-center">Anomalía IA (RF-18)</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((m) => (
                  <tr
                    key={m.id_medicion}
                    className="border-b border-sage-mist/40 hover:bg-cream-paper/50 font-mono tabular-nums"
                  >
                    <td className="py-3 px-4 text-bark whitespace-nowrap" title={`UTC: ${m.fecha_hora_utc}`}>
                      {new Date(m.fecha_hora_utc).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-sans text-bark">
                      {m.ubicacion_nombre || m.ubicacion_id || '—'}
                    </td>
                    <td className="py-3 px-4 font-sans text-bark">
                      {m.dispositivo_nombre || m.dispositivo_codigo || m.dispositivo_id}
                    </td>
                    <td className="py-3 px-4 text-slate">
                      {m.sensor_identificador || m.sensor_id || '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-canopy font-semibold">
                      {m.temperatura !== null ? `${m.temperatura.toFixed(2)} °C` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-bark">
                      {m.humedad !== null ? `${m.humedad.toFixed(1)} %RH` : '—'}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <span
                        className={`px-2 py-0.5 rounded-[5px] text-[11px] font-semibold ${
                          m.estado_evaluacion === 'Conforme'
                            ? 'bg-canopy/15 text-canopy'
                            : m.estado_evaluacion === 'Fuera de umbral'
                              ? 'bg-[#15803d]/15 text-[#15803d]'
                              : 'bg-cream-paper text-slate'
                        }`}
                      >
                        {m.estado_evaluacion}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      {m.es_anomalia_ia || m.valor_anomalo ? (
                        <span
                          className="px-2 py-0.5 rounded-[5px] text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 inline-flex items-center gap-1"
                          title={`Score Anomaly Forest: ${m.score_anomalia_ia ?? 'N/A'}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          <span>Anómalo</span>
                          {m.score_anomalia_ia !== null && m.score_anomalia_ia !== undefined && (
                            <span className="text-[10px] font-mono opacity-80">
                              ({m.score_anomalia_ia.toFixed(2)})
                            </span>
                          )}
                        </span>
                      ) : m.score_anomalia_ia !== null && m.score_anomalia_ia !== undefined ? (
                        <span
                          className="px-2 py-0.5 rounded-[5px] text-[11px] text-slate font-mono"
                          title={`Score Anomaly Forest: ${m.score_anomalia_ia.toFixed(4)}`}
                        >
                          Nominal ({m.score_anomalia_ia.toFixed(2)})
                        </span>
                      ) : (
                        <span className="text-slate text-[11px] font-mono">No evaluado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {result && result.total_pages > 1 && (
          <div className="px-6 py-4 border-t border-sage-mist/60 flex items-center justify-between text-xs">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => handlePageChange(page - 1)}
              className="px-3 py-1.5 rounded-[8px] bg-cream-paper border border-sage-mist text-bark disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Anterior
            </button>
            <span className="font-mono text-slate">
              Página {result.page} / {result.total_pages}
            </span>
            <button
              type="button"
              disabled={page >= result.total_pages || loading}
              onClick={() => handlePageChange(page + 1)}
              className="px-3 py-1.5 rounded-[8px] bg-cream-paper border border-sage-mist text-bark disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
            >
              Siguiente
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
