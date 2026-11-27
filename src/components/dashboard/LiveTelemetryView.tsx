import React, { useMemo, useState, useEffect } from 'react';
import { useSiteDataVersion } from '../../services/siteData';
import {
  BrainCircuit,
  AlertOctagon,
  CheckCircle2,
  AlertTriangle,
  Database,
} from 'lucide-react';
import { Ubicacion, Alerta } from '../../types/iot';
import { DeviceConnectivity } from '../../services/deviceService';
import { DeviceConnectivityPanel } from '../devices/DeviceConnectivity';
import { TelemetryChart } from './TelemetryChart';
import { TemperatureKpiCard } from './TemperatureKpiCard';
import { HumidityKpiCard } from './HumidityKpiCard';
import { VirtualList } from '../common/VirtualList';
import {
  DashboardMedicionDTO,
  DashboardUbicacionResumenDTO,
  fetchDashboardMedicionesPorUbicacion,
} from '../../services/locationService';
import {
  DashboardTelemetryItemDTO,
  DashboardTelemetrySensorDTO,
  fetchDashboardTelemetry,
  fetchLocationHumidity,
  fetchLocationTemperature,
  LocationHumiditySnapshotDTO,
  LocationTemperatureSnapshotDTO,
} from '../../services/sensorService';

interface LiveTelemetryViewProps {
  locations: Ubicacion[];
  selectedLocationId: string;
  onSelectLocation: (id: string) => void;
  connectivity: DeviceConnectivity[] | null;
  activeAlerts: Alerta[];
  onOpenAlertModal: (alert: Alerta) => void;
}

export const LiveTelemetryView: React.FC<LiveTelemetryViewProps> = React.memo(({
  locations,
  selectedLocationId,
  onSelectLocation,
  connectivity,
  activeAlerts,
  onOpenAlertModal,
}) => {
  const currentLocation = locations.find((location) => location.id_ubicacion === selectedLocationId) || locations[0];
  const mysqlDevicesInLoc = connectivity?.filter((device) => device.ubicacion_id === currentLocation?.id_ubicacion);

  // Alerta pendiente sobre este espacio
  const locationAlert = useMemo(
    () =>
      activeAlerts.find(
        (a) => a.ubicacion_id === currentLocation?.id_ubicacion && a.estado !== 'RESUELTA'
      ),
    [activeAlerts, currentLocation]
  );

  const globalConnectivityStats = useMemo(() => {
    if (!connectivity) return null;
    let online = 0;
    let totalActivos = 0;
    for (const d of connectivity) {
      if (d.estado !== 'INACTIVO' && d.activo_administrativamente !== false) {
        totalActivos++;
        if (d.estado === 'ONLINE') online++;
      }
    }
    return { online, totalActivos };
  }, [connectivity]);

  const [selectedMysqlDeviceId, setSelectedMysqlDeviceId] = useState('ALL');
  const effectiveDeviceId = mysqlDevicesInLoc?.some((device) => device.id_dispositivo === selectedMysqlDeviceId)
    ? selectedMysqlDeviceId : 'ALL';
  const catalogRevision = useSiteDataVersion('ubicaciones', 'dispositivos', 'sensores', 'umbrales');
  const [mysqlMediciones, setMysqlMediciones] = useState<DashboardMedicionDTO[]>([]);
  const [mysqlResumen, setMysqlResumen] = useState<DashboardUbicacionResumenDTO[]>([]);
  const [mysqlSensorConfigs, setMysqlSensorConfigs] = useState<DashboardTelemetrySensorDTO[]>([]);
  const [mysqlTelemetry, setMysqlTelemetry] = useState<DashboardTelemetryItemDTO[]>([]);

  // RF-08 & RF-09: Estado en tiempo real de temperatura (°C) y humedad (%RH) vía SSE único post-COMMIT de RF-07
  const [rf08Snapshot, setRf08Snapshot] = useState<LocationTemperatureSnapshotDTO | null>(null);
  const [rf09Snapshot, setRf09Snapshot] = useState<LocationHumiditySnapshotDTO | null>(null);
  const [rf08StreamConnected, setRf08StreamConnected] = useState<boolean>(false);
  const [rf08Stale, setRf08Stale] = useState<boolean>(false);
  const [rf09Stale, setRf09Stale] = useState<boolean>(false);

  useEffect(() => {
    const locId = currentLocation?.id_ubicacion;
    // Limpiar inmediatamente lecturas de la ubicación anterior al cambiar de recinto
    setRf08Snapshot(null);
    setRf09Snapshot(null);
    setRf08StreamConnected(false);
    setRf08Stale(false);
    setRf09Stale(false);
    if (!locId) return;

    let active = true;
    const refreshSnapshots = async () => {
      const [temperature, humidity] = await Promise.all([
        fetchLocationTemperature(locId).catch(() => null),
        fetchLocationHumidity(locId).catch(() => null),
      ]);
      if (!active) return;
      setRf08Snapshot(temperature);
      setRf09Snapshot(humidity);
      setRf08Stale(!temperature?.datos_recientes);
      setRf09Stale(!humidity?.datos_recientes);
    };

    let es: EventSource | null = null;
    if (typeof EventSource !== 'undefined') {
      es = new EventSource(
        `/api/mediciones/stream/temperatura?ubicacion_id=${encodeURIComponent(locId)}`,
        { withCredentials: true }
      );
      const handleTempOrSnapshot = (ev: MessageEvent) => {
        if (!active) return;
        try {
          const data = JSON.parse(ev.data) as LocationTemperatureSnapshotDTO & {
            humedad_snapshot?: LocationHumiditySnapshotDTO | null;
          };
          if (data.ubicacion_id !== locId) return;
          setRf08Snapshot(data);
          setRf08StreamConnected(true);
          setRf08Stale(!data.datos_recientes);
          if (data.humedad_snapshot && data.humedad_snapshot.ubicacion_id === locId) {
            setRf09Snapshot(data.humedad_snapshot);
            setRf09Stale(!data.humedad_snapshot.datos_recientes);
          }
        } catch {
          // Ignorar payload corrupto sin romper UI
        }
      };
      const handleHumidity = (ev: MessageEvent) => {
        if (!active) return;
        try {
          const hData = JSON.parse(ev.data) as LocationHumiditySnapshotDTO;
          if (hData.ubicacion_id !== locId) return;
          setRf09Snapshot(hData);
          setRf08StreamConnected(true);
          setRf09Stale(!hData.datos_recientes);
        } catch {
          // Ignorar payload corrupto sin romper UI
        }
      };
      es.addEventListener('snapshot', handleTempOrSnapshot as EventListener);
      es.addEventListener('temperatura', handleTempOrSnapshot as EventListener);
      es.addEventListener('humedad', handleHumidity as EventListener);
      es.onopen = () => {
        if (active) setRf08StreamConnected(true);
      };
      es.onerror = () => {
        if (active) setRf08StreamConnected(false);
      };
    }

    void refreshSnapshots();
    const snapshotTimer = window.setInterval(refreshSnapshots, 5000);
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
      setRf09Snapshot((prev) => {
        if (!prev || !prev.fecha_hora_utc) {
          setRf09Stale(true);
          return prev;
        }
        const ageMs = Date.now() - new Date(prev.fecha_hora_utc).getTime();
        const maxMs = (prev.antiguedad_max_segundos || 30) * 1000;
        setRf09Stale(ageMs > maxMs);
        return prev;
      });
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(freshnessTimer);
      window.clearInterval(snapshotTimer);
      if (es) es.close();
    };
  }, [currentLocation?.id_ubicacion, catalogRevision]);

  useEffect(() => {
    setSelectedMysqlDeviceId('ALL');
  }, [currentLocation?.id_ubicacion]);

  useEffect(() => {
    let active = true;
    const locId = currentLocation?.id_ubicacion;
    if (!locId) return;

    const refreshHistory = async () => {
      const [medRes, telRes] = await Promise.all([
        fetchDashboardMedicionesPorUbicacion(locId).catch(() => null),
        fetchDashboardTelemetry({
          ubicacion_id: locId,
          dispositivo_id: effectiveDeviceId !== 'ALL' ? effectiveDeviceId : undefined,
          limit: 60,
        }).catch(() => null),
      ]);
      if (!active) return;
      if (medRes) {
        setMysqlMediciones(medRes.mediciones);
        setMysqlResumen(medRes.resumen_por_ubicacion);
      }
      if (telRes) {
        setMysqlSensorConfigs(telRes.sensores);
        setMysqlTelemetry(telRes.mediciones);
      }
    };
    setMysqlMediciones([]);
    setMysqlResumen([]);
    setMysqlSensorConfigs([]);
    setMysqlTelemetry([]);
    void refreshHistory();
    const timer = window.setInterval(refreshHistory, 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [currentLocation?.id_ubicacion, effectiveDeviceId, catalogRevision]);

  const activeSensorConfig = useMemo(() => {
    if (mysqlSensorConfigs.length === 0) return null;
    return mysqlSensorConfigs.find((s) => s.estado === 'ACTIVO') || mysqlSensorConfigs[0];
  }, [mysqlSensorConfigs]);

  const tempEnabled = activeSensorConfig ? activeSensorConfig.temperatura_habilitada : true;
  const humEnabled = activeSensorConfig ? activeSensorConfig.humedad_habilitada : true;
  const presEnabled = activeSensorConfig ? activeSensorConfig.presion_habilitada : false;

  const chartReadings = useMemo(() => mysqlTelemetry.map((m) => {
    const timestamp = Date.parse(m.fecha_hora.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(m.fecha_hora)
      ? m.fecha_hora : m.fecha_hora + 'Z');
    return {
      id_medicion: String(m.id_medicion),
      sensor_id: m.sensor_id || '',
      dispositivo_id: m.dispositivo_id,
      ubicacion_id: m.ubicacion_id || '',
      temperatura: m.temperatura,
      humedad: m.humedad,
      score_anomalia_ia: m.score_anomalia_ia ?? null,
      valor_anomalo: (m.score_anomalia_ia ?? 0) >= 0.7,
      es_fuera_de_umbral: m.es_fuera_de_umbral ?? m.alerta_generada,
      timestamp,
    };
  }), [mysqlTelemetry]);
  const recentRows = useMemo(() => chartReadings.slice().reverse(), [chartReadings]);
  const isDeviceUnavailable = (deviceId?: string | null) => !connectivity || (
    !!deviceId && !connectivity.some((device) =>
      device.id_dispositivo === deviceId && ['ONLINE', 'ADVERTENCIA'].includes(device.estado)
    )
  );
  const latestMysqlReading = mysqlTelemetry.at(-1);
  const latestTimestamp = chartReadings.at(-1)?.timestamp;
  const pressureAge = latestTimestamp ? Date.now() - latestTimestamp : Infinity;
  const displayPres = latestMysqlReading && pressureAge >= 0 && pressureAge <= 30_000 &&
    !isDeviceUnavailable(latestMysqlReading.dispositivo_id) ? latestMysqlReading.presion : null;

  if (!currentLocation) {
    return <p role="status" className="rounded-[16px] bg-sheet-white p-5">No hay ubicaciones activas para monitorear.</p>;
  }

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
            {globalConnectivityStats && (
              <span
                role="status"
                aria-label={`Red IoT: ${globalConnectivityStats.online} de ${globalConnectivityStats.totalActivos} dispositivos conectados`}
                title="Contador global de nodos IoT conectados al sistema"
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cream-paper border border-sage-mist text-xs font-medium text-bark"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-canopy">{globalConnectivityStats.online}</span>
                <span className="text-slate font-normal">de</span>
                <span className="font-semibold">{globalConnectivityStats.totalActivos}</span>
                <span className="text-slate">conectados</span>
              </span>
            )}
          </div>
          <p className="text-[14px] text-slate mt-1">
            {currentLocation?.descripcion}
          </p>
        </div>

        {/* Pestañas de ubicaciones */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-[8px] bg-cream-paper overflow-x-auto">
          {locations.map((loc) => {
            const isSelected = loc.id_ubicacion === currentLocation?.id_ubicacion;
            const hasAlert = activeAlerts.some((a) => a.ubicacion_id === loc.id_ubicacion && a.estado !== 'RESUELTA');
            return (
              <button
                key={loc.id_ubicacion}
                onClick={() => onSelectLocation(loc.id_ubicacion)}
                className={`flex items-center gap-2 px-4 py-1.5 text-[13px] rounded-full transition-colors whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-[#17191c] text-white font-medium'
                    : 'text-[#777b86] hover:text-[#17191c]'
                }`}
              >
                <span className="truncate max-w-[160px]" title={loc.nombre}>
                  {loc.nombre}
                </span>
                {hasAlert && (
                  <span className="w-2 h-2 rounded-full bg-[#15803d] animate-ping" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Banner de Alerta Crítica Activa si existe */}
      {locationAlert && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-[16px] border border-[#15803d]/50 bg-sheet-white text-bark animate-fadeIn">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-[#15803d] text-sheet-white flex items-center justify-center shrink-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-[#15803d] font-mono">
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
      {mysqlDevicesInLoc && mysqlDevicesInLoc.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-sheet-white px-5 py-3 rounded-[16px]">
          <div className="text-xs text-slate">
            <span className="font-semibold text-bark">Dispositivo en MySQL:</span>{' '}
            {activeSensorConfig ? (
              <span className="inline-flex items-center gap-2">
                <span className="sensor-badge-purple">
                  Sensor {activeSensorConfig.identificador} ({activeSensorConfig.modelo})
                </span>
                <span className="font-mono text-canopy text-[11px]">
                  · Variables: {activeSensorConfig.variables_habilitadas.map((v) => `${v.variable} (${v.unidad})`).join(', ')}
                </span>
              </span>
            ) : (
              <span>Sin sensor vinculado en MySQL</span>
            )}
          </div>
          <select
            value={effectiveDeviceId}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Tarjeta 1: Temperatura Actual °C (RF-08, solo si está habilitada en RF-05) */}
        {tempEnabled && (
          <TemperatureKpiCard
            snapshot={rf08Snapshot}
            locationName={currentLocation?.nombre || ''}
            streamConnected={rf08StreamConnected}
            isStale={rf08Stale || isDeviceUnavailable(rf08Snapshot?.dispositivo_id)}
          />
        )}

        {/* Tarjeta 2: Humedad Relativa %RH (RF-09, solo si está habilitada en RF-05) */}
        {humEnabled && (
          <HumidityKpiCard
            snapshot={rf09Snapshot}
            locationName={currentLocation?.nombre || ''}
            streamConnected={rf08StreamConnected}
            isStale={rf09Stale || isDeviceUnavailable(rf09Snapshot?.dispositivo_id)}
          />
        )}

        {/* Tarjeta Opcional BME280: Presión Atmosférica (solo si está habilitada en RF-05) */}
        {presEnabled && (
          <div className="bg-sheet-white rounded-[16px] p-[16px] space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-slate">Presión Atmosférica</span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full font-medium bg-[#fbe1d1] text-[#5d2a1a]">
                SENSOR BME280
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

        <div className="bg-brand-lavender border border-brand-lavender-border rounded-[16px] p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-plum"><BrainCircuit className="h-4 w-4" /> Diagnóstico de la lectura</h3>
          <p className="mt-2 text-xs text-slate">
            {rf08Snapshot?.z_score_disponible && rf08Snapshot.z_score !== null && !rf08Stale &&
              !isDeviceUnavailable(rf08Snapshot.dispositivo_id)
              ? `Z-score de temperatura: ${rf08Snapshot.z_score.toFixed(2)}σ`
              : 'Sin diagnóstico para una lectura actual.'}
          </p>
        </div>
      </div>

      {/* Gráfico de Telemetría Dinámico */}
      {activeSensorConfig && (
        <TelemetryChart
          readings={chartReadings}
          limites={{
            temp_min: activeSensorConfig?.limites.temp_min ?? 18,
            temp_max: activeSensorConfig?.limites.temp_max ?? 25,
            temp_critica_max: ((activeSensorConfig?.limites.temp_max ?? 25) + 5),
            hum_min: activeSensorConfig?.limites.hum_min ?? 40,
            hum_max: activeSensorConfig?.limites.hum_max ?? 70,
            hum_critica_max: ((activeSensorConfig?.limites.hum_max ?? 70) + 10),
          }}
          sensorType={activeSensorConfig?.modelo || 'DHT22'}
          locationName={currentLocation?.nombre || ''}
          maxGapSeconds={mysqlDevicesInLoc?.[0]?.tolerancia_maxima_segundos ?? 60}
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
              <Database className="w-3 h-3" /> MySQL
            </span>
          </div>
        </div>

        {/* Cabecera fija para la lista virtualizada */}
        <div className="grid grid-cols-6 bg-cream-paper text-slate font-mono text-[11px] uppercase tracking-wider border-b border-sage-mist/60 px-5 py-2.5">
          <div>ID Paquete</div>
          <div>Estampa de Tiempo</div>
          <div className="text-right">Temperatura</div>
          <div className="text-right">Humedad</div>
          <div className="text-right">Score ML</div>
          <div className="text-center">Estado</div>
        </div>

        {/* VirtualList: solo renderiza las filas visibles en el viewport */}
        <VirtualList
          items={recentRows}
          rowHeight={42}
          viewportHeight={252}
          keyExtractor={(m) => m.id_medicion}
          renderItem={(m) => (
            <div
              className="grid grid-cols-6 items-center px-5 h-[42px] border-b border-sage-mist/30 hover:bg-cream-paper/50 transition-colors font-mono text-xs tabular-nums"
            >
              <div className="text-slate truncate">{m.id_medicion.slice(-10)}</div>
              <div className="text-bark">
                {new Date(m.timestamp).toLocaleTimeString()}
              </div>
              <div
                className={`text-right font-semibold ${
                  m.temperatura !== null && m.temperatura > (activeSensorConfig?.limites.temp_max ?? 30)
                    ? 'text-[#15803d]'
                    : 'text-canopy'
                }`}
              >
                {m.temperatura === null ? '—' : m.temperatura.toFixed(2) + ' °C'}
              </div>
              <div className="text-right text-bark">
                {m.humedad === null ? '—' : m.humedad.toFixed(1) + ' %RH'}
              </div>
              <div className="text-right text-slate">{m.score_anomalia_ia ?? '—'}</div>
              <div className="text-center">
                {m.es_fuera_de_umbral ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-sans text-[#15803d] font-semibold">
                    <AlertTriangle className="w-3 h-3" /> Alerta
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-sans text-canopy font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Registrado
                  </span>
                )}
              </div>
            </div>
          )}
        />
      </div>

      {/* RF-03: Dispositivos y Mediciones Históricas en MySQL por Ubicación */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DeviceConnectivityPanel devices={mysqlDevicesInLoc ?? null} />

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
