import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Filter,
  Check,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  History,
  Eye,
  X,
  ShieldAlert,
} from 'lucide-react';
import { Alerta, AlertState, Ubicacion, Dispositivo, Sensor, Usuario } from '../../types/iot';
import { useDebounce } from '../../hooks/useDebounce';
import {
  AlertHistorialItemDTO,
  AlertResumenDTO,
  fetchAlertaDetail,
  fetchAlertaHistorial,
  fetchAlertasPaginated,
  LiveAlertRecord,
  updateAlertaEstado,
  validateAlertTransitionClient,
} from '../../services/alertService';

interface AlertsManagerProps {
  alerts: LiveAlertRecord[];
  locations: Ubicacion[];
  devices: Dispositivo[];
  sensors: Sensor[];
  currentUser: Usuario;
  onAlertUpdated?: (updated: LiveAlertRecord) => void;
  onNotify?: (msg: string, type?: 'success' | 'alert') => void;
  selectedAlertForModal: Alerta | null;
  onCloseModal: () => void;
  onOpenModal: (alert: Alerta) => void;
}

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'PENDIENTE',
  ATENDIDA: 'ATENDIDA',
  EN_ATENCION: 'ATENDIDA',
  RESUELTA: 'RESUELTA',
};

const ESTADO_STYLE: Record<string, string> = {
  PENDIENTE: 'bg-[#15803d]/15 text-[#15803d] border border-[#15803d]/40',
  ATENDIDA: 'bg-[#D97706]/15 text-[#D97706] border border-[#D97706]/40',
  RESUELTA: 'bg-canopy/15 text-canopy border border-canopy/40',
};

export const AlertsManager: React.FC<AlertsManagerProps> = React.memo(
  ({
    alerts: liveAlertsProp,
    locations,
    devices,
    sensors,
    currentUser,
    onAlertUpdated,
    onNotify,
    selectedAlertForModal,
    onCloseModal,
    onOpenModal,
  }) => {
    const [items, setItems] = useState<LiveAlertRecord[]>([]);
    const [resumen, setResumen] = useState<AlertResumenDTO>({
      total: 0,
      pendientes: 0,
      atendidas: 0,
      resueltas: 0,
      criticas: 0,
      criticas_activas: 0,
      activas: 0,
    });
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalRecords, setTotalRecords] = useState(0);
    const pageSize = 10;

    // Filtros backend RF-14
    const [filterStatus, setFilterStatus] = useState<'' | AlertState>('');
    const [filterSeverity, setFilterSeverity] = useState<'' | 'ADVERTENCIA' | 'CRITICA'>('');
    const [filterUbicacion, setFilterUbicacion] = useState('');
    const [filterDispositivo, setFilterDispositivo] = useState('');
    const [filterSensor, setFilterSensor] = useState('');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 280);

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    // Modal detalle + atención/resolución + historial RN-16
    const [detailAlert, setDetailAlert] = useState<LiveAlertRecord | null>(null);
    const [historial, setHistorial] = useState<AlertHistorialItemDTO[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const [targetState, setTargetState] = useState<'ATENDIDA' | 'RESUELTA'>('ATENDIDA');
    const [accionCorrectiva, setAccionCorrectiva] = useState('');
    const [causaRaiz, setCausaRaiz] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [conflictDetected, setConflictDetected] = useState(false);

    const loadAlertsFromBackend = useCallback(async () => {
      setLoading(true);
      setLoadError('');
      try {
        const res = await fetchAlertasPaginated({
          estado: filterStatus,
          severidad: filterSeverity,
          ubicacion_id: filterUbicacion || undefined,
          dispositivo_id: filterDispositivo || undefined,
          sensor_id: filterSensor || undefined,
          fecha_inicio: fechaInicio || undefined,
          fecha_fin: fechaFin || undefined,
          search: debouncedSearch,
          page,
          page_size: pageSize,
        });
        setItems(res.alertas);
        setTotalPages(res.total_pages);
        setTotalRecords(res.total_records);
        setResumen(res.resumen);
      } catch (err: any) {
        setLoadError(err?.message || 'Error al consultar la bitácora de alertas.');
      } finally {
        setLoading(false);
      }
    }, [
      filterStatus,
      filterSeverity,
      filterUbicacion,
      filterDispositivo,
      filterSensor,
      fechaInicio,
      fechaFin,
      debouncedSearch,
      page,
    ]);

    useEffect(() => {
      void loadAlertsFromBackend();
    }, [loadAlertsFromBackend]);

    // Refrescar cuando llegan nuevas alertas o cambios de estado en tiempo real vía SSE
    useEffect(() => {
      if (liveAlertsProp.length > 0) {
        void loadAlertsFromBackend();
      }
    }, [liveAlertsProp.length]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadModalDetail = useCallback(async (alertaId: string) => {
      setLoadingDetail(true);
      setFormError('');
      setConflictDetected(false);
      try {
        const [det, hist] = await Promise.all([
          fetchAlertaDetail(alertaId),
          fetchAlertaHistorial(alertaId),
        ]);
        setDetailAlert(det);
        setHistorial(hist);
        setTargetState(det.estado === 'PENDIENTE' ? 'ATENDIDA' : 'RESUELTA');
        setAccionCorrectiva('');
        setCausaRaiz('');
        setObservaciones('');
      } catch (err: any) {
        setFormError(err?.message || 'No fue posible cargar el detalle auditable de la alerta.');
      } finally {
        setLoadingDetail(false);
      }
    }, []);

    useEffect(() => {
      if (selectedAlertForModal) {
        void loadModalDetail(selectedAlertForModal.id_alerta);
      } else {
        setDetailAlert(null);
        setHistorial([]);
      }
    }, [selectedAlertForModal, loadModalDetail]);

    const handleSubmitEstado = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!detailAlert || submitting) return;
      setFormError('');
      setConflictDetected(false);

      const clientErr = validateAlertTransitionClient(detailAlert, targetState, accionCorrectiva);
      if (clientErr) {
        setFormError(clientErr);
        return;
      }

      setSubmitting(true);
      try {
        const res = await updateAlertaEstado(detailAlert.id_alerta, {
          estado_nuevo: targetState,
          accion_correctiva: accionCorrectiva.trim() || undefined,
          causa_raiz: causaRaiz.trim() || undefined,
          observaciones: observaciones.trim() || undefined,
          expected_version: detailAlert.version ?? 1,
        });
        setDetailAlert(res.alerta);
        onAlertUpdated?.(res.alerta);
        onNotify?.(res.message, 'success');
        const hist = await fetchAlertaHistorial(detailAlert.id_alerta);
        setHistorial(hist);
        setAccionCorrectiva('');
        setCausaRaiz('');
        setObservaciones('');
        await loadAlertsFromBackend();
      } catch (err: any) {
        if (err?.status === 409) {
          setConflictDetected(true);
        }
        setFormError(err?.message || 'No fue posible actualizar el estado de la alerta.');
      } finally {
        setSubmitting(false);
      }
    };

    const orNotRegistered = (val?: string | null) => (val && val.trim() ? val : 'No registrado');

    return (
      <div className="space-y-[24px]">
        {/* Encabezado RF-14 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="apple-card-heading text-bark flex items-center gap-2.5">
              <AlertTriangle className="w-6 h-6 text-[#15803d]" />
              <span>Gestor de Alertas</span>
            </h2>
            <p className="text-[14px] text-slate mt-1">
              Consulta, seguimiento y gestión de las incidencias ambientales registradas en el sistema
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadAlertsFromBackend()}
            className="apple-white-outline-pill px-4 py-2 text-xs font-medium inline-flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar bitácora</span>
          </button>
        </div>

        {/* Resumen KPI RF-14 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-sheet-white rounded-[16px] p-4">
            <span className="text-[11px] font-semibold text-slate uppercase tracking-wider">Pendientes</span>
            <div className="apple-metric-display text-[#15803d] mt-1 tabular-nums">{resumen.pendientes}</div>
          </div>
          <div className="bg-sheet-white rounded-[16px] p-4">
            <span className="text-[11px] font-semibold text-slate uppercase tracking-wider">Atendidas</span>
            <div className="apple-metric-display text-[#D97706] mt-1 tabular-nums">{resumen.atendidas}</div>
          </div>
          <div className="bg-sheet-white rounded-[16px] p-4">
            <span className="text-[11px] font-semibold text-slate uppercase tracking-wider">Resueltas</span>
            <div className="apple-metric-display text-canopy mt-1 tabular-nums">{resumen.resueltas}</div>
          </div>
          <div className="bg-sheet-white rounded-[16px] p-4">
            <span className="text-[11px] font-semibold text-slate uppercase tracking-wider">Críticas</span>
            <div className="apple-metric-display text-[#15803d] mt-1 tabular-nums">{resumen.criticas}</div>
          </div>
          <div className="bg-sheet-white rounded-[16px] p-4 col-span-2 sm:col-span-1">
            <span className="text-[11px] font-semibold text-slate uppercase tracking-wider">Activas</span>
            <div className="apple-metric-display text-bark mt-1 tabular-nums">{resumen.activas}</div>
          </div>
        </div>

        {/* Filtros combinados en backend */}
        <div className="bg-sheet-white p-4 rounded-[16px] space-y-3">
          <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
            {([
              { id: '', label: `Todas (${resumen.total})` },
              { id: 'PENDIENTE', label: `Pendientes (${resumen.pendientes})` },
              { id: 'ATENDIDA', label: `Atendidas (${resumen.atendidas})` },
              { id: 'RESUELTA', label: `Resueltas (${resumen.resueltas})` },
            ] as const).map((tab) => (
              <button
                key={tab.id || 'all'}
                type="button"
                onClick={() => {
                  setFilterStatus(tab.id);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-[8px] transition-colors cursor-pointer ${
                  filterStatus === tab.id
                    ? 'bg-bark text-sheet-white font-semibold'
                    : 'bg-cream-paper text-slate hover:text-bark'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate" />
              <input
                type="text"
                aria-label="Buscar alertas"
                placeholder="Buscar ID, mensaje..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="apple-pill-input w-full pl-8 pr-3 py-1.5 text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate shrink-0" />
              <select
                aria-label="Filtrar por severidad"
                value={filterSeverity}
                onChange={(e) => {
                  setFilterSeverity(e.target.value as '' | 'ADVERTENCIA' | 'CRITICA');
                  setPage(1);
                }}
                className="apple-pill-select w-full py-1.5 text-xs"
              >
                <option value="">Severidad: Todas</option>
                <option value="CRITICA">CRÍTICA</option>
                <option value="ADVERTENCIA">ADVERTENCIA</option>
              </select>
            </div>

            <select
              aria-label="Filtrar por ubicación"
              value={filterUbicacion}
              onChange={(e) => {
                setFilterUbicacion(e.target.value);
                setPage(1);
              }}
              className="apple-pill-select w-full py-1.5 text-xs"
            >
              <option value="">Ubicación: Todas</option>
              {locations.map((loc) => (
                <option key={loc.id_ubicacion} value={loc.id_ubicacion}>
                  {loc.nombre}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtrar por dispositivo"
              value={filterDispositivo}
              onChange={(e) => {
                setFilterDispositivo(e.target.value);
                setFilterSensor('');
                setPage(1);
              }}
              className="apple-pill-select w-full py-1.5 text-xs"
            >
              <option value="">Dispositivo: Todos</option>
              {devices.map((dev) => (
                <option key={dev.id_dispositivo} value={dev.id_dispositivo}>
                  {dev.nombre}
                </option>
              ))}
            </select>

            <input
              type="date"
              aria-label="Fecha inicial"
              value={fechaInicio}
              onChange={(e) => {
                setFechaInicio(e.target.value);
                setPage(1);
              }}
              className="apple-pill-input w-full px-3 py-1.5 text-xs"
            />

            <input
              type="date"
              aria-label="Fecha final"
              value={fechaFin}
              onChange={(e) => {
                setFechaFin(e.target.value);
                setPage(1);
              }}
              className="apple-pill-input w-full px-3 py-1.5 text-xs"
            />
          </div>
        </div>

        {loadError && (
          <div className="p-4 rounded-[14px] bg-[#15803d]/10 border border-[#15803d]/40 text-xs text-[#15803d] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {/* Listado Paginado */}
        <div className="space-y-3">
          {loading ? (
            <div className="bg-sheet-white rounded-[16px] p-10 flex items-center justify-center gap-2 text-xs text-slate">
              <Loader2 className="w-5 h-5 animate-spin text-canopy" />
              <span>Consultando bitácora de alertas en MySQL...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="bg-sheet-white rounded-[16px] p-12 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-canopy mx-auto" />
              <h4 className="text-[17px] font-semibold text-bark">
                No existen alertas registradas con los filtros seleccionados
              </h4>
              <p className="text-[14px] text-slate max-w-sm mx-auto">
                Ajusta los criterios de búsqueda o verifica los rangos de fechas.
              </p>
            </div>
          ) : (
            items.map((alt) => {
              const estadoNorm = ESTADO_LABEL[alt.estado] || alt.estado;
              return (
                <div
                  key={alt.id_alerta}
                  className={`bg-sheet-white rounded-[16px] p-5 transition-all border ${
                    estadoNorm === 'PENDIENTE'
                      ? 'border-[#15803d]/40'
                      : estadoNorm === 'ATENDIDA'
                      ? 'border-[#D97706]/40'
                      : 'border-sage-mist/60 opacity-90'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          alt.nivel === 'CRITICA'
                            ? 'bg-[#15803d]/15 text-[#15803d]'
                            : 'bg-cream-paper text-[#D97706]'
                        }`}
                      >
                        {alt.nivel === 'CRITICA' ? (
                          <AlertOctagon className="w-5 h-5" />
                        ) : (
                          <AlertTriangle className="w-5 h-5" />
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[5px] ${
                              alt.nivel === 'CRITICA'
                                ? 'bg-[#15803d] text-sheet-white'
                                : 'apple-badge-orange'
                            }`}
                          >
                            {alt.nivel === 'CRITICA' ? 'CRÍTICA' : 'ADVERTENCIA'}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[5px] ${
                              ESTADO_STYLE[estadoNorm] || ''
                            }`}
                          >
                            {estadoNorm}
                          </span>
                          <span className="text-[14px] font-semibold text-bark">
                            {alt.ubicacion_nombre || alt.ubicacion_id}
                          </span>
                          <span className="text-slate">·</span>
                          <span className="text-xs text-slate font-mono">
                            {alt.sensor_identificador || alt.sensor_id} ({alt.dispositivo_nombre || alt.dispositivo_id})
                          </span>
                          <span className="text-slate">·</span>
                          <span className="text-xs text-slate font-mono">
                            {new Date(alt.fecha_hora).toLocaleString()}
                          </span>
                        </div>

                        <p className="text-[14px] text-bark">{alt.mensaje}</p>

                        {(alt.atendido_por || alt.accion_correctiva) && (
                          <div className="text-[12px] text-slate bg-cream-paper px-3 py-2 rounded-[10px] flex flex-wrap gap-x-4 gap-y-1">
                            <span>
                              Responsable: <strong className="text-bark">{orNotRegistered(alt.atendido_por)}</strong>
                            </span>
                            {alt.accion_correctiva && (
                              <span>
                                Acción: <strong className="text-bark">{alt.accion_correctiva}</strong>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenModal(alt)}
                        className="apple-blue-pill px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{estadoNorm === 'RESUELTA' ? 'Ver detalle' : 'Gestionar'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Paginación backend */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-sheet-white px-5 py-3.5 rounded-[16px] text-xs">
          <span className="text-slate font-mono">
            Página {totalPages === 0 ? 0 : page} de {totalPages} · {totalRecords} alertas encontradas
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="apple-white-outline-pill py-1.5 px-3 text-xs disabled:opacity-40 flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="apple-blue-pill px-4 py-1.5 text-xs disabled:opacity-40 flex items-center gap-1 cursor-pointer"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Modal Detalle, Gestión y Bitácora Auditable (RN-16) */}
        {selectedAlertForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-deep-abyss/65 backdrop-blur-md">
            <div className="bg-sheet-white border border-sage-mist rounded-[18px] w-full max-w-2xl p-6 space-y-5 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-sage-mist pb-3">
                <div>
                  <h3 className="text-[17px] font-semibold text-bark flex items-center gap-2">
                    <AlertOctagon className="w-5 h-5 text-[#15803d]" />
                    <span>Detalle y Bitácora de Alerta ({selectedAlertForModal.id_alerta})</span>
                  </h3>
                  <p className="text-[11px] text-slate font-mono mt-0.5">
                    Usuario en sesión (RN-16): {currentUser.nombre} ({currentUser.correo})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCloseModal}
                  aria-label="Cerrar modal"
                  className="text-slate hover:text-bark cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingDetail || !detailAlert ? (
                <div className="py-10 flex items-center justify-center gap-2 text-xs text-slate">
                  <Loader2 className="w-5 h-5 animate-spin text-canopy" />
                  <span>Cargando detalle e historial auditable...</span>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Ficha completa de detalle */}
                  <div className="p-4 bg-cream-paper rounded-[14px] space-y-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-[5px] ${
                          detailAlert.nivel === 'CRITICA' ? 'bg-[#15803d] text-sheet-white' : 'apple-badge-orange'
                        }`}
                      >
                        {detailAlert.nivel === 'CRITICA' ? 'CRÍTICA' : 'ADVERTENCIA'}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-[5px] ${
                          ESTADO_STYLE[detailAlert.estado] || ''
                        }`}
                      >
                        {detailAlert.estado}
                      </span>
                      <span className="font-mono text-slate">v{detailAlert.version ?? 1}</span>
                    </div>

                    <p className="text-[14px] font-semibold text-bark">{detailAlert.mensaje}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 pt-2 border-t border-sage-mist/60">
                      <div><span className="text-slate">Generación:</span> <span className="font-mono text-bark">{new Date(detailAlert.fecha_hora).toLocaleString()}</span></div>
                      <div><span className="text-slate">Ubicación:</span> <span className="text-bark">{orNotRegistered(detailAlert.ubicacion_nombre || detailAlert.ubicacion_id)}</span></div>
                      <div><span className="text-slate">Dispositivo:</span> <span className="text-bark">{orNotRegistered(detailAlert.dispositivo_nombre || detailAlert.dispositivo_id)}</span></div>
                      <div><span className="text-slate">Sensor:</span> <span className="text-bark">{orNotRegistered(detailAlert.sensor_identificador || detailAlert.sensor_id)}</span></div>
                      <div><span className="text-slate">Variable:</span> <span className="font-mono text-bark">{orNotRegistered(detailAlert.variable_alterada)}</span></div>
                      <div>
                        <span className="text-slate">Valor / Umbral:</span>{' '}
                        <span className="font-mono text-bark">
                          {detailAlert.valor_registrado ?? 'No registrado'} / {detailAlert.valor_limite ?? 'No registrado'}
                        </span>
                      </div>
                      <div><span className="text-slate">Responsable:</span> <span className="text-bark">{orNotRegistered(detailAlert.atendido_por)}</span></div>
                      <div>
                        <span className="text-slate">Fecha atención:</span>{' '}
                        <span className="font-mono text-bark">
                          {detailAlert.fecha_atencion ? new Date(detailAlert.fecha_atencion).toLocaleString() : 'No registrado'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate">Fecha resolución:</span>{' '}
                        <span className="font-mono text-bark">
                          {detailAlert.fecha_resolucion ? new Date(detailAlert.fecha_resolucion).toLocaleString() : 'No registrado'}
                        </span>
                      </div>
                      <div><span className="text-slate">Causa raíz:</span> <span className="text-bark">{orNotRegistered(detailAlert.causa_raiz)}</span></div>
                      <div className="sm:col-span-2">
                        <span className="text-slate">Acción correctiva:</span>{' '}
                        <span className="text-bark">{orNotRegistered(detailAlert.accion_correctiva)}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-slate">Observaciones previas:</span>{' '}
                        <span className="text-bark whitespace-pre-line">{orNotRegistered(detailAlert.observaciones)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Formulario de transición (solo si no está RESUELTA) */}
                  {detailAlert.estado !== 'RESUELTA' && (
                    <form onSubmit={handleSubmitEstado} className="space-y-3 border border-sage-mist rounded-[14px] p-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-bark">
                        Registrar atención o resolución
                      </h4>

                      {formError && (
                        <div className="p-3 rounded-[10px] bg-[#15803d]/10 border border-[#15803d]/40 text-xs text-[#15803d] flex items-center justify-between gap-2">
                          <span>{formError}</span>
                          {conflictDetected && (
                            <button
                              type="button"
                              onClick={() => void loadModalDetail(detailAlert.id_alerta)}
                              className="px-2.5 py-1 rounded-[8px] bg-[#15803d] text-sheet-white font-medium cursor-pointer shrink-0"
                            >
                              Recargar
                            </button>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        {detailAlert.estado === 'PENDIENTE' && (
                          <button
                            type="button"
                            onClick={() => setTargetState('ATENDIDA')}
                            className={`px-3.5 py-1.5 rounded-[8px] text-xs font-semibold cursor-pointer ${
                              targetState === 'ATENDIDA'
                                ? 'bg-[#D97706] text-sheet-white'
                                : 'bg-cream-paper text-slate'
                            }`}
                          >
                            Marcar como ATENDIDA
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setTargetState('RESUELTA')}
                          className={`px-3.5 py-1.5 rounded-[8px] text-xs font-semibold cursor-pointer ${
                            targetState === 'RESUELTA'
                              ? 'bg-canopy text-sheet-white'
                              : 'bg-cream-paper text-slate'
                          }`}
                        >
                          Marcar como RESUELTA
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-bark mb-1">
                          Acción correctiva {detailAlert.nivel === 'CRITICA' && targetState === 'RESUELTA' ? '(Obligatoria para crítica)' : '(Opcional)'}
                        </label>
                        <textarea
                          rows={2}
                          value={accionCorrectiva}
                          onChange={(e) => setAccionCorrectiva(e.target.value)}
                          placeholder="Describe la acción correctiva ejecutada..."
                          className="w-full px-3 py-2 rounded-[10px] border border-sage-mist bg-sheet-white text-xs text-bark"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-bark mb-1">Causa raíz</label>
                          <input
                            type="text"
                            value={causaRaiz}
                            onChange={(e) => setCausaRaiz(e.target.value)}
                            placeholder="Ej. Puerta abierta / Falla HVAC"
                            className="w-full px-3 py-1.5 rounded-[10px] border border-sage-mist bg-sheet-white text-xs text-bark"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-bark mb-1">Observaciones</label>
                          <input
                            type="text"
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            placeholder="Notas adicionales del operador..."
                            className="w-full px-3 py-1.5 rounded-[10px] border border-sage-mist bg-sheet-white text-xs text-bark"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={onCloseModal}
                          className="apple-white-outline-pill px-4 py-2 text-xs cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="apple-blue-pill px-5 py-2 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <Check className="w-3.5 h-3.5" />
                          <span>Guardar transición</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Historial Auditable RN-16 */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-bark flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-canopy" />
                      <span>Historial auditable (RN-16 · {historial.length} eventos)</span>
                    </h4>
                    {historial.length === 0 ? (
                      <p className="text-xs text-slate bg-cream-paper p-3 rounded-[10px]">
                        Sin transiciones de estado registradas aún.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {historial.map((h) => (
                          <div key={h.id_historial} className="p-3 rounded-[10px] bg-cream-paper text-xs space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono font-semibold text-bark">
                                {h.estado_anterior} → {h.estado_nuevo}
                              </span>
                              <span className="font-mono text-[11px] text-slate">
                                {new Date(h.fecha_hora_utc).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-slate">
                              Usuario: <strong className="text-bark">{h.usuario_nombre}</strong> ({h.usuario_correo})
                            </div>
                            {h.accion_correctiva && (
                              <div className="text-bark">Acción: {h.accion_correctiva}</div>
                            )}
                            {h.causa_raiz && <div className="text-slate">Causa raíz: {h.causa_raiz}</div>}
                            {h.observaciones && <div className="text-slate">Observación: {h.observaciones}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);
