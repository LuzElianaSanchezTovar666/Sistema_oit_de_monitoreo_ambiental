import React, { useEffect, useState } from 'react';
import { useSiteDataVersion } from '../../services/siteData';
import {
  FileText,
  X,
  RefreshCw,
  Cpu,
  Wifi,
  Radio,
  Server,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Edit3,
  Plus,
  Info,
} from 'lucide-react';
import {
  CreateMantenimientoPayload,
  createDeviceMaintenance,
  DeviceFichaTecnicaDTO,
  evaluateRssi,
  fetchDeviceFichaTecnica,
  formatLastContact,
  formatRelativeTime,
  MaintenanceResult,
  MaintenanceType,
  patchDeviceTechnicalConfig,
  UpdateDeviceTechnicalPayload,
} from '../../services/deviceService';
import { DeviceConnectivityBadge, DeviceRssiBadge } from './DeviceConnectivity';
import { UbicacionDTO } from '../../services/locationService';

interface DeviceFichaTecnicaModalProps {
  deviceId: string;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: string; // 'admin' | 'tecnico' | 'supervisor' | 'cliente'
  locations?: UbicacionDTO[];
  onNotify?: (msg: string, type?: 'success' | 'alert') => void;
  onDeviceUpdated?: () => void;
}

export const DeviceFichaTecnicaModal: React.FC<DeviceFichaTecnicaModalProps> = ({
  deviceId,
  isOpen,
  onClose,
  currentUserRole = 'cliente',
  locations = [],
  onNotify,
  onDeviceUpdated,
}) => {
  const [ficha, setFicha] = useState<DeviceFichaTecnicaDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'general' | 'mqtt' | 'sensores' | 'mantenimientos'>('general');

  // Modal / Formulario para Editar Configuración Técnica (RN-22)
  const [showEditTechnical, setShowEditTechnical] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editFirmware, setEditFirmware] = useState('');
  const [editIp, setEditIp] = useState('');
  const [editUbicacionId, setEditUbicacionId] = useState('');
  const [editObservacion, setEditObservacion] = useState('');
  const [savingTechnical, setSavingTechnical] = useState(false);
  const [editError, setEditError] = useState('');

  // Modal / Formulario para Registrar Mantenimiento (RN-22)
  const [showAddMaintenance, setShowAddMaintenance] = useState(false);
  const [mntTipo, setMntTipo] = useState<MaintenanceType>('CALIBRACION');
  const [mntSensorId, setMntSensorId] = useState<string>('');
  const [mntDescripcion, setMntDescripcion] = useState('');
  const [mntActividades, setMntActividades] = useState('');
  const [mntResultado, setMntResultado] = useState<MaintenanceResult>('EXITOSO');
  const [mntObservaciones, setMntObservaciones] = useState('');
  const [mntCosto, setMntCosto] = useState<number>(50);
  const [savingMnt, setSavingMnt] = useState(false);
  const [mntError, setMntError] = useState('');

  const isAdminOrTecnico = currentUserRole === 'admin' || currentUserRole === 'tecnico';
  const revision = useSiteDataVersion('dispositivos', 'ubicaciones', 'sensores', 'mantenimientos');

  const loadData = async (initializeForm = true) => {
    if (!deviceId) return;
    if (initializeForm) setLoading(true);
    setError('');
    try {
      const data = await fetchDeviceFichaTecnica(deviceId);
      setFicha(data);
      if (!initializeForm) return;
      setEditNombre(data.dispositivo.nombre);
      setEditFirmware(data.dispositivo.firmware_version);
      setEditIp(data.dispositivo.ip_address || '');
      setEditUbicacionId(data.dispositivo.ubicacion_id || '');
      setEditObservacion(data.dispositivo.observacion_tecnica || '');
      if (data.sensores && data.sensores.length > 0) {
        setMntSensorId(data.sensores[0].id_sensor);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al cargar la ficha técnica del dispositivo.');
    } finally {
      if (initializeForm) setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && deviceId) {
      void loadData();
    }
  }, [isOpen, deviceId]);

  useEffect(() => {
    if (isOpen && ficha?.dispositivo.id_dispositivo === deviceId) {
      void loadData(!showEditTechnical && !showAddMaintenance);
    }
  }, [revision]);

  if (!isOpen) return null;

  const handleSaveTechnical = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrTecnico) return;
    setSavingTechnical(true);
    setEditError('');

    const payload: UpdateDeviceTechnicalPayload = {
      nombre: editNombre.trim(),
      firmware_version: editFirmware.trim(),
      ubicacion_id: editUbicacionId || undefined,
      ip_address: editIp.trim() ? editIp.trim() : undefined,
      observacion_tecnica: editObservacion.trim() || undefined,
    };

    try {
      const res = await patchDeviceTechnicalConfig(deviceId, payload);
      onNotify?.(res.message || 'Parámetros técnicos actualizados en SIMOA.', 'success');
      setShowEditTechnical(false);
      await loadData();
      onDeviceUpdated?.();
    } catch (err: any) {
      setEditError(err?.message || 'Error al actualizar parámetros técnicos.');
    } finally {
      setSavingTechnical(false);
    }
  };

  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrTecnico) return;
    setSavingMnt(true);
    setMntError('');

    const payload: CreateMantenimientoPayload = {
      dispositivo_id: deviceId,
      sensor_id: mntSensorId || undefined,
      tipo_mantenimiento: mntTipo,
      descripcion: mntDescripcion.trim(),
      actividades_realizadas: mntActividades.trim() || undefined,
      resultado: mntResultado,
      observaciones: mntObservaciones.trim() || undefined,
      costo_estimado_usd: Number(mntCosto) || 0,
    };

    try {
      const res = await createDeviceMaintenance(deviceId, payload);
      onNotify?.(res.message || 'Intervención técnica registrada exitosamente en MySQL.', 'success');
      setShowAddMaintenance(false);
      setMntDescripcion('');
      setMntActividades('');
      setMntObservaciones('');
      await loadData();
      setActiveTab('mantenimientos');
    } catch (err: any) {
      setMntError(err?.message || 'Error al registrar la intervención técnica.');
    } finally {
      setSavingMnt(false);
    }
  };

  const dev = ficha?.dispositivo;
  const conn = ficha?.conectividad;
  const rssiEval = evaluateRssi(conn?.rssi_dbm, conn?.estado === 'OFFLINE');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ficha-tecnica-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-white text-bark border border-graphite-fill rounded-[28px] w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-graphite-fill flex items-center justify-between bg-brand-forest shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/30 flex items-center justify-center text-[#d9eee1]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="ficha-tecnica-title" className="text-lg font-semibold text-white">
                  Ficha Técnica e Historial por Dispositivo (RF-20)
                </h2>
                {dev && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-garden-mint text-garden-deep border border-garden-border">
                    {dev.codigo || dev.id_dispositivo}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#d9eee1] mt-0.5">
                Consolidación de hardware, configuración MQTT, conectividad en tiempo real y bitácora técnica
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadData()}
              title="Actualizar datos"
              disabled={loading}
              className="p-2 rounded-full text-white hover:bg-white/15 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              title="Cerrar ficha técnica"
              className="p-2 rounded-full text-white hover:bg-white/15 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Loading / Error States */}
        {loading && !ficha && (
          <div className="p-12 text-center text-slate-text">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-neon-pulse" />
            <p className="text-sm">Cargando ficha técnica consolidada desde MySQL...</p>
          </div>
        )}

        {error && (
          <div className="p-6 m-6 bg-emerald-500/10 border border-emerald-500/30 rounded-[18px] text-emerald-300 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-emerald-200">Error al consultar la ficha técnica</p>
              <p className="text-xs text-emerald-300/80 mt-1">{error}</p>
            </div>
          </div>
        )}

        {ficha && dev && (
          <>
            {/* Top Bar: Resumen Rápido y Conectividad */}
            <div className="px-6 py-3 bg-obsidian-shell/60 border-b border-graphite-fill flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-pure-white font-medium text-sm">{dev.nombre}</span>
                <span className="text-slate-text">·</span>
                <span className="text-slate-text">{dev.ubicacion || 'Sin ubicación física'}</span>
                <span className="text-slate-text">·</span>
                <DeviceConnectivityBadge
                  state={conn?.estado || dev.estado}
                />
                <DeviceRssiBadge
                  rssi={conn?.rssi_dbm}
                  isOffline={conn?.estado === 'OFFLINE' || dev.estado === 'OFFLINE'}
                />
              </div>

              {/* RN-22: Aviso de Perfil */}
              <div>
                {isAdminOrTecnico ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-console-accent border border-emerald-500/20">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    RN-22: Modo Técnico Autorizado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-green-500/10 text-green-300 border border-green-500/20">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    RN-22: Modo Solo Lectura (Supervisor / Operador)
                  </span>
                )}
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-6 pt-3 border-b border-graphite-fill flex items-center gap-2 bg-sheet-white">
              <button
                onClick={() => setActiveTab('general')}
                className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
                  activeTab === 'general'
                    ? 'border-canopy bg-canopy text-white'
                    : 'border-transparent text-slate-text hover:text-pure-white'
                }`}
              >
                <Cpu className="w-4 h-4" />
                <span>Identificación y Hardware</span>
              </button>
              <button
                onClick={() => setActiveTab('mqtt')}
                className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
                  activeTab === 'mqtt'
                    ? 'border-canopy bg-canopy text-white'
                    : 'border-transparent text-slate-text hover:text-pure-white'
                }`}
              >
                <Wifi className="w-4 h-4" />
                <span>Configuración MQTT</span>
              </button>
              <button
                onClick={() => setActiveTab('sensores')}
                className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
                  activeTab === 'sensores'
                    ? 'border-canopy bg-canopy text-white'
                    : 'border-transparent text-slate-text hover:text-pure-white'
                }`}
              >
                <Radio className="w-4 h-4" />
                <span>Sensores Vinculados ({ficha.sensores_count})</span>
              </button>
              <button
                onClick={() => setActiveTab('mantenimientos')}
                className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
                  activeTab === 'mantenimientos'
                    ? 'border-canopy bg-canopy text-white'
                    : 'border-transparent text-slate-text hover:text-pure-white'
                }`}
              >
                <Wrench className="w-4 h-4" />
                <span>Historial de Mantenimientos ({ficha.mantenimientos_count})</span>
              </button>
            </div>

            {/* Modal Body / Tab Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* TAB 1: IDENTIFICACIÓN Y HARDWARE */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  {/* Grid de Parámetros de Hardware */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Caja 1: Identificación Administrativa */}
                    <div className="p-4 rounded-[18px] bg-obsidian-shell border border-graphite-fill space-y-3">
                      <h3 className="text-xs font-semibold text-slate-text uppercase tracking-wider flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-neon-pulse" />
                        Identificación Administrativa
                      </h3>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-graphite-fill/40">
                          <span className="text-slate-text">ID Interno</span>
                          <span className="font-mono text-pure-white">{dev.id_dispositivo}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-graphite-fill/40">
                          <span className="text-slate-text">Código Visible</span>
                          <span className="font-mono text-pure-white">{dev.codigo || 'Sin código'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-graphite-fill/40">
                          <span className="text-slate-text">Nombre del Nodo</span>
                          <span className="text-pure-white font-medium">{dev.nombre}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-graphite-fill/40">
                          <span className="text-slate-text">Tipo de Nodo</span>
                          <span className="px-2 py-0.5 rounded bg-sheet-white text-pure-white font-medium">
                            {dev.tipo}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-graphite-fill/40">
                          <span className="text-slate-text">Ubicación Física</span>
                          <span className="text-pure-white">{dev.ubicacion || 'No asignada'}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-text">Fecha de Registro</span>
                          <span className="text-pure-white">{formatLastContact(dev.fecha_registro)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Caja 2: Información Técnica y Hardware */}
                    <div className="p-4 rounded-[18px] bg-obsidian-shell border border-graphite-fill space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-slate-text uppercase tracking-wider flex items-center gap-2">
                          <Server className="w-4 h-4 text-console-accent" />
                          Parámetros Técnicos de Hardware
                        </h3>
                        {isAdminOrTecnico && !showEditTechnical && (
                          <button
                            onClick={() => setShowEditTechnical(true)}
                            className="px-2.5 py-1 rounded-[56px] bg-sheet-white border border-graphite-fill hover:bg-cream-paper text-xs text-pure-white inline-flex items-center gap-1.5 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Editar
                          </button>
                        )}
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-graphite-fill/40">
                          <span className="text-slate-text">Dirección MAC</span>
                          <span className="font-mono text-console-accent font-semibold">{dev.mac_address}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-graphite-fill/40">
                          <span className="text-slate-text">Dirección IP (Última conocida)</span>
                          <span className={`font-mono ${dev.ip_address ? 'text-console-info' : 'text-slate-text italic'}`}>
                            {dev.ip_address || 'No registrado'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-graphite-fill/40">
                          <span className="text-slate-text">Versión de Firmware</span>
                          <span className="font-mono text-pure-white">{dev.firmware_version || 'v1.0.0'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-graphite-fill/40">
                          <span className="text-slate-text">Estado Administrativo</span>
                          <span className="text-pure-white font-medium">
                            {dev.activo_administrativamente ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </div>
                        <div className="py-1">
                          <span className="text-slate-text block mb-1">Observaciones Técnicas:</span>
                          <p className="text-pure-white text-[11px] bg-graphite-fill/30 p-2 rounded-lg italic">
                            {dev.observacion_tecnica || 'Sin observaciones técnicas registradas.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Formulario de Edición Técnica Inline (RN-22) */}
                  {showEditTechnical && isAdminOrTecnico && (
                    <div className="p-5 rounded-[20px] bg-sheet-white border border-neon-pulse/40 space-y-4 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b border-graphite-fill/60 pb-3">
                        <div className="flex items-center gap-2 text-pure-white font-medium text-sm">
                          <Edit3 className="w-4 h-4 text-neon-pulse" />
                          <span>Editar Configuración Técnica (RN-22)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowEditTechnical(false)}
                          className="text-slate-text hover:text-pure-white text-xs"
                        >
                          Cancelar
                        </button>
                      </div>

                      {editError && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs">
                          {editError}
                        </div>
                      )}

                      <form onSubmit={handleSaveTechnical} className="space-y-4 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-slate-text mb-1">Nombre del Dispositivo *</label>
                            <input
                              type="text"
                              value={editNombre}
                              onChange={(e) => setEditNombre(e.target.value)}
                              required
                              className="w-full px-3 py-2 rounded-lg bg-obsidian-shell border border-graphite-fill text-pure-white focus:outline-none focus:border-neon-pulse"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-text mb-1">Versión de Firmware *</label>
                            <input
                              type="text"
                              value={editFirmware}
                              onChange={(e) => setEditFirmware(e.target.value)}
                              required
                              placeholder="Ej: v1.4.2"
                              className="w-full px-3 py-2 rounded-lg bg-obsidian-shell border border-graphite-fill text-pure-white focus:outline-none focus:border-neon-pulse"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-text mb-1">Dirección IP (IPv4 / IPv6)</label>
                            <input
                              type="text"
                              value={editIp}
                              onChange={(e) => setEditIp(e.target.value)}
                              placeholder="Ej: 192.168.1.150 (opcional)"
                              className="w-full px-3 py-2 rounded-lg bg-obsidian-shell border border-graphite-fill text-pure-white focus:outline-none focus:border-neon-pulse"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-text mb-1">Ubicación Física</label>
                            <select
                              value={editUbicacionId}
                              onChange={(e) => setEditUbicacionId(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-obsidian-shell border border-graphite-fill text-pure-white focus:outline-none focus:border-neon-pulse"
                            >
                              <option value="">Seleccione una ubicación</option>
                              {locations.map((loc) => (
                                <option key={loc.ubicacion_id} value={loc.ubicacion_id}>
                                  {loc.nombre} ({loc.codigo_area})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-text mb-1">Observaciones Técnicas</label>
                          <textarea
                            value={editObservacion}
                            onChange={(e) => setEditObservacion(e.target.value)}
                            rows={2}
                            placeholder="Notas sobre montaje, fuente de alimentación o calibración..."
                            className="w-full px-3 py-2 rounded-lg bg-obsidian-shell border border-graphite-fill text-pure-white focus:outline-none focus:border-neon-pulse resize-none"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <span className="text-[11px] text-slate-text">
                            La clave primaria MAC ({dev.mac_address}) y el código permanecen protegidos.
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setShowEditTechnical(false)}
                              className="px-4 py-1.5 rounded-[56px] border border-graphite-fill text-slate-text hover:text-pure-white"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              disabled={savingTechnical}
                              className="apple-blue-pill px-4 py-1.5 font-semibold text-xs inline-flex items-center gap-1.5"
                            >
                              {savingTechnical && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                              Guardar Parámetros
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Estado de Conectividad en Tiempo Real (RF-15 y RF-19) */}
                  <div className="p-4 rounded-[18px] bg-obsidian-shell border border-graphite-fill space-y-3">
                    <h3 className="text-xs font-semibold text-slate-text uppercase tracking-wider flex items-center gap-2">
                      <Radio className="w-4 h-4 text-console-info" />
                      Estado de Conectividad y Telemetría en Tiempo Real (RF-15 y RF-19)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div className="p-3 rounded-xl bg-graphite-fill/20 border border-graphite-fill/40">
                        <span className="text-slate-text block mb-1">Estado Actual</span>
                        <div className="flex items-center gap-2 mt-1">
                          <DeviceConnectivityBadge
                            state={conn?.estado || dev.estado}
                          />
                        </div>
                        <p className="text-[11px] text-slate-text mt-1.5">
                          {conn?.tiempo_silencio_segundos !== null && conn?.tiempo_silencio_segundos !== undefined
                            ? `Silencio: ${conn.tiempo_silencio_segundos}s`
                            : 'Sin actividad'}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-graphite-fill/20 border border-graphite-fill/40">
                        <span className="text-slate-text block mb-1">Calidad de Señal RSSI</span>
                        <div className="flex items-center gap-2 mt-1">
                          <DeviceRssiBadge
                            rssi={conn?.rssi_dbm}
                            isOffline={conn?.estado === 'OFFLINE' || dev.estado === 'OFFLINE'}
                          />
                        </div>
                        <p className="text-[11px] text-slate-text mt-1.5">
                          {rssiEval.isWeak ? (
                            <span className="text-signal-yellow font-medium">Advertencia preventiva (&lt; -80 dBm)</span>
                          ) : (
                            <span>{rssiEval.qualityLabel}</span>
                          )}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-graphite-fill/20 border border-graphite-fill/40">
                        <span className="text-slate-text block mb-1">Último Contacto / Ping</span>
                        <p className="text-pure-white font-medium">
                          {formatRelativeTime(conn?.ultimo_ping || dev.ultimo_ping)}
                        </p>
                        <p className="text-[11px] text-slate-text font-mono mt-1">
                          UTC: {conn?.ultimo_ping ? new Date(conn.ultimo_ping).toISOString() : 'Sin registro'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Advertencia de Hardware Físico */}
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-300 text-xs flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                    <span>{ficha.advertencia_hardware}</span>
                  </div>
                </div>
              )}

              {/* TAB 2: CONFIGURACIÓN MQTT */}
              {activeTab === 'mqtt' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-[18px] bg-obsidian-shell border border-graphite-fill space-y-4">
                    <h3 className="text-xs font-semibold text-slate-text uppercase tracking-wider flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-neon-pulse" />
                      Tópicos y Conexión MQTT
                    </h3>

                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="text-slate-text block mb-1">Client ID MQTT</span>
                        <div className="p-2.5 rounded-lg bg-graphite-fill/30 font-mono text-pure-white select-all">
                          {ficha.mqtt.client_id}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-text block mb-1">Tópico de Telemetría (Publicación de mediciones)</span>
                        <div className="p-2.5 rounded-lg bg-graphite-fill/30 font-mono text-console-accent select-all">
                          {ficha.mqtt.topic_telemetria}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-text block mb-1">Tópico de Heartbeat / Ping (Monitoreo de vida)</span>
                        <div className="p-2.5 rounded-lg bg-graphite-fill/30 font-mono text-console-info select-all">
                          {ficha.mqtt.topic_heartbeat}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div className="p-3 rounded-xl bg-graphite-fill/20 border border-graphite-fill/40">
                          <span className="text-slate-text block mb-1">Broker MQTT</span>
                          <span className="font-mono text-pure-white font-medium">
                            {ficha.mqtt.broker_host}:{ficha.mqtt.broker_port}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-graphite-fill/20 border border-graphite-fill/40">
                          <span className="text-slate-text block mb-1">Disponibilidad del Broker</span>
                          <span
                            className={`font-semibold inline-flex items-center gap-1.5 ${
                              ficha.mqtt.broker_disponible ? 'text-console-accent' : 'text-signal-yellow'
                            }`}
                          >
                            {ficha.mqtt.broker_disponible ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Accesible en línea
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="w-3.5 h-3.5" />
                                No accesible localmente
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Advertencia de Seguridad Criptográfica */}
                  <div className="p-3.5 rounded-[16px] bg-sky-500/10 border border-sky-500/30 text-console-info text-xs flex items-start gap-3">
                    <ShieldCheck className="w-4 h-4 text-console-info shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-console-info">Protección Criptográfica de Credenciales (RN-02 y RN-22)</p>
                      <p className="text-[11px] text-console-info mt-0.5">
                        Por motivos de seguridad, las contraseñas planas y hashes criptográficos de autenticación MQTT
                        no se exponen en esta vista técnica ni pueden ser extraídos desde la API.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SENSORES VINCULADOS (RF-04) */}
              {activeTab === 'sensores' && (
                <div className="space-y-4">
                  {ficha.sensores_count === 0 ? (
                    <div className="p-8 text-center bg-obsidian-shell border border-graphite-fill rounded-[20px] text-slate-text">
                      <Radio className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-medium text-pure-white">Este dispositivo no tiene sensores vinculados</p>
                      <p className="text-xs text-slate-text mt-1">
                        Utilice el módulo de Sensores (RF-04) para vincular sondas DHT22, BME280 o SHT31.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-[18px] border border-graphite-fill bg-obsidian-shell">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-graphite-fill bg-graphite-fill/20 text-slate-text">
                            <th className="py-2.5 px-3">Identificador</th>
                            <th className="py-2.5 px-3">Modelo</th>
                            <th className="py-2.5 px-3">Variables Medidas</th>
                            <th className="py-2.5 px-3">Estado</th>
                            <th className="py-2.5 px-3">Instalación</th>
                            <th className="py-2.5 px-3">Última Calibración</th>
                            <th className="py-2.5 px-3 text-right">Lecturas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-graphite-fill/40">
                          {ficha.sensores.map((s) => (
                            <tr key={s.id_sensor} className="hover:bg-graphite-fill/20">
                              <td className="py-2.5 px-3 font-mono font-medium text-pure-white">
                                {s.identificador}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded bg-sheet-white text-pure-white font-mono">
                                  {s.modelo}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex flex-wrap gap-1">
                                  {s.variables_medidas.map((value) => {
                                    const label = typeof value === 'string'
                                      ? value
                                      : `${value.variable} (${value.unidad})`;
                                    return (
                                      <span
                                        key={label}
                                        className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                      >
                                        {label}
                                      </span>
                                    );
                                  })}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    s.estado === 'ACTIVO'
                                      ? 'bg-emerald-500/10 text-emerald-400'
                                      : 'bg-green-500/10 text-green-300'
                                  }`}
                                >
                                  {s.estado}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-text">{s.fecha_instalacion}</td>
                              <td className="py-2.5 px-3 text-slate-text">{s.ultima_calibracion}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-pure-white">
                                {s.historial_mediciones_count.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: HISTORIAL DE MANTENIMIENTOS (RF-20 / RN-22) */}
              {activeTab === 'mantenimientos' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-text uppercase tracking-wider flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-signal-yellow" />
                        Historial de Intervenciones Técnicas (RN-22)
                      </h3>
                      <p className="text-[11px] text-slate-text mt-0.5">
                        Trazabilidad de calibraciones, cambio de baterías y mantenimiento metrológico
                      </p>
                    </div>

                    {isAdminOrTecnico && !showAddMaintenance && (
                      <button
                        onClick={() => setShowAddMaintenance(true)}
                        className="apple-blue-pill px-3 py-1.5 font-semibold text-xs inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Registrar Mantenimiento
                      </button>
                    )}
                  </div>

                  {/* Formulario para Registrar Intervención Técnica (RN-22) */}
                  {showAddMaintenance && isAdminOrTecnico && (
                    <div className="p-5 rounded-[20px] bg-sheet-white border border-signal-yellow/40 space-y-4 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b border-graphite-fill/60 pb-3">
                        <div className="flex items-center gap-2 text-pure-white font-medium text-sm">
                          <Wrench className="w-4 h-4 text-signal-yellow" />
                          <span>Registrar Intervención Técnica (RN-22)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAddMaintenance(false)}
                          className="text-slate-text hover:text-pure-white text-xs"
                        >
                          Cancelar
                        </button>
                      </div>

                      {mntError && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs">
                          {mntError}
                        </div>
                      )}

                      <form onSubmit={handleCreateMaintenance} className="space-y-4 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-slate-text mb-1">Tipo de Intervención *</label>
                            <select
                              value={mntTipo}
                              onChange={(e) => setMntTipo(e.target.value as MaintenanceType)}
                              className="w-full px-3 py-2 rounded-lg bg-obsidian-shell border border-graphite-fill text-pure-white focus:outline-none focus:border-neon-pulse"
                            >
                              <option value="CALIBRACION">Calibración Metrológica</option>
                              <option value="PREVENTIVO">Mantenimiento Preventivo</option>
                              <option value="CORRECTIVO">Mantenimiento Correctivo</option>
                              <option value="REEMPLAZO_BATERIA">Reemplazo de Batería</option>
                              <option value="LIMPIEZA_SONDA">Limpieza de Sonda</option>
                              <option value="ACTUALIZACION_FIRMWARE">Actualización de Firmware</option>
                              <option value="REVISION_GENERAL">Revisión General</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-slate-text mb-1">Sensor Relacionado</label>
                            <select
                              value={mntSensorId}
                              onChange={(e) => setMntSensorId(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-obsidian-shell border border-graphite-fill text-pure-white focus:outline-none focus:border-neon-pulse"
                            >
                              <option value="">Aplica al nodo en general</option>
                              {ficha.sensores.map((s) => (
                                <option key={s.id_sensor} value={s.id_sensor}>
                                  {s.identificador} ({s.modelo})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-slate-text mb-1">Resultado de la Intervención *</label>
                            <select
                              value={mntResultado}
                              onChange={(e) => setMntResultado(e.target.value as MaintenanceResult)}
                              className="w-full px-3 py-2 rounded-lg bg-obsidian-shell border border-graphite-fill text-pure-white focus:outline-none focus:border-neon-pulse"
                            >
                              <option value="EXITOSO">Exitoso / Conforme</option>
                              <option value="PENDIENTE">Pendiente de Repuesto / Ajuste</option>
                              <option value="EN_OBSERVACION">En Observación Operacional</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-text mb-1">Descripción del Mantenimiento *</label>
                          <input
                            type="text"
                            value={mntDescripcion}
                            onChange={(e) => setMntDescripcion(e.target.value)}
                            required
                            placeholder="Ej: Calibración semestral de humedad relativa y prueba de estanqueidad"
                            className="w-full px-3 py-2 rounded-lg bg-obsidian-shell border border-graphite-fill text-pure-white focus:outline-none focus:border-neon-pulse"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-slate-text mb-1">Actividades Realizadas</label>
                            <textarea
                              value={mntActividades}
                              onChange={(e) => setMntActividades(e.target.value)}
                              rows={2}
                              placeholder="Desarmado de carcasa, reemplazo de empaque, verificación de voltaje..."
                              className="w-full px-3 py-2 rounded-lg bg-obsidian-shell border border-graphite-fill text-pure-white focus:outline-none focus:border-neon-pulse resize-none"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-text mb-1">Observaciones Metrológicas / Costo USD</label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={mntCosto}
                                onChange={(e) => setMntCosto(parseFloat(e.target.value) || 0)}
                                placeholder="Costo USD"
                                className="w-28 px-3 py-2 rounded-lg bg-obsidian-shell border border-graphite-fill text-pure-white focus:outline-none focus:border-neon-pulse"
                              />
                              <input
                                type="text"
                                value={mntObservaciones}
                                onChange={(e) => setMntObservaciones(e.target.value)}
                                placeholder="Desviación hallada, patrón utilizado..."
                                className="flex-1 px-3 py-2 rounded-lg bg-obsidian-shell border border-graphite-fill text-pure-white focus:outline-none focus:border-neon-pulse"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <span className="text-[11px] text-slate-text">
                            El registro se atribuirá automáticamente a su usuario autenticado en MySQL.
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setShowAddMaintenance(false)}
                              className="px-4 py-1.5 rounded-[56px] border border-graphite-fill text-slate-text hover:text-pure-white"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              disabled={savingMnt}
                              className="apple-blue-pill px-4 py-1.5 font-semibold text-xs inline-flex items-center gap-1.5"
                            >
                              {savingMnt && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                              Registrar Intervención
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Tabla de Mantenimientos */}
                  {ficha.mantenimientos_count === 0 ? (
                    <div className="p-8 text-center bg-obsidian-shell border border-graphite-fill rounded-[20px] text-slate-text space-y-3">
                      <Wrench className="w-8 h-8 mx-auto opacity-50 text-signal-yellow" />
                      <p className="text-sm font-medium text-pure-white">
                        No se han registrado mantenimientos para este dispositivo
                      </p>
                      {isAdminOrTecnico ? (
                        <button
                          onClick={() => setShowAddMaintenance(true)}
                          className="apple-blue-pill px-4 py-2 font-semibold text-xs inline-flex items-center gap-1.5 mx-auto"
                        >
                          <Plus className="w-4 h-4" />
                          Registrar primer mantenimiento
                        </button>
                      ) : (
                        <p className="text-xs text-slate-text">
                          Modo de solo lectura: el registro de mantenimientos requiere perfil Administrador o Técnico.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-[18px] border border-graphite-fill bg-obsidian-shell">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-graphite-fill bg-graphite-fill/20 text-slate-text">
                            <th className="py-2.5 px-3">Fecha</th>
                            <th className="py-2.5 px-3">Tipo</th>
                            <th className="py-2.5 px-3">Responsable</th>
                            <th className="py-2.5 px-3">Descripción</th>
                            <th className="py-2.5 px-3">Resultado</th>
                            <th className="py-2.5 px-3 text-right">Costo USD</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-graphite-fill/40">
                          {ficha.mantenimientos.map((m) => (
                            <tr key={m.id_mantenimiento} className="hover:bg-graphite-fill/20">
                              <td className="py-2.5 px-3 text-slate-text whitespace-nowrap">
                                {formatLastContact(m.fecha_intervencion || m.fecha_realizacion)}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded bg-sheet-white text-pure-white font-medium">
                                  {m.tipo_mantenimiento}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-pure-white font-medium">
                                {m.tecnico_nombre}
                              </td>
                              <td className="py-2.5 px-3 max-w-xs truncate text-pure-white" title={m.descripcion}>
                                {m.descripcion}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    m.resultado === 'EXITOSO'
                                      ? 'bg-emerald-500/10 text-console-accent'
                                      : 'bg-signal-yellow/10 text-signal-yellow'
                                  }`}
                                >
                                  {m.resultado}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-pure-white">
                                ${(m.costo_estimado_usd || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-3.5 border-t border-graphite-fill bg-obsidian-shell flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-text">
                SIMOA IoT · Ficha Técnica e Historial (RF-20 / RN-22)
              </span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-[56px] bg-canopy hover:bg-brand-forest text-white font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
