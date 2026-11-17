import React, { useMemo } from 'react';
import {
  Thermometer,
  Droplets,
  Cpu,
  BrainCircuit,
  Wifi,
  WifiOff,
  AlertOctagon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Database,
} from 'lucide-react';
import { Ubicacion, Dispositivo, Sensor, Medicion, Alerta } from '../../types/iot';
import { TelemetryChart } from './TelemetryChart';
import { buildEntityIndexes, selectColumns } from '../../services/performanceEngine';
import { VirtualList } from '../common/VirtualList';

interface LiveTelemetryViewProps {
  locations: Ubicacion[];
  selectedLocationId: string;
  onSelectLocation: (id: string) => void;
  devices: Dispositivo[];
  sensors: Sensor[];
  latestReadings: { [sensorId: string]: Medicion };
  readingsHistory: { [sensorId: string]: Medicion[] };
  activeAlerts: Alerta[];
  onOpenAlertModal: (alert: Alerta) => void;
  onOpenSimulator: () => void;
}

export const LiveTelemetryView: React.FC<LiveTelemetryViewProps> = React.memo(({
  locations,
  selectedLocationId,
  onSelectLocation,
  devices,
  sensors,
  latestReadings,
  readingsHistory,
  activeAlerts,
  onOpenAlertModal,
  onOpenSimulator,
}) => {
  // Índices en memoria O(1) — Cero consultas N+1
  const entityIndexes = useMemo(
    () => buildEntityIndexes(locations, devices, sensors),
    [locations, devices, sensors]
  );

  const currentLocation = entityIndexes.locationById.get(selectedLocationId) || locations[0];
  const currentDevice = currentLocation
    ? entityIndexes.devicesByLocationId.get(currentLocation.id_ubicacion)?.[0]
    : undefined;
  const currentSensor = currentDevice
    ? entityIndexes.sensorByDeviceId.get(currentDevice.id_dispositivo)
    : undefined;

  const reading = currentSensor ? latestReadings[currentSensor.id_sensor] : null;
  const history = currentSensor ? readingsHistory[currentSensor.id_sensor] || [] : [];

  // Proyección de solo las columnas necesarias (SELECT id_medicion, fecha_hora, temperatura, humedad, z_score_temp, score_anomalia_ia, valor_anomalo)
  const projectedStreamRows = useMemo(() => {
    const reversed = history.slice().reverse();
    return selectColumns(reversed, [
      'id_medicion',
      'fecha_hora',
      'temperatura',
      'humedad',
      'z_score_temp',
      'score_anomalia_ia',
      'valor_anomalo',
    ]);
  }, [history]);

  // Alerta pendiente sobre este espacio
  const locationAlert = useMemo(
    () =>
      activeAlerts.find(
        (a) => a.ubicacion_id === currentLocation?.id_ubicacion && a.estado !== 'RESUELTA'
      ),
    [activeAlerts, currentLocation]
  );

  const isOnline = currentDevice?.estado === 'ONLINE';

  return (
    <div className="space-y-[24px]">
      {/* Selector de Recintos / Ubicaciones — Charcoal Stage (#FFFFFF, 28px radius) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FFFFFF] p-5 rounded-[16px]">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="apple-card-heading text-[#101f1e]">
              {currentLocation?.nombre}
            </h2>
            <span className="apple-badge-orange font-mono">
              {currentLocation?.codigo_area}
            </span>
          </div>
          <p className="text-[14px] text-[#535e5d] mt-1">
            {currentLocation?.descripcion}
          </p>
        </div>

        {/* Pestañas de Ubicaciones en cápsula #afc4bf */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-[8px] bg-[#f3f1ec] overflow-x-auto">
          {locations.map((loc) => {
            const isSelected = loc.id_ubicacion === currentLocation?.id_ubicacion;
            const hasAlert = activeAlerts.some((a) => a.ubicacion_id === loc.id_ubicacion && a.estado !== 'RESUELTA');
            return (
              <button
                key={loc.id_ubicacion}
                onClick={() => onSelectLocation(loc.id_ubicacion)}
                className={`flex items-center gap-2 px-4 py-1.5 text-[12px] tracking-[-0.12px] rounded-[8px] transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#104336] text-[#ffffff] font-semibold'
                    : 'text-[#535e5d] hover:text-[#101f1e]'
                }`}
              >
                <span>{loc.nombre.split(' ')[0]} {loc.codigo_area.split('-')[1]}</span>
                {hasAlert && (
                  <span className="w-2 h-2 rounded-full bg-[#DC2626] animate-ping" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Banner de Alerta Crítica Activa si existe */}
      {locationAlert && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-[16px] border border-[#DC2626]/50 bg-[#FFFFFF] text-[#101f1e] animate-fadeIn">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-[#DC2626] text-[#ffffff] flex items-center justify-center shrink-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-[#DC2626] font-mono">
                  ¡Alerta {locationAlert.nivel}!
                </span>
                <span className="text-xs text-[#535e5d]">·</span>
                <span className="text-xs text-[#535e5d] font-mono">
                  {new Date(locationAlert.fecha_hora).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-[14px] font-semibold text-[#101f1e] mt-0.5">{locationAlert.mensaje}</p>
            </div>
          </div>
          <button
            onClick={() => onOpenAlertModal(locationAlert)}
            className="apple-blue-pill px-5 py-2 text-[12px] font-semibold shrink-0"
          >
            Atender Alerta
          </button>
        </div>
      )}

      {/* Grid de Métricas Principales en Tiempo Real — Feature Metric Tiles (28px radius, 16px padding, no shadow) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px]">
        {/* Tarjeta 1: Temperatura */}
        <div className="bg-[#FFFFFF] rounded-[16px] p-[16px] space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#535e5d] flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-[#104336]" />
              Temperatura
            </span>
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded-[5px] font-semibold ${
                reading?.es_fuera_de_umbral
                  ? 'bg-[#DC2626]/20 text-[#DC2626]'
                  : 'bg-[#104336]/15 text-[#104336]'
              }`}
            >
              {reading?.es_fuera_de_umbral ? 'FUERA DE RANGO' : 'NOMINAL'}
            </span>
          </div>

          <div>
            <div
              className={`apple-metric-display tabular-nums ${
                reading?.es_fuera_de_umbral ? 'text-[#DC2626]' : 'text-[#104336]'
              }`}
            >
              {reading ? `${reading.temperatura.toFixed(1)}` : '--'}
              <span className="text-[20px] font-normal text-[#535e5d] ml-1">°C</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#535e5d] mt-2 font-mono">
              <span>Óptimo: {currentSensor?.limites.temp_min}° - {currentSensor?.limites.temp_max}°C</span>
              <span>Z: {reading ? reading.z_score_temp : 0}σ</span>
            </div>
          </div>

          <div className="w-full bg-[#f3f1ec] rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                reading?.es_fuera_de_umbral ? 'bg-[#DC2626]' : 'bg-[#104336]'
              }`}
              style={{
                width: reading
                  ? `${Math.min(100, Math.max(10, ((reading.temperatura - (currentSensor?.limites.temp_min || 0)) / ((currentSensor?.limites.temp_max || 10) - (currentSensor?.limites.temp_min || 0))) * 100))}%`
                  : '50%',
              }}
            />
          </div>
        </div>

        {/* Tarjeta 2: Humedad Relativa */}
        <div className="bg-[#FFFFFF] rounded-[16px] p-[16px] space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#535e5d] flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-[#104336]" />
              Humedad Relativa
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-[5px] bg-[#f3f1ec] text-[#101f1e] font-medium">
              ESTABLE
            </span>
          </div>

          <div>
            <div className="apple-metric-display text-[#101f1e] tabular-nums">
              {reading ? `${reading.humedad.toFixed(1)}` : '--'}
              <span className="text-[20px] font-normal text-[#535e5d] ml-1">%RH</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#535e5d] mt-2 font-mono">
              <span>Banda: {currentSensor?.limites.hum_min}% - {currentSensor?.limites.hum_max}%</span>
              <span>Z: {reading ? reading.z_score_hum : 0}σ</span>
            </div>
          </div>

          <div className="w-full bg-[#f3f1ec] rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-[#104336] transition-all duration-500"
              style={{
                width: reading ? `${Math.min(100, Math.max(5, reading.humedad))}%` : '50%',
              }}
            />
          </div>
        </div>

        {/* Tarjeta 3: Modelo de Anomalías IA (Isolation Forest) */}
        <div className="bg-[#FFFFFF] rounded-[16px] p-[16px] space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#535e5d] flex items-center gap-1.5">
              <BrainCircuit className="w-4 h-4 text-[#104336]" />
              Isolation Forest
            </span>
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded-[5px] font-semibold ${
                reading?.valor_anomalo
                  ? 'apple-badge-orange'
                  : 'bg-[#104336]/15 text-[#104336]'
              }`}
            >
              {reading?.valor_anomalo ? 'ANOMALÍA' : 'INFERENCIA OK'}
            </span>
          </div>

          <div>
            <div
              className={`apple-metric-display tabular-nums ${
                reading?.valor_anomalo ? 'text-[#DC2626]' : 'text-[#101f1e]'
              }`}
            >
              {reading ? reading.score_anomalia_ia.toFixed(2) : '0.00'}
              <span className="text-[14px] font-normal text-[#535e5d] ml-1.5">Score</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#535e5d] mt-2 font-mono">
              <span>Umbral Alerta: &gt;0.70</span>
              <span>Latencia: 38ms</span>
            </div>
          </div>

          <div className="w-full bg-[#f3f1ec] rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                (reading?.score_anomalia_ia || 0) > 0.7 ? 'bg-[#DC2626]' : 'bg-[#104336]'
              }`}
              style={{
                width: `${Math.min(100, (reading?.score_anomalia_ia || 0) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Tarjeta 4: Enlace y Dispositivo IoT */}
        <div className="bg-[#FFFFFF] rounded-[16px] p-[16px] space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#535e5d] flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-[#101f1e]" />
              {currentDevice?.tipo || 'ESP32-WROOM'}
            </span>
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded-[5px] flex items-center gap-1 font-semibold ${
                isOnline
                  ? 'bg-[#104336]/15 text-[#104336]'
                  : 'bg-[#f3f1ec] text-[#535e5d]'
              }`}
            >
              {isOnline ? <Wifi className="w-3 h-3 text-[#104336]" /> : <WifiOff className="w-3 h-3 text-[#535e5d]" />}
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex items-center justify-between text-[#101f1e]">
              <span className="text-[#535e5d] font-sans">MAC:</span>
              <span className="font-semibold">{currentDevice?.mac_address}</span>
            </div>
            <div className="flex items-center justify-between text-[#101f1e]">
              <span className="text-[#535e5d] font-sans">IP / RSSI:</span>
              <span>{currentDevice?.ip_address} · {currentDevice?.rssi_dbm} dBm</span>
            </div>
            <div className="flex items-center justify-between text-[#101f1e]">
              <span className="text-[#535e5d] font-sans">Tópico:</span>
              <span className="truncate max-w-[130px] text-[#104336]">{currentDevice?.mqtt_topic}</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-[11px] text-[#535e5d] border-t border-[#afc4bf]/60">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> Último ping
            </span>
            <span className="font-mono text-[#101f1e]">
              {reading ? new Date(reading.timestamp).toLocaleTimeString() : 'Hace instantes'}
            </span>
          </div>
        </div>
      </div>

      {/* Gráfico de Telemetría Dinámico */}
      {currentSensor && (
        <TelemetryChart
          readings={history}
          limites={currentSensor.limites}
          sensorType={currentSensor.tipo_sensor}
          locationName={currentLocation.nombre}
        />
      )}

      {/* Lista Virtualizada de Lecturas Recientes en Vivo — Charcoal Stage (#FFFFFF, 28px radius) */}
      <div className="bg-[#FFFFFF] rounded-[16px] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#afc4bf]/60 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <h3 className="text-[17px] font-semibold tracking-[-0.374px] text-[#101f1e]">
              Historial de Ingesta Inmediata (TimescaleDB Stream Virtualizado)
            </h3>
            <span className="px-2 py-0.5 rounded-[5px] bg-[#f3f1ec] text-[#104336] text-[10px] font-mono flex items-center gap-1">
              <Database className="w-3 h-3" /> 7 columnas proyectadas · idx_mediciones_sensor_fecha
            </span>
          </div>
          <button
            onClick={onOpenSimulator}
            className="apple-inline-link text-[12px] font-semibold"
          >
            Inyectar prueba de campo →
          </button>
        </div>

        {/* Cabecera fija para la lista virtualizada */}
        <div className="grid grid-cols-7 bg-[#f3f1ec] text-[#535e5d] font-mono text-[11px] uppercase tracking-wider border-b border-[#afc4bf]/60 px-5 py-2.5">
          <div>ID Paquete</div>
          <div>Estampa de Tiempo</div>
          <div className="text-right">Temperatura</div>
          <div className="text-right">Humedad</div>
          <div className="text-right">Z-Score</div>
          <div className="text-right">Score ML</div>
          <div className="text-center">Estado</div>
        </div>

        {/* VirtualList: solo renderiza las filas visibles en el viewport */}
        <VirtualList
          items={projectedStreamRows}
          rowHeight={42}
          viewportHeight={252}
          keyExtractor={(m) => m.id_medicion}
          renderItem={(m) => (
            <div
              className="grid grid-cols-7 items-center px-5 h-[42px] border-b border-[#afc4bf]/30 hover:bg-[#f3f1ec]/50 transition-colors font-mono text-xs tabular-nums"
            >
              <div className="text-[#535e5d] truncate">{m.id_medicion.slice(-10)}</div>
              <div className="text-[#101f1e]">
                {new Date(m.fecha_hora).toLocaleTimeString()}
              </div>
              <div
                className={`text-right font-semibold ${
                  m.temperatura > (currentSensor?.limites.temp_max || 30)
                    ? 'text-[#DC2626]'
                    : 'text-[#104336]'
                }`}
              >
                {m.temperatura.toFixed(2)} °C
              </div>
              <div className="text-right text-[#101f1e]">
                {m.humedad.toFixed(1)} %RH
              </div>
              <div className="text-right text-[#535e5d]">{m.z_score_temp}σ</div>
              <div className="text-right text-[#535e5d]">{m.score_anomalia_ia}</div>
              <div className="text-center">
                {m.valor_anomalo ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-sans text-[#DC2626] font-semibold">
                    <AlertTriangle className="w-3 h-3" /> Anómalo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-sans text-[#104336] font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Nominal
                  </span>
                )}
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
});
