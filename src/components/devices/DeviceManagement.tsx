import React, { useState } from 'react';
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
} from 'lucide-react';
import { Dispositivo, Sensor, Ubicacion, Usuario, DeviceType, SensorType } from '../../types/iot';

interface DeviceManagementProps {
  devices: Dispositivo[];
  sensors: Sensor[];
  locations: Ubicacion[];
  users: Usuario[];
  onAddDevice: (device: Dispositivo, sensor: Sensor) => void;
  onUpdateSensorLimits: (sensorId: string, limits: Sensor['limites']) => void;
  onToggleDeviceState: (deviceId: string) => void;
}

export const DeviceManagement: React.FC<DeviceManagementProps> = ({
  devices,
  sensors,
  locations,
  users,
  onAddDevice,
  onUpdateSensorLimits,
  onToggleDeviceState,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'ONLINE' | 'OFFLINE'>('all');
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

  // Validación de MAC Address con formato estándar XX:XX:XX:XX:XX:XX
  const validateMac = (mac: string) => {
    const regex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return regex.test(mac);
  };

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
    // Reset fields
    setNewDeviceName('');
    setNewMacAddress('');
    setMacError('');
  };

  const filteredDevices = devices.filter((d) => {
    const matchesSearch =
      d.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.mac_address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = selectedFilter === 'all' || d.estado === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header y Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-600" />
            <span>Gestión de Nodos IoT y Sensores</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Registro de microcontroladores (ESP32/ESP8266), credenciales MQTT y umbrales operacionales
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Nuevo Dispositivo</span>
        </button>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o MAC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium self-stretch sm:self-auto justify-center">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1 rounded-md transition-colors ${
              selectedFilter === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Todos ({devices.length})
          </button>
          <button
            onClick={() => setSelectedFilter('ONLINE')}
            className={`px-3 py-1 rounded-md transition-colors ${
              selectedFilter === 'ONLINE'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Online ({devices.filter((d) => d.estado === 'ONLINE').length})
          </button>
          <button
            onClick={() => setSelectedFilter('OFFLINE')}
            className={`px-3 py-1 rounded-md transition-colors ${
              selectedFilter === 'OFFLINE'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Offline ({devices.filter((d) => d.estado === 'OFFLINE').length})
          </button>
        </div>
      </div>

      {/* Grid de Dispositivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDevices.map((dev) => {
          const loc = locations.find((l) => l.id_ubicacion === dev.ubicacion_id);
          const user = users.find((u) => u.id_usuario === dev.usuario_id);
          const sensor = sensors.find((s) => s.dispositivo_id === dev.id_dispositivo);
          const isOnline = dev.estado === 'ONLINE';

          return (
            <div
              key={dev.id_dispositivo}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              {/* Encabezado de Tarjeta */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {dev.nombre}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>{loc?.nombre || 'Sin Ubicación'}</span>
                    <span>·</span>
                    <span className="font-mono text-[11px]">{dev.tipo}</span>
                  </div>
                </div>

                <button
                  onClick={() => onToggleDeviceState(dev.id_dispositivo)}
                  title="Cambiar estado de conexión"
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors ${
                    isOnline
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {isOnline ? <Wifi className="w-3 h-3 text-emerald-500" /> : <WifiOff className="w-3 h-3 text-slate-400" />}
                  <span>{dev.estado}</span>
                </button>
              </div>

              {/* Especificaciones Técnicas */}
              <div className="space-y-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 font-sans">MAC:</span>
                  <span className="font-semibold">{dev.mac_address}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 font-sans">IP / RSSI:</span>
                  <span>{dev.ip_address} · {dev.rssi_dbm} dBm</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 font-sans">Sensor Activo:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {sensor ? `${sensor.tipo_sensor}` : 'Sin sensor'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 font-sans">Responsable:</span>
                  <span className="font-sans truncate max-w-[130px]">{user?.nombre}</span>
                </div>
              </div>

              {/* Umbrales Actuales */}
              {sensor && (
                <div className="space-y-1 text-xs">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Límites Operacionales
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      Temp: <span className="font-semibold">{sensor.limites.temp_min}° a {sensor.limites.temp_max}°C</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      Hum: <span className="font-semibold">{sensor.limites.hum_min}% a {sensor.limites.hum_max}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Botones de Acción */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 text-xs">
                <button
                  onClick={() => setCredentialsModalDevice(dev)}
                  className="flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-emerald-600 font-medium"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Credenciales MQTT</span>
                </button>

                {sensor && (
                  <button
                    onClick={() => setEditingSensor(sensor)}
                    className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
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

      {/* Modal: Registrar Nuevo Dispositivo */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-600" />
                <span>Alta de Nodo IoT y Configuración</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDevice} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Nombre del Nodo / Identificador
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Sonda Térmica Almacén Central"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
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
                    className={`w-full font-mono px-3 py-2 rounded-lg border ${
                      macError ? 'border-red-500 bg-red-50 dark:bg-red-950/30' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                    } text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500`}
                  />
                  {macError && <p className="text-[11px] text-red-500 mt-1">{macError}</p>}
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Tipo de Microcontrolador
                  </label>
                  <select
                    value={newDeviceType}
                    onChange={(e) => setNewDeviceType(e.target.value as DeviceType)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
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
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Ubicación Asignada
                  </label>
                  <select
                    value={newLocationId}
                    onChange={(e) => setNewLocationId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id_ubicacion} value={loc.id_ubicacion}>
                        {loc.nombre} ({loc.codigo_area})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Usuario / Cliente Responsable
                  </label>
                  <select
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
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
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Sonda / Sensor Conectado
                  </span>
                  <select
                    value={newSensorType}
                    onChange={(e) => setNewSensorType(e.target.value as SensorType)}
                    className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono"
                  >
                    <option value="DHT22">DHT22 (Precisión Media)</option>
                    <option value="BME280">BME280 (Bosch Precisión Alta)</option>
                    <option value="SHT31">SHT31 (Sensirion Grado Médico)</option>
                    <option value="DHT11">DHT11 (Básico)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                  <div>
                    <label className="block text-[10px] text-slate-500">Mín Temp (°C)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={newTempMin}
                      onChange={(e) => setNewTempMin(parseFloat(e.target.value))}
                      className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">Máx Temp (°C)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={newTempMax}
                      onChange={(e) => setNewTempMax(parseFloat(e.target.value))}
                      className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">Mín Hum (%RH)</label>
                    <input
                      type="number"
                      step="1"
                      value={newHumMin}
                      onChange={(e) => setNewHumMin(parseFloat(e.target.value))}
                      className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">Máx Hum (%RH)</label>
                    <input
                      type="number"
                      step="1"
                      value={newHumMax}
                      onChange={(e) => setNewHumMax(parseFloat(e.target.value))}
                      className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-500" />
                <span>Credenciales MQTT Broker Mosquitto</span>
              </h3>
              <button
                onClick={() => setCredentialsModalDevice(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-slate-950 text-slate-200 space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-[11px] pb-1 border-b border-slate-800">
                  <span>MQTT Broker Host:</span>
                  <span className="text-emerald-400 font-semibold">broker.iot-ambiental.com</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Puerto MQTTS (TLS 1.3):</span>
                  <span className="text-emerald-400">8883</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Client ID:</span>
                  <span className="text-white">{credentialsModalDevice.mqtt_client_id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Tópico Telemetría:</span>
                  <span className="text-amber-400">{credentialsModalDevice.mqtt_topic}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">QoS Requerido:</span>
                  <span>1 (Al menos una entrega)</span>
                </div>
              </div>

              {/* Snippet Arduino ESP32 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Ejemplo de publicación Arduino ESP32:</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`// Payload JSON a publicar en ${credentialsModalDevice.mqtt_topic}\n{"mac":"${credentialsModalDevice.mac_address}","temp":22.4,"hum":54.2,"ts":${Date.now()}}`);
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2000);
                    }}
                    className="flex items-center gap-1 text-emerald-600 hover:underline"
                  >
                    {copiedKey ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey ? 'Copiado' : 'Copiar Payload'}</span>
                  </button>
                </div>
                <pre className="p-2.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 text-[11px] overflow-x-auto">
{`mqttClient.publish("${credentialsModalDevice.mqtt_topic}", 
  "{\\"mac\\":\\"${credentialsModalDevice.mac_address}\\",\\"temp\\":22.4,\\"hum\\":54.2}");`}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setCredentialsModalDevice(null)}
                className="px-4 py-2 font-semibold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ajustar Umbrales de Sensor */}
      {editingSensor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-600" />
                <span>Ajustar Umbrales Operacionales</span>
              </h3>
              <button
                onClick={() => setEditingSensor(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="space-y-2">
                <label className="block text-slate-700 dark:text-slate-300 font-semibold font-sans">
                  Rango de Temperatura Operacional (°C)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400">Mínimo Nominal</span>
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
                      className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Máximo Nominal</span>
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
                      className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-slate-700 dark:text-slate-300 font-semibold font-sans">
                  Rango de Humedad Relativa (%RH)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400">Mínimo Nominal</span>
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
                      className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Máximo Nominal</span>
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
                      className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setEditingSensor(null)}
                className="px-3 py-2 text-slate-600 dark:text-slate-300 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onUpdateSensorLimits(editingSensor.id_sensor, editingSensor.limites);
                  setEditingSensor(null);
                }}
                className="flex items-center gap-1 px-4 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs"
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
};
