import React, { useMemo, useState, useEffect } from 'react';
import {
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
import { TemperatureKpiCard } from './TemperatureKpiCard';
import { buildEntityIndexes, selectColumns } from '../../services/performanceEngine';
import { VirtualList } from '../common/VirtualList';
import {
  DashboardMedicionDTO,
  DashboardUbicacionResumenDTO,
  fetchDashboardMedicionesPorUbicacion,
  fetchDispositivosByUbicacion,
} from '../../services/locationService';
import {
  DashboardTelemetryItemDTO,
  DashboardTelemetrySensorDTO,
  fetchDashboardTelemetry,
  fetchLocationTemperature,
  LocationTemperatureSnapshotDTO,
} from '../../services/sensorService';

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

  // RF-03 & RF-05: Datos reales en MySQL filtrados por ubicación y dispositivo + configuración de variables
  const [selectedMysqlDeviceId, setSelectedMysqlDeviceId] = useState<string>('ALL');
  const [mysqlDevicesInLoc, setMysqlDevicesInLoc] = useState<
    Array<{ id_dispositivo: string; codigo: string; nombre: string; mac_address: string; tipo: string; estado: string }>
  >([]);
  const [mysqlMediciones, setMysqlMediciones] = useState<DashboardMedicionDTO[]>([]);
  const [mysqlResumen, setMysqlResumen] = useState<DashboardUbicacionResumenDTO[]>([]);
  const [mysqlSensorConfigs, setMysqlSensorConfigs] = useState<DashboardTelemetrySensorDTO[]>([]);
  const [mysqlTelemetry, setMysqlTelemetry] = useState<DashboardTelemetryItemDTO[]>([]);

  // RF-08: Estado en tiempo real de temperatura actual (°C) vía SSE post-COMMIT de RF-07
  const [rf08Snapshot, setRf08Snapshot] = useState<LocationTemperatureSnapshotDTO | null>(null);
  const [rf08StreamConnected, setRf08StreamConnected] = useState<boolean>(false);
  const [rf08Stale, setRf08Stale] = useState<boolean>(false);

  useEffect(() => {
    const locId = currentLocation?.id_ubicacion;
    // Limpiar inmediatamente lecturas de la ubicación anterior al cambiar de recinto
    setRf08Snapshot(null);
    setRf08StreamConnected(false);
    setRf08Stale(false);
    if (!locId) return;

    let active = true;
    fetchLocationTemperature(locId)
      .then((snap) => {
        if (!active) return;
        setRf08Snapshot(snap);
        setRf08Stale(!snap.datos_recientes);
      })
      .catch(() => {
        if (!active) return;
        setRf08Stale(true);
      });

    let es: EventSource | null = null;
    if (typeof EventSource !== 'undefined') {
      es = new EventSource(
        `/api/mediciones/stream/temperatura?ubicacion_id=${encodeURIComponent(locId)}`,
        { withCredentials: true }
      );
      const handleEvent = (ev: MessageEvent) => {
        if (!active) return;
        try {
          const data: LocationTemperatureSnapshotDTO = JSON.parse(ev.data);
          if (data.ubicacion_id !== locId) return;
          setRf08Snapshot(data);
          setRf08StreamConnected(true);
          setRf08Stale(!data.datos_recientes);
        } catch {
          // Ignorar payload corrupto sin romper UI
        }
      };
      es.addEventListener('snapshot', handleEvent as EventListener);
      es.addEventListener('temperatura', handleEvent as EventListener);
      es.onopen = () => {
        if (active) setRf08StreamConnected(true);
      };
      es.onerror = () => {
        if (active) setRf08StreamConnected(false);
      };
    }

    const freshnessTimer = window.setInterval(() => {
      setRf08Snapshot((prev) => {
        if (!prev || !prev.fecha_hora_utc) {
          setRf08Stale(true);
          return prev;
        }
        const ageMs = Date.now() - new Date(prev.fecha_hora_utc).getTime();
        const maxMs = (prev.antiguedad_max_segundos || 30) * 1000;
        setRf08Stale(ageMs > maxMs);
        return prev;
      });
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(freshnessTimer);
      if (es) es.close();
    };
  }, [currentLocation?.id_ubicacion]);

  useEffect(() => {
    setSelectedMysqlDeviceId('ALL');
  }, [currentLocation?.id_ubicacion]);

  useEffect(() => {
    let active = true;
    const locId = currentLocation?.id_ubicacion;
    if (!locId) return;

    Promise.all([
      fetchDispositivosByUbicacion(locId).catch(() => null),
      fetchDashboardMedicionesPorUbicacion(locId).catch(() => null),
      fetchDashboardTelemetry({
        ubicacion_id: locId,
        dispositivo_id: selectedMysqlDeviceId !== 'ALL' ? selectedMysqlDeviceId : undefined,
        limit: 60,
      }).catch(() => null),
    ]).then(([devRes, medRes, telRes]) => {
      if (!active) return;
      if (devRes) setMysqlDevicesInLoc(devRes.items);
      if (medRes) {
        setMysqlMediciones(medRes.mediciones);
        setMysqlResumen(medRes.resumen_por_ubicacion);
      }
      if (telRes) {
        setMysqlSensorConfigs(telRes.sensores);
        setMysqlTelemetry(telRes.mediciones);
      }
    });

    return () => {
      active = false;
    };
  }, [currentLocation?.id_ubicacion, selectedMysqlDeviceId]);

  const activeSensorConfig = useMemo(() => {
    if (mysqlSensorConfigs.length === 0) return null;
    return mysqlSensorConfigs.find((s) => s.estado === 'ACTIVO') || mysqlSensorConfigs[0];
  }, [mysqlSensorConfigs]);

  const tempEnabled = activeSensorConfig ? activeSensorConfig.temperatura_habilitada : true;
  const humEnabled = activeSensorConfig ? activeSensorConfig.humedad_habilitada : true;
  const presEnabled = activeSensorConfig ? activeSensorConfig.presion_habilitada : false;

  const latestMysqlReading = mysqlTelemetry.length > 0 ? mysqlTelemetry[mysqlTelemetry.length - 1] : null;
  const displayTemp: number | null = tempEnabled
    ? (latestMysqlReading ? latestMysqlReading.temperatura : (reading ? reading.temperatura : null))
    : null;
  const displayHum: number | null = humEnabled
    ? (latestMysqlReading ? latestMysqlReading.humedad : (reading ? reading.humedad : null))
    : null;
  const displayPres: number | null = presEnabled
    ? (latestMysqlReading ? latestMysqlReading.presion : null)
    : null;

  const chartReadings = useMemo(() => {
    if (mysqlTelemetry.length > 0) {
      return mysqlTelemetry.map((m) => ({
        id_medicion: String(m.id_medicion),
        sensor_id: m.sensor_id || activeSensorConfig?.sensor_id || '',
        dispositivo_id: m.dispositivo_id,
        ubicacion_id: m.ubicacion_id || currentLocation?.id_ubicacion || '',
        temperatura: tempEnabled ? m.temperatura : null,
        humedad: humEnabled ? m.humedad : null,
        z_score_temp: 0,
        z_score_hum: 0,
        score_anomalia_ia: 0,
        valor_anomalo: m.alerta_generada,
        es_fuera_de_umbral: m.alerta_generada,
        fecha_hora: m.fecha_hora,
        timestamp: new Date(m.fecha_hora).getTime(),
      }));
    }
    return history.map((h) => ({
      ...h,
      temperatura: tempEnabled ? h.temperatura : null,
      humedad: humEnabled ? h.humedad : null,
    }));
  }, [mysqlTelemetry, history, tempEnabled, humEnabled, activeSensorConfig?.sensor_id]);

  return (
    <div className="space-y-[24px]">
      {/* Selector de Recintos / Ubicaciones — Charcoal Stage (#FFFFFF, 28px radius) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-sheet-white p-5 rounded-[16px]">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="apple-card-heading text-bark">
              {currentLocation?.nombre}
            </h2>
            <span className="apple-badge-orange font-mono">
              {currentLocation?.codigo_area}
            </span>
          </div>
          <p className="text-[14px] text-slate mt-1">
            {currentLocation?.descripcion}
          </p>
        </div>

        {/* Pestañas de Ubicaciones en cápsula #afc4bf */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-[8px] bg-cream-paper overflow-x-auto">
          {locations.map((loc) => {
            const isSelected = loc.id_ubicacion === currentLocation?.id_ubicacion;
            const hasAlert = activeAlerts.some((a) => a.ubicacion_id === loc.id_ubicacion && a.estado !== 'RESUELTA');
            return (
              <button
                key={loc.id_ubicacion}
                onClick={() => onSelectLocation(loc.id_ubicacion)}
                className={`flex items-center gap-2 px-4 py-1.5 text-[12px] tracking-[-0.12px] rounded-[8px] transition-colors whitespace-nowrap ${
                  isSelected
                    ? 'bg-canopy text-sheet-white font-semibold'
                    : 'text-slate hover:text-bark'
                }`}
              >
                <span className="truncate max-w-[160px]" title={loc.nombre}>
                  {loc.nombre}
                </span>
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-[16px] border border-[#DC2626]/50 bg-sheet-white text-bark animate-fadeIn">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-[#DC2626] text-sheet-white flex items-center justify-center shrink-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-[#DC2626] font-mono">
                  ¡Alerta {locationAlert.nivel}!
                </span>
                <span className="text-xs text-slate">·</span>
                <span className="text-xs text-slate font-mono">
                  {new Date(locationAlert.fecha_hora).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-[14px] font-semibold text-bark mt-0.5">{locationAlert.mensaje}</p>
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

      {/* Filtro por Dispositivo MySQL en ubicación actual (RF-05) */}
      {mysqlDevicesInLoc.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-sheet-white px-5 py-3 rounded-[16px]">
          <div className="text-xs text-slate">
            <span className="font-semibold text-bark">Dispositivo en MySQL:</span>{' '}
            {activeSensorConfig ? (
              <span className="font-mono text-canopy">
                Sensor {activeSensorConfig.identificador} ({activeSensorConfig.modelo}) · Variables:{' '}
                {activeSensorConfig.variables_habilitadas.map((v) => `${v.variable} (${v.unidad})`).join(', ')}
              </span>
            ) : (
              <span>Sin sensor vinculado en MySQL</span>
            )}
          </div>
          <select
            value={selectedMysqlDeviceId}
            onChange={(e) => setSelectedMysqlDeviceId(e.target.value)}
            aria-label="Filtrar por dispositivo en MySQL"
            className="px-3 py-1.5 rounded-[8px] bg-cream-paper border border-sage-mist text-xs text-bark font-mono"
          >
            <option value="ALL">Todos los dispositivos ({mysqlDevicesInLoc.length})</option>
            {mysqlDevicesInLoc.map((d) => (
              <option key={d.id_dispositivo} value={d.id_dispositivo}>
                {d.nombre} ({d.codigo})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Grid de Métricas Principales en Tiempo Real — Feature Metric Tiles (28px radius, 16px padding, no shadow) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px]">
        {/* Tarjeta 1: Temperatura Actual °C (RF-08, solo si está habilitada en RF-05) */}
        {tempEnabled && (
          <TemperatureKpiCard
            snapshot={rf08Snapshot}
            locationName={currentLocation?.nombre || ''}
            streamConnected={rf08StreamConnected}
            isStale={rf08Stale}
          />
        )}

        {/* Tarjeta 2: Humedad Relativa (solo si está habilitada en RF-05) */}
        {humEnabled && (() => {
          const humMin = activeSensorConfig?.limites.hum_min ?? currentSensor?.limites.hum_min ?? 0;
          const humMax = activeSensorConfig?.limites.hum_max ?? currentSensor?.limites.hum_max ?? 100;
          const humOutOfRange = displayHum !== null && (displayHum < humMin || displayHum > humMax);
          return (
            <div className="bg-sheet-white rounded-[16px] p-[16px] space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-slate flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-canopy" />
                  Humedad Relativa
                </span>
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded-[5px] font-semibold ${
                    humOutOfRange
                      ? 'bg-[#DC2626]/20 text-[#DC2626]'
                      : 'bg-canopy/15 text-canopy'
                  }`}
                >
                  {humOutOfRange ? 'FUERA DE RANGO' : 'NOMINAL'}
                </span>
              </div>

          <div>
            <div className="apple-metric-display text-bark tabular-nums">
              {displayHum !== null ? `${displayHum.toFixed(1)}` : '--'}
              <span className="text-[20px] font-normal text-slate ml-1">%RH</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate mt-2 font-mono">
              <span>Banda: {humMin}% - {humMax}%</span>
              <span>Z: {reading ? reading.z_score_hum : '--'}σ</span>
            </div>
          </div>

          <div className="w-full bg-cream-paper rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                humOutOfRange ? 'bg-[#DC2626]' : 'bg-canopy'
              }`}
              style={{
                width: displayHum !== null ? `${Math.min(100, Math.max(5, displayHum))}%` : '0%',
              }}
            />
          </div>
        </div>
          );
        })()}

        {/* Tarjeta Opcional BME280: Presión Atmosférica (solo si está habilitada en RF-05) */}
        {presEnabled && (
          <div className="bg-sheet-white rounded-[16px] p-[16px] space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-slate">Presión Atmosférica</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-[5px] font-semibold bg-canopy/15 text-canopy">
                BME280
              </span>
            </div>
            <div>
              <div className="apple-metric-display text-bark tabular-nums">
                {displayPres !== null ? `${displayPres.toFixed(1)}` : '--'}
                <span className="text-[20px] font-normal text-slate ml-1">hPa</span>
              </div>
              <div className="text-[11px] text-slate mt-2 font-mono">
                Banda: {activeSensorConfig?.limites.presion_min ?? 980} - {activeSensorConfig?.limites.presion_max ?? 1030} hPa
              </div>
            </div>
          </div>
        )}

        {/* Tarjeta 3: Modelo de Anomalías IA (Isolation Forest) */}
        <div className="bg-sheet-white rounded-[16px] p-[16px] space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-slate flex items-center gap-1.5">
              <BrainCircuit className="w-4 h-4 text-canopy" />
              Isolation Forest
            </span>
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded-[5px] font-semibold ${
                reading?.valor_anomalo
                  ? 'apple-badge-orange'
                  : 'bg-canopy/15 text-canopy'
              }`}
            >
              {reading?.valor_anomalo ? 'ANOMALÍA' : 'INFERENCIA OK'}
            </span>
          </div>

          <div>
            <div
              className={`apple-metric-display tabular-nums ${
                reading?.valor_anomalo ? 'text-[#DC2626]' : 'text-bark'
              }`}
            >
              {reading ? reading.score_anomalia_ia.toFixed(2) : '0.00'}
              <span className="text-[14px] font-normal text-slate ml-1.5">Score</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate mt-2 font-mono">
              <span>Umbral Alerta: &gt;0.70</span>
              <span>Latencia: 38ms</span>
            </div>
          </div>

          <div className="w-full bg-cream-paper rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                (reading?.score_anomalia_ia || 0) > 0.7 ? 'bg-[#DC2626]' : 'bg-canopy'
              }`}
              style={{
                width: `${Math.min(100, (reading?.score_anomalia_ia || 0) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Tarjeta 4: Enlace y Dispositivo IoT */}
        <div className="bg-sheet-white rounded-[16px] p-[16px] space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-slate flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-bark" />
              {currentDevice?.tipo || 'ESP32-WROOM'}
            </span>
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded-[5px] flex items-center gap-1 font-semibold ${
                isOnline
                  ? 'bg-canopy/15 text-canopy'
                  : 'bg-cream-paper text-slate'
              }`}
            >
              {isOnline ? <Wifi className="w-3 h-3 text-canopy" /> : <WifiOff className="w-3 h-3 text-slate" />}
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex items-center justify-between text-bark">
              <span className="text-slate font-sans">MAC:</span>
              <span className="font-semibold">{currentDevice?.mac_address}</span>
            </div>
            <div className="flex items-center justify-between text-bark">
              <span className="text-slate font-sans">IP / RSSI:</span>
              <span>{currentDevice?.ip_address} · {currentDevice?.rssi_dbm} dBm</span>
            </div>
            <div className="flex items-center justify-between text-bark">
              <span className="text-slate font-sans">Tópico:</span>
              <span className="truncate max-w-[130px] text-canopy">{currentDevice?.mqtt_topic}</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-[11px] text-slate border-t border-sage-mist/60">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> Último ping
            </span>
            <span className="font-mono text-bark">
              {reading ? new Date(reading.timestamp).toLocaleTimeString() : 'Hace instantes'}
            </span>
          </div>
        </div>
      </div>

      {/* Gráfico de Telemetría Dinámico */}
      {(currentSensor || activeSensorConfig) && (
        <TelemetryChart
          readings={chartReadings}
          limites={{
            temp_min: activeSensorConfig?.limites.temp_min ?? currentSensor?.limites.temp_min ?? 18,
            temp_max: activeSensorConfig?.limites.temp_max ?? currentSensor?.limites.temp_max ?? 25,
            temp_critica_max: currentSensor?.limites.temp_critica_max ?? ((activeSensorConfig?.limites.temp_max ?? 25) + 5),
            hum_min: activeSensorConfig?.limites.hum_min ?? currentSensor?.limites.hum_min ?? 40,
            hum_max: activeSensorConfig?.limites.hum_max ?? currentSensor?.limites.hum_max ?? 70,
            hum_critica_max: currentSensor?.limites.hum_critica_max ?? ((activeSensorConfig?.limites.hum_max ?? 70) + 10),
          }}
          sensorType={activeSensorConfig?.modelo || currentSensor?.tipo_sensor || 'DHT22'}
          locationName={currentLocation?.nombre || ''}
          enabledVariables={{
            temperatura: tempEnabled,
            humedad: humEnabled,
            presion: presEnabled,
          }}
        />
      )}

      {/* Lista Virtualizada de Lecturas Recientes en Vivo — Charcoal Stage (#FFFFFF, 28px radius) */}
      <div className="bg-sheet-white rounded-[16px] overflow-hidden">
        <div className="px-6 py-4 border-b border-sage-mist/60 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <h3 className="text-[17px] font-semibold tracking-[-0.374px] text-bark">
              Lecturas recientes
            </h3>
            <span className="px-2 py-0.5 rounded-[5px] bg-cream-paper text-canopy text-[10px] font-mono flex items-center gap-1">
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
        <div className="grid grid-cols-7 bg-cream-paper text-slate font-mono text-[11px] uppercase tracking-wider border-b border-sage-mist/60 px-5 py-2.5">
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
              className="grid grid-cols-7 items-center px-5 h-[42px] border-b border-sage-mist/30 hover:bg-cream-paper/50 transition-colors font-mono text-xs tabular-nums"
            >
              <div className="text-slate truncate">{m.id_medicion.slice(-10)}</div>
              <div className="text-bark">
                {new Date(m.fecha_hora).toLocaleTimeString()}
              </div>
              <div
                className={`text-right font-semibold ${
                  m.temperatura > (currentSensor?.limites.temp_max || 30)
                    ? 'text-[#DC2626]'
                    : 'text-canopy'
                }`}
              >
                {m.temperatura.toFixed(2)} °C
              </div>
              <div className="text-right text-bark">
                {m.humedad.toFixed(1)} %RH
              </div>
              <div className="text-right text-slate">{m.z_score_temp}σ</div>
              <div className="text-right text-slate">{m.score_anomalia_ia}</div>
              <div className="text-center">
                {m.valor_anomalo ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-sans text-[#DC2626] font-semibold">
                    <AlertTriangle className="w-3 h-3" /> Anómalo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-sans text-canopy font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Nominal
                  </span>
                )}
              </div>
            </div>
          )}
        />
      </div>

      {/* RF-03: Dispositivos y Mediciones Históricas en MySQL por Ubicación */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-sheet-white rounded-[16px] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-bark">
              Dispositivos asignados en MySQL ({currentLocation?.nombre})
            </h3>
            <span className="text-[11px] font-mono text-canopy">
              {mysqlDevicesInLoc.length} nodo(s)
            </span>
          </div>
          {mysqlDevicesInLoc.length === 0 ? (
            <p className="text-xs text-slate">
              No hay nodos registrados en MySQL para {currentLocation?.nombre}.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {mysqlDevicesInLoc.map((d) => (
                <div
                  key={d.id_dispositivo}
                  className="p-2.5 rounded-[10px] bg-cream-paper border border-sage-mist flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-bark">{d.nombre}</div>
                    <div className="font-mono text-slate">
                      {d.codigo} · {d.mac_address} · {d.tipo}
                    </div>
                  </div>
                  <span className="font-mono text-canopy">{d.estado}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-sheet-white rounded-[16px] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-bark">
              Agrupación de mediciones por ubicación (MySQL)
            </h3>
            <span className="text-[11px] font-mono text-slate">
              {mysqlMediciones.length} en recinto actual
            </span>
          </div>
          <div className="space-y-2 text-xs">
            {mysqlResumen.map((r) => (
              <div
                key={r.ubicacion_id}
                className="p-2.5 rounded-[10px] bg-cream-paper border border-sage-mist flex items-center justify-between"
              >
                <div>
                  <span className="font-medium text-bark">{r.ubicacion_nombre}</span>{' '}
                  <span className="font-mono text-slate">({r.codigo_area})</span>
                </div>
                <div className="font-mono text-canopy">
                  {r.total_mediciones} lecturas
                  {r.promedio_temp !== null ? ` · ${r.promedio_temp}°C / ${r.promedio_hum}%` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
