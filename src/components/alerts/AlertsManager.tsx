import React, { useState } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Filter,
  Check,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Alerta, Ubicacion, Dispositivo, Sensor, Usuario } from '../../types/iot';

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

export const AlertsManager: React.FC<AlertsManagerProps> = ({
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
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Form states in resolution modal
  const [motivo, setMotivo] = useState(CAUSAS_ESTANDAR[0]);
  const [customNotas, setCustomNotas] = useState('');
  const [targetState, setTargetState] = useState<'RESUELTA' | 'EN_ATENCION'>('RESUELTA');

  const filteredAlerts = alerts.filter((a) => {
    const matchesStatus = filterStatus === 'all' || a.estado === filterStatus;
    const matchesSev = filterSeverity === 'all' || a.nivel === filterSeverity;
    return matchesStatus && matchesSev;
  });

  const pendingCount = alerts.filter((a) => a.estado === 'PENDIENTE').length;
  const inProgressCount = alerts.filter((a) => a.estado === 'EN_ATENCION').length;
  const resolvedCount = alerts.filter((a) => a.estado === 'RESUELTA').length;

  const handleSubmitResolution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlertForModal) return;
    onResolveAlert(selectedAlertForModal.id_alerta, motivo, customNotas, targetState);
    onCloseModal();
    setCustomNotas('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <span>Centro de Alertas e Incidencias Ambientales</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gestión en tiempo real con debouncing de 5 min y protocolo de atención con trazabilidad
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              soundEnabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                : 'border-slate-300 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{soundEnabled ? 'Alarma Sonora Activa' : 'Alarma Silenciada'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Pendientes
            </span>
            <div className="text-2xl font-bold font-mono text-red-600 dark:text-red-400 mt-0.5 tabular-nums">
              {pendingCount}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-red-600">
            <AlertOctagon className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              En Atención
            </span>
            <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
              {inProgressCount}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Resueltas
            </span>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
              {resolvedCount}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filterStatus === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Todas ({alerts.length})
          </button>
          <button
            onClick={() => setFilterStatus('PENDIENTE')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filterStatus === 'PENDIENTE'
                ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Pendientes ({pendingCount})
          </button>
          <button
            onClick={() => setFilterStatus('EN_ATENCION')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filterStatus === 'EN_ATENCION'
                ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            En Atención ({inProgressCount})
          </button>
          <button
            onClick={() => setFilterStatus('RESUELTA')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filterStatus === 'RESUELTA'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Resueltas ({resolvedCount})
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Severidad:</span>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value as any)}
            className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="all">Todas</option>
            <option value="CRITICA">Crítica</option>
            <option value="ADVERTENCIA">Advertencia</option>
          </select>
        </div>
      </div>

      {/* Lista de Alertas */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              No existen alertas registradas con los filtros seleccionados
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Todos los recintos e instalaciones se encuentran operando dentro de sus rangos ambientales nominales.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alt) => {
            const loc = locations.find((l) => l.id_ubicacion === alt.ubicacion_id);
            const dev = devices.find((d) => d.id_dispositivo === alt.dispositivo_id);
            const sensor = sensors.find((s) => s.id_sensor === alt.sensor_id);
            const isPending = alt.estado === 'PENDIENTE';
            const isResolved = alt.estado === 'RESUELTA';

            return (
              <div
                key={alt.id_alerta}
                className={`bg-white dark:bg-slate-900 rounded-xl border p-4 transition-all ${
                  isPending
                    ? 'border-red-300 dark:border-red-900/80 shadow-xs'
                    : isResolved
                    ? 'border-slate-200 dark:border-slate-800 opacity-90'
                    : 'border-amber-300 dark:border-amber-900/80'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        alt.nivel === 'CRITICA'
                          ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
                          : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                      }`}
                    >
                      {alt.nivel === 'CRITICA' ? (
                        <AlertOctagon className="w-5 h-5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            alt.nivel === 'CRITICA'
                              ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {alt.nivel}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {loc?.nombre || 'Ubicación'}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-xs text-slate-500 font-mono">
                          {sensor?.tipo_sensor} ({dev?.nombre})
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-xs text-slate-400 font-mono">
                          {new Date(alt.fecha_hora).toLocaleTimeString()}
                        </span>
                      </div>

                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {alt.mensaje}
                      </p>

                      {/* Detalles de resolución si ya fue atendida */}
                      {isResolved && (
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/50 mt-2 space-y-0.5">
                          <div className="font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>Resuelta por: {alt.atendido_por || 'Personal de Turno'}</span>
                          </div>
                          <div>Causa: {alt.motivo_resolucion}</div>
                          {alt.notas_resolucion && <div>Notas: {alt.notas_resolucion}</div>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {!isResolved && (
                      <button
                        onClick={() => onOpenModal(alt)}
                        className={`px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors shadow-xs ${
                          isPending
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-amber-600 hover:bg-amber-700'
                        }`}
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

      {/* Modal: Atender y Resolver Alerta (PRD 3.5 & User Flow 5.1) */}
      {selectedAlertForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-red-500" />
                <span>Protocolo de Atención de Incidencia</span>
              </h3>
              <button
                onClick={onCloseModal}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-100 dark:border-red-900/60 text-xs space-y-1">
              <div className="font-semibold text-red-900 dark:text-red-200">
                {selectedAlertForModal.mensaje}
              </div>
              <div className="text-[11px] text-red-700 dark:text-red-300 font-mono">
                Estampa: {new Date(selectedAlertForModal.fecha_hora).toLocaleString()} · Operador: {currentUser.nombre}
              </div>
            </div>

            <form onSubmit={handleSubmitResolution} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Causa Raíz Identificada (Catálogo Normalizado)
                </label>
                <select
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
                >
                  {CAUSAS_ESTANDAR.map((c, i) => (
                    <option key={i} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Acción Correctiva Ejecutada / Observaciones Técnicas
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="ej. Se restableció compuerta frigorífica y se confirmó estabilización térmica a 4.1°C tras 8 minutos."
                  value={customNotas}
                  onChange={(e) => setCustomNotas(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Estado de Cierre
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetState('RESUELTA')}
                    className={`py-2 px-3 rounded-lg border font-semibold transition-colors ${
                      targetState === 'RESUELTA'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Marcar como Resuelta
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetState('EN_ATENCION')}
                    className={`py-2 px-3 rounded-lg border font-semibold transition-colors ${
                      targetState === 'EN_ATENCION'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    En Atención / Seguimiento
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
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
};
