import React, { useState, useEffect, useCallback } from 'react';
import {
  Thermometer,
  Plus,
  Search,
  RefreshCw,
  Edit3,
  Sliders,
  AlertCircle,
  Loader2,
  X,
  ShieldAlert,
  ToggleRight,
  History,
} from 'lucide-react';
import { UserRole } from '../../types/iot';
import { useDebounce } from '../../hooks/useDebounce';
import { DispositivoDTO, fetchDispositivos } from '../../services/deviceService';
import {
  areSensorDatesCoherent,
  changeSensorEstado,
  createSensor,
  fetchSensorConfigHistory,
  fetchSensores,
  fetchSensorVariables,
  fetchThresholdConfig,
  fetchThresholdHistory,
  MODEL_CAPABILITIES,
  MODEL_TEMP_RANGES,
  saveThresholdConfig,
  SensorConfigHistoryItemDTO,
  SensorConfiguracionDTO,
  SensorDTO,
  SensorEstado,
  SensorModelo,
  SensorVariablesConfigDTO,
  ThresholdFormValues,
  ThresholdHistoryItemDTO,
  updateSensor,
  updateSensorVariables,
  validateThresholdsClient,
  validateSensorVariablesSelection,
  VariableNombre,
} from '../../services/sensorService';

interface SensorManagementViewProps {
  currentUserRole: UserRole;
  onNotify?: (msg: string, type?: 'success' | 'alert') => void;
}

const ESTADO_STYLE: Record<SensorEstado, string> = {
  ACTIVO: 'bg-neon-pulse/20 text-neon-pulse border border-neon-pulse/50',
  FALLA: 'bg-[#DC2626]/20 text-[#FCA5A5] border border-[#DC2626]/50',
  CALIBRACION: 'bg-signal-yellow/20 text-signal-yellow border border-signal-yellow/50',
  INACTIVO: 'bg-graphite-fill/40 text-slate-text border border-graphite-fill',
};

export const SensorManagementView: React.FC<SensorManagementViewProps> = ({
  currentUserRole,
  onNotify,
}) => {
  const isAdmin = currentUserRole === 'admin';

  const [items, setItems] = useState<SensorDTO[]>([]);
  const [devices, setDevices] = useState<DispositivoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtros
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 280);
  const [modeloFilter, setModeloFilter] = useState('ALL');
  const [estadoFilter, setEstadoFilter] = useState('ALL');

  // Modal Crear / Editar
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SensorDTO | null>(null);
  const [dispositivoId, setDispositivoId] = useState('');
  const [identificador, setIdentificador] = useState('');
  const [modelo, setModelo] = useState<SensorModelo>('DHT22');
  const [variables, setVariables] = useState<VariableNombre[]>(['temperatura', 'humedad']);
  const [fechaInstalacion, setFechaInstalacion] = useState('2026-01-15');
  const [ultimaCalibracion, setUltimaCalibracion] = useState('2026-01-15');
  const [estadoInicial, setEstadoInicial] = useState<SensorEstado>('ACTIVO');
  const [descripcion, setDescripcion] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal Cambio de Estado (RN-05)
  const [estadoTarget, setEstadoTarget] = useState<SensorDTO | null>(null);
  const [nuevoEstado, setNuevoEstado] = useState<SensorEstado>('ACTIVO');
  const [changingEstado, setChangingEstado] = useState(false);

  // Modal RF-12: Configuración de Límites y Umbrales Ambientales
  const [cfgModalSensor, setCfgModalSensor] = useState<SensorDTO | null>(null);
  const [cfgData, setCfgData] = useState<SensorConfiguracionDTO | null>(null);
  const [cfgHistory, setCfgHistory] = useState<ThresholdHistoryItemDTO[]>([]);
  const [loadingCfg, setLoadingCfg] = useState(false);
  const [savingCfg, setSavingCfg] = useState(false);
  const [cfgError, setCfgError] = useState('');
  const [cfgConflict, setCfgConflict] = useState(false);
  const [cfgSuccess, setCfgSuccess] = useState('');
  const [showCfgHistory, setShowCfgHistory] = useState(false);
  const [cfgUbicacionId, setCfgUbicacionId] = useState('');
  const [cfgDispositivoId, setCfgDispositivoId] = useState('');
  const [cfgForm, setCfgForm] = useState<ThresholdFormValues>({
    temp_min: '',
    temp_max: '',
    temp_critico_min: '',
    temp_critico_max: '',
    hum_min: '',
    hum_max: '',
    hum_critico_min: '',
    hum_critico_max: '',
    presion_min: '',
    presion_max: '',
    motivo: '',
  });

  // Modal RF-05: Configuración de Variables Monitoreadas
  const [varsModalSensor, setVarsModalSensor] = useState<SensorDTO | null>(null);
  const [varsConfig, setVarsConfig] = useState<SensorVariablesConfigDTO | null>(null);
  const [varsHistory, setVarsHistory] = useState<SensorConfigHistoryItemDTO[]>([]);
  const [loadingVars, setLoadingVars] = useState(false);
  const [savingVars, setSavingVars] = useState(false);
  const [varsError, setVarsError] = useState('');
  const [varsSuccess, setVarsSuccess] = useState('');
  const [tempEnabled, setTempEnabled] = useState(true);
  const [humEnabled, setHumEnabled] = useState(true);
  const [presEnabled, setPresEnabled] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [senRes, devRes] = await Promise.all([
        fetchSensores({
          modelo: modeloFilter,
          estado: estadoFilter,
          search: debouncedSearch,
        }),
        fetchDispositivos(),
      ]);
      setItems(senRes.items);
      const activeDevs = devRes.items.filter((d) => d.estado !== 'INACTIVO');
      setDevices(activeDevs);
      if (activeDevs.length > 0 && !dispositivoId) {
        setDispositivoId(activeDevs[0].id_dispositivo);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al cargar sensores desde MySQL.');
    } finally {
      setLoading(false);
    }
  }, [modeloFilter, estadoFilter, debouncedSearch, dispositivoId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleModeloChange = (nextModelo: SensorModelo) => {
    setModelo(nextModelo);
    const allowed = MODEL_CAPABILITIES[nextModelo].map((v) => v.variable);
    const filtered = variables.filter((v) => allowed.includes(v));
    setVariables(filtered.length > 0 ? filtered : allowed);
  };

  const toggleVariable = (v: VariableNombre) => {
    setVariables((prev) =>
      prev.includes(v) ? prev.filter((item) => item !== v) : [...prev, v]
    );
  };

  const openCreate = () => {
    setEditing(null);
    setIdentificador('');
    setModelo('DHT22');
    setVariables(['temperatura', 'humedad']);
    const today = new Date().toISOString().slice(0, 10);
    setFechaInstalacion(today);
    setUltimaCalibracion(today);
    setEstadoInicial('ACTIVO');
    setDescripcion('');
    setFormError('');
    if (devices.length > 0) setDispositivoId(devices[0].id_dispositivo);
    setFormOpen(true);
  };

  const openEdit = (s: SensorDTO) => {
    setEditing(s);
    setDispositivoId(s.dispositivo_id);
    setIdentificador(s.identificador);
    setModelo(s.modelo);
    setVariables(s.variables_medidas.map((v) => v.variable));
    setFechaInstalacion(s.fecha_instalacion.slice(0, 10));
    setUltimaCalibracion(s.ultima_calibracion.slice(0, 10));
    setDescripcion(s.descripcion || '');
    setFormError('');
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!editing && !dispositivoId) {
      setFormError('Debes seleccionar un dispositivo padre activo.');
      return;
    }
    if (!identificador.trim() || identificador.trim().length < 2) {
      setFormError('El identificador único del sensor es obligatorio.');
      return;
    }
    if (variables.length === 0) {
      setFormError('Selecciona al menos una variable permitida para el modelo.');
      return;
    }
    if (!areSensorDatesCoherent(fechaInstalacion, ultimaCalibracion)) {
      setFormError('La fecha de última calibración no puede ser anterior a la fecha de instalación.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const res = await updateSensor(editing.id_sensor, {
          identificador: identificador.trim(),
          modelo,
          variables,
          fecha_instalacion: fechaInstalacion,
          ultima_calibracion: ultimaCalibracion,
          descripcion: descripcion.trim() || undefined,
        });
        onNotify?.(res.message, 'success');
      } else {
        const res = await createSensor({
          dispositivo_id: dispositivoId,
          identificador: identificador.trim(),
          modelo,
          variables,
          fecha_instalacion: fechaInstalacion,
          ultima_calibracion: ultimaCalibracion,
          estado: estadoInicial,
          descripcion: descripcion.trim() || undefined,
        });
        onNotify?.(res.message, 'success');
      }
      setFormOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo guardar el sensor.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmEstado = async () => {
    if (!estadoTarget) return;
    setChangingEstado(true);
    try {
      const res = await changeSensorEstado(estadoTarget.id_sensor, nuevoEstado);
      setEstadoTarget(null);
      onNotify?.(res.message, 'success');
      await loadData();
    } catch (err: any) {
      onNotify?.(err?.message || 'No fue posible cambiar el estado.', 'alert');
    } finally {
      setChangingEstado(false);
    }
  };

  const populateThresholdForm = (cfg: SensorConfiguracionDTO | null) => {
    setCfgForm({
      temp_min: cfg?.temp_min !== null && cfg?.temp_min !== undefined ? String(cfg.temp_min) : '',
      temp_max: cfg?.temp_max !== null && cfg?.temp_max !== undefined ? String(cfg.temp_max) : '',
      temp_critico_min:
        cfg?.temp_critico_min !== null && cfg?.temp_critico_min !== undefined
          ? String(cfg.temp_critico_min)
          : '',
      temp_critico_max:
        cfg?.temp_critico_max !== null && cfg?.temp_critico_max !== undefined
          ? String(cfg.temp_critico_max)
          : '',
      hum_min: cfg?.hum_min !== null && cfg?.hum_min !== undefined ? String(cfg.hum_min) : '',
      hum_max: cfg?.hum_max !== null && cfg?.hum_max !== undefined ? String(cfg.hum_max) : '',
      hum_critico_min:
        cfg?.hum_critico_min !== null && cfg?.hum_critico_min !== undefined
          ? String(cfg.hum_critico_min)
          : '',
      hum_critico_max:
        cfg?.hum_critico_max !== null && cfg?.hum_critico_max !== undefined
          ? String(cfg.hum_critico_max)
          : '',
      presion_min: cfg?.presion_min !== null && cfg?.presion_min !== undefined ? String(cfg.presion_min) : '',
      presion_max: cfg?.presion_max !== null && cfg?.presion_max !== undefined ? String(cfg.presion_max) : '',
      motivo: '',
    });
  };

  const loadThresholdForSensor = async (s: SensorDTO) => {
    setCfgModalSensor(s);
    setCfgUbicacionId(s.ubicacion_id || '');
    setCfgDispositivoId(s.dispositivo_id || '');
    setCfgError('');
    setCfgConflict(false);
    setCfgSuccess('');
    setLoadingCfg(true);
    try {
      const [res, histRes] = await Promise.all([
        fetchThresholdConfig(s.id_sensor),
        fetchThresholdHistory(s.id_sensor),
      ]);
      setCfgData(res.configuracion);
      setCfgHistory(histRes.historial || []);
      populateThresholdForm(res.configuracion);
    } catch (err: any) {
      setCfgError(err?.message || 'Error al consultar configuración de umbrales.');
      onNotify?.(err?.message || 'Error al consultar configuración.', 'alert');
    } finally {
      setLoadingCfg(false);
    }
  };

  const openConfigModal = async (s: SensorDTO) => {
    setShowCfgHistory(false);
    await loadThresholdForSensor(s);
  };

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfgModalSensor || !isAdmin) return;
    setCfgError('');
    setCfgConflict(false);
    setCfgSuccess('');

    const measuredVars: VariableNombre[] = cfgModalSensor.variables_medidas.map((v) => v.variable);
    const validation = validateThresholdsClient(cfgModalSensor.modelo, measuredVars, cfgForm);
    if (!validation.valid) {
      setCfgError(validation.error);
      return;
    }

    setSavingCfg(true);
    try {
      const res = await saveThresholdConfig(cfgModalSensor.id_sensor, {
        ...validation.payload,
        expected_version: cfgData?.version ?? null,
      });
      setCfgData(res.configuracion);
      populateThresholdForm(res.configuracion);
      const histRes = await fetchThresholdHistory(cfgModalSensor.id_sensor);
      setCfgHistory(histRes.historial || []);
      setCfgSuccess(res.message || 'Umbrales ambientales guardados y aplicados inmediatamente.');
      onNotify?.('Umbrales ambientales actualizados en MySQL y motor de reglas.', 'success');
      window.dispatchEvent(
        new CustomEvent('simoa:thresholds-updated', {
          detail: { sensor_id: cfgModalSensor.id_sensor, ubicacion_id: cfgModalSensor.ubicacion_id },
        })
      );
    } catch (err: any) {
      if (err?.status === 409) {
        setCfgConflict(true);
      }
      setCfgError(err?.message || 'Error al guardar los umbrales ambientales.');
    } finally {
      setSavingCfg(false);
    }
  };

  const openVariablesModal = async (s: SensorDTO) => {
    setVarsModalSensor(s);
    setVarsError('');
    setVarsSuccess('');
    setLoadingVars(true);
    try {
      const [cfgRes, histRes] = await Promise.all([
        fetchSensorVariables(s.id_sensor),
        fetchSensorConfigHistory(s.id_sensor),
      ]);
      const cfg = cfgRes.configuracion;
      setVarsConfig(cfg);
      setTempEnabled(cfg.temperatura_habilitada);
      setHumEnabled(cfg.humedad_habilitada);
      setPresEnabled(cfg.presion_habilitada);
      setVarsHistory(histRes.items);
    } catch (err: any) {
      setVarsError(err?.message || 'Error al consultar las variables del sensor.');
    } finally {
      setLoadingVars(false);
    }
  };

  const handleSaveVariables = async () => {
    if (!varsModalSensor || !varsConfig) return;
    setVarsError('');
    setVarsSuccess('');

    const validationError = validateSensorVariablesSelection(
      varsConfig.modelo,
      tempEnabled,
      humEnabled,
      presEnabled
    );
    if (validationError) {
      setVarsError(validationError);
      return;
    }

    setSavingVars(true);
    try {
      const supportsPres = varsConfig.variables_disponibles.some((v) => v.variable === 'presion');
      const res = await updateSensorVariables(varsModalSensor.id_sensor, {
        temperatura_habilitada: tempEnabled,
        humedad_habilitada: humEnabled,
        presion_habilitada: supportsPres ? presEnabled : false,
        unidad_temperatura: '°C',
        unidad_humedad: '%RH',
        unidad_presion: supportsPres ? 'hPa' : null,
      });
      setVarsConfig(res.configuracion);
      setVarsSuccess(res.message);
      const histRes = await fetchSensorConfigHistory(varsModalSensor.id_sensor);
      setVarsHistory(histRes.items);
      onNotify?.(res.message, 'success');
      await loadData();
    } catch (err: any) {
      setVarsError(err?.message || 'No fue posible guardar la configuración de variables.');
    } finally {
      setSavingVars(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="sauce-eyebrow text-neon-pulse">RF-04 · INSTRUMENTACIÓN MYSQL</p>
          <h1 className="text-2xl font-medium text-pure-white mt-1">
            Registro y Vinculación de Sensores Ambientales
          </h1>
          <p className="text-sm text-slate-text mt-0.5">
            Gestiona sondas DHT22, BME280 y SHT31 vinculadas a dispositivos activos y sus límites iniciales.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={loadData}
            className="px-4 py-2.5 rounded-[56px] bg-deep-abyss border border-graphite-fill text-pure-white hover:border-neon-pulse text-xs font-medium inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>

          {items.length > 0 && (
            <button
              onClick={() => openConfigModal(items[0])}
              className="px-4 py-2.5 rounded-[56px] bg-deep-abyss border border-neon-pulse/60 text-neon-pulse hover:bg-neon-pulse/10 text-xs font-medium inline-flex items-center gap-2 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              Configurar Umbrales (RF-12)
            </button>
          )}

          {isAdmin && (
            <button
              onClick={openCreate}
              className="sauce-btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nuevo sensor
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-deep-abyss border border-graphite-fill/50 rounded-[20px] p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-text" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por identificador, modelo o dispositivo..."
            className="apple-pill-input w-full pl-10 pr-4 py-2 text-sm"
          />
        </div>

        <select
          value={modeloFilter}
          onChange={(e) => setModeloFilter(e.target.value)}
          className="apple-pill-select py-2 text-sm"
          aria-label="Filtrar por modelo"
        >
          <option value="ALL">Todos los modelos</option>
          <option value="DHT22">DHT22</option>
          <option value="BME280">BME280</option>
          <option value="SHT31">SHT31</option>
        </select>

        <select
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value)}
          className="apple-pill-select py-2 text-sm"
          aria-label="Filtrar por estado"
        >
          <option value="ALL">Todos los estados</option>
          <option value="ACTIVO">ACTIVO</option>
          <option value="FALLA">FALLA</option>
          <option value="CALIBRACION">CALIBRACION</option>
          <option value="INACTIVO">INACTIVO</option>
        </select>
      </div>

      {error && (
        <div className="p-4 rounded-[20px] bg-[#DC2626]/15 border border-[#DC2626]/50 text-[#FCA5A5] text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabla de Sensores */}
      <div className="bg-deep-abyss border border-graphite-fill/50 rounded-[20px] overflow-hidden">
        {loading ? (
          <div className="p-10 flex items-center justify-center gap-3 text-slate-text text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-neon-pulse" />
            <span>Consultando sensores en MySQL...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Thermometer className="w-8 h-8 text-slate-text mx-auto" />
            <p className="text-sm text-pure-white font-medium">
              No hay sensores ambientales registrados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-graphite-fill/60 text-[11px] uppercase tracking-wider text-slate-text">
                  <th className="py-3.5 px-4">Identificador</th>
                  <th className="py-3.5 px-4">Modelo</th>
                  <th className="py-3.5 px-4">Dispositivo asociado</th>
                  <th className="py-3.5 px-4">Variables</th>
                  <th className="py-3.5 px-4">Instalación / Calibración</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-fill/40">
                {items.map((s) => (
                  <tr key={s.id_sensor} className="hover:bg-obsidian-shell/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-xs text-neon-pulse font-medium">{s.identificador}</div>
                      {s.descripcion && (
                        <div className="text-[11px] text-slate-text truncate max-w-[180px]">{s.descripcion}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-pure-white font-medium">{s.modelo}</td>
                    <td className="py-3.5 px-4 text-xs">
                      <div className="text-pure-white">{s.dispositivo_nombre}</div>
                      <div className="text-[11px] text-slate-text">
                        {s.dispositivo_codigo} · {s.ubicacion_nombre}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <div className="flex flex-wrap gap-1">
                        {s.variables_medidas.map((v) => (
                          <span
                            key={v.variable}
                            className="px-2 py-0.5 rounded-[56px] bg-obsidian-shell border border-graphite-fill text-[11px] text-pure-white font-mono"
                          >
                            {v.variable} ({v.unidad})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[11px] font-mono text-slate-text">
                      <div>Inst: {s.fecha_instalacion.slice(0, 10)}</div>
                      <div>Cal: {s.ultima_calibracion.slice(0, 10)}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-[56px] text-[11px] font-mono font-medium ${ESTADO_STYLE[s.estado]}`}>
                        {s.estado}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openVariablesModal(s)}
                          className="px-3 py-1.5 rounded-[56px] bg-neon-pulse/15 border border-neon-pulse/40 text-neon-pulse hover:bg-neon-pulse/25 text-xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <ToggleRight className="w-3 h-3" />
                          Variables
                        </button>
                        <button
                          onClick={() => openConfigModal(s)}
                          className="px-3 py-1.5 rounded-[56px] bg-obsidian-shell border border-graphite-fill text-pure-white hover:border-neon-pulse text-xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Sliders className="w-3 h-3" />
                          Límites
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => openEdit(s)}
                              className="px-3 py-1.5 rounded-[56px] bg-obsidian-shell border border-graphite-fill text-pure-white hover:border-neon-pulse text-xs inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              Editar
                            </button>
                            <button
                              onClick={() => {
                                setEstadoTarget(s);
                                setNuevoEstado(s.estado);
                              }}
                              className="px-3 py-1.5 rounded-[56px] bg-signal-yellow/15 border border-signal-yellow/40 text-signal-yellow text-xs cursor-pointer"
                            >
                              Estado
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Crear / Editar Sensor */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm">
          <div className="bg-deep-abyss border border-graphite-fill rounded-[20px] w-full max-w-lg p-6 space-y-4 text-pure-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">
                {editing ? 'Editar sensor ambiental' : 'Registrar y vincular sensor (RF-04)'}
              </h2>
              <button onClick={() => setFormOpen(false)} className="text-slate-text hover:text-pure-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-3 text-sm">
              {!editing && (
                <div>
                  <label className="block text-xs text-slate-text mb-1">Dispositivo IoT padre (activo) *</label>
                  <select
                    required
                    value={dispositivoId}
                    onChange={(e) => setDispositivoId(e.target.value)}
                    className="apple-pill-select w-full py-2"
                  >
                    {devices.map((d) => (
                      <option key={d.id_dispositivo} value={d.id_dispositivo}>
                        {d.nombre} ({d.codigo}) · {d.ubicacion}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-text mb-1">Identificador único *</label>
                  <input
                    type="text"
                    required
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    placeholder="SEN-LAB-DHT22-01"
                    className="apple-pill-input w-full py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-text mb-1">Modelo *</label>
                  <select
                    value={modelo}
                    onChange={(e) => handleModeloChange(e.target.value as SensorModelo)}
                    className="apple-pill-select w-full py-2"
                  >
                    <option value="DHT22">DHT22</option>
                    <option value="BME280">BME280</option>
                    <option value="SHT31">SHT31</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-text mb-1.5">
                  Variables permitidas para {modelo} *
                </label>
                <div className="flex flex-wrap gap-2">
                  {MODEL_CAPABILITIES[modelo].map((cap) => {
                    const checked = variables.includes(cap.variable);
                    return (
                      <label
                        key={cap.variable}
                        className={`px-3 py-1.5 rounded-[56px] border text-xs inline-flex items-center gap-2 cursor-pointer ${
                          checked
                            ? 'bg-neon-pulse/20 border-neon-pulse text-neon-pulse'
                            : 'bg-obsidian-shell border-graphite-fill text-slate-text'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleVariable(cap.variable)}
                          className="accent-neon-pulse"
                        />
                        <span>
                          {cap.variable} ({cap.unidad})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-text mb-1">Fecha de instalación *</label>
                  <input
                    type="date"
                    required
                    value={fechaInstalacion}
                    onChange={(e) => setFechaInstalacion(e.target.value)}
                    className="apple-pill-input w-full py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-text mb-1">Última calibración *</label>
                  <input
                    type="date"
                    required
                    value={ultimaCalibracion}
                    onChange={(e) => setUltimaCalibracion(e.target.value)}
                    className="apple-pill-input w-full py-2"
                  />
                </div>
              </div>

              {!editing && (
                <div>
                  <label className="block text-xs text-slate-text mb-1">Estado operativo inicial</label>
                  <select
                    value={estadoInicial}
                    onChange={(e) => setEstadoInicial(e.target.value as SensorEstado)}
                    className="apple-pill-select w-full py-2"
                  >
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="CALIBRACION">CALIBRACION</option>
                    <option value="FALLA">FALLA</option>
                    <option value="INACTIVO">INACTIVO</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-text mb-1">Descripción (opcional)</label>
                <input
                  type="text"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Sonda ubicada en cámara principal"
                  className="apple-pill-input w-full py-2"
                />
              </div>

              {formError && (
                <div className="p-3 rounded-[10px] bg-[#DC2626]/15 border border-[#DC2626]/50 text-[#FCA5A5] text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 rounded-[56px] border border-graphite-fill text-slate-text hover:text-pure-white text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="sauce-btn-primary px-5 py-2 text-xs inline-flex items-center gap-2 cursor-pointer"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Guardar sensor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cambio de Estado (RN-05) */}
      {estadoTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm">
          <div className="bg-deep-abyss border border-signal-yellow/50 rounded-[20px] w-full max-w-md p-6 space-y-4 text-pure-white">
            <div className="flex items-center gap-2 text-signal-yellow">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="text-lg font-medium">Cambiar estado operativo (RN-05)</h3>
            </div>
            <p className="text-xs text-slate-text">
              Sensor: <strong className="text-pure-white font-mono">{estadoTarget.identificador}</strong>
            </p>
            <select
              value={nuevoEstado}
              onChange={(e) => setNuevoEstado(e.target.value as SensorEstado)}
              className="apple-pill-select w-full py-2 text-sm"
            >
              <option value="ACTIVO">ACTIVO (habilitado para alertas y monitoreo)</option>
              <option value="FALLA">FALLA (sin alertas de producción)</option>
              <option value="CALIBRACION">CALIBRACION (sin alertas de producción)</option>
              <option value="INACTIVO">INACTIVO (deshabilitado)</option>
            </select>
            {(nuevoEstado === 'FALLA' || nuevoEstado === 'CALIBRACION') && (
              <p className="text-xs text-signal-yellow bg-signal-yellow/10 p-3 rounded-[10px]">
                Regla RN-05: mientras permanezca en {nuevoEstado}, las mediciones conservarán su trazabilidad pero no dispararán alertas de producción ni se eliminarán mediciones previas.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEstadoTarget(null)}
                className="px-4 py-2 rounded-[56px] border border-graphite-fill text-slate-text text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={changingEstado}
                onClick={handleConfirmEstado}
                className="sauce-btn-primary px-5 py-2 text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                {changingEstado && <Loader2 className="w-3 h-3 animate-spin" />}
                Confirmar estado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal RF-12: Configuración de Límites y Umbrales Ambientales */}
      {cfgModalSensor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm">
          <div className="bg-deep-abyss border border-graphite-fill rounded-[20px] w-full max-w-2xl p-6 space-y-4 text-pure-white max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <p className="sauce-eyebrow text-neon-pulse">
                  RF-12 · LÍMITES Y UMBRALES AMBIENTALES · {cfgModalSensor.modelo}
                </p>
                <h3 className="text-lg font-medium">
                  Configuración de umbrales ({cfgModalSensor.identificador})
                </h3>
              </div>
              <button
                onClick={() => setCfgModalSensor(null)}
                className="text-slate-text hover:text-pure-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selector en cascada Ubicación -> Dispositivo -> Sensor */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-obsidian-shell border border-graphite-fill rounded-[12px] p-3">
              <div>
                <label className="block text-[11px] text-slate-text mb-1">Ubicación</label>
                <select
                  aria-label="Seleccionar ubicación RF-12"
                  value={cfgUbicacionId}
                  onChange={(e) => {
                    const uid = e.target.value;
                    setCfgUbicacionId(uid);
                    const matchingSensors = items.filter((x) => !uid || x.ubicacion_id === uid);
                    if (matchingSensors.length > 0) {
                      void loadThresholdForSensor(matchingSensors[0]);
                    }
                  }}
                  className="w-full px-2.5 py-1.5 rounded-[8px] bg-deep-abyss border border-graphite-fill text-xs text-pure-white"
                >
                  <option value="">Todas las ubicaciones</option>
                  {Array.from(
                    new Map<string, string>(
                      items
                        .filter((s): s is SensorDTO & { ubicacion_id: string } => Boolean(s.ubicacion_id))
                        .map((s) => [s.ubicacion_id, s.ubicacion_nombre || s.ubicacion_id])
                    ).entries()
                  ).map(([uid, uname]) => (
                    <option key={uid} value={uid}>
                      {uname}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-text mb-1">Dispositivo</label>
                <select
                  aria-label="Seleccionar dispositivo RF-12"
                  value={cfgDispositivoId}
                  onChange={(e) => {
                    const did = e.target.value;
                    setCfgDispositivoId(did);
                    const matching = items.filter(
                      (x) => (!cfgUbicacionId || x.ubicacion_id === cfgUbicacionId) && (!did || x.dispositivo_id === did)
                    );
                    if (matching.length > 0) {
                      void loadThresholdForSensor(matching[0]);
                    }
                  }}
                  className="w-full px-2.5 py-1.5 rounded-[8px] bg-deep-abyss border border-graphite-fill text-xs text-pure-white"
                >
                  {Array.from(
                    new Map<string, string>(
                      items
                        .filter((s) => !cfgUbicacionId || s.ubicacion_id === cfgUbicacionId)
                        .map((s) => [s.dispositivo_id, s.dispositivo_nombre || s.dispositivo_id])
                    ).entries()
                  ).map(([did, dname]) => (
                    <option key={did} value={did}>
                      {dname}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-text mb-1">Sensor</label>
                <select
                  aria-label="Seleccionar sensor RF-12"
                  value={cfgModalSensor.id_sensor}
                  onChange={(e) => {
                    const target = items.find((x) => x.id_sensor === e.target.value);
                    if (target) {
                      void loadThresholdForSensor(target);
                    }
                  }}
                  className="w-full px-2.5 py-1.5 rounded-[8px] bg-deep-abyss border border-graphite-fill text-xs text-pure-white"
                >
                  {items
                    .filter(
                      (s) =>
                        (!cfgUbicacionId || s.ubicacion_id === cfgUbicacionId) &&
                        (!cfgDispositivoId || s.dispositivo_id === cfgDispositivoId)
                    )
                    .map((s) => (
                      <option key={s.id_sensor} value={s.id_sensor}>
                        {s.identificador} ({s.modelo})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {loadingCfg ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-neon-pulse" />
              </div>
            ) : (
              <form onSubmit={handleSaveThresholds} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-obsidian-shell border border-graphite-fill rounded-[10px] px-3 py-2">
                  <div>
                    <span className="text-slate-text">Precedencia:</span>{' '}
                    <span className="font-mono text-neon-pulse">Sensor</span> ·{' '}
                    <span className="text-slate-text">Versión:</span>{' '}
                    <span className="font-mono text-pure-white">{cfgData?.version ?? 'Sin configurar'}</span>
                  </div>
                  {cfgData?.actualizado_por && (
                    <div className="text-slate-text">
                      Actualizado por <span className="text-pure-white">{cfgData.actualizado_por}</span>
                    </div>
                  )}
                </div>

                {!cfgData && (
                  <p className="text-xs text-signal-yellow bg-signal-yellow/10 p-2.5 rounded-[10px]">
                    Este sensor aún no tiene umbrales registrados. Ingresa los límites reales sin valores ficticios.
                  </p>
                )}

                {cfgError && (
                  <div className="p-3 rounded-[10px] bg-crimson-danger/15 border border-crimson-danger/40 text-xs text-crimson-danger flex items-center justify-between gap-2">
                    <span>{cfgError}</span>
                    {cfgConflict && (
                      <button
                        type="button"
                        onClick={() => void loadThresholdForSensor(cfgModalSensor)}
                        className="px-2.5 py-1 rounded-[8px] bg-crimson-danger text-pure-white font-medium cursor-pointer shrink-0"
                      >
                        Recargar vigente
                      </button>
                    )}
                  </div>
                )}

                {cfgSuccess && (
                  <div className="p-3 rounded-[10px] bg-emerald-ok/15 border border-emerald-ok/40 text-xs text-emerald-ok">
                    {cfgSuccess}
                  </div>
                )}

                {/* Temperatura */}
                {cfgModalSensor.variables_medidas.some((v) => v.variable === 'temperatura') && (
                  <div className="p-3.5 rounded-[14px] bg-obsidian-shell border border-graphite-fill space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-pure-white">Temperatura (°C)</span>
                      <span className="text-[11px] font-mono text-slate-text">
                        Rango {cfgModalSensor.modelo}:{' '}
                        {MODEL_TEMP_RANGES[cfgModalSensor.modelo]?.min ?? -40} °C a{' '}
                        {MODEL_TEMP_RANGES[cfgModalSensor.modelo]?.max ?? 85} °C
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-slate-text mb-1">Crítico inferior</label>
                        <input
                          type="number"
                          step="0.01"
                          disabled={!isAdmin}
                          value={cfgForm.temp_critico_min}
                          onChange={(e) => setCfgForm((f) => ({ ...f, temp_critico_min: e.target.value }))}
                          placeholder="Ej. 12.0"
                          className="w-full px-2.5 py-1.5 rounded-[8px] bg-deep-abyss border border-graphite-fill text-xs text-pure-white disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-text mb-1">Mín. operacional</label>
                        <input
                          type="number"
                          step="0.01"
                          disabled={!isAdmin}
                          value={cfgForm.temp_min}
                          onChange={(e) => setCfgForm((f) => ({ ...f, temp_min: e.target.value }))}
                          placeholder="Ej. 18.0"
                          className="w-full px-2.5 py-1.5 rounded-[8px] bg-deep-abyss border border-graphite-fill text-xs text-pure-white disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-text mb-1">Máx. operacional</label>
                        <input
                          type="number"
                          step="0.01"
                          disabled={!isAdmin}
                          value={cfgForm.temp_max}
                          onChange={(e) => setCfgForm((f) => ({ ...f, temp_max: e.target.value }))}
                          placeholder="Ej. 25.0"
                          className="w-full px-2.5 py-1.5 rounded-[8px] bg-deep-abyss border border-graphite-fill text-xs text-pure-white disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-text mb-1">Crítico superior</label>
                        <input
                          type="number"
                          step="0.01"
                          disabled={!isAdmin}
                          value={cfgForm.temp_critico_max}
                          onChange={(e) => setCfgForm((f) => ({ ...f, temp_critico_max: e.target.value }))}
                          placeholder="Ej. 30.0"
                          className="w-full px-2.5 py-1.5 rounded-[8px] bg-deep-abyss border border-graphite-fill text-xs text-pure-white disabled:opacity-60"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Humedad relativa */}
                {cfgModalSensor.variables_medidas.some((v) => v.variable === 'humedad') && (
                  <div className="p-3.5 rounded-[14px] bg-obsidian-shell border border-graphite-fill space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-pure-white">Humedad relativa (%RH)</span>
                      <span className="text-[11px] font-mono text-slate-text">Rango físico: 0 % a 100 %</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-slate-text mb-1">Crítico inferior</label>
                        <input
                          type="number"
                          step="0.01"
                          disabled={!isAdmin}
                          value={cfgForm.hum_critico_min}
                          onChange={(e) => setCfgForm((f) => ({ ...f, hum_critico_min: e.target.value }))}
                          placeholder="Ej. 25.0"
                          className="w-full px-2.5 py-1.5 rounded-[8px] bg-deep-abyss border border-graphite-fill text-xs text-pure-white disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-text mb-1">Mín. operacional</label>
                        <input
                          type="number"
                          step="0.01"
                          disabled={!isAdmin}
                          value={cfgForm.hum_min}
                          onChange={(e) => setCfgForm((f) => ({ ...f, hum_min: e.target.value }))}
                          placeholder="Ej. 40.0"
                          className="w-full px-2.5 py-1.5 rounded-[8px] bg-deep-abyss border border-graphite-fill text-xs text-pure-white disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-text mb-1">Máx. operacional</label>
                        <input
                          type="number"
                          step="0.01"
                          disabled={!isAdmin}
                          value={cfgForm.hum_max}
                          onChange={(e) => setCfgForm((f) => ({ ...f, hum_max: e.target.value }))}
                          placeholder="Ej. 70.0"
                          className="w-full px-2.5 py-1.5 rounded-[8px] bg-deep-abyss border border-graphite-fill text-xs text-pure-white disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-text mb-1">Crítico superior</label>
                        <input
                          type="number"
                          step="0.01"
                          disabled={!isAdmin}
                          value={cfgForm.hum_critico_max}
                          onChange={(e) => setCfgForm((f) => ({ ...f, hum_critico_max: e.target.value }))}
                          placeholder="Ej. 85.0"
                          className="w-full px-2.5 py-1.5 rounded-[8px] bg-deep-abyss border border-graphite-fill text-xs text-pure-white disabled:opacity-60"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Presión atmosférica (solo si el sensor la mide) */}
                {cfgModalSensor.variables_medidas.some((v) => v.variable === 'presion') && (
                  <div className="p-3.5 rounded-[14px] bg-obsidian-shell border border-graphite-fill space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-pure-white">Presión atmosférica (hPa)</span>
                      <span className="text-[11px] font-mono text-slate-text">Opcional · 300 a 1100 hPa</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-slate-text mb-1">Mín. operacional</label>
                        <input
                          type="number"
                          step="0.01"
                          disabled={!isAdmin}
                          value={cfgForm.presion_min}
                          onChange={(e) => setCfgForm((f) => ({ ...f, presion_min: e.target.value }))}
                          placeholder="Ej. 980.0"
                          className="w-full px-2.5 py-1.5 rounded-[8px] bg-deep-abyss border border-graphite-fill text-xs text-pure-white disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-text mb-1">Máx. operacional</label>
                        <input
                          type="number"
                          step="0.01"
                          disabled={!isAdmin}
                          value={cfgForm.presion_max}
                          onChange={(e) => setCfgForm((f) => ({ ...f, presion_max: e.target.value }))}
                          placeholder="Ej. 1030.0"
                          className="w-full px-2.5 py-1.5 rounded-[8px] bg-deep-abyss border border-graphite-fill text-xs text-pure-white disabled:opacity-60"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {isAdmin && (
                  <div>
                    <label className="block text-[11px] text-slate-text mb-1">Motivo del cambio (trazabilidad)</label>
                    <input
                      type="text"
                      maxLength={255}
                      value={cfgForm.motivo || ''}
                      onChange={(e) => setCfgForm((f) => ({ ...f, motivo: e.target.value }))}
                      placeholder="Ej. Ajuste estacional de sala limpia"
                      className="w-full px-3 py-1.5 rounded-[8px] bg-obsidian-shell border border-graphite-fill text-xs text-pure-white"
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCfgHistory((prev) => !prev)}
                    className="px-3 py-1.5 rounded-[10px] bg-obsidian-shell border border-graphite-fill text-xs text-slate-text hover:text-pure-white inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    {showCfgHistory ? 'Ocultar historial' : `Historial (${cfgHistory.length})`}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCfgModalSensor(null)}
                      className="px-4 py-2 rounded-[56px] bg-obsidian-shell border border-graphite-fill text-xs text-pure-white cursor-pointer"
                    >
                      Cerrar
                    </button>
                    {isAdmin && (
                      <button
                        type="submit"
                        disabled={savingCfg}
                        className="sauce-btn-primary px-5 py-2 text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        {savingCfg && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Guardar umbrales
                      </button>
                    )}
                  </div>
                </div>

                {showCfgHistory && (
                  <div className="border-t border-graphite-fill pt-3 space-y-2 max-h-44 overflow-y-auto">
                    {cfgHistory.length === 0 ? (
                      <p className="text-xs text-slate-text">Sin cambios registrados en historial.</p>
                    ) : (
                      cfgHistory.map((h) => (
                        <div
                          key={h.id_historial}
                          className="p-2.5 rounded-[10px] bg-obsidian-shell border border-graphite-fill text-[11px] flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between text-pure-white">
                            <span className="font-mono text-neon-pulse">v{h.version}</span>
                            <span className="text-slate-text">
                              {h.actualizado_por} ·{' '}
                              {h.vigente_desde ? new Date(h.vigente_desde).toLocaleString() : '—'}
                            </span>
                          </div>
                          <div className="text-slate-text font-mono">
                            {h.temp_min !== null && (
                              <span>
                                T: [{h.temp_critico_min ?? '—'} &lt; {h.temp_min}..{h.temp_max} &lt;{' '}
                                {h.temp_critico_max ?? '—'}] °C{' '}
                              </span>
                            )}
                            {h.hum_min !== null && (
                              <span>
                                H: [{h.hum_critico_min ?? '—'} &lt; {h.hum_min}..{h.hum_max} &lt;{' '}
                                {h.hum_critico_max ?? '—'}] %RH
                              </span>
                            )}
                          </div>
                          {h.motivo && <div className="text-slate-text italic">{h.motivo}</div>}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal RF-05: Configuración de Variables Monitoreadas */}
      {varsModalSensor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm">
          <div className="bg-deep-abyss border border-graphite-fill rounded-[20px] w-full max-w-xl p-6 space-y-4 text-pure-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <p className="sauce-eyebrow text-neon-pulse">RF-05 · MAGNITUDES Y UNIDADES ESTÁNDAR</p>
                <h3 className="text-lg font-medium">
                  Variables monitoreadas ({varsModalSensor.identificador})
                </h3>
                <p className="text-xs text-slate-text mt-0.5">
                  Modelo {varsModalSensor.modelo} · Dispositivo {varsModalSensor.dispositivo_nombre} · Estado {varsModalSensor.estado}
                </p>
              </div>
              <button
                onClick={() => setVarsModalSensor(null)}
                className="text-slate-text hover:text-pure-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingVars ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-neon-pulse" />
              </div>
            ) : varsConfig ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs bg-obsidian-shell border border-graphite-fill rounded-[12px] p-3">
                  <div>
                    <span className="text-slate-text">ID Configuración:</span>{' '}
                    <span className="font-mono text-neon-pulse">{varsConfig.id_configuracion}</span>
                  </div>
                  <div>
                    <span className="text-slate-text">Última actualización:</span>{' '}
                    <span className="font-mono text-pure-white">
                      {varsConfig.fecha_actualizacion ? new Date(varsConfig.fecha_actualizacion).toLocaleString() : '—'}
                    </span>
                  </div>
                </div>

                {varsModalSensor.estado === 'INACTIVO' && (
                  <div className="p-3 rounded-[10px] bg-signal-yellow/15 border border-signal-yellow/40 text-xs text-signal-yellow">
                    Sensor inactivo: no participa en nuevas operaciones de monitoreo ni admite cambios operativos hasta reactivarse.
                  </div>
                )}

                {varsError && (
                  <div className="p-3 rounded-[10px] bg-[#DC2626]/15 border border-[#DC2626]/40 text-xs text-[#FCA5A5] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{varsError}</span>
                  </div>
                )}

                {varsSuccess && (
                  <div className="p-3 rounded-[10px] bg-neon-pulse/15 border border-neon-pulse/40 text-xs text-neon-pulse">
                    {varsSuccess}
                  </div>
                )}

                <div className="space-y-2.5">
                  <p className="text-xs font-medium text-pure-white">
                    Variables soportadas por {varsConfig.modelo} (unidades estándar inmutables RN-06):
                  </p>

                  {varsConfig.variables_disponibles.some((v) => v.variable === 'temperatura') && (
                    <label
                      className={`flex items-center justify-between p-3 rounded-[12px] border cursor-pointer ${
                        tempEnabled
                          ? 'bg-neon-pulse/10 border-neon-pulse/50'
                          : 'bg-obsidian-shell border-graphite-fill'
                      } ${!isAdmin || varsModalSensor.estado === 'INACTIVO' ? 'opacity-75 cursor-not-allowed' : ''}`}
                    >
                      <div>
                        <div className="text-sm font-medium text-pure-white">Temperatura</div>
                        <div className="text-[11px] text-slate-text font-mono">
                          Unidad estándar: {varsConfig.unidad_temperatura} (inmutable)
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={tempEnabled}
                        disabled={!isAdmin || varsModalSensor.estado === 'INACTIVO'}
                        onChange={(e) => {
                          setTempEnabled(e.target.checked);
                          setVarsError('');
                        }}
                        className="w-4 h-4 accent-neon-pulse"
                      />
                    </label>
                  )}

                  {varsConfig.variables_disponibles.some((v) => v.variable === 'humedad') && (
                    <label
                      className={`flex items-center justify-between p-3 rounded-[12px] border cursor-pointer ${
                        humEnabled
                          ? 'bg-neon-pulse/10 border-neon-pulse/50'
                          : 'bg-obsidian-shell border-graphite-fill'
                      } ${!isAdmin || varsModalSensor.estado === 'INACTIVO' ? 'opacity-75 cursor-not-allowed' : ''}`}
                    >
                      <div>
                        <div className="text-sm font-medium text-pure-white">Humedad Relativa</div>
                        <div className="text-[11px] text-slate-text font-mono">
                          Unidad estándar: {varsConfig.unidad_humedad} (inmutable)
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={humEnabled}
                        disabled={!isAdmin || varsModalSensor.estado === 'INACTIVO'}
                        onChange={(e) => {
                          setHumEnabled(e.target.checked);
                          setVarsError('');
                        }}
                        className="w-4 h-4 accent-neon-pulse"
                      />
                    </label>
                  )}

                  {varsConfig.variables_disponibles.some((v) => v.variable === 'presion') && (
                    <label
                      className={`flex items-center justify-between p-3 rounded-[12px] border cursor-pointer ${
                        presEnabled
                          ? 'bg-neon-pulse/10 border-neon-pulse/50'
                          : 'bg-obsidian-shell border-graphite-fill'
                      } ${!isAdmin || varsModalSensor.estado === 'INACTIVO' ? 'opacity-75 cursor-not-allowed' : ''}`}
                    >
                      <div>
                        <div className="text-sm font-medium text-pure-white">Presión Atmosférica</div>
                        <div className="text-[11px] text-slate-text font-mono">
                          Unidad estándar: {varsConfig.unidad_presion || 'hPa'} (inmutable)
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={presEnabled}
                        disabled={!isAdmin || varsModalSensor.estado === 'INACTIVO'}
                        onChange={(e) => {
                          setPresEnabled(e.target.checked);
                          setVarsError('');
                        }}
                        className="w-4 h-4 accent-neon-pulse"
                      />
                    </label>
                  )}
                </div>

                {isAdmin && varsModalSensor.estado !== 'INACTIVO' && (
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setVarsModalSensor(null)}
                      className="px-4 py-2 rounded-[56px] border border-graphite-fill text-xs text-slate-text cursor-pointer"
                    >
                      Cerrar
                    </button>
                    <button
                      type="button"
                      disabled={savingVars}
                      onClick={handleSaveVariables}
                      className="apple-blue-pill px-5 py-2 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                    >
                      {savingVars && <Loader2 className="w-3 h-3 animate-spin" />}
                      Guardar variables
                    </button>
                  </div>
                )}

                {/* Trazabilidad histórica RF-05 */}
                <div className="pt-3 border-t border-graphite-fill space-y-2">
                  <h4 className="text-xs font-semibold text-pure-white flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-neon-pulse" />
                    Historial de configuraciones ({varsHistory.length})
                  </h4>
                  {varsHistory.length === 0 ? (
                    <p className="text-xs text-slate-text">Sin cambios registrados aún.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {varsHistory.map((h) => (
                        <div
                          key={h.id_historial}
                          className="p-2.5 rounded-[10px] bg-obsidian-shell border border-graphite-fill text-[11px] flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="font-mono text-pure-white">
                            {h.variables_snapshot.map((v) => `${v.variable} (${v.unidad})`).join(' · ')}
                          </div>
                          <div className="text-slate-text">
                            {h.usuario_responsable} · {new Date(h.fecha_cambio).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-text">No se pudo cargar la configuración del sensor.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
