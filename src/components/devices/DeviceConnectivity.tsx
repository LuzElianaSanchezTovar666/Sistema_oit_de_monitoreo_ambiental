import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  Clock,
  PowerOff,
  Wifi,
  WifiOff,
  Radio,
  Filter,
} from 'lucide-react';
import {
  DeviceConnectivity,
  DispositivoEstado,
  evaluateRssi,
  formatLastContact,
  formatRelativeTime,
} from '../../services/deviceService';

export const CONNECTIVITY_STATES_CONFIG: Record<
  DispositivoEstado | 'UNKNOWN',
  {
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
    color: string;
    border: string;
    label: string;
    detail: string;
  }
> = {
  ONLINE: {
    icon: Wifi,
    color: 'bg-emerald-500/15 text-emerald-300',
    border: 'border-emerald-500/30',
    label: 'ONLINE',
    detail: 'Conexión confirmada',
  },
  ADVERTENCIA: {
    icon: AlertTriangle,
    color: 'bg-signal-yellow/15 text-signal-yellow',
    border: 'border-signal-yellow/40',
    label: 'ADVERTENCIA',
    detail: 'Retraso en la comunicación',
  },
  OFFLINE: {
    icon: WifiOff,
    color: 'bg-red-500/15 text-red-300',
    border: 'border-red-500/30',
    label: 'OFFLINE',
    detail: 'Comunicación interrumpida',
  },
  ERROR: {
    icon: AlertOctagon,
    color: 'bg-rose-500/20 text-rose-200',
    border: 'border-rose-500/40',
    label: 'ERROR',
    detail: 'Error reportado',
  },
  PENDIENTE: {
    icon: Clock,
    color: 'bg-slate-500/15 text-slate-300',
    border: 'border-slate-500/30',
    label: 'PENDIENTE',
    detail: 'Esperando la primera comunicación válida',
  },
  INACTIVO: {
    icon: PowerOff,
    color: 'bg-graphite-fill/40 text-slate-400',
    border: 'border-graphite-fill',
    label: 'INACTIVO',
    detail: 'Desactivado administrativamente',
  },
  UNKNOWN: {
    icon: Clock,
    color: 'bg-graphite-fill/40 text-slate-400',
    border: 'border-graphite-fill',
    label: 'SIN ESTADO',
    detail: 'Estado sin verificar',
  },
};

/**
 * RN-21: Marcación visual de estado accesible.
 * Obliga a mostrar simultáneamente etiqueta de texto visible E icono identificador,
 * nunca dependiendo únicamente del color.
 */
export function DeviceConnectivityBadge({
  state,
  className = '',
}: {
  state?: DispositivoEstado;
  className?: string;
}) {
  const effectiveState = state ?? 'UNKNOWN';
  const config = CONNECTIVITY_STATES_CONFIG[effectiveState] ?? CONNECTIVITY_STATES_CONFIG.UNKNOWN;
  const { icon: Icon, color, border, label, detail } = config;

  return (
    <span
      role="status"
      aria-label={`Estado de conectividad: ${label} - ${detail}`}
      title={detail}
      tabIndex={0}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${color} ${border} focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-neon-pulse ${className}`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

/**
 * RF-19: Visualizador de intensidad de señal WiFi (RSSI).
 * Destaca visualmente señales < -80 dBm como advertencia preventiva.
 * Si es >= -80 dBm, no muestra advertencia.
 * Si es null/indefinido, muestra "Señal no disponible".
 */
export function DeviceRssiBadge({
  rssi,
  isOffline = false,
  className = '',
}: {
  rssi?: number | null;
  isOffline?: boolean;
  className?: string;
}) {
  const evalResult = evaluateRssi(rssi, isOffline);

  if (!evalResult.isAvailable) {
    return (
      <span
        role="status"
        aria-label="Intensidad de señal WiFi: No disponible"
        title="Nivel de señal WiFi no disponible para este dispositivo"
        tabIndex={0}
        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-mono bg-graphite-fill/30 border border-graphite-fill text-slate-400 focus:outline-none focus:ring-1 focus:ring-neon-pulse ${className}`}
      >
        <WifiOff aria-hidden="true" className="h-3 w-3 shrink-0 text-slate-500" />
        <span>Señal no disponible</span>
      </span>
    );
  }

  const IconComponent = evalResult.isWeak ? AlertTriangle : Wifi;

  return (
    <span
      role="status"
      aria-label={`Intensidad de señal WiFi: ${evalResult.text} (${evalResult.qualityLabel})`}
      title={
        evalResult.isWeak
          ? `Advertencia preventiva: Nivel de señal débil (${evalResult.raw} dBm < -80 dBm). Riesgo de latencia o desconexión.`
          : `Calidad de señal: ${evalResult.qualityLabel} (${evalResult.raw} dBm)`
      }
      tabIndex={0}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-mono border ${evalResult.qualityColor} focus:outline-none focus:ring-1 focus:ring-neon-pulse ${className}`}
    >
      <IconComponent aria-hidden="true" className="h-3 w-3 shrink-0" />
      <span>{evalResult.text}</span>
    </span>
  );
}

export function DeviceConnectivityPanel({
  devices,
}: {
  devices: DeviceConnectivity[] | null;
}) {
  const [filterMode, setFilterMode] = useState<
    'ALL' | 'ONLINE' | 'WARNING' | 'OFFLINE' | 'WEAK_SIGNAL'
  >('ALL');

  const stats = useMemo(() => {
    if (!devices) return null;
    let online = 0;
    let offline = 0;
    let warning = 0;
    let errorCnt = 0;
    let weakSignal = 0;
    let totalActivos = 0;

    for (const d of devices) {
      const isInactive = d.estado === 'INACTIVO' || d.activo_administrativamente === false;
      if (!isInactive) {
        totalActivos++;
        if (d.estado === 'ONLINE') online++;
        else if (d.estado === 'ADVERTENCIA') warning++;
        else if (d.estado === 'OFFLINE') offline++;
        else if (d.estado === 'ERROR') errorCnt++;
      }
      if (d.rssi_dbm !== null && d.rssi_dbm !== undefined && d.rssi_dbm < -80) {
        weakSignal++;
      }
    }
    const pct = totalActivos > 0 ? Math.round((online / totalActivos) * 100) : 0;
    return { online, offline, warning, errorCnt, weakSignal, totalActivos, pct };
  }, [devices]);

  const filteredDevices = useMemo(() => {
    if (!devices) return [];
    return devices.filter((d) => {
      if (filterMode === 'ALL') return true;
      if (filterMode === 'ONLINE') return d.estado === 'ONLINE';
      if (filterMode === 'WARNING') return d.estado === 'ADVERTENCIA' || d.estado === 'ERROR';
      if (filterMode === 'OFFLINE') return d.estado === 'OFFLINE';
      if (filterMode === 'WEAK_SIGNAL') {
        return d.rssi_dbm !== null && d.rssi_dbm !== undefined && d.rssi_dbm < -80;
      }
      return true;
    });
  }, [devices, filterMode]);

  return (
    <section
      aria-label="Supervisión de conectividad de nodos IoT"
      className="rounded-[16px] bg-sheet-white border border-sage-mist/70 p-5 space-y-4"
    >
      {/* Encabezado y Contador Global */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sage-mist/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-canopy animate-pulse" aria-hidden="true" />
            <h2 className="apple-card-heading text-bark text-[17px] font-semibold">
              Conectividad de Nodos en Tiempo Real (RF-19)
            </h2>
          </div>
          <p className="text-xs text-slate mt-0.5">
            Supervisión continua con detección de caídas, nivel de señal WiFi y regla preventiva de cobertura.
          </p>
        </div>

        {/* Contador Global Destacado */}
        {stats && (
          <div
            role="status"
            aria-label={`Contador global: ${stats.online} de ${stats.totalActivos} dispositivos conectados`}
            className="flex items-center gap-3 bg-cream-paper border border-sage-mist rounded-xl px-4 py-2"
          >
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate">
                Contador Global
              </div>
              <div className="text-[15px] font-bold text-bark flex items-center gap-1.5">
                <span className="text-canopy">{stats.online}</span>
                <span className="text-slate font-normal">de</span>
                <span>{stats.totalActivos}</span>
                <span className="text-xs font-medium text-slate">conectados</span>
              </div>
            </div>
            <div className="h-8 w-[1px] bg-sage-mist" />
            <div className="text-right">
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate">Disponibilidad</div>
              <div className="text-xs font-mono font-bold text-canopy">{stats.pct}%</div>
            </div>
          </div>
        )}
      </div>

      {/* Barra de Filtros Rápidos (Identificación en < 3 segundos) */}
      {stats && (
        <div
          role="toolbar"
          aria-label="Filtros rápidos de conectividad"
          className="flex flex-wrap items-center gap-1.5 text-xs"
        >
          <span className="text-slate text-[11px] font-medium mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" aria-hidden="true" /> Filtrar:
          </span>
          <button
            type="button"
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
              filterMode === 'ALL'
                ? 'bg-bark text-sheet-white'
                : 'bg-cream-paper text-slate hover:bg-sage-mist/50'
            }`}
          >
            Todos ({devices?.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('ONLINE')}
            className={`px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
              filterMode === 'ONLINE'
                ? 'bg-canopy text-sheet-white'
                : 'bg-cream-paper text-slate hover:bg-sage-mist/50'
            }`}
          >
            Conectados ({stats.online})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('OFFLINE')}
            className={`px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
              filterMode === 'OFFLINE'
                ? 'bg-red-600 text-sheet-white'
                : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
            }`}
          >
            Desconectados ({stats.offline})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('WARNING')}
            className={`px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
              filterMode === 'WARNING'
                ? 'bg-signal-yellow text-bark'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            Advertencia / Error ({stats.warning + stats.errorCnt})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('WEAK_SIGNAL')}
            className={`px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
              filterMode === 'WEAK_SIGNAL'
                ? 'bg-orange-600 text-sheet-white'
                : 'bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100'
            }`}
          >
            Señal Débil &lt; -80 dBm ({stats.weakSignal})
          </button>
        </div>
      )}

      {/* Lista de Nodos */}
      {devices === null ? (
        <p role="status" className="py-6 text-center text-sm text-slate">
          Estado de conectividad no disponible.
        </p>
      ) : devices.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate">Sin dispositivos registrados.</p>
      ) : filteredDevices.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate">
          No hay dispositivos que cumplan el filtro seleccionado ({filterMode}).
        </div>
      ) : (
        <ul className="divide-y divide-sage-mist/60 max-h-[420px] overflow-y-auto pr-1">
          {filteredDevices.map((device) => {
            const isOffline = device.estado === 'OFFLINE';
            return (
              <li
                key={device.id_dispositivo}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-3 hover:bg-cream-paper/40 rounded-lg px-2 transition-colors"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-bark text-sm">{device.nombre}</p>
                    <span className="text-[11px] font-mono text-neon-pulse bg-graphite-fill/40 px-1.5 py-0.5 rounded">
                      {device.codigo || device.id_dispositivo}
                    </span>
                  </div>
                  <p className="text-xs text-slate">
                    {device.ubicacion || 'Sin ubicación física asignada'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  {/* Badge de estado accesible RN-21 */}
                  <DeviceConnectivityBadge state={device.estado} />

                  {/* Badge de nivel de señal RSSI */}
                  <DeviceRssiBadge
                    rssi={device.rssi_dbm}
                    isOffline={isOffline}
                  />

                  {/* Último contacto relativo + fecha completa */}
                  <div
                    className="text-[11px] text-slate font-mono flex items-center gap-1"
                    title={`Último ping registrado: ${formatLastContact(device.ultimo_ping)}`}
                  >
                    <Clock className="w-3 h-3 text-slate-400" aria-hidden="true" />
                    <span>Último contacto · {formatRelativeTime(device.ultimo_ping)}</span>
                  </div>

                  {/* Mensaje de detalle si está en advertencia u offline */}
                  {(device.estado === 'ADVERTENCIA' || device.estado === 'OFFLINE') && (
                    <span
                      className={`text-[11px] font-medium ${
                        device.estado === 'ADVERTENCIA' ? 'text-signal-yellow' : 'text-red-400'
                      }`}
                    >
                      {CONNECTIVITY_STATES_CONFIG[device.estado].detail}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
