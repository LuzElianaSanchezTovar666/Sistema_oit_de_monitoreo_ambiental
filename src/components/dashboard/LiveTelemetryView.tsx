import React from 'react';
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
} from 'lucide-react';
import { Ubicacion, Dispositivo, Sensor, Medicion, Alerta } from '../../types/iot';
import { TelemetryChart } from './TelemetryChart';

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

export const LiveTelemetryView: React.FC<LiveTelemetryViewProps> = ({
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
  const currentLocation = locations.find((l) => l.id_ubicacion === selectedLocationId) || locations[0];
  const currentDevice = devices.find((d) => d.ubicacion_id === currentLocation?.id_ubicacion);
  const currentSensor = sensors.find((s) => s.dispositivo_id === currentDevice?.id_dispositivo);

  const reading = currentSensor ? latestReadings[currentSensor.id_sensor] : null;
  const history = currentSensor ? readingsHistory[currentSensor.id_sensor] || [] : [];

  // Alerta pendiente sobre este espacio
  const locationAlert = activeAlerts.find(
    (a) => a.ubicacion_id === currentLocation?.id_ubicacion && a.estado !== 'RESUELTA'
  );

  const isOnline = currentDevice?.estado === 'ONLINE';

  return (
    <div className="space-y-6">
      {/* Selector de Recintos / Ubicaciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>{currentLocation?.nombre}</span>
            <span className="text-xs font-mono font-medium text-slate-400">
              [{currentLocation?.codigo_area}]
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {currentLocation?.descripcion}
          </p>
        </div>

        {/* Pestañas de Ubicaciones */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {locations.map((loc) => {
            const isSelected = loc.id_ubicacion === currentLocation?.id_ubicacion;
            const hasAlert = activeAlerts.some((a) => a.ubicacion_id === loc.id_ubicacion && a.estado !== 'RESUELTA');
            return (
              <button
                key={loc.id_ubicacion}
                onClick={() => onSelectLocation(loc.id_ubicacion)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{loc.nombre.split(' ')[0]} {loc.codigo_area.split('-')[1]}</span>
                {hasAlert && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Banner de Alerta Crítica Activa si existe */}
      {locationAlert && (
        <div className="flex items-center justify-between p-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400 font-mono">
                  ¡Alerta {locationAlert.nivel}!
                </span>
                <span className="text-xs text-red-600/80 dark:text-red-300/80">·</span>
                <span className="text-xs text-red-600/80 dark:text-red-300/80 font-mono">
                  {new Date(locationAlert.fecha_hora).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm font-semibold mt-0.5">{locationAlert.mensaje}</p>
            </div>
          </div>
          <button
            onClick={() => onOpenAlertModal(locationAlert)}
            className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition-colors shrink-0"
          >
            Atender Alerta
          </button>
        </div>
      )}

      {/* Grid de Métricas Principales en Tiempo Real */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tarjeta 1: Temperatura */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-emerald-500" />
              Temperatura
            </span>
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                reading?.es_fuera_de_umbral
                  ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 font-bold'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-medium'
              }`}
            >
              {reading?.es_fuera_de_umbral ? 'FUERA DE RANGO' : 'NOMINAL'}
            </span>
          </div>

          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums tracking-tight">
              {reading ? `${reading.temperatura.toFixed(2)}` : '--'}
              <span className="text-lg font-normal text-slate-400 ml-1">°C</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
              <span>Óptimo: {currentSensor?.limites.temp_min}°C - {currentSensor?.limites.temp_max}°C</span>
              <span>Z: {reading ? reading.z_score_temp : 0}σ</span>
            </div>
          </div>

          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                reading?.es_fuera_de_umbral ? 'bg-red-500' : 'bg-emerald-500'
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
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-blue-500" />
              Humedad Relativa
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-medium">
              ESTABLE
            </span>
          </div>

          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums tracking-tight">
              {reading ? `${reading.humedad.toFixed(1)}` : '--'}
              <span className="text-lg font-normal text-slate-400 ml-1">%RH</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
              <span>Banda: {currentSensor?.limites.hum_min}% - {currentSensor?.limites.hum_max}%</span>
              <span>Z: {reading ? reading.z_score_hum : 0}σ</span>
            </div>
          </div>

          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{
                width: reading ? `${Math.min(100, Math.max(5, reading.humedad))}%` : '50%',
              }}
            />
          </div>
        </div>

        {/* Tarjeta 3: Modelo de Anomalías IA (Isolation Forest) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <BrainCircuit className="w-4 h-4 text-purple-500" />
              Isolation Forest
            </span>
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded font-medium ${
                reading?.valor_anomalo
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
              }`}
            >
              {reading?.valor_anomalo ? 'ANOMALÍA DETECTADA' : 'INFERENCIA OK'}
            </span>
          </div>

          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums tracking-tight">
              {reading ? reading.score_anomalia_ia.toFixed(3) : '0.000'}
              <span className="text-xs font-normal text-slate-400 ml-2">Score</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
              <span>Umbral Alerta: &gt;0.70</span>
              <span>Latencia: 38ms</span>
            </div>
          </div>

          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                (reading?.score_anomalia_ia || 0) > 0.7 ? 'bg-amber-500' : 'bg-purple-500'
              }`}
              style={{
                width: `${Math.min(100, (reading?.score_anomalia_ia || 0) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Tarjeta 4: Enlace y Dispositivo IoT */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              {currentDevice?.tipo || 'ESP32-WROOM'}
            </span>
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded flex items-center gap-1 font-medium ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {isOnline ? <Wifi className="w-3 h-3 text-emerald-500" /> : <WifiOff className="w-3 h-3 text-slate-400" />}
              {isOnline ? 'ONLINE' : 'DESCONECTADO'}
            </span>
          </div>

          <div className="space-y-1 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-700 dark:text-slate-200">
              <span className="text-slate-400 font-sans">MAC:</span>
              <span className="font-semibold">{currentDevice?.mac_address}</span>
            </div>
            <div className="flex items-center justify-between text-slate-700 dark:text-slate-200">
              <span className="text-slate-400 font-sans">IP / RSSI:</span>
              <span>{currentDevice?.ip_address} · {currentDevice?.rssi_dbm} dBm</span>
            </div>
            <div className="flex items-center justify-between text-slate-700 dark:text-slate-200">
              <span className="text-slate-400 font-sans">Tópico:</span>
              <span className="truncate max-w-[130px]">{currentDevice?.mqtt_topic}</span>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> Último ping
            </span>
            <span className="font-mono text-slate-600 dark:text-slate-300">
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

      {/* Tabla de Lecturas Recientes en Vivo */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Historial de Ingesta Inmediata (TimescaleDB Stream)
            </h3>
            <span className="text-xs text-slate-400">· Últimos paquetes</span>
          </div>
          <button
            onClick={onOpenSimulator}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
          >
            Inyectar prueba de campo
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-2.5">ID Paquete</th>
                <th className="px-4 py-2.5">Estampa de Tiempo</th>
                <th className="px-4 py-2.5 text-right">Temperatura</th>
                <th className="px-4 py-2.5 text-right">Humedad</th>
                <th className="px-4 py-2.5 text-right">Z-Score</th>
                <th className="px-4 py-2.5 text-right">Score ML</th>
                <th className="px-4 py-2.5 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono tabular-nums">
              {history.slice(-6).reverse().map((m) => (
                <tr key={m.id_medicion} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-slate-400 font-mono">{m.id_medicion.slice(-10)}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                    {new Date(m.fecha_hora).toLocaleTimeString()}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${m.temperatura > (currentSensor?.limites.temp_max || 30) ? 'text-red-500' : 'text-slate-800 dark:text-slate-200'}`}>
                    {m.temperatura.toFixed(2)} °C
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-800 dark:text-slate-200">
                    {m.humedad.toFixed(1)} %RH
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500">
                    {m.z_score_temp}σ
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500">
                    {m.score_anomalia_ia}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {m.valor_anomalo ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-sans text-red-600 dark:text-red-400 font-semibold">
                        <AlertTriangle className="w-3 h-3" /> Anómalo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-sans text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Nominal
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
