import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Cpu,
  Wifi,
  WifiOff,
  Key,
  Copy,
  Check,
  Search,
  Loader2,
  AlertCircle,
  Eye,
  PowerOff,
  RefreshCw,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { Dispositivo, Sensor, Ubicacion, Usuario, UserRole } from '../../types/iot';
import { useDebounce } from '../../hooks/useDebounce';
import {
  createDispositivo,
  deactivateDispositivo,
  DeviceConnectivity,
  DispositivoDTO,
  DispositivoEstado,
  DispositivoTipo,
  fetchDispositivoDetail,
  fetchDispositivos,
  formatLastContact,
  formatRelativeTime,
  evaluateRssi,
  fetchConnectivitySummary,
  INVALID_MAC_MESSAGE,
  isValidMacFormat,
  MqttCredentialsOnce,
  updateDispositivo,
} from '../../services/deviceService';
import { DeviceConnectivityBadge, DeviceRssiBadge } from './DeviceConnectivity';
import {
  assignDispositivoUbicacion,
  fetchHistorialUbicaciones,
  fetchUbicaciones,
  HistorialUbicacionDTO,
  UbicacionDTO,
} from '../../services/locationService';
import { fetchSensoresByDispositivo, SensorDTO } from '../../services/sensorService';

interface DeviceManagementProps {
  devices?: Dispositivo[];
  sensors?: Sensor[];
  locations: Ubicacion[];
  users?: Usuario[];
  currentUserRole?: UserRole;
  onAddDevice?: (device: Dispositivo, sensor: Sensor) => void;
  onUpdateSensorLimits?: (sensorId: string, limits: Sensor['limites']) => void;
  onToggleDeviceState?: (deviceId: string) => void;
  onNotify?: (msg: string, type?: 'success' | 'alert') => void;
  connectivity: DeviceConnectivity[] | null;
}

export const DeviceManagement: React.FC<DeviceManagementProps> = React.memo(
  ({ locations, currentUserRole = 'cliente', onNotify, connectivity }) => {
    const isAdmin = currentUserRole === 'admin';

    const [items, setItems] = useState<DispositivoDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [brokerDisponible, setBrokerDisponible] = useState<boolean | null>(null);
    const [brokerMensaje, setBrokerMensaje] = useState('');

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 280);
    const [estadoFilter, setEstadoFilter] = useState<string>('ALL');
    const [tipoFilter, setTipoFilter] = useState<string>('ALL');

    // Modal Nuevo Dispositivo
    const [showAddModal, setShowAddModal] = useState(false);
    const [submittingCreate, setSubmittingCreate] = useState(false);
    const [createError, setCreateError] = useState('');
    const [newNombre, setNewNombre] = useState('');
    const [newMac, setNewMac] = useState('');
    const [newTipo, setNewTipo] = useState<DispositivoTipo>('ESP32');
    const [newFirmware, setNewFirmware] = useState('v2.4.0');
    const [newUbicacion, setNewUbicacion] = useState('ubi-lab-01');
    const [activeUbicaciones, setActiveUbicaciones] = useState<UbicacionDTO[]>([]);
    const [deviceHistorial, setDeviceHistorial] = useState<HistorialUbicacionDTO[]>([]);
    const [deviceSensores, setDeviceSensores] = useState<SensorDTO[]>([]);
    const [reassignTargetUbiId, setReassignTargetUbiId] = useState('');
    const [reassignMotivo, setReassignMotivo] = useState('');
    const [confirmReassignOpen, setConfirmReassignOpen] = useState(false);
    const [reassigning, setReassigning] = useState(false);

    // Modal Credenciales MQTT (una sola vez tras crear)
    const [createdCreds, setCreatedCreds] = useState<MqttCredentialsOnce | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Modal Detalle / Edición
    const [detailDevice, setDetailDevice] = useState<DispositivoDTO | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [editNombre, setEditNombre] = useState('');
    const [editMac, setEditMac] = useState('');
    const [editTipo, setEditTipo] = useState<DispositivoTipo>('ESP32');
    const [editFirmware, setEditFirmware] = useState('');
    const [editUbicacion, setEditUbicacion] = useState('');
    const [editObs, setEditObs] = useState('');
    const [editError, setEditError] = useState('');
    const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);

    // Modal Desactivación Lógica (RN-03)
    const [deactivateTarget, setDeactivateTarget] = useState<DispositivoDTO | null>(null);
    const [deactivating, setDeactivating] = useState(false);

    const loadInventory = useCallback(async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [res, ubiRes] = await Promise.all([
          fetchDispositivos({
            search: debouncedSearch,
            tipo: tipoFilter,
          }),
          fetchUbicaciones({ estado: 'ACTIVA' }),
        ]);
        setItems(res.items);
        setBrokerDisponible(res.mqtt_broker_disponible);
        setBrokerMensaje(res.mqtt_broker_mensaje);
        setActiveUbicaciones(ubiRes.items);
        if (ubiRes.items.length > 0 && !ubiRes.items.some((u) => u.ubicacion_id === newUbicacion)) {
          setNewUbicacion(ubiRes.items[0].ubicacion_id);
        }
      } catch (err: any) {
        setLoadError(err?.message || 'No se pudo cargar el inventario desde MySQL.');
      } finally {
        setLoading(false);
      }
    }, [debouncedSearch, tipoFilter, newUbicacion]);

    useEffect(() => {
      loadInventory();
    }, [loadInventory]);

    const statusById = useMemo(
      () => new Map(connectivity?.map((device) => [device.id_dispositivo, device])),
      [connectivity]
    );

    const stats = useMemo(() => {
      let online = 0;
      let offline = 0;
      let warning = 0;
      let errorCnt = 0;
      let weakSignal = 0;
      let totalActivos = 0;

      for (const dev of items) {
        const live = statusById.get(dev.id_dispositivo) ?? dev;
        const isInactive = (live.estado ?? dev.estado) === 'INACTIVO' || dev.activo_administrativamente === false;
        if (!isInactive) {
          totalActivos++;
          const st = live.estado ?? dev.estado;
          if (st === 'ONLINE') online++;
          else if (st === 'ADVERTENCIA') warning++;
          else if (st === 'OFFLINE') offline++;
          else if (st === 'ERROR') errorCnt++;
        }
        const rssi = live.rssi_dbm ?? dev.rssi_dbm;
        if (rssi !== null && rssi !== undefined && rssi < -80) {
          weakSignal++;
        }
      }
      const pct = totalActivos > 0 ? Math.round((online / totalActivos) * 100) : 0;
      return { online, offline, warning, errorCnt, weakSignal, totalActivos, totalRegistrados: items.length, pct };
    }, [items, statusById]);

    const visibleItems = items.filter((device) => {
      const live = statusById.get(device.id_dispositivo) ?? device;
      if (estadoFilter === 'ALL') return true;
      if (estadoFilter === 'WEAK_SIGNAL') {
        const rssi = live.rssi_dbm ?? device.rssi_dbm;
        return rssi !== null && rssi !== undefined && rssi < -80;
      }
      return (live.estado ?? device.estado) === estadoFilter;
    });

    const detailStatus = detailDevice ? statusById.get(detailDevice.id_dispositivo) : undefined;

    const handleCopy = (key: string, value: string) => {
      navigator.clipboard?.writeText(value);
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 1800);
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setCreateError('');

      if (!newNombre.trim() || newNombre.trim().length < 2) {
        setCreateError('El nombre del nodo es obligatorio (mínimo 2 caracteres).');
        return;
      }
      if (!isValidMacFormat(newMac)) {
        setCreateError(INVALID_MAC_MESSAGE);
        return;
      }
      if (!newFirmware.trim()) {
        setCreateError('La versión de firmware es obligatoria.');
        return;
      }
      if (!newUbicacion.trim()) {
        setCreateError('La ubicación asignada es obligatoria.');
        return;
      }

      setSubmittingCreate(true);
      try {
        const res = await createDispositivo({
          nombre: newNombre.trim(),
          mac_address: newMac.trim().toUpperCase(),
          tipo: newTipo,
          firmware_version: newFirmware.trim(),
          ubicacion_id: newUbicacion.trim(),
        });
        setShowAddModal(false);
        setNewNombre('');
        setNewMac('');
        setCreatedCreds(res.mqtt_credentials_once);
        setBrokerDisponible(res.mqtt_broker_disponible);
        setBrokerMensaje(res.mqtt_broker_mensaje);
        onNotify?.(res.message, 'success');
        await loadInventory();
      } catch (err: any) {
        setCreateError(err?.message || 'Error al registrar el dispositivo.');
      } finally {
        setSubmittingCreate(false);
      }
    };

    const openDetailModal = async (dev: DispositivoDTO) => {
      setEditError('');
      setConfirmSaveOpen(false);
      setConfirmReassignOpen(false);
      setReassignMotivo('');
      setLoadingDetail(true);
      setDetailDevice(dev);
      try {
        const [res, histRes, senRes] = await Promise.all([
          fetchDispositivoDetail(dev.id_dispositivo),
          fetchHistorialUbicaciones(dev.id_dispositivo),
          fetchSensoresByDispositivo(dev.id_dispositivo),
        ]);
        const fresh = res.dispositivo;
        setDetailDevice(fresh);
        setDeviceHistorial(histRes.items);
        setDeviceSensores(senRes.items);
        setEditNombre(fresh.nombre);
        setEditMac(fresh.mac_address);
        setEditTipo(fresh.tipo);
        setEditFirmware(fresh.firmware_version);
        setEditUbicacion(fresh.ubicacion_id || '');
        setReassignTargetUbiId(fresh.ubicacion_id || '');
        setEditObs(fresh.observacion_tecnica || '');
      } catch (err: any) {
        setEditError(err?.message || 'Error al cargar el detalle.');
      } finally {
        setLoadingDetail(false);
      }
    };

    const handleConfirmReassign = async () => {
      if (!detailDevice || !reassignTargetUbiId) return;
      setReassigning(true);
      setEditError('');
      try {
        const res = await assignDispositivoUbicacion(
          detailDevice.id_dispositivo,
          reassignTargetUbiId,
          reassignMotivo.trim() || undefined
        );
        onNotify?.(res.message, 'success');
        setConfirmReassignOpen(false);
        await openDetailModal(detailDevice);
        await loadInventory();
      } catch (err: any) {
        setEditError(err?.message || 'No se pudo reasignar la ubicación.');
        setConfirmReassignOpen(false);
      } finally {
        setReassigning(false);
      }
    };

    const handleSaveEdit = async () => {
      if (!detailDevice) return;
      setEditError('');
      if (!editNombre.trim() || !editFirmware.trim() || !editUbicacion.trim()) {
        setEditError('Todos los campos requeridos deben estar completos.');
        setConfirmSaveOpen(false);
        return;
      }
      if (!isValidMacFormat(editMac)) {
        setEditError(INVALID_MAC_MESSAGE);
        setConfirmSaveOpen(false);
        return;
      }

      setSavingEdit(true);
      try {
        const res = await updateDispositivo(detailDevice.id_dispositivo, {
          nombre: editNombre.trim(),
          mac_address: editMac.trim().toUpperCase(),
          tipo: editTipo,
          firmware_version: editFirmware.trim(),
          ubicacion_id: editUbicacion.trim(),
          observacion_tecnica: editObs.trim() || undefined,
        });
        setDetailDevice(res.dispositivo);
        setConfirmSaveOpen(false);
        onNotify?.(res.message, 'success');
        await loadInventory();
      } catch (err: any) {
        setEditError(err?.message || 'No se pudo actualizar el dispositivo.');
        setConfirmSaveOpen(false);
      } finally {
        setSavingEdit(false);
      }
    };

    const handleConfirmDeactivate = async () => {
      if (!deactivateTarget) return;
      setDeactivating(true);
      try {
        const res = await deactivateDispositivo(deactivateTarget.id_dispositivo);
        setDeactivateTarget(null);
        if (detailDevice?.id_dispositivo === res.dispositivo.id_dispositivo) {
          setDetailDevice(res.dispositivo);
        }
        onNotify?.(res.message, 'success');
        await loadInventory();
      } catch (err: any) {
        onNotify?.(err?.message || 'Error al desactivar el dispositivo.', 'alert');
      } finally {
        setDeactivating(false);
      }
    };

    return (
      <div className="space-y-6 animate-fadeIn">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="sauce-eyebrow text-neon-pulse">RF-02 · INVENTARIO MYSQL</p>
            <h1 className="text-2xl font-medium text-pure-white mt-1">
              Registro y Administración de Dispositivos IoT
            </h1>
            <p className="text-sm text-slate-text mt-0.5">
              Gestión persistente de nodos ESP32, ESP8266 y Gateway con credenciales MQTT seguras.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadInventory}
              className="px-4 py-2.5 rounded-[56px] bg-deep-abyss border border-graphite-fill text-pure-white hover:border-neon-pulse text-xs font-medium inline-flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>

            {isAdmin && (
              <button
                onClick={() => {
                  setCreateError('');
                  setShowAddModal(true);
                }}
                className="sauce-btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Nuevo dispositivo
              </button>
            )}
          </div>
        </div>

        {/* Estado real del Broker MQTT (sin simulación) */}
        {brokerMensaje && (
          <div
            className={`p-4 rounded-[20px] border flex items-start gap-3 text-xs ${
              brokerDisponible
                ? 'bg-deep-abyss border-neon-pulse/40 text-pure-white'
                : 'bg-deep-abyss border-signal-yellow/50 text-signal-yellow'
            }`}
          >
            {brokerDisponible ? (
              <Wifi className="w-4 h-4 text-neon-pulse shrink-0 mt-0.5" />
            ) : (
              <WifiOff className="w-4 h-4 text-signal-yellow shrink-0 mt-0.5" />
            )}
            <div>
              <span className="font-medium">Estado real del Broker MQTT: </span>
              <span>{brokerMensaje}</span>
            </div>
          </div>
        )}

        {/* KPI: Contador Global de Conectividad (RF-19) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-[16px] bg-deep-abyss border border-graphite-fill">
            <span className="text-[11px] font-mono text-slate-text uppercase block">Nodos Conectados</span>
            <div className="text-xl font-bold text-pure-white mt-0.5 flex items-baseline gap-1">
              <span className="text-neon-pulse">{stats.online}</span>
              <span className="text-xs text-slate-text font-normal">/ {stats.totalActivos} activos</span>
            </div>
            <span className="text-[11px] text-slate-text font-mono mt-0.5 block">{stats.pct}% disponibilidad</span>
          </div>

          <div className="p-3.5 rounded-[16px] bg-deep-abyss border border-graphite-fill">
            <span className="text-[11px] font-mono text-slate-text uppercase block">Desconectados (OFFLINE)</span>
            <div className="text-xl font-bold text-pure-white mt-0.5 flex items-baseline gap-1">
              <span className={stats.offline > 0 ? "text-red-400" : "text-pure-white"}>{stats.offline}</span>
              <span className="text-xs text-slate-text font-normal">nodos</span>
            </div>
            <span className="text-[11px] text-slate-text font-mono mt-0.5 block">Silencio superado</span>
          </div>

          <div className="p-3.5 rounded-[16px] bg-deep-abyss border border-graphite-fill">
            <span className="text-[11px] font-mono text-slate-text uppercase block">Advertencia / Error</span>
            <div className="text-xl font-bold text-pure-white mt-0.5 flex items-baseline gap-1">
              <span className={stats.warning + stats.errorCnt > 0 ? "text-signal-yellow" : "text-pure-white"}>
                {stats.warning + stats.errorCnt}
              </span>
              <span className="text-xs text-slate-text font-normal">nodos</span>
            </div>
            <span className="text-[11px] text-slate-text font-mono mt-0.5 block">Retraso o fallo</span>
          </div>

          <div className="p-3.5 rounded-[16px] bg-deep-abyss border border-graphite-fill">
            <span className="text-[11px] font-mono text-slate-text uppercase block">Señal Débil (&lt; -80 dBm)</span>
            <div className="text-xl font-bold text-pure-white mt-0.5 flex items-baseline gap-1">
              <span className={stats.weakSignal > 0 ? "text-signal-yellow" : "text-pure-white"}>
                {stats.weakSignal}
              </span>
              <span className="text-xs text-slate-text font-normal">nodos</span>
            </div>
            <span className="text-[11px] text-slate-text font-mono mt-0.5 block">Riesgo preventivo</span>
          </div>
        </div>

        {/* Barra de Búsqueda y Filtros */}
        <div className="bg-deep-abyss border border-graphite-fill/50 rounded-[20px] p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-text" />
            <input
              type="text"
              placeholder="Buscar por nombre, código, MAC o ubicación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="apple-pill-input w-full pl-10 pr-4 py-2 text-sm"
            />
          </div>

          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="apple-pill-select py-2 text-sm"
            aria-label="Filtrar por estado"
          >
            <option value="ALL">Todos los estados</option>
            <option value="ONLINE">ONLINE (Conectados)</option>
            <option value="ADVERTENCIA">ADVERTENCIA (Retraso)</option>
            <option value="OFFLINE">OFFLINE (Desconectados)</option>
            <option value="ERROR">ERROR</option>
            <option value="PENDIENTE">PENDIENTE</option>
            <option value="INACTIVO">INACTIVO</option>
            <option value="WEAK_SIGNAL">SEÑAL DÉBIL (&lt; -80 dBm)</option>
          </select>

          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            className="apple-pill-select py-2 text-sm"
            aria-label="Filtrar por tipo"
          >
            <option value="ALL">Todos los tipos</option>
            <option value="ESP32">ESP32</option>
            <option value="ESP8266">ESP8266</option>
            <option value="Gateway">Gateway</option>
          </select>
        </div>

        {/* Error de carga */}
        {loadError && (
          <div className="p-4 rounded-[20px] bg-[#DC2626]/15 border border-[#DC2626]/50 text-[#FCA5A5] text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {/* Inventario Responsive */}
        <div className="bg-deep-abyss border border-graphite-fill/50 rounded-[20px] overflow-hidden">
          {loading ? (
            <div className="p-10 flex items-center justify-center gap-3 text-slate-text text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-neon-pulse" />
              <span>Consultando dispositivos en MySQL...</span>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Cpu className="w-8 h-8 text-slate-text mx-auto" />
              <p className="text-sm text-pure-white font-medium">
                No hay dispositivos registrados con los filtros actuales.
              </p>
              {isAdmin && (
                <p className="text-xs text-slate-text">
                  Usa el botón &ldquo;Nuevo dispositivo&rdquo; para registrar el primer nodo en MySQL.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-graphite-fill/60 text-[11px] uppercase tracking-wider text-slate-text">
                    <th className="py-3.5 px-4">Dispositivo</th>
                    <th className="py-3.5 px-4">Código</th>
                    <th className="py-3.5 px-4">MAC / Tipo</th>
                    <th className="py-3.5 px-4">Ubicación</th>
                    <th className="py-3.5 px-4">Señal WiFi (RSSI)</th>
                    <th className="py-3.5 px-4">Estado / Último Ping</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-graphite-fill/40">
                  {visibleItems.map((dev) => {
                    const live = statusById.get(dev.id_dispositivo);
                    const effectiveState = live?.estado ?? dev.estado;
                    const effectiveRssi = live?.rssi_dbm ?? dev.rssi_dbm;
                    const effectivePing = live?.ultimo_ping ?? dev.ultimo_ping;
                    return (
                      <tr key={dev.id_dispositivo} className="hover:bg-obsidian-shell/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-pure-white">{dev.nombre}</div>
                          <div className="text-[11px] text-slate-text font-mono">
                            FW {dev.firmware_version || '—'} · {dev.historial_mediciones_count} lecturas
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-neon-pulse">
                          {dev.codigo || dev.id_dispositivo}
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          <div className="font-mono text-pure-white">{dev.mac_address}</div>
                          <div className="text-[11px] text-slate-text">{dev.tipo}</div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-text">{dev.ubicacion}</td>
                        <td className="py-3.5 px-4">
                          <DeviceRssiBadge
                            rssi={effectiveRssi}
                            isOffline={effectiveState === 'OFFLINE'}
                          />
                        </td>
                        <td className="py-3.5 px-4">
                          <DeviceConnectivityBadge state={effectiveState} />
                          <p
                            className="mt-1 text-[11px] text-slate-text font-mono"
                            title={`Último ping registrado: ${formatLastContact(effectivePing)}`}
                          >
                            {formatRelativeTime(effectivePing)}
                          </p>
                          {effectiveState === 'ADVERTENCIA' && (
                            <p className="text-xs text-signal-yellow">Retraso en la comunicación</p>
                          )}
                          {effectiveState === 'OFFLINE' && (
                            <p className="text-xs text-red-300">Comunicación interrumpida</p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => openDetailModal(dev)}
                              className="px-3 py-1.5 rounded-[56px] bg-obsidian-shell border border-graphite-fill text-pure-white hover:border-neon-pulse text-xs inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              {isAdmin ? 'Detalle / Editar' : 'Ver detalle'}
                            </button>
                            {isAdmin && (live?.estado ?? dev.estado) !== 'INACTIVO' && (
                              <button
                                onClick={() => setDeactivateTarget(dev)}
                                className="px-3 py-1.5 rounded-[56px] bg-[#DC2626]/15 border border-[#DC2626]/40 text-[#FCA5A5] hover:bg-[#DC2626]/25 text-xs inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <PowerOff className="w-3.5 h-3.5" />
                                Desactivar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Nuevo Dispositivo */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm">
            <div className="bg-deep-abyss border border-graphite-fill rounded-[20px] w-full max-w-lg p-6 space-y-5 text-pure-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="sauce-eyebrow text-neon-pulse">REGISTRO RF-02</p>
                  <h2 className="text-lg font-medium mt-0.5">Nuevo dispositivo IoT</h2>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-text hover:text-pure-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} noValidate className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs text-slate-text mb-1">Nombre del nodo *</label>
                  <input
                    type="text"
                    required
                    value={newNombre}
                    onChange={(e) => setNewNombre(e.target.value)}
                    placeholder="Ej. Nodo Bioterio Norte"
                    className="apple-pill-input w-full py-2.5"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-text mb-1">
                      Dirección MAC (AA:BB:CC:DD:EE:FF) *
                    </label>
                    <input
                      type="text"
                      required
                      value={newMac}
                      onChange={(e) => {
                        setNewMac(e.target.value);
                        if (createError) setCreateError('');
                      }}
                      placeholder="24:6F:28:B1:C0:04"
                      className="apple-pill-input w-full py-2.5 font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-text mb-1">Tipo de dispositivo *</label>
                    <select
                      value={newTipo}
                      onChange={(e) => setNewTipo(e.target.value as DispositivoTipo)}
                      className="apple-pill-select w-full py-2.5"
                    >
                      <option value="ESP32">ESP32</option>
                      <option value="ESP8266">ESP8266</option>
                      <option value="Gateway">Gateway</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-text mb-1">Versión de firmware *</label>
                    <input
                      type="text"
                      required
                      value={newFirmware}
                      onChange={(e) => setNewFirmware(e.target.value)}
                      placeholder="v2.4.0"
                      className="apple-pill-input w-full py-2.5 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-text mb-1">Ubicación asignada (catálogo activo) *</label>
                    <select
                      required
                      value={newUbicacion}
                      onChange={(e) => setNewUbicacion(e.target.value)}
                      className="apple-pill-select w-full py-2.5"
                    >
                      {activeUbicaciones.map((u) => (
                        <option key={u.ubicacion_id} value={u.ubicacion_id}>
                          {u.nombre} ({u.codigo_area})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="p-3 rounded-[10px] bg-obsidian-shell border border-graphite-fill text-xs text-slate-text flex items-center gap-2">
                  <Clock className="w-4 h-4 text-signal-yellow shrink-0" />
                  <span>
                    El nodo se registrará en estado <strong className="text-signal-yellow">PENDIENTE</strong> hasta confirmar conexión real con el broker MQTT.
                  </span>
                </div>

                {createError && (
                  <div
                    role="alert"
                    className="p-3 rounded-[10px] bg-[#DC2626]/15 border border-[#DC2626]/50 text-[#FCA5A5] text-xs flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-[56px] border border-graphite-fill text-slate-text hover:text-pure-white text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCreate}
                    className="sauce-btn-primary px-5 py-2 text-xs inline-flex items-center gap-2 cursor-pointer"
                  >
                    {submittingCreate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Guardar dispositivo
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Credenciales MQTT generadas una única vez */}
        {createdCreds && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm">
            <div className="bg-deep-abyss border border-neon-pulse/60 rounded-[20px] w-full max-w-lg p-6 space-y-4 text-pure-white">
              <div className="flex items-center gap-2.5">
                <Key className="w-5 h-5 text-neon-pulse" />
                <h3 className="text-lg font-medium">Credenciales MQTT generadas</h3>
              </div>
              <p className="text-xs text-signal-yellow">
                Copia y guarda la contraseña MQTT ahora: por seguridad, el servidor solo almacena su hash bcrypt y no volverá a mostrarla.
              </p>

              <div className="space-y-2.5 text-xs font-mono">
                {[
                  { k: 'codigo', label: 'Código', val: createdCreds.codigo },
                  { k: 'client', label: 'Client ID', val: createdCreds.mqtt_client_id },
                  { k: 'topic', label: 'Tópico', val: createdCreds.mqtt_topic },
                  { k: 'user', label: 'Usuario MQTT', val: createdCreds.mqtt_username },
                  { k: 'pass', label: 'Contraseña MQTT', val: createdCreds.mqtt_password },
                ].map((row) => (
                  <div
                    key={row.k}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-[10px] bg-obsidian-shell border border-graphite-fill"
                  >
                    <div className="truncate">
                      <span className="text-slate-text block text-[10px] uppercase">{row.label}</span>
                      <span className="text-pure-white">{row.val}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(row.k, row.val)}
                      className="p-1.5 rounded-[8px] bg-deep-abyss border border-graphite-fill text-neon-pulse cursor-pointer shrink-0"
                    >
                      {copiedField === row.k ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setCreatedCreds(null)}
                  className="sauce-btn-primary px-5 py-2 text-xs cursor-pointer"
                >
                  Entendido, cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Detalle y Edición */}
        {detailDevice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm">
            <div className="bg-deep-abyss border border-graphite-fill rounded-[20px] w-full max-w-xl p-6 space-y-5 text-pure-white max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <p className="sauce-eyebrow text-neon-pulse">
                    {detailDevice.codigo || detailDevice.id_dispositivo}
                  </p>
                  <h2 className="text-lg font-medium mt-0.5">Detalle del dispositivo IoT</h2>
                </div>
                <button
                  onClick={() => setDetailDevice(null)}
                  className="text-slate-text hover:text-pure-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {loadingDetail ? (
                <div className="py-8 flex items-center justify-center gap-2 text-slate-text text-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-neon-pulse" />
                  <span>Cargando detalle desde MySQL...</span>
                </div>
              ) : (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-[12px] bg-obsidian-shell border border-graphite-fill text-xs">
                    <div>
                      <span className="text-slate-text block">Estado</span>
                      <DeviceConnectivityBadge state={detailStatus?.estado ?? detailDevice.estado} />
                      <p className="mt-1 text-slate-text font-mono">
                        Último contacto: {formatRelativeTime(detailStatus?.ultimo_ping ?? detailDevice.ultimo_ping)}
                      </p>
                      <p className="text-[10px] text-slate-text/80 font-mono">
                        {formatLastContact(detailStatus?.ultimo_ping ?? detailDevice.ultimo_ping)}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-text block">Intensidad WiFi (RSSI)</span>
                      <div className="mt-1 flex items-center gap-1.5">
                        <DeviceRssiBadge
                          rssi={detailStatus?.rssi_dbm ?? detailDevice.rssi_dbm}
                          isOffline={(detailStatus?.estado ?? detailDevice.estado) === 'OFFLINE'}
                        />
                      </div>
                      {(detailStatus?.rssi_dbm ?? detailDevice.rssi_dbm) !== null &&
                        (detailStatus?.rssi_dbm ?? detailDevice.rssi_dbm) !== undefined &&
                        (detailStatus?.rssi_dbm ?? detailDevice.rssi_dbm)! < -80 && (
                          <p className="mt-1 text-signal-yellow text-[10px] font-mono">
                            Advertencia: &lt; -80 dBm (cobertura débil)
                          </p>
                        )}
                    </div>

                    <div>
                      <span className="text-slate-text block">Historial de mediciones (RN-03)</span>
                      <span className="font-mono font-medium text-neon-pulse">
                        {detailDevice.historial_mediciones_count} registros
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-text block">Silencio Transcurrido</span>
                      <span className="font-mono text-pure-white">
                        {(detailStatus?.silencio_segundos ?? detailDevice.silencio_segundos) !== null &&
                        (detailStatus?.silencio_segundos ?? detailDevice.silencio_segundos) !== undefined
                          ? `${detailStatus?.silencio_segundos ?? detailDevice.silencio_segundos} segundos`
                          : 'Sin silencio registrado'}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-slate-text block">Tópico MQTT</span>
                      <span className="font-mono text-pure-white break-all">
                        {detailDevice.mqtt_topic || '—'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-text block">Client ID MQTT</span>
                      <span className="font-mono text-pure-white break-all">
                        {detailDevice.mqtt_client_id || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-text mb-1">Nombre</label>
                      <input
                        type="text"
                        disabled={!isAdmin}
                        value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)}
                        className="apple-pill-input w-full py-2 disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-text mb-1">MAC</label>
                      <input
                        type="text"
                        disabled={!isAdmin}
                        value={editMac}
                        onChange={(e) => setEditMac(e.target.value)}
                        className="apple-pill-input w-full py-2 font-mono uppercase disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-text mb-1">Tipo</label>
                      <select
                        disabled={!isAdmin}
                        value={editTipo}
                        onChange={(e) => setEditTipo(e.target.value as DispositivoTipo)}
                        className="apple-pill-select w-full py-2 disabled:opacity-60"
                      >
                        <option value="ESP32">ESP32</option>
                        <option value="ESP8266">ESP8266</option>
                        <option value="Gateway">Gateway</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-text mb-1">Firmware</label>
                      <input
                        type="text"
                        disabled={!isAdmin}
                        value={editFirmware}
                        onChange={(e) => setEditFirmware(e.target.value)}
                        className="apple-pill-input w-full py-2 font-mono disabled:opacity-60"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-text mb-1">Ubicación asignada (catálogo activo)</label>
                      <select
                        disabled={!isAdmin || detailDevice.estado === 'INACTIVO'}
                        value={editUbicacion}
                        onChange={(e) => setEditUbicacion(e.target.value)}
                        className="apple-pill-select w-full py-2 disabled:opacity-60"
                      >
                        {activeUbicaciones.map((u) => (
                          <option key={u.ubicacion_id} value={u.ubicacion_id}>
                            {u.nombre} ({u.codigo_area})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-text mb-1">Observación técnica</label>
                      <input
                        type="text"
                        disabled={!isAdmin}
                        value={editObs}
                        onChange={(e) => setEditObs(e.target.value)}
                        className="apple-pill-input w-full py-2 disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {editError && (
                    <div className="p-3 rounded-[10px] bg-[#DC2626]/15 border border-[#DC2626]/50 text-[#FCA5A5] text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{editError}</span>
                    </div>
                  )}

                  {/* RF-03: Reasignación dedicada con confirmación Actual -> Nueva */}
                  {isAdmin && detailDevice.estado !== 'INACTIVO' && (
                    <div className="p-3.5 rounded-[12px] bg-obsidian-shell border border-graphite-fill space-y-2.5 text-xs">
                      <div className="font-medium text-pure-white">
                        Reasignar ubicación física (RF-03)
                      </div>
                      <div className="text-slate-text">
                        Ubicación actual:{' '}
                        <strong className="text-neon-pulse">
                          {detailDevice.ubicacion} ({detailDevice.codigo_area || detailDevice.ubicacion_id})
                        </strong>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          value={reassignTargetUbiId}
                          onChange={(e) => {
                            setReassignTargetUbiId(e.target.value);
                            setConfirmReassignOpen(false);
                          }}
                          className="apple-pill-select py-2 text-xs"
                        >
                          {activeUbicaciones.map((u) => (
                            <option key={u.ubicacion_id} value={u.ubicacion_id}>
                              {u.nombre} ({u.codigo_area})
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={reassignMotivo}
                          onChange={(e) => setReassignMotivo(e.target.value)}
                          placeholder="Motivo del traslado (opcional)"
                          className="apple-pill-input py-2 text-xs"
                        />
                      </div>

                      {reassignTargetUbiId &&
                        reassignTargetUbiId !== detailDevice.ubicacion_id &&
                        !confirmReassignOpen && (
                          <button
                            type="button"
                            onClick={() => setConfirmReassignOpen(true)}
                            className="px-4 py-1.5 rounded-[56px] bg-neon-pulse text-obsidian-shell font-medium cursor-pointer"
                          >
                            Cambiar ubicación
                          </button>
                        )}

                      {confirmReassignOpen && (
                        <div className="p-3 rounded-[10px] bg-signal-yellow/15 border border-signal-yellow/50 space-y-2">
                          <p className="text-signal-yellow">
                            Confirmar traslado: <strong>{detailDevice.ubicacion}</strong> →{' '}
                            <strong>
                              {activeUbicaciones.find((u) => u.ubicacion_id === reassignTargetUbiId)?.nombre}
                            </strong>
                          </p>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmReassignOpen(false)}
                              className="px-3 py-1 rounded-[56px] border border-graphite-fill text-pure-white cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={reassigning}
                              onClick={handleConfirmReassign}
                              className="sauce-btn-primary px-4 py-1 text-xs inline-flex items-center gap-1 cursor-pointer"
                            >
                              {reassigning && <Loader2 className="w-3 h-3 animate-spin" />}
                              Confirmar traslado
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* RF-03: Historial de Cambios de Ubicación */}
                  <div className="p-3.5 rounded-[12px] bg-obsidian-shell border border-graphite-fill space-y-2 text-xs">
                    <div className="font-medium text-pure-white">
                      Historial de ubicaciones ({deviceHistorial.length})
                    </div>
                    {deviceHistorial.length === 0 ? (
                      <p className="text-slate-text">Sin cambios registrados.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {deviceHistorial.map((h) => (
                          <div
                            key={h.id_historial}
                            className="p-2 rounded-[8px] bg-deep-abyss border border-graphite-fill/60 flex flex-col gap-0.5"
                          >
                            <div className="text-pure-white">
                              {h.ubicacion_anterior_nombre ? `${h.ubicacion_anterior_nombre} → ` : 'Inicial → '}
                              <span className="text-neon-pulse font-medium">
                                {h.ubicacion_nueva_nombre} ({h.ubicacion_nueva_codigo})
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-text font-mono">
                              {new Date(h.fecha_cambio).toLocaleString()} · {h.usuario_responsable_correo}
                              {h.motivo ? ` · ${h.motivo}` : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* RF-04: Sensores Asociados en MySQL */}
                  <div className="p-3.5 rounded-[12px] bg-obsidian-shell border border-graphite-fill space-y-2 text-xs">
                    <div className="font-medium text-pure-white">
                      Sensores asociados (RF-04) ({deviceSensores.length})
                    </div>
                    {deviceSensores.length === 0 ? (
                      <p className="text-slate-text">
                        No hay sensores vinculados a este dispositivo todavía.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {deviceSensores.map((s) => (
                          <div
                            key={s.id_sensor}
                            className="p-2 rounded-[8px] bg-deep-abyss border border-graphite-fill/60 flex items-center justify-between gap-2"
                          >
                            <div>
                              <div className="font-mono text-neon-pulse font-medium">
                                {s.identificador} · {s.modelo}
                              </div>
                              <div className="text-[11px] text-slate-text">
                                {s.variables_medidas.map((v) => `${v.variable} (${v.unidad})`).join(', ')}
                              </div>
                            </div>
                            <span className="font-mono text-[11px] text-pure-white">{s.estado}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {isAdmin && confirmSaveOpen && (
                    <div className="p-3.5 rounded-[12px] bg-signal-yellow/15 border border-signal-yellow/50 text-xs space-y-3">
                      <p className="text-signal-yellow font-medium">
                        ¿Confirmas guardar los cambios en MySQL para este dispositivo?
                      </p>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmSaveOpen(false)}
                          className="px-3 py-1.5 rounded-[56px] border border-graphite-fill text-pure-white cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={savingEdit}
                          onClick={handleSaveEdit}
                          className="sauce-btn-primary px-4 py-1.5 text-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          {savingEdit && <Loader2 className="w-3 h-3 animate-spin" />}
                          Confirmar guardado
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setDetailDevice(null)}
                      className="px-4 py-2 rounded-[56px] border border-graphite-fill text-slate-text hover:text-pure-white text-xs cursor-pointer"
                    >
                      Cerrar
                    </button>
                    {isAdmin && !confirmSaveOpen && (
                      <button
                        type="button"
                        onClick={() => setConfirmSaveOpen(true)}
                        className="sauce-btn-primary px-5 py-2 text-xs cursor-pointer"
                      >
                        Guardar cambios
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal: Confirmación de Desactivación Lógica (RN-03) */}
        {deactivateTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm">
            <div className="bg-deep-abyss border border-[#DC2626]/50 rounded-[20px] w-full max-w-md p-6 space-y-4 text-pure-white">
              <div className="flex items-center gap-2.5 text-[#FCA5A5]">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-lg font-medium">Desactivar dispositivo (RN-03)</h3>
              </div>
              <p className="text-xs text-slate-text leading-relaxed">
                El dispositivo <strong className="text-pure-white">{deactivateTarget.nombre}</strong> ({deactivateTarget.mac_address}) pasará a estado <strong className="text-pure-white">INACTIVO</strong>. No se eliminará físicamente y conservará sus{' '}
                <strong className="text-neon-pulse">{deactivateTarget.historial_mediciones_count}</strong> mediciones y relaciones históricas.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeactivateTarget(null)}
                  className="px-4 py-2 rounded-[56px] border border-graphite-fill text-slate-text hover:text-pure-white text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={deactivating}
                  onClick={handleConfirmDeactivate}
                  className="px-5 py-2 rounded-[56px] bg-[#DC2626] text-pure-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {deactivating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirmar desactivación
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);
