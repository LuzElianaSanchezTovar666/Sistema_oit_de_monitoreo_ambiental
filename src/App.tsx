/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import {
  Usuario,
  Ubicacion,
  Dispositivo,
  Sensor,
  Alerta,
  Mantenimiento,
  DLQEntry,
  Medicion,
} from './types/iot';
import {
  UBICACIONES_INICIALES,
  getStoredDispositivos,
  saveStoredDispositivos,
  getStoredSensores,
  saveStoredSensores,
  getStoredAlertas,
  saveStoredAlertas,
  getStoredMantenimientos,
  saveStoredMantenimientos,
  getStoredDLQ,
  saveStoredDLQ,
} from './services/storage';
import { telemetryEngineInstance } from './services/telemetryEngine';
import {
  otelTracer,
  redisCache,
  networkSimulator,
  MobileViewportProfile,
} from './services/performanceEngine';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { EnvironmentalLandingPage } from './components/landing/EnvironmentalLandingPage';
import { LiveTelemetryView } from './components/dashboard/LiveTelemetryView';
import { HeroSkeleton, CardGridSkeleton } from './components/common/SkeletonLoader';
import { Check, AlertCircle, Smartphone, Loader2, AlertTriangle, AlertOctagon, Volume2, VolumeX, X } from 'lucide-react';
import { fetchCurrentUser, logoutSession, getDefaultTabForRole } from './services/authService';
import { fetchUbicaciones } from './services/locationService';
import { DeviceConnectivity, watchDeviceConnectivity } from './services/deviceService';
import {
  BackendAlertaDTO,
  fetchAlertas,
  LiveAlertRecord,
  mapBackendAlertaToUi,
  mergeAlertsDeduplicated,
} from './services/alertService';

const FIELD_SIMULATOR_ENABLED = import.meta.env.DEV && import.meta.env.VITE_ENABLE_FIELD_SIMULATOR === 'true';

// ErrorBoundary para evitar pantallas vacías si falla un chunk o vista
class SystemErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode; onReset: () => void }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-sheet-white border border-sage-mist rounded-[16px] text-center space-y-4">
          <h3 className="text-lg font-semibold text-bark">Ocurrió un error al cargar el módulo</h3>
          <p className="text-sm text-slate">{this.state.message}</p>
          <button
            onClick={() => {
              this.setState({ hasError: false, message: '' });
              this.props.onReset();
            }}
            className="apple-blue-pill px-5 py-2 text-xs font-semibold"
          >
            Volver al inicio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Code-Splitting por página / vista mediante React.lazy() para módulos secundarios
const DeviceManagement = React.lazy(() =>
  import('./components/devices/DeviceManagement').then((m) => ({
    default: m.DeviceManagement,
  }))
);
const AlertsManager = React.lazy(() =>
  import('./components/alerts/AlertsManager').then((m) => ({
    default: m.AlertsManager,
  }))
);
const HistoricalAnalytics = React.lazy(() =>
  import('./components/analytics/HistoricalAnalytics').then((m) => ({
    default: m.HistoricalAnalytics,
  }))
);
const AiDiagnosticPanel = React.lazy(() =>
  import('./components/ai/AiDiagnosticPanel').then((m) => ({
    default: m.AiDiagnosticPanel,
  }))
);
const MaintenanceLog = React.lazy(() =>
  import('./components/maintenance/MaintenanceLog').then((m) => ({
    default: m.MaintenanceLog,
  }))
);
const FieldSimulatorModal = React.lazy(() =>
  import('./components/simulator/FieldSimulatorModal').then((m) => ({
    default: m.FieldSimulatorModal,
  }))
);
const LoginModal = React.lazy(() =>
  import('./components/auth/LoginModal').then((m) => ({
    default: m.LoginModal,
  }))
);
const PerformanceMonitorModal = React.lazy(() =>
  import('./components/common/PerformanceMonitorModal').then((m) => ({
    default: m.PerformanceMonitorModal,
  }))
);
const LocationCatalogView = React.lazy(() =>
  import('./components/locations/LocationCatalogView').then((m) => ({
    default: m.LocationCatalogView,
  }))
);
const SensorManagementView = React.lazy(() =>
  import('./components/sensors/SensorManagementView').then((m) => ({
    default: m.SensorManagementView,
  }))
);

export default function App() {
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    if ('serviceWorker' in navigator && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      }).catch(() => {});
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      }
    }
  }, []);

  // Mode: 'landing' (Página pública de presentación) vs 'system' (Plataforma de gestión IoT)
  const [viewMode, setViewMode] = useState<'landing' | 'system'>(() => {
    if (typeof window !== 'undefined' && (window.location.search.includes('sistema') || window.location.hash === '#sistema')) {
      return 'system';
    }
    return 'landing';
  });

  // Skeleton loading states (never block initial render with black screen)
  const [skeletonMode, setSkeletonMode] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(false);

  // Simulador de Viewport Móvil (Desktop / iPhone 15 390px / Android 412px)
  const [viewportProfile, setViewportProfile] = useState<MobileViewportProfile>(
    () => networkSimulator.getViewport()
  );

  useEffect(() => {
    return networkSimulator.subscribe(() => {
      setViewportProfile(networkSimulator.getViewport());
    });
  }, []);

  // App entities & real backend authentication state
  const [currentUser, setCurrentUser] = useState<Usuario | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [locations, setLocations] = useState<Ubicacion[]>(UBICACIONES_INICIALES);
  const [selectedLocationId, setSelectedLocationId] = useState<string>(UBICACIONES_INICIALES[0].id_ubicacion);

  const loadLocationsFromMySQL = useCallback(async () => {
    try {
      const res = await fetchUbicaciones({ estado: 'ACTIVA' });
      if (res.items.length > 0) {
        const mapped: Ubicacion[] = res.items.map((u) => ({
          id_ubicacion: u.ubicacion_id,
          nombre: u.nombre,
          descripcion: u.descripcion || u.tipo,
          codigo_area: u.codigo_area,
          temp_optima_min: 18,
          temp_optima_max: 25,
          hum_optima_min: 40,
          hum_optima_max: 70,
        }));
        setLocations(mapped);
        setSelectedLocationId((prev) =>
          mapped.some((m) => m.id_ubicacion === prev) ? prev : mapped[0].id_ubicacion
        );
      }
    } catch {
      // Si el usuario aún no está autenticado, se cargará al iniciar sesión
    }
  }, []);

  const [devices, setDevices] = useState<Dispositivo[]>(() => FIELD_SIMULATOR_ENABLED ? getStoredDispositivos() : []);
  const [sensors, setSensors] = useState<Sensor[]>(() => FIELD_SIMULATOR_ENABLED ? getStoredSensores() : []);
  const [connectivity, setConnectivity] = useState<DeviceConnectivity[] | null>(null);
  useEffect(() => {
    setConnectivity(null);
    if (currentUser) return watchDeviceConnectivity(setConnectivity);
  }, [currentUser]);
  const [alerts, setAlerts] = useState<LiveAlertRecord[]>(() => FIELD_SIMULATOR_ENABLED ? getStoredAlertas() : []);
  const [liveAlertBanner, setLiveAlertBanner] = useState<LiveAlertRecord | null>(null);
  const [alertSoundEnabled, setAlertSoundEnabled] = useState<boolean>(true);
  const notifiedAlertIdsRef = useRef<Set<string>>(new Set());
  const [maintenances, setMaintenances] = useState<Mantenimiento[]>(getStoredMantenimientos);
  const [dlqEntries, setDlqEntries] = useState<DLQEntry[]>(getStoredDLQ);

  // Active navigation tab inside the IoT platform
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Modals
  const [showSimulator, setShowSimulator] = useState<boolean>(false);
  const [showPerformanceModal, setShowPerformanceModal] = useState<boolean>(false);
  const [selectedAlertForModal, setSelectedAlertForModal] = useState<Alerta | null>(null);

  // Verificar sesión activa contra FastAPI (/api/auth/me) al iniciar
  useEffect(() => {
    let active = true;
    fetchCurrentUser()
      .then((user) => {
        if (active && user) {
          setCurrentUser(user);
          loadLocationsFromMySQL();
        }
      })
      .finally(() => {
        if (active) setAuthChecking(false);
      });
    return () => {
      active = false;
    };
  }, [loadLocationsFromMySQL]);

  // Streaming telemetry state (initialized synchronously so frame 1 is always complete)
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [readingsHistory, setReadingsHistory] = useState<{ [sensorId: string]: Medicion[] }>(() =>
    FIELD_SIMULATOR_ENABLED ? telemetryEngineInstance.generateInitialHistory(getStoredDispositivos(), getStoredSensores()) : {}
  );

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'alert'>('success');

  const showToast = useCallback((msg: string, type: 'success' | 'alert' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3800);
  }, []);

  const handleLogout = useCallback(async () => {
    await logoutSession();
    setCurrentUser(null);
    setViewMode('landing');
    showToast('Sesión cerrada correctamente.');
  }, [showToast]);

  const handleAuthorizedTabChange = useCallback(
    (tab: string) => {
      if (!currentUser) return;
      const rolePermissions: Record<string, string[]> = {
        admin: ['dashboard', 'devices', 'locations', 'sensors', 'alerts', 'analytics', 'ai', 'maintenance', 'simulator'],
        cliente: ['dashboard', 'devices', 'locations', 'sensors', 'alerts', 'analytics'],
        tecnico: ['dashboard', 'devices', 'locations', 'sensors', 'maintenance', 'simulator'],
        supervisor: ['dashboard', 'devices', 'locations', 'sensors', 'alerts', 'analytics', 'ai'],
      };
      const allowed = rolePermissions[currentUser.rol] || ['dashboard'];
      if (!allowed.includes(tab)) {
        showToast('No tiene permisos suficientes para acceder a este módulo.', 'alert');
        setActiveTab(getDefaultTabForRole(currentUser.rol));
        return;
      }
      setActiveTab(tab);
    },
    [currentUser, showToast]
  );

  // Web Audio Beeper for alerts
  const playAlertSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {
      // AudioContext permitted upon user gesture
    }
  }, []);

  // Lanzar peticiones independientes en paralelo (Promise.all) y cachear en Redis al iniciar
  useEffect(() => {
    let mounted = true;

    const bootstrapParallelData = async () => {
      await otelTracer.traceAsync(
        'ParallelBootstrap:Promise.all(Devices,Sensors,Alerts,Telemetry)',
        'Bootstrap/ParallelLoader',
        async () => {
          const [loadedDevices, loadedSensors, loadedAlerts, loadedMaint, loadedDlq] =
            await Promise.all([
              Promise.resolve(FIELD_SIMULATOR_ENABLED ? getStoredDispositivos() : []),
              Promise.resolve(FIELD_SIMULATOR_ENABLED ? getStoredSensores() : []),
              Promise.resolve(FIELD_SIMULATOR_ENABLED ? getStoredAlertas() : []),
              Promise.resolve(getStoredMantenimientos()),
              Promise.resolve(getStoredDLQ()),
            ]);

          if (!mounted) return;

          // Cachear en Redis los catálogos más consultados
          redisCache.set('catalog:locations', UBICACIONES_INICIALES, 120_000);
          redisCache.set('catalog:devices', loadedDevices, 60_000);
          redisCache.set('catalog:sensors', loadedSensors, 60_000);

          setDevices(loadedDevices);
          setSensors(loadedSensors);
          setAlerts(loadedAlerts);
          setMaintenances(loadedMaint);
          setDlqEntries(loadedDlq);
          setInitialLoading(false);
        }
      );
    };

    bootstrapParallelData();
    return () => {
      mounted = false;
    };
  }, []);

  // RF-13: Canal SSE en tiempo real para alertas automáticas por desborde de límites
  useEffect(() => {
    if (!currentUser) return;
    const canViewAlerts =
      currentUser.rol === 'admin' ||
      currentUser.rol === 'cliente' ||
      currentUser.rol === 'supervisor';
    if (!canViewAlerts) return;

    let active = true;
    fetchAlertas()
      .then((persisted) => {
        if (!active) return;
        for (const a of persisted) {
          notifiedAlertIdsRef.current.add(a.id_alerta);
        }
        setAlerts((prev) => mergeAlertsDeduplicated(prev, persisted));
      })
      .catch(() => {
        // Fallback silencioso si el usuario no tiene sesión válida o el endpoint no está disponible aún
      });

    if (typeof EventSource === 'undefined') {
      return () => {
        active = false;
      };
    }

    const es = new EventSource('/api/alertas/stream', { withCredentials: true });
    const onSnapshot = (ev: MessageEvent) => {
      if (!active) return;
      try {
        const data = JSON.parse(ev.data) as { alertas?: BackendAlertaDTO[] };
        const mapped = Array.isArray(data.alertas) ? data.alertas.map(mapBackendAlertaToUi) : [];
        for (const a of mapped) {
          notifiedAlertIdsRef.current.add(a.id_alerta);
        }
        setAlerts((prev) => mergeAlertsDeduplicated(prev, mapped));
      } catch {
        // Ignorar payload corrupto
      }
    };

    const onAlert = (ev: MessageEvent) => {
      if (!active) return;
      try {
        const dto = JSON.parse(ev.data) as BackendAlertaDTO;
        const mapped = mapBackendAlertaToUi(dto);
        setAlerts((prev) => mergeAlertsDeduplicated(prev, [mapped]));
        if (!notifiedAlertIdsRef.current.has(mapped.id_alerta)) {
          notifiedAlertIdsRef.current.add(mapped.id_alerta);
          setLiveAlertBanner(mapped);
          if (alertSoundEnabled) {
            playAlertSound();
          }
        }
      } catch {
        // Ignorar payload corrupto
      }
    };

    const onAlertUpdated = (ev: MessageEvent) => {
      if (!active) return;
      try {
        const dto = JSON.parse(ev.data) as BackendAlertaDTO;
        const mapped = mapBackendAlertaToUi(dto);
        notifiedAlertIdsRef.current.add(mapped.id_alerta);
        setAlerts((prev) => mergeAlertsDeduplicated(prev, [mapped]));
      } catch {
        // Ignorar payload corrupto
      }
    };

    es.addEventListener('snapshot', onSnapshot as EventListener);
    es.addEventListener('alerta', onAlert as EventListener);
    es.addEventListener('alerta_actualizada', onAlertUpdated as EventListener);

    return () => {
      active = false;
      es.close();
    };
  }, [currentUser, alertSoundEnabled, playAlertSound]);

  // Interval for real-time telemetry streaming (2.5 seconds)
  useEffect(() => {
    if (!FIELD_SIMULATOR_ENABLED || !isStreaming) return;

    const interval = setInterval(() => {
      telemetryEngineInstance.tick(devices, sensors, (newAlert) => {
        setAlerts((prev) => {
          const updated = [newAlert, ...prev];
          saveStoredAlertas(updated);
          return updated;
        });

        playAlertSound();
        showToast(`¡Alerta detectada!: ${newAlert.mensaje}`, 'alert');
      });

      setReadingsHistory((prev) => {
        const updated = { ...prev };
        sensors.forEach((s) => {
          updated[s.id_sensor] = telemetryEngineInstance.getHistory(s.id_sensor);
        });
        return updated;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [isStreaming, devices, sensors, playAlertSound, showToast]);

  // Optimistic UI Handler: Add device (Actualiza la interfaz en 0ms sin esperar al servidor)
  const handleAddDevice = useCallback(
    (device: Dispositivo, sensor: Sensor) => {
      setDevices((prev) => {
        const next = [...prev, device];
        queueMicrotask(() => {
          saveStoredDispositivos(next);
          redisCache.set('catalog:devices', next, 60_000);
        });
        return next;
      });
      setSensors((prev) => {
        const next = [...prev, sensor];
        queueMicrotask(() => {
          saveStoredSensores(next);
          redisCache.set('catalog:sensors', next, 60_000);
        });
        return next;
      });
      showToast(`UI Optimista (0ms): Dispositivo ${device.nombre} dado de alta con éxito.`);
    },
    [showToast]
  );

  // Optimistic UI Handler: Update sensor limits
  const handleUpdateSensorLimits = useCallback(
    (sensorId: string, limits: Sensor['limites']) => {
      setSensors((prev) => {
        const updated = prev.map((s) => (s.id_sensor === sensorId ? { ...s, limites: limits } : s));
        queueMicrotask(() => {
          saveStoredSensores(updated);
          redisCache.set('catalog:sensors', updated, 60_000);
        });
        return updated;
      });
      showToast('UI Optimista (0ms): Umbrales operacionales actualizados instantáneamente.');
    },
    [showToast]
  );

  // Optimistic UI Handler: Toggle device offline
  const handleToggleDeviceOffline = useCallback(
    (deviceId: string) => {
      setDevices((prev) => {
        const updated = prev.map((d) =>
          d.id_dispositivo === deviceId
            ? { ...d, estado: (d.estado === 'ONLINE' ? 'OFFLINE' : 'ONLINE') as any }
            : d
        );
        const dev = updated.find((d) => d.id_dispositivo === deviceId);
        queueMicrotask(() => {
          saveStoredDispositivos(updated);
          redisCache.set('catalog:devices', updated, 60_000);
        });
        showToast(
          dev?.estado === 'ONLINE'
            ? `UI Optimista (0ms): Nodo ${dev.nombre} reconectado.`
            : `UI Optimista (0ms): Nodo ${dev?.nombre} desconectado.`
        );
        return updated;
      });
    },
    [showToast]
  );

  // RF-14: Actualización de estado confirmada desde MySQL
  const handleAlertUpdated = useCallback((updated: LiveAlertRecord) => {
    setAlerts((prev) => mergeAlertsDeduplicated(prev, [updated]));
  }, []);

  // Optimistic UI Handler: Add Maintenance
  const handleAddMaintenance = useCallback(
    (entry: Mantenimiento) => {
      setMaintenances((prev) => {
        const updated = [entry, ...prev];
        queueMicrotask(() => saveStoredMantenimientos(updated));
        return updated;
      });
      showToast('UI Optimista (0ms): Intervención registrada en la bitácora.');
    },
    [showToast]
  );

  // Handler: Add to DLQ (Escenario B)
  const handleAddDLQ = useCallback(
    (entry: DLQEntry) => {
      setDlqEntries((prev) => {
        const updated = [entry, ...prev];
        queueMicrotask(() => saveStoredDLQ(updated));
        return updated;
      });
      showToast('Payload corrupto enrutado exitosamente a la Dead Letter Queue (DLQ).');
    },
    [showToast]
  );

  const activeAlertsCount = useMemo(
    () => alerts.filter((a) => a.estado !== 'RESUELTA').length,
    [alerts]
  );

  // Wrapper de simulación móvil cuando el usuario elige probar en celulares (iPhone 15 390px / Android 412px)
  const mobileFrameClass =
    viewportProfile === 'iphone-15'
      ? 'max-w-[390px] mx-auto border-x-4 border-sage-mist  min-h-screen'
      : viewportProfile === 'android-mid'
      ? 'max-w-[412px] mx-auto border-x-4 border-sage-mist  min-h-screen'
      : '';

  // Estado de carga inicial con Skeleton Shimmer en Gallery Black
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-cream-paper p-6 flex flex-col justify-center items-center">
        <HeroSkeleton />
      </div>
    );
  }

  return (
    <div className={`bg-cream-paper min-h-screen ${mobileFrameClass}`}>
      {/* Barra superior de Simulación de Celular activa */}
      {viewportProfile !== 'desktop' && (
        <div className="sticky top-0 z-50 bg-canopy text-sheet-white px-4 py-1.5 text-[11px] font-semibold flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-mono">
            <Smartphone className="w-3.5 h-3.5" />
            Simulador Móvil: {viewportProfile === 'iphone-15' ? 'iPhone 15 Pro (390px)' : 'Android Gama Media (412px)'}
          </span>
          <button
            onClick={() => networkSimulator.setViewport('desktop')}
            className="px-2.5 py-0.5 rounded-[8px] bg-sheet-white/25 hover:bg-deep-abyss/55 text-[10px]"
          >
            Salir a Desktop
          </button>
        </div>
      )}

      <Suspense
        fallback={
          <div className="min-h-screen bg-cream-paper p-6 flex flex-col justify-center items-center">
            <HeroSkeleton />
          </div>
        }
      >
        {viewMode === 'landing' ? (
          <EnvironmentalLandingPage
            onEnterSystem={(initialTab) => {
              if (typeof initialTab === 'string') {
                setActiveTab(initialTab);
              } else {
                setActiveTab('dashboard');
              }
              setViewMode('system');
              window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
            }}
            skeletonMode={skeletonMode}
            onToggleSkeletonMode={() => setSkeletonMode(!skeletonMode)}
            onOpenPerformanceMonitor={() => setShowPerformanceModal(true)}
          />
        ) : authChecking ? (
          <div className="min-h-screen bg-obsidian-shell text-pure-white flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-neon-pulse" />
            <p className="text-sm text-slate-text">Verificando sesión segura...</p>
          </div>
        ) : !currentUser ? (
          <LoginModal
            isOpen
            fullPage
            onBackToLanding={() => setViewMode('landing')}
            onLoginSuccess={(u) => {
              setCurrentUser(u);
              setActiveTab(getDefaultTabForRole(u.rol));
              loadLocationsFromMySQL();
              showToast(`Sesión iniciada como ${u.nombre}.`);
            }}
          />
        ) : (
          <div className="min-h-screen bg-cream-paper text-bark flex flex-col transition-colors">
            {/* Top Navigation Bar con sesión real y cierre de sesión */}
            <Navbar
              currentUser={currentUser}
              onLogout={handleLogout}
              activeAlertCount={activeAlertsCount}
              onOpenAlerts={() => handleAuthorizedTabChange('alerts')}
              onOpenSimulator={FIELD_SIMULATOR_ENABLED ? () => setShowSimulator(true) : undefined}
              onOpenPerformanceMonitor={() => setShowPerformanceModal(true)}
              activeTab={activeTab}
              onTabChange={handleAuthorizedTabChange}
              isStreaming={isStreaming}
              onToggleStreaming={FIELD_SIMULATOR_ENABLED ? () => setIsStreaming(!isStreaming) : undefined}
              onBackToLanding={() => setViewMode('landing')}
            />

            {/* Main Layout Body */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Sidebar */}
              <Sidebar
                activeTab={activeTab}
                onTabChange={handleAuthorizedTabChange}
                userRole={currentUser.rol}
                alertCount={activeAlertsCount}
                devicesCount={connectivity?.length ?? 0}
                simulatorEnabled={FIELD_SIMULATOR_ENABLED}
              />

              {/* Content Viewport */}
              <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
                {skeletonMode ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center pb-2">
                      <span className="font-semibold text-xs text-canopy font-mono">
                        [Vista Skeleton Activa en Panel de Gestión]
                      </span>
                      <button
                        onClick={() => setSkeletonMode(false)}
                        className="px-4 py-1.5 text-xs rounded-[8px] bg-canopy text-sheet-white font-semibold"
                      >
                        Ver Datos Reales
                      </button>
                    </div>
                    <CardGridSkeleton count={4} cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
                  </div>
                ) : (
                  <SystemErrorBoundary onReset={() => setViewMode('landing')}>
                    <Suspense
                      fallback={<CardGridSkeleton count={4} cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />}
                    >
                    {activeTab === 'dashboard' && (
                      <LiveTelemetryView
                        locations={locations}
                        selectedLocationId={selectedLocationId}
                        onSelectLocation={setSelectedLocationId}
                        connectivity={connectivity}
                        activeAlerts={alerts}
                        onOpenAlertModal={setSelectedAlertForModal}
                      />
                    )}

                    {activeTab === 'devices' && (
                      <DeviceManagement
                        devices={devices}
                        sensors={sensors}
                        locations={locations}
                        users={[currentUser]}
                        currentUserRole={currentUser.rol}
                        onAddDevice={handleAddDevice}
                        onUpdateSensorLimits={handleUpdateSensorLimits}
                        onToggleDeviceState={handleToggleDeviceOffline}
                        onNotify={showToast}
                        connectivity={connectivity}
                      />
                    )}

                    {activeTab === 'locations' && (
                      <LocationCatalogView
                        currentUserRole={currentUser.rol}
                        onNotify={showToast}
                        onLocationsChanged={loadLocationsFromMySQL}
                      />
                    )}

                    {activeTab === 'sensors' && (
                      <SensorManagementView
                        currentUserRole={currentUser.rol}
                        onNotify={showToast}
                      />
                    )}

                    {activeTab === 'alerts' && (
                      <AlertsManager
                        alerts={alerts}
                        locations={locations}
                        devices={devices}
                        sensors={sensors}
                        currentUser={currentUser}
                        onAlertUpdated={handleAlertUpdated}
                        onNotify={showToast}
                        selectedAlertForModal={selectedAlertForModal}
                        onCloseModal={() => setSelectedAlertForModal(null)}
                        onOpenModal={setSelectedAlertForModal}
                      />
                    )}

                    {activeTab === 'analytics' && (
                      <HistoricalAnalytics
                        locations={locations}
                        devices={devices}
                        sensors={sensors}
                        readingsHistory={readingsHistory}
                      />
                    )}

                    {activeTab === 'ai' && (
                      <AiDiagnosticPanel
                        locations={locations}
                        devices={devices}
                        sensors={sensors}
                        readingsHistory={readingsHistory}
                        activeAlerts={alerts}
                      />
                    )}

                    {activeTab === 'maintenance' && (
                      <MaintenanceLog
                        maintenances={maintenances}
                        connectivity={connectivity}
                        currentUser={currentUser}
                        onAddMaintenance={handleAddMaintenance}
                      />
                    )}

                    {FIELD_SIMULATOR_ENABLED && activeTab === 'simulator' && (
                      <div className="space-y-6">
                        <div className="bg-sheet-white p-8 rounded-[16px] space-y-4">
                          <span className="apple-badge-orange inline-block">ENTORNO DE PRUEBAS E2E</span>
                          <h3 className="apple-card-heading text-bark">
                            Simulador de Campo &amp; Pruebas de Resiliencia
                          </h3>
                          <p className="apple-body text-slate max-w-2xl">
                            Abra la consola de control para emular microcontroladores ESP32 en condiciones de sobrecalentamiento, desconexión de red o ingesta de paquetes corruptos hacia la Dead Letter Queue (DLQ).
                          </p>
                          <div className="pt-2 flex flex-wrap gap-3">
                            <button
                              onClick={() => setShowSimulator(true)}
                              className="apple-blue-pill px-6 py-2.5 text-xs font-semibold"
                            >
                              Abrir Consola del Simulador Edge
                            </button>
                            <button
                              onClick={() => setShowPerformanceModal(true)}
                              className="apple-white-outline-pill px-6 py-2.5 text-xs font-semibold"
                            >
                              Abrir Consola RUM, 3G y Móvil
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    </Suspense>
                  </SystemErrorBoundary>
                )}
              </main>
            </div>

            {/* Edge Simulator Modal */}
            {FIELD_SIMULATOR_ENABLED && showSimulator && (
              <FieldSimulatorModal
                isOpen={showSimulator}
                onClose={() => setShowSimulator(false)}
                devices={devices}
                sensors={sensors}
                locations={locations}
                dlqEntries={dlqEntries}
                onInjectFault={(sensorId, fault) => {
                  telemetryEngineInstance.injectFault(sensorId, fault);
                  showToast('Falla ambiental inyectada en el sensor seleccionado.');
                }}
                onClearFault={(sensorId) => {
                  telemetryEngineInstance.clearFault(sensorId);
                  showToast('Falla cancelada. Telemetría normalizada.');
                }}
                onAddDLQ={handleAddDLQ}
                onToggleDeviceOffline={handleToggleDeviceOffline}
                activeFaults={telemetryEngineInstance.getActiveFaults()}
              />
            )}
          </div>
        )}

        {/* Consola Global de Rendimiento (RUM, OpenTelemetry, Redis, Load Balancer, 3G/Mobile Simulator) */}
        {showPerformanceModal && (
          <PerformanceMonitorModal
            isOpen={showPerformanceModal}
            onClose={() => setShowPerformanceModal(false)}
          />
        )}
      </Suspense>

      {/* Banner de Alerta Automática en Tiempo Real RF-13 (Paleta Verde SIMOA) */}
      {liveAlertBanner && (
        <div
          role="alert"
          className="fixed top-20 right-6 z-50 max-w-md rounded-[16px] border border-[#16a34a] bg-[#f0fdf4] text-[#0d1310] p-4 shadow-xl backdrop-blur-md transition-all"
        >
          <div className="flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 text-[#16a34a] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#14532d] border border-[#86efac]">
                  {liveAlertBanner.nivel} · {liveAlertBanner.variable_alterada || 'AMBIENTAL'}
                </span>
                {liveAlertBanner.provisional && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#14532d] border border-[#86efac]">
                    Provisional
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-[#0d1310] leading-snug">
                {liveAlertBanner.mensaje}
              </p>
              <p className="text-[11px] text-[#2d543c]">
                {liveAlertBanner.ubicacion_nombre || liveAlertBanner.ubicacion_id} ·{' '}
                {liveAlertBanner.sensor_identificador || liveAlertBanner.sensor_id}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    handleAuthorizedTabChange('alerts');
                    setLiveAlertBanner(null);
                  }}
                  className="text-[11px] font-medium text-neon-pulse hover:underline cursor-pointer"
                >
                  Ver en Alertas
                </button>
                <button
                  type="button"
                  onClick={() => setAlertSoundEnabled((v) => !v)}
                  title={alertSoundEnabled ? 'Silenciar aviso sonoro' : 'Activar aviso sonoro'}
                  className="text-[11px] text-slate-text hover:text-pure-white inline-flex items-center gap-1 cursor-pointer ml-auto"
                >
                  {alertSoundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  {alertSoundEnabled ? 'Sonido ON' : 'Sonido OFF'}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLiveAlertBanner(null)}
              aria-label="Cerrar notificación de alerta"
              className="text-slate-text hover:text-pure-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Global Toast Notification — SIMOA Eco Capsule */}
      {toastMessage && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-[36px] bg-sheet-white border border-canopy  text-bark text-[14px] font-semibold leading-[18px] tracking-[-0.224px] animate-slideUp"
        >
          {toastType === 'success' ? (
            <Check className="w-4 h-4 text-canopy shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-[#16a34a] shrink-0" />
          )}
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
