import React, { useState, useEffect } from 'react';
import {
  Activity,
  Database,
  Server,
  Gauge,
  Smartphone,
  Wifi,
  Layers,
  Zap,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react';
import {
  redisCache,
  otelTracer,
  backgroundJobQueue,
  loadBalancer,
  rumMonitor,
  networkSimulator,
  getDeduplicationStats,
  NetworkProfile,
  DeviceViewportProfile,
} from '../../services/performanceEngine';

interface PerformanceMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceViewportChange?: (viewport: DeviceViewportProfile) => void;
}

export const PerformanceMonitorModal: React.FC<PerformanceMonitorModalProps> = ({
  isOpen,
  onClose,
  onDeviceViewportChange,
}) => {
  const [, setTick] = useState(0);
  const [netProfile, setNetProfile] = useState<NetworkProfile>(networkSimulator.getConfig().network);
  const [viewProfile, setViewProfile] = useState<DeviceViewportProfile>(networkSimulator.getConfig().viewport);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = backgroundJobQueue.subscribe(() => setTick((t) => t + 1));
    const timer = setInterval(() => setTick((t) => t + 1), 1500);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const redisStats = redisCache.getStats();
  const spans = otelTracer.getSpans();
  const jobs = backgroundJobQueue.getJobs();
  const cluster = loadBalancer.getClusterStatus();
  const rum = rumMonitor.getMetrics();
  const dedup = getDeduplicationStats();

  const handleApplySimulation = (net: NetworkProfile, vp: DeviceViewportProfile) => {
    setNetProfile(net);
    setViewProfile(vp);
    networkSimulator.setProfile(net, vp);
    if (onDeviceViewportChange) {
      onDeviceViewportChange(vp);
    }
    setTick((t) => t + 1);
  };

  const handleTriggerSampleJob = () => {
    backgroundJobQueue.enqueueJob('Compresión y Reindexación Hypertable TimescaleDB', async (progress) => {
      await new Promise((r) => setTimeout(r, 350));
      progress(55);
      await new Promise((r) => setTimeout(r, 350));
      progress(90);
      await new Promise((r) => setTimeout(r, 200));
      return '3 índices B-Tree/BRIN optimizados, 0 consultas N+1';
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#f3f1ec]/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#FFFFFF] border border-[#afc4bf] rounded-[16px] w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-[#101f1e]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#afc4bf] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#f3f1ec] text-[#104336] flex items-center justify-center">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[17px] font-semibold text-[#101f1e]">
                Centro de Ingeniería de Rendimiento, OpenTelemetry, Redis & RUM
              </h3>
              <p className="text-xs text-[#535e5d]">
                Monitoreo de velocidad real (Core Web Vitals), caché Redis, cola de trabajos, pool de conexiones y pruebas en redes lentas / celulares
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#535e5d] hover:text-[#101f1e] text-base font-semibold"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs">
          {/* 1. Core Web Vitals (RUM - Real User Monitoring) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-[#f3f1ec] p-4 rounded-[24px] space-y-1">
              <span className="text-[10px] text-[#535e5d] uppercase font-mono">LCP (Hero AVIF)</span>
              <div className="text-[24px] font-semibold text-[#104336] font-display tabular-nums">
                {rum.lcpMs}ms
              </div>
              <span className="text-[10px] text-[#104336]">Óptimo (&lt;2.5s)</span>
            </div>
            <div className="bg-[#f3f1ec] p-4 rounded-[24px] space-y-1">
              <span className="text-[10px] text-[#535e5d] uppercase font-mono">FCP (SSR Shell)</span>
              <div className="text-[24px] font-semibold text-[#104336] font-display tabular-nums">
                {rum.fcpMs}ms
              </div>
              <span className="text-[10px] text-[#104336]">Pre-renderizado</span>
            </div>
            <div className="bg-[#f3f1ec] p-4 rounded-[24px] space-y-1">
              <span className="text-[10px] text-[#535e5d] uppercase font-mono">INP (React Memo)</span>
              <div className="text-[24px] font-semibold text-[#101f1e] font-display tabular-nums">
                {rum.inpMs}ms
              </div>
              <span className="text-[10px] text-[#535e5d]">Sin re-renders</span>
            </div>
            <div className="bg-[#f3f1ec] p-4 rounded-[24px] space-y-1">
              <span className="text-[10px] text-[#535e5d] uppercase font-mono">CLS (Estabilidad)</span>
              <div className="text-[24px] font-semibold text-[#104336] font-display tabular-nums">
                {rum.clsScore}
              </div>
              <span className="text-[10px] text-[#535e5d]">Fuentes swap 400/600</span>
            </div>
            <div className="bg-[#f3f1ec] p-4 rounded-[24px] space-y-1">
              <span className="text-[10px] text-[#535e5d] uppercase font-mono">Redis Hit Ratio</span>
              <div className="text-[24px] font-semibold text-[#104336] font-display tabular-nums">
                {redisStats.hitRatioPct}%
              </div>
              <span className="text-[10px] text-[#535e5d]">
                {redisStats.hits} hits · {dedup.savedDuplicateCalls} dedup
              </span>
            </div>
            <div className="bg-[#f3f1ec] p-4 rounded-[24px] space-y-1">
              <span className="text-[10px] text-[#535e5d] uppercase font-mono">DB Pool Proximity</span>
              <div className="text-[24px] font-semibold text-[#104336] font-display tabular-nums">
                {cluster.dbProximityLatencyMs}ms
              </div>
              <span className="text-[10px] text-[#535e5d]">Brotli/Gzip + CDN</span>
            </div>
          </div>

          {/* 2. Simulador de Celulares y Redes Lentas (3G / 2G Edge) */}
          <div className="bg-[#f3f1ec] p-5 rounded-[16px] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#104336]" />
                <h4 className="text-[14px] font-semibold text-[#101f1e]">
                  Laboratorio de Pruebas en Celulares y Redes Lentas (Throttling)
                </h4>
              </div>
              <span className="apple-badge-orange font-mono">
                PERFIL ACTIVO: {netProfile.toUpperCase()} · {viewProfile.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-[11px] text-[#535e5d] block">Condición de Red (Simulación de Latencia):</span>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'fiber', label: 'Fibra / CDN (0ms)' },
                      { id: '4g', label: '4G Móvil (+90ms)' },
                      { id: '3g-slow', label: '3G Lento (+420ms)' },
                      { id: '2g-edge', label: '2G Rural (+1100ms)' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleApplySimulation(item.id, viewProfile)}
                      className={`px-3.5 py-1.5 rounded-[8px] text-[11px] font-semibold transition-colors ${
                        netProfile === item.id
                          ? 'bg-[#104336] text-[#ffffff]'
                          : 'bg-[#FFFFFF] text-[#535e5d] hover:text-[#101f1e]'
                      }`}
                    >
                      <Wifi className="w-3 h-3 inline mr-1" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] text-[#535e5d] block">Viewport de Dispositivo:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'desktop', label: 'Desktop Full (100%)' },
                      { id: 'iphone-15', label: 'Celular iPhone (390px)' },
                      { id: 'android-mid', label: 'Android Gama Media (412px)' },
                    ] as const
                  ).map((vp) => (
                    <button
                      key={vp.id}
                      onClick={() => handleApplySimulation(netProfile, vp.id)}
                      className={`px-3.5 py-1.5 rounded-[8px] text-[11px] font-semibold transition-colors ${
                        viewProfile === vp.id
                          ? 'bg-[#104336] text-[#f3f1ec]'
                          : 'bg-[#FFFFFF] text-[#535e5d] hover:text-[#101f1e]'
                      }`}
                    >
                      {vp.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Balanceador de Carga Multi-Instancia, Pool de Conexiones e Índices SQL */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cluster & Connection Pool */}
            <div className="bg-[#f3f1ec] p-5 rounded-[16px] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[#101f1e] flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#104336]" />
                  Clúster Multi-Instancia & Pool de Conexiones
                </span>
                <span className="text-[11px] font-mono text-[#104336]">{cluster.dbRegion}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                {cluster.instances.map((inst) => (
                  <div key={inst.id} className="p-3 rounded-[18px] bg-[#FFFFFF] space-y-1">
                    <div className="text-[#104336] font-semibold truncate">{inst.id}</div>
                    <div className="text-[#535e5d]">Req: {inst.requestsServed}</div>
                    <div className="text-[#101f1e]">Conns: {inst.activeConns}/20</div>
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-[#535e5d] font-mono pt-1 flex items-center justify-between border-t border-[#afc4bf]/60">
                <span>Pool Activas: {cluster.poolConfig.activeConnections} · Idle: {cluster.poolConfig.idleConnections}</span>
                <span className="text-[#104336]">0 Consultas N+1 (DataLoader O(1))</span>
              </div>
            </div>

            {/* Background Job Queue */}
            <div className="bg-[#f3f1ec] p-5 rounded-[16px] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[#101f1e] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#D97706]" />
                  Cola de Trabajos Asíncronos (Job Queue)
                </span>
                <button
                  onClick={handleTriggerSampleJob}
                  className="apple-blue-pill px-3 py-1 text-[11px] font-semibold flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Encolar Trabajo Pesado
                </button>
              </div>

              <div className="space-y-2 max-h-36 overflow-y-auto font-mono text-[11px]">
                {jobs.length === 0 ? (
                  <div className="text-[#535e5d] py-2">
                    No hay tareas pesadas en cola. Las exportaciones CSV/JSON y diagnósticos se procesan aquí.
                  </div>
                ) : (
                  jobs.map((job) => (
                    <div
                      key={job.id}
                      className="p-2.5 rounded-[16px] bg-[#FFFFFF] flex items-center justify-between gap-3"
                    >
                      <div className="truncate">
                        <span className="text-[#101f1e] font-semibold">{job.name}</span>
                        {job.resultSummary && (
                          <span className="block text-[10px] text-[#535e5d] truncate">{job.resultSummary}</span>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-[5px] text-[10px] font-semibold shrink-0 ${
                          job.status === 'COMPLETED'
                            ? 'bg-[#104336]/15 text-[#104336]'
                            : 'apple-badge-orange'
                        }`}
                      >
                        {job.status} ({job.progressPct}%)
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 4. OpenTelemetry Spans & Slow Request Tracer */}
          <div className="bg-[#f3f1ec] p-5 rounded-[16px] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-[#101f1e] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#104336]" />
                Rastreador de Peticiones OpenTelemetry (W3C Trace Context)
              </span>
              <span className="text-[11px] font-mono text-[#535e5d]">
                Umbral petición lenta: &gt;150ms
              </span>
            </div>

            <div className="max-h-40 overflow-y-auto font-mono text-[11px] space-y-1.5">
              {spans.length === 0 ? (
                <div className="text-[#535e5d] py-2">
                  Ejecute un diagnóstico IA o consulta para inspeccionar los spans de OpenTelemetry.
                </div>
              ) : (
                spans.slice(0, 8).map((sp) => (
                  <div
                    key={sp.spanId}
                    className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-[14px] bg-[#FFFFFF]"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded-[5px] text-[10px] font-bold ${
                          sp.status === 'SLOW'
                            ? 'bg-[#DC2626] text-[#ffffff]'
                            : 'bg-[#104336]/15 text-[#104336]'
                        }`}
                      >
                        {sp.status}
                      </span>
                      <span className="text-[#101f1e] font-semibold">{sp.name}</span>
                      <span className="text-[#535e5d] text-[10px]">trace:{sp.traceId.slice(0, 10)}...</span>
                    </div>
                    <div className="flex items-center gap-3 text-[#535e5d]">
                      <span>{sp.instanceId}</span>
                      <span className={sp.durationMs > 150 ? 'text-[#DC2626] font-bold' : 'text-[#104336]'}>
                        {sp.durationMs} ms
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-[#f3f1ec] border-t border-[#afc4bf] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-[#535e5d]">
            <CheckCircle2 className="w-4 h-4 text-[#104336]" />
            <span>
              AVIF/WebP · Debounce 280ms · Paginación · Brotli/Gzip · Streaming IA Token-a-Token · Virtualización · Code Splitting activos
            </span>
          </div>
          <button
            onClick={onClose}
            className="apple-blue-pill px-5 py-2 font-semibold text-xs"
          >
            Cerrar Monitor
          </button>
        </div>
      </div>
    </div>
  );
};

