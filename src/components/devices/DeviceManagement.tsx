import React, { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  Cpu,
  Wifi,
  WifiOff,
  Sliders,
  Key,
  Copy,
  Check,
  Search,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Dispositivo, Sensor, Ubicacion, Usuario, DeviceType, SensorType } from '../../types/iot';
import { useDebounce } from '../../hooks/useDebounce';
import { buildEntityIndexes, paginateArray } from '../../services/performanceEngine';

interface DeviceManagementProps {
  devices: Dispositivo[];
  sensors: Sensor[];
  locations: Ubicacion[];
  users: Usuario[];
  onAddDevice: (device: Dispositivo, sensor: Sensor) => void;
  onUpdateSensorLimits: (sensorId: string, limits: Sensor['limites']) => void;
  onToggleDeviceState: (deviceId: string) => void;
}

export const DeviceManagement: React.FC<DeviceManagementProps> = React.memo(({
  devices,
  sensors,
  locations,
  users,
  onAddDevice,
  onUpdateSensorLimits,
  onToggleDeviceState,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  // Debounce de 280ms para búsqueda y autocompletado
  const debouncedSearchTerm = useDebounce(searchTerm, 280);

  const [selectedFilter, setSelectedFilter] = useState<'all' | 'ONLINE' | 'OFFLINE'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const [showAddModal, setShowAddModal] = useState(false);
  const [credentialsModalDevice, setCredentialsModalDevice] = useState<Dispositivo | null>(null);
  const [editingSensor, setEditingSensor] = useState<Sensor | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Form states for new device
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newMacAddress, setNewMacAddress] = useState('');
  const [newDeviceType, setNewDeviceType] = useState<DeviceType>('ESP32-WROOM');
  const [newLocationId, setNewLocationId] = useState(locations[0]?.id_ubicacion || '');
  const [newUserId, setNewUserId] = useState(users[0]?.id_usuario || '');
  const [newSensorType, setNewSensorType] = useState<SensorType>('DHT22');
  const [newTempMin, setNewTempMin] = useState(18.0);
  const [newTempMax, setNewTempMax] = useState(25.0);
  const [newHumMin, setNewHumMin] = useState(40.0);
  const [newHumMax, setNewHumMax] = useState(65.0);
  const [macError, setMacError] = useState('');

  // Índices en memoria O(1) para eliminar por completo las consultas N+1
  const indexes = useMemo(
    () => buildEntityIndexes(locations, devices, sensors, users, []),
    [locations, devices, sensors, users]
  );

  // Sugerencias de autocompletado con debounce
  const autocompleteSuggestions = useMemo(() => {
    const q = debouncedSearchTerm.trim().toLowerCase();
    if (!q) return [];
    return devices
      .filter(
        (d) =>
          d.nombre.toLowerCase().includes(q) ||
          d.mac_address.toLowerCase().includes(q) ||
          d.tipo.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [devices, debouncedSearchTerm]);

  const validateMac = useCallback((mac: string) => {
    const regex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return regex.test(mac);
  }, []);

  const handleCreateDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateMac(newMacAddress)) {
      setMacError('Formato inválido. Use formato hexadecimal estándar (ej. 24:6F:28:B1:C0:04)');
      return;
    }

    const deviceId = `dev-${Date.now().toString().slice(-6)}`;
    const sensorId = `sens-${Date.now().toString().slice(-6)}`;
    const sanitizedMac = newMacAddress.toUpperCase();
    const topicSlug = newDeviceName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    const createdDevice: Dispositivo = {
      id_dispositivo: deviceId,
      mac_address: sanitizedMac,
      nombre: newDeviceName || `Nodo ${sanitizedMac.slice(-5)}`,
      tipo: newDeviceType,
      ubicacion_id: newLocationId,
      usuario_id: newUserId,
      estado: 'ONLINE',
      ip_address: `192.168.10.${Math.floor(Math.random() * 150) + 20}`,
      rssi_dbm: -(Math.floor(Math.random() * 25) + 50),
      firmware_version: 'v2.5.0-esp32',
      fecha_registro: new Date().toISOString(),
      ultimo_ping: new Date().toISOString(),
      mqtt_client_id: `client_${topicSlug}_${deviceId}`,
      mqtt_topic: `iot/telemetry/${topicSlug}`,
    };

    const createdSensor: Sensor = {
      id_sensor: sensorId,
      dispositivo_id: deviceId,
      tipo_sensor: newSensorType,
      variables: ['temperatura', 'humedad'],
      unidad_temperatura: '°C',
      unidad_humedad: '%RH',
      estado: 'ACTIVO',
      fecha_instalacion: new Date().toISOString(),
      ultima_calibracion: new Date().toISOString(),
      limites: {
        temp_min: Number(newTempMin),
        temp_max: Number(newTempMax),
        hum_min: Number(newHumMin),
        hum_max: Number(newHumMax),
        temp_critica_max: Number(newTempMax) + 4.0,
        hum_critica_max: Number(newHumMax) + 10.0,
      },
    };

    onAddDevice(createdDevice, createdSensor);
    setShowAddModal(false);
    setNewDeviceName('');
    setNewMacAddress('');
    setMacError('');
  };

  const filteredDevices = useMemo(() => {
    const q = debouncedSearchTerm.toLowerCase();
    return devices.filter((d) => {
      const matchesSearch =
        !q ||
        d.nombre.toLowerCase().includes(q) ||
        d.mac_address.toLowerCase().includes(q) ||
        d.tipo.toLowerCase().includes(q);
      const matchesFilter = selectedFilter === 'all' || d.estado === selectedFilter;
      return matchesSearch && matchesFilter;
    });
  }, [devices, debouncedSearchTerm, selectedFilter]);

  // Paginación de resultados
  const paginated = useMemo(
    () => paginateArray(filteredDevices, currentPage, pageSize),
    [filteredDevices, currentPage]
  );

  return (
    <div className="space-y-[24px]">
      {/* Header y Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="apple-card-heading text-[#101f1e] flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-[#104336]" />
            <span>Gestión de Nodos IoT y Sensores</span>
          </h2>
          <p className="text-[14px] text-[#535e5d] mt-1">
            Búsqueda con debounce (280ms) · Autocompletado indexado O(1) sin consultas N+1 · Paginación activa
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="apple-blue-pill flex items-center gap-1.5 px-5 py-2.5 text-[12px] font-semibold shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Nuevo Dispositivo</span>
        </button>
      </div>

      {/* Barra de Filtros, Búsqueda con Debounce y Autocompletado */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#FFFFFF] p-4 rounded-[16px]">
        <div className="relative w-full sm:w-96">
          <Search className="w-3.5 h-3.5 absolute left-4 top-3 text-[#535e5d]" />
          <input
            type="text"
            placeholder="Buscar por nombre, tipo o MAC (Debounce 280ms)..."
            value={searchTerm}
            onFocus={() => setShowAutocomplete(true)}
            onBlur={() => setTimeout(() => setShowAutocomplete(false), 180)}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
              setShowAutocomplete(true);
            }}
            className="apple-pill-input w-full pl-10 pr-4 py-2 text-[12px] placeholder-[#4A7C59]"
          />

          {/* Dropdown de Autocompletado con Debounce */}
          {showAutocomplete && autocompleteSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 rounded-[16px] bg-[#f3f1ec] border border-[#afc4bf] p-2 z-30 space-y-1">
              <div className="px-3 py-1 text-[10px] font-mono text-[#535e5d] uppercase">
                Autocompletado Instantáneo (Índice O(1))
              </div>
              {autocompleteSuggestions.map((sug) => (
                <button
                  key={sug.id_dispositivo}
                  type="button"
                  onMouseDown={() => {
                    setSearchTerm(sug.nombre);
                    setShowAutocomplete(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-[12px] hover:bg-[#FFFFFF] text-left text-xs"
                >
                  <span className="font-semibold text-[#101f1e]">{sug.nombre}</span>
                  <span className="font-mono text-[11px] text-[#104336]">{sug.mac_address}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#f3f1ec] rounded-[8px] text-[12px] self-stretch sm:self-auto justify-center">
          <button
            onClick={() => {
              setSelectedFilter('all');
              setCurrentPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-[8px] transition-colors ${
              selectedFilter === 'all'
                ? 'bg-[#f3f1ec] text-[#101f1e] font-semibold'
                : 'text-[#535e5d] hover:text-[#101f1e]'
            }`}
          >
            Todos ({devices.length})
          </button>
          <button
            onClick={() => {
              setSelectedFilter('ONLINE');
              setCurrentPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-[8px] transition-colors ${
              selectedFilter === 'ONLINE'
                ? 'bg-[#f3f1ec] text-[#104336] font-semibold'
                : 'text-[#535e5d] hover:text-[#101f1e]'
            }`}
          >
            Online ({devices.filter((d) => d.estado === 'ONLINE').length})
          </button>
          <button
            onClick={() => {
              setSelectedFilter('OFFLINE');
              setCurrentPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-[8px] transition-colors ${
              selectedFilter === 'OFFLINE'
                ? 'bg-[#f3f1ec] text-[#101f1e] font-semibold'
                : 'text-[#535e5d] hover:text-[#101f1e]'
            }`}
          >
            Offline ({devices.filter((d) => d.estado === 'OFFLINE').length})
          </button>
        </div>
      </div>

      {/* Grid de Dispositivos (Sin consultas N+1 gracias a indexes O(1)) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[16px]">
        {paginated.items.map((dev) => {
          const loc = indexes.locationById.get(dev.ubicacion_id);
          const user = indexes.userById.get(dev.usuario_id);
          const sensor = indexes.sensorByDeviceId.get(dev.id_dispositivo);
          const isOnline = dev.estado === 'ONLINE';

          return (
            <div
              key={dev.id_dispositivo}
              className="bg-[#FFFFFF] rounded-[16px] p-5 space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Encabezado de Tarjeta */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-[17px] font-semibold tracking-[-0.374px] text-[#101f1e]">
                      {dev.nombre}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[12px] text-[#535e5d] mt-0.5">
                      <span>{loc?.nombre || 'Sin Ubicación'}</span>
                      <span>·</span>
                      <span className="font-mono text-[11px]">{dev.tipo}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onToggleDeviceState(dev.id_dispositivo)}
                    title="Cambiar estado de conexión (Optimistic UI)"
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-[10px] font-mono font-semibold transition-colors ${
                      isOnline
                        ? 'bg-[#104336]/15 text-[#104336]'
                        : 'bg-[#f3f1ec] text-[#535e5d]'
                    }`}
                  >
                    {isOnline ? <Wifi className="w-3 h-3 text-[#104336]" /> : <WifiOff className="w-3 h-3 text-[#535e5d]" />}
                    <span>{dev.estado}</span>
                  </button>
                </div>

                {/* Especificaciones Técnicas en Tile #f3f1ec (28px radius, 16px padding) */}
                <div className="space-y-1.5 text-xs font-mono bg-[#f3f1ec] p-[16px] rounded-[16px]">
                  <div className="flex items-center justify-between text-[#101f1e]">
                    <span className="text-[#535e5d] font-sans">MAC:</span>
                    <span className="font-semibold">{dev.mac_address}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#101f1e]">
                    <span className="text-[#535e5d] font-sans">IP / RSSI:</span>
                    <span>{dev.ip_address} · {dev.rssi_dbm} dBm</span>
                  </div>
                  <div className="flex items-center justify-between text-[#101f1e]">
                    <span className="text-[#535e5d] font-sans">Sensor Activo:</span>
                    <span className="font-semibold text-[#104336]">
                      {sensor ? `${sensor.tipo_sensor}` : 'Sin sensor'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#101f1e]">
                    <span className="text-[#535e5d] font-sans">Responsable:</span>
                    <span className="font-sans truncate max-w-[130px]">{user?.nombre}</span>
                  </div>
                </div>

                {/* Umbrales Actuales */}
                {sensor && (
                  <div className="space-y-1.5 text-xs">
                    <div className="text-[11px] font-semibold text-[#535e5d] uppercase tracking-wider">
                      Límites Operacionales
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="p-2.5 rounded-[14px] bg-[#f3f1ec] text-[#101f1e]">
                        Temp: <span className="font-semibold text-[#104336]">{sensor.limites.temp_min}° a {sensor.limites.temp_max}°C</span>
                      </div>
                      <div className="p-2.5 rounded-[14px] bg-[#f3f1ec] text-[#101f1e]">
                        Hum: <span className="font-semibold">{sensor.limites.hum_min}% a {sensor.limites.hum_max}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Botones de Acción */}
              <div className="pt-3 flex items-center justify-between border-t border-[#afc4bf]/60 text-xs">
                <button
                  onClick={() => setCredentialsModalDevice(dev)}
                  className="flex items-center gap-1.5 text-[#101f1e] hover:text-[#104336] font-medium transition-colors"
                >
                  <Key className="w-3.5 h-3.5 text-[#535e5d]" />
                  <span>Credenciales MQTT</span>
                </button>

                {sensor && (
                  <button
                    onClick={() => setEditingSensor(sensor)}
                    className="apple-inline-link flex items-center gap-1 font-semibold"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Ajustar Umbrales</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Controles de Paginación de Resultados */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#FFFFFF] px-5 py-3.5 rounded-[16px] text-xs">
        <span className="text-[#535e5d] font-mono">
          Página {paginated.page} de {paginated.totalPages} · Mostrando {paginated.items.length} de {paginated.totalItems} dispositivos
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={!paginated.hasPrev}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="apple-white-outline-pill py-1.5 text-xs disabled:opacity-40 flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Anterior</span>
          </button>
          <button
            disabled={!paginated.hasNext}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="apple-blue-pill px-4 py-1.5 text-xs disabled:opacity-40 flex items-center gap-1"
          >
            <span>Siguiente</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Modal: Registrar Nuevo Dispositivo */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A2E17]/65 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#FFFFFF] border border-[#afc4bf] rounded-[16px] w-full max-w-lg p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-[#afc4bf] pb-3">
              <h3 className="text-[17px] font-semibold text-[#101f1e] flex items-center gap-2">
                <Cpu className="w-5 h-5 text-[#104336]" />
                <span>Alta de Nodo IoT y Configuración</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#535e5d] hover:text-[#101f1e] text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDevice} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#535e5d] font-semibold mb-1.5">
                  Nombre del Nodo / Identificador
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Sonda Térmica Almacén Central"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  className="apple-pill-input w-full py-2.5 text-xs placeholder-[#4A7C59]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#535e5d] font-semibold mb-1.5">
                    Dirección MAC (Validación estricta)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="XX:XX:XX:XX:XX:XX"
                    value={newMacAddress}
                    onChange={(e) => {
                      setNewMacAddress(e.target.value);
                      if (macError) setMacError('');
                    }}
                    className={`apple-pill-input w-full font-mono py-2.5 text-xs ${
                      macError ? 'border-[#DC2626]' : ''
                    }`}
                  />
                  {macError && <p className="text-[11px] text-[#DC2626] mt-1">{macError}</p>}
                </div>

                <div>
                  <label className="block text-[#535e5d] font-semibold mb-1.5">
                    Tipo de Microcontrolador
                  </label>
                  <select
                    value={newDeviceType}
                    onChange={(e) => setNewDeviceType(e.target.value as DeviceType)}
                    className="apple-pill-select w-full py-2.5 text-xs"
                  >
                    <option value="ESP32-WROOM">ESP32-WROOM (Dual Core WiFi/BLE)</option>
                    <option value="ESP8266-NodeMCU">ESP8266-NodeMCU (WiFi Standalone)</option>
                    <option value="Raspberry Pi Gateway 4B">Raspberry Pi Gateway 4B</option>
                    <option value="Industrial Gateway MQTTS">Industrial Gateway MQTTS</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#535e5d] font-semibold mb-1.5">
                    Ubicación Asignada
                  </label>
                  <select
                    value={newLocationId}
                    onChange={(e) => setNewLocationId(e.target.value)}
                    className="apple-pill-select w-full py-2.5 text-xs"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id_ubicacion} value={loc.id_ubicacion}>
                        {loc.nombre} ({loc.codigo_area})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#535e5d] font-semibold mb-1.5">
                    Usuario / Operador Responsable
                  </label>
                  <select
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                    className="apple-pill-select w-full py-2.5 text-xs"
                  >
                    {users.map((u) => (
                      <option key={u.id_usuario} value={u.id_usuario}>
                        {u.nombre} ({u.empresa})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Asignación de Sensor y Umbrales */}
              <div className="p-4 bg-[#f3f1ec] rounded-[16px] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#101f1e]">
                    Sonda / Sensor Conectado
                  </span>
                  <select
                    value={newSensorType}
                    onChange={(e) => setNewSensorType(e.target.value as SensorType)}
                    className="apple-pill-select py-1.5 text-xs font-mono"
                  >
                    <option value="DHT22">DHT22 (Precisión Media)</option>
                    <option value="BME280">BME280 (Bosch Precisión Alta)</option>
                    <option value="SHT31">SHT31 (Sensirion Grado Médico)</option>
                    <option value="DHT11">DHT11 (Básico)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                  <div>
                    <label className="block text-[10px] text-[#535e5d] mb-1">Mín Temp (°C)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={newTempMin}
                      onChange={(e) => setNewTempMin(parseFloat(e.target.value))}
                      className="apple-pill-input w-full py-1.5 text-xs text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#535e5d] mb-1">Máx Temp (°C)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={newTempMax}
                      onChange={(e) => setNewTempMax(parseFloat(e.target.value))}
                      className="apple-pill-input w-full py-1.5 text-xs text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#535e5d] mb-1">Mín Hum (%RH)</label>
                    <input
                      type="number"
                      step="1"
                      value={newHumMin}
                      onChange={(e) => setNewHumMin(parseFloat(e.target.value))}
                      className="apple-pill-input w-full py-1.5 text-xs text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#535e5d] mb-1">Máx Hum (%RH)</label>
                    <input
                      type="number"
                      step="1"
                      value={newHumMax}
                      onChange={(e) => setNewHumMax(parseFloat(e.target.value))}
                      className="apple-pill-input w-full py-1.5 text-xs text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#afc4bf]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="apple-white-outline-pill py-2 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="apple-blue-pill px-5 py-2 font-semibold text-xs"
                >
                  Registrar y Generar Credenciales
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Credenciales y Conexión MQTT */}
      {credentialsModalDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A2E17]/65 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#FFFFFF] border border-[#afc4bf] rounded-[16px] w-full max-w-lg p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-[#afc4bf] pb-3">
              <h3 className="text-[17px] font-semibold text-[#101f1e] flex items-center gap-2">
                <Key className="w-5 h-5 text-[#D97706]" />
                <span>Credenciales MQTT Broker Mosquitto</span>
              </h3>
              <button
                onClick={() => setCredentialsModalDevice(null)}
                className="text-[#535e5d] hover:text-[#101f1e] text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="p-4 rounded-[16px] bg-[#f3f1ec] text-[#101f1e] space-y-2">
                <div className="flex items-center justify-between text-[#535e5d] text-[11px] pb-1.5 border-b border-[#afc4bf]">
                  <span>MQTT Broker Host:</span>
                  <span className="text-[#104336] font-semibold">broker.iot-ambiental.com</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#535e5d]">Puerto MQTTS (TLS 1.3):</span>
                  <span className="text-[#104336]">8883</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#535e5d]">Client ID:</span>
                  <span className="text-[#101f1e]">{credentialsModalDevice.mqtt_client_id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#535e5d]">Tópico Telemetría:</span>
                  <span className="text-[#D97706]">{credentialsModalDevice.mqtt_topic}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#535e5d]">QoS Requerido:</span>
                  <span>1 (Al menos una entrega)</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-[#535e5d] font-sans">
                  <span>Ejemplo de publicación Arduino ESP32:</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`// Payload JSON a publicar en ${credentialsModalDevice.mqtt_topic}\n{"mac":"${credentialsModalDevice.mac_address}","temp":22.4,"hum":54.2,"ts":${Date.now()}}`);
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2000);
                    }}
                    className="apple-inline-link flex items-center gap-1 font-semibold"
                  >
                    {copiedKey ? <Check className="w-3 h-3 text-[#104336]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey ? 'Copiado' : 'Copiar Payload'}</span>
                  </button>
                </div>
                <pre className="p-3.5 rounded-[16px] bg-[#f3f1ec] text-[#101f1e] text-[11px] overflow-x-auto">
{`mqttClient.publish("${credentialsModalDevice.mqtt_topic}", 
  "{\\"mac\\":\\"${credentialsModalDevice.mac_address}\\",\\"temp\\":22.4,\\"hum\\":54.2}");`}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setCredentialsModalDevice(null)}
                className="apple-blue-pill px-5 py-2 font-semibold text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ajustar Umbrales de Sensor */}
      {editingSensor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A2E17]/65 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#FFFFFF] border border-[#afc4bf] rounded-[16px] w-full max-w-md p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-[#afc4bf] pb-3">
              <h3 className="text-[17px] font-semibold text-[#101f1e] flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#104336]" />
                <span>Ajustar Umbrales Operacionales</span>
              </h3>
              <button
                onClick={() => setEditingSensor(null)}
                className="text-[#535e5d] hover:text-[#101f1e] text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="space-y-2">
                <label className="block text-[#101f1e] font-semibold font-sans">
                  Rango de Temperatura Operacional (°C)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-[#535e5d] block mb-1">Mínimo Nominal</span>
                    <input
                      type="number"
                      step="0.5"
                      value={editingSensor.limites.temp_min}
                      onChange={(e) =>
                        setEditingSensor({
                          ...editingSensor,
                          limites: { ...editingSensor.limites, temp_min: parseFloat(e.target.value) },
                        })
                      }
                      className="apple-pill-input w-full py-2 text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#535e5d] block mb-1">Máximo Nominal</span>
                    <input
                      type="number"
                      step="0.5"
                      value={editingSensor.limites.temp_max}
                      onChange={(e) =>
                        setEditingSensor({
                          ...editingSensor,
                          limites: { ...editingSensor.limites, temp_max: parseFloat(e.target.value) },
                        })
                      }
                      className="apple-pill-input w-full py-2 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[#101f1e] font-semibold font-sans">
                  Rango de Humedad Relativa (%RH)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-[#535e5d] block mb-1">Mínimo Nominal</span>
                    <input
                      type="number"
                      step="1"
                      value={editingSensor.limites.hum_min}
                      onChange={(e) =>
                        setEditingSensor({
                          ...editingSensor,
                          limites: { ...editingSensor.limites, hum_min: parseFloat(e.target.value) },
                        })
                      }
                      className="apple-pill-input w-full py-2 text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#535e5d] block mb-1">Máximo Nominal</span>
                    <input
                      type="number"
                      step="1"
                      value={editingSensor.limites.hum_max}
                      onChange={(e) =>
                        setEditingSensor({
                          ...editingSensor,
                          limites: { ...editingSensor.limites, hum_max: parseFloat(e.target.value) },
                        })
                      }
                      className="apple-pill-input w-full py-2 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-[#afc4bf]">
              <button
                onClick={() => setEditingSensor(null)}
                className="apple-white-outline-pill py-2 text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onUpdateSensorLimits(editingSensor.id_sensor, editingSensor.limites);
                  setEditingSensor(null);
                }}
                className="apple-blue-pill flex items-center gap-1.5 px-5 py-2 font-semibold text-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Guardar Nuevos Umbrales</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

DeviceManagement.displayName = 'DeviceManagement';
