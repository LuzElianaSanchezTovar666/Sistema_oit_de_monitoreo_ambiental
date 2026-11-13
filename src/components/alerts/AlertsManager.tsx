import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Filter,
  Check,
  Volume2,
  VolumeX,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Alerta, Ubicacion, Dispositivo, Sensor, Usuario } from '../../types/iot';
import { useDebounce } from '../../hooks/useDebounce';
import { buildEntityIndexes, paginateArray } from '../../services/performanceEngine';

interface AlertsManagerProps {
  alerts: Alerta[];
  locations: Ubicacion[];
  devices: Dispositivo[];
  sensors: Sensor[];
  currentUser: Usuario;
  onResolveAlert: (
    alertId: string,
    motivo: string,
    notas: string,
    estado: 'RESUELTA' | 'EN_ATENCION'
  ) => void;
  selectedAlertForModal: Alerta | null;
  onCloseModal: () => void;
  onOpenModal: (alert: Alerta) => void;
}

const CAUSAS_ESTANDAR = [
  'Falla o paro en sistema de aire acondicionado / climatización HVAC',
  'Compuerta, ventana o puerta de recinto frigorífico abierta',
  'Falla en compresor principal o pérdida de gas refrigerante',
  'Falla en humidificador / deshumidificador ambiental',
  'Sobrecarga térmica temporal por ingreso masivo de insumos/personal',
  'Descalibración o deriva física en la sonda del sensor',
  'Prueba de campo o simulacro de contingencia programado',
  'Corte momentáneo de suministro eléctrico o transición a UPS',
];

export const AlertsManager: React.FC<AlertsManagerProps> = React.memo(({
  alerts,
  locations,
  devices,
  sensors,
  currentUser,
  onResolveAlert,
  selectedAlertForModal,
  onCloseModal,
  onOpenModal,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'PENDIENTE' | 'EN_ATENCION' | 'RESUELTA'>('all');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'CRITICA' | 'ADVERTENCIA'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 280);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [soundEnabled, setSoundEnabled] = useState(true);

  // Form states in resolution modal
  const [motivo, setMotivo] = useState(CAUSAS_ESTANDAR[0]);
  const [customNotas, setCustomNotas] = useState('');
  const [targetState, setTargetState] = useState<'RESUELTA' | 'EN_ATENCION'>('RESUELTA');

  // Índices en memoria O(1) para eliminar consultas N+1
  const indexes = useMemo(
    () => buildEntityIndexes(locations, devices, sensors, [], alerts),
    [locations, devices, sensors, alerts]
  );

  const filteredAlerts = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return alerts.filter((a) => {
      const matchesStatus = filterStatus === 'all' || a.estado === filterStatus;
      const matchesSev = filterSeverity === 'all' || a.nivel === filterSeverity;
      const locName = indexes.locationById.get(a.ubicacion_id)?.nombre.toLowerCase() || '';
      const matchesSearch = !q || a.mensaje.toLowerCase().includes(q) || locName.includes(q);
      return matchesStatus && matchesSev && matchesSearch;
    });
  }, [alerts, filterStatus, filterSeverity, debouncedQuery, indexes]);

  const paginatedAlerts = useMemo(
    () => paginateArray(filteredAlerts, currentPage, pageSize),
    [filteredAlerts, currentPage]
  );

  const pendingCount = useMemo(() => alerts.filter((a) => a.estado === 'PENDIENTE').length, [alerts]);
  const inProgressCount = useMemo(() => alerts.filter((a) => a.estado === 'EN_ATENCION').length, [alerts]);
  const resolvedCount = useMemo(() => alerts.filter((a) => a.estado === 'RESUELTA').length, [alerts]);

  const handleSubmitResolution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlertForModal) return;
    onResolveAlert(selectedAlertForModal.id_alerta, motivo, customNotas, targetState);
    onCloseModal();
    setCustomNotas('');
  };

  return (
    <div className="space-y-[24px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="apple-card-heading text-[#0D3B1E] flex items-center gap-2.5">
            <AlertTriangle className="w-6 h-6 text-[#DC2626]" />
            <span>Centro de Alertas e Incidencias Ambientales</span>
          </h2>
          <p className="text-[14px] text-[#3B694C] mt-1">
            Gestión con Optimistic UI · Búsqueda con debounce · Índices O(1) sin N+1 · Paginación activa
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex items-center gap-2 px-4 py-2 rounded-[980px] bg-[#E3F2E6] text-[12px] font-medium text-[#0D3B1E] hover:bg-[#E3F2E6]/80 transition-colors"
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-[#15803D]" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-[#3B694C]" />
            )}
            <span>{soundEnabled ? 'Alarma Sonora Activa' : 'Alarma Silenciada'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[16px]">
        <div className="bg-[#FFFFFF] rounded-[28px] p-[16px] flex items-center justify-between">
          <div>
            <span className="text-[12px] font-semibold text-[#3B694C] uppercase tracking-wider">
              Pendientes
            </span>
            <div className="apple-metric-display text-[#DC2626] mt-1 tabular-nums">
              {pendingCount}
            </div>
          </div>
          <div className="w-11 h-11 rounded-full bg-[#F2F8F4] flex items-center justify-center text-[#DC2626]">
            <AlertOctagon className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FFFFFF] rounded-[28px] p-[16px] flex items-center justify-between">
          <div>
            <span className="text-[12px] font-semibold text-[#3B694C] uppercase tracking-wider">
              En Atención
            </span>
            <div className="apple-metric-display text-[#D97706] mt-1 tabular-nums">
              {inProgressCount}
            </div>
          </div>
          <div className="w-11 h-11 rounded-full bg-[#F2F8F4] flex items-center justify-center text-[#D97706]">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FFFFFF] rounded-[28px] p-[16px] flex items-center justify-between">
          <div>
            <span className="text-[12px] font-semibold text-[#3B694C] uppercase tracking-wider">
              Resueltas
            </span>
            <div className="apple-metric-display text-[#15803D] mt-1 tabular-nums">
              {resolvedCount}
            </div>
          </div>
          <div className="w-11 h-11 rounded-full bg-[#F2F8F4] flex items-center justify-center text-[#15803D]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filtros y Búsqueda con Debounce */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FFFFFF] p-4 rounded-[28px]">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F2F8F4] rounded-[980px] text-[12px]">
          <button
            onClick={() => {
              setFilterStatus('all');
              setCurrentPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-[980px] transition-colors ${
              filterStatus === 'all'
                ? 'bg-[#E3F2E6] text-[#0D3B1E] font-semibold'
                : 'text-[#3B694C] hover:text-[#0D3B1E]'
            }`}
          >
            Todas ({alerts.length})
          </button>
          <button
            onClick={() => {
              setFilterStatus('PENDIENTE');
              setCurrentPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-[980px] transition-colors ${
              filterStatus === 'PENDIENTE'
                ? 'bg-[#E3F2E6] text-[#DC2626] font-semibold'
                : 'text-[#3B694C] hover:text-[#0D3B1E]'
            }`}
          >
            Pendientes ({pendingCount})
          </button>
          <button
            onClick={() => {
              setFilterStatus('EN_ATENCION');
              setCurrentPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-[980px] transition-colors ${
              filterStatus === 'EN_ATENCION'
                ? 'bg-[#E3F2E6] text-[#D97706] font-semibold'
                : 'text-[#3B694C] hover:text-[#0D3B1E]'
            }`}
          >
            En Atención ({inProgressCount})
          </button>
          <button
            onClick={() => {
              setFilterStatus('RESUELTA');
              setCurrentPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-[980px] transition-colors ${
              filterStatus === 'RESUELTA'
                ? 'bg-[#E3F2E6] text-[#15803D] font-semibold'
                : 'text-[#3B694C] hover:text-[#0D3B1E]'
            }`}
          >
            Resueltas ({resolvedCount})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-2.5 text-[#3B694C]" />
            <input
              type="text"
              placeholder="Filtrar alertas..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="apple-pill-input pl-9 pr-4 py-1.5 text-xs placeholder-[#4A7C59]"
            />
          </div>

          <Filter className="w-3.5 h-3.5 text-[#3B694C] ml-1" />
          <select
            value={filterSeverity}
            onChange={(e) => {
              setFilterSeverity(e.target.value as any);
              setCurrentPage(1);
            }}
            className="apple-pill-select py-1.5 text-xs"
          >
            <option value="all">Severidad: Todas</option>
            <option value="CRITICA">Crítica</option>
            <option value="ADVERTENCIA">Advertencia</option>
          </select>
        </div>
      </div>

      {/* Lista Paginada de Alertas (Sin consultas N+1) */}
      <div className="space-y-3">
        {paginatedAlerts.items.length === 0 ? (
          <div className="bg-[#FFFFFF] rounded-[28px] p-12 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-[#15803D] mx-auto" />
            <h4 className="text-[17px] font-semibold text-[#0D3B1E]">
              No existen alertas registradas con los filtros seleccionados
            </h4>
            <p className="text-[14px] text-[#3B694C] max-w-sm mx-auto">
              Todos los recintos e instalaciones se encuentran operando dentro de sus rangos ambientales nominales.
            </p>
          </div>
        ) : (
          paginatedAlerts.items.map((alt) => {
            const loc = indexes.locationById.get(alt.ubicacion_id);
            const dev = indexes.deviceById.get(alt.dispositivo_id);
            const sensor = indexes.sensorById.get(alt.sensor_id);
            const isPending = alt.estado === 'PENDIENTE';
            const isResolved = alt.estado === 'RESUELTA';

            return (
              <div
                key={alt.id_alerta}
                className={`bg-[#FFFFFF] rounded-[28px] p-5 transition-all ${
                  isPending
                    ? 'border border-[#DC2626]/50'
                    : isResolved
                    ? 'opacity-85'
                    : 'border border-[#D97706]/50'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        alt.nivel === 'CRITICA'
                          ? 'bg-[#DC2626]/20 text-[#DC2626]'
                          : 'bg-[#E8F5E9] text-[#D97706]'
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
                              ? 'bg-[#DC2626] text-[#ffffff]'
                              : 'apple-badge-orange'
                          }`}
                        >
                          {alt.nivel}
                        </span>
                        <span className="text-[14px] font-semibold text-[#0D3B1E]">
                          {loc?.nombre || 'Ubicación'}
                        </span>
                        <span className="text-[#3B694C]">·</span>
                        <span className="text-xs text-[#3B694C] font-mono">
                          {sensor?.tipo_sensor} ({dev?.nombre})
                        </span>
                        <span className="text-[#3B694C]">·</span>
                        <span className="text-xs text-[#3B694C] font-mono">
                          {new Date(alt.fecha_hora).toLocaleTimeString()}
                        </span>
                      </div>

                      <p className="text-[14px] text-[#0D3B1E]">
                        {alt.mensaje}
                      </p>

                      {isResolved && (
                        <div className="text-[12px] text-[#15803D] bg-[#F2F8F4] p-3 rounded-[20px] mt-2 space-y-0.5">
                          <div className="font-semibold flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5" />
                            <span>Resuelta por: {alt.atendido_por || 'Personal de Turno'}</span>
                          </div>
                          <div className="text-[#3B694C]">Causa: {alt.motivo_resolucion}</div>
                          {alt.notas_resolucion && <div className="text-[#3B694C]">Notas: {alt.notas_resolucion}</div>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {!isResolved && (
                      <button
                        onClick={() => onOpenModal(alt)}
                        className="apple-blue-pill px-4 py-2 text-xs font-semibold"
                      >
                        {isPending ? 'Atender Alerta' : 'Actualizar Estado'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Paginación de Alertas */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#FFFFFF] px-5 py-3.5 rounded-[28px] text-xs">
        <span className="text-[#3B694C] font-mono">
          Página {paginatedAlerts.page} de {paginatedAlerts.totalPages} · {paginatedAlerts.totalItems} alertas totales
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={!paginatedAlerts.hasPrev}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="apple-white-outline-pill py-1.5 text-xs disabled:opacity-40 flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Anterior</span>
          </button>
          <button
            disabled={!paginatedAlerts.hasNext}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="apple-blue-pill px-4 py-1.5 text-xs disabled:opacity-40 flex items-center gap-1"
          >
            <span>Siguiente</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Modal: Atender y Resolver Alerta */}
      {selectedAlertForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A2E17]/65 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#FFFFFF] border border-[#C8E6C9] rounded-[28px] w-full max-w-lg p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-[#C8E6C9] pb-3">
              <h3 className="text-[17px] font-semibold text-[#0D3B1E] flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-[#DC2626]" />
                <span>Protocolo de Atención de Incidencia</span>
              </h3>
              <button
                onClick={onCloseModal}
                className="text-[#3B694C] hover:text-[#0D3B1E] text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-[#F2F8F4] rounded-[20px] border border-[#DC2626]/40 text-xs space-y-1">
              <div className="font-semibold text-[#0D3B1E]">
                {selectedAlertForModal.mensaje}
              </div>
              <div className="text-[11px] text-[#3B694C] font-mono">
                Estampa: {new Date(selectedAlertForModal.fecha_hora).toLocaleString()} · Operador: {currentUser.nombre}
              </div>
            </div>

            <form onSubmit={handleSubmitResolution} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#3B694C] font-semibold mb-1.5">
                  Causa Raíz Identificada (Catálogo Normalizado)
                </label>
                <select
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="apple-pill-select w-full py-2.5 text-xs"
                >
                  {CAUSAS_ESTANDAR.map((c, i) => (
                    <option key={i} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#3B694C] font-semibold mb-1.5">
                  Acción Correctiva Ejecutada / Observaciones Técnicas
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="ej. Se restableció compuerta frigorífica y se confirmó estabilización térmica..."
                  value={customNotas}
                  onChange={(e) => setCustomNotas(e.target.value)}
                  className="w-full px-4 py-3 rounded-[20px] border border-[#4A7C59] bg-[#F2F8F4] text-[#0D3B1E] placeholder-[#4A7C59] focus:outline-none focus:border-[#1B5E20]"
                />
              </div>

              <div>
                <label className="block text-[#3B694C] font-semibold mb-1.5">
                  Estado de Cierre
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTargetState('RESUELTA')}
                    className={`py-2.5 px-4 rounded-[980px] border font-semibold transition-colors ${
                      targetState === 'RESUELTA'
                        ? 'bg-[#15803D] text-[#F2F8F4] border-[#15803D]'
                        : 'border-[#4A7C59] text-[#0D3B1E]'
                    }`}
                  >
                    Marcar como Resuelta
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetState('EN_ATENCION')}
                    className={`py-2.5 px-4 rounded-[980px] border font-semibold transition-colors ${
                      targetState === 'EN_ATENCION'
                        ? 'bg-[#D97706] text-[#F2F8F4] border-[#D97706]'
                        : 'border-[#4A7C59] text-[#0D3B1E]'
                    }`}
                  >
                    En Atención / Seguimiento
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#C8E6C9]">
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="apple-white-outline-pill py-2 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="apple-blue-pill px-5 py-2 font-semibold text-xs"
                >
                  Confirmar y Guardar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});

AlertsManager.displayName = 'AlertsManager';
