/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
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
import { Check, AlertCircle, Smartphone, Loader2 } from 'lucide-react';
import { fetchCurrentUser, logoutSession, getDefaultTabForRole } from './services/authService';

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
  const [locations] = useState<Ubicacion[]>(UBICACIONES_INICIALES);
  const [selectedLocationId, setSelectedLocationId] = useState<string>(UBICACIONES_INICIALES[0].id_ubicacion);

  const [devices, setDevices] = useState<Dispositivo[]>(getStoredDispositivos);
  const [sensors, setSensors] = useState<Sensor[]>(getStoredSensores);
  const [alerts, setAlerts] = useState<Alerta[]>(getStoredAlertas);
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
        }
      })
      .finally(() => {
        if (active) setAuthChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Streaming telemetry state (initialized synchronously so frame 1 is always complete)
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [readingsHistory, setReadingsHistory] = useState<{ [sensorId: string]: Medicion[] }>(() =>
    telemetryEngineInstance.generateInitialHistory(getStoredDispositivos(), getStoredSensores())
  );
  const [latestReadings, setLatestReadings] = useState<{ [sensorId: string]: Medicion }>(() => {
    const sList = getStoredSensores();
    const latest: { [sensorId: string]: Medicion } = {};
    sList.forEach((s) => {
      const history = telemetryEngineInstance.getHistory(s.id_sensor);
      if (history.length > 0) {
        latest[s.id_sensor] = history[history.length - 1];
      }
    });
    return latest;
  });

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
        admin: ['dashboard', 'devices', 'alerts', 'analytics', 'ai', 'maintenance', 'simulator'],
        cliente: ['dashboard', 'devices', 'alerts', 'analytics'],
        tecnico: ['dashboard', 'devices', 'maintenance', 'simulator'],
        supervisor: ['dashboard', 'devices', 'alerts', 'analytics', 'ai'],
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
              Promise.resolve(getStoredDispositivos()),
              Promise.resolve(getStoredSensores()),
              Promise.resolve(getStoredAlertas()),
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

  // Interval for real-time telemetry streaming (2.5 seconds)
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      const newReadings = telemetryEngineInstance.tick(devices, sensors, (newAlert) => {
        setAlerts((prev) => {
          const updated = [newAlert, ...prev];
          saveStoredAlertas(updated);
          return updated;
        });

        playAlertSound();
        showToast(`¡Alerta detectada!: ${newAlert.mensaje}`, 'alert');
      });

      setLatestReadings((prev) => ({ ...prev, ...newReadings }));

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

  // Optimistic UI Handler: Resolve Alert
  const handleResolveAlert = useCallback(
    (
      alertId: string,
      motivo: string,
      notas: string,
      estado: 'RESUELTA' | 'EN_ATENCION'
    ) => {
      setAlerts((prev) => {
        const updated = prev.map((a) =>
          a.id_alerta === alertId
            ? {
                ...a,
                estado,
                motivo_resolucion: motivo,
                notas_resolucion: notas,
                atendido_por: currentUser?.nombre || 'Sistema',
                fecha_resolucion: new Date().toISOString(),
              }
            : a
        );
        queueMicrotask(() => saveStoredAlertas(updated));
        return updated;
      });
      showToast('UI Optimista (0ms): Alerta resuelta sin esperar confirmación del servidor.');
    },
    [currentUser?.nombre, showToast]
  );

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
            className="px-2.5 py-0.5 rounded-[8px] bg-sheet-white/25 hover:bg-[#0A2E17]/55 text-[10px]"
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
              onOpenSimulator={() => setShowSimulator(true)}
              onOpenPerformanceMonitor={() => setShowPerformanceModal(true)}
              activeTab={activeTab}
              onTabChange={handleAuthorizedTabChange}
              isStreaming={isStreaming}
              onToggleStreaming={() => setIsStreaming(!isStreaming)}
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
                devicesCount={devices.length}
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
                        devices={devices}
                        sensors={sensors}
                        latestReadings={latestReadings}
                        readingsHistory={readingsHistory}
                        activeAlerts={alerts}
                        onOpenAlertModal={setSelectedAlertForModal}
                        onOpenSimulator={() => setShowSimulator(true)}
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
                      />
                    )}

                    {activeTab === 'alerts' && (
                      <AlertsManager
                        alerts={alerts}
                        locations={locations}
                        devices={devices}
                        sensors={sensors}
                        currentUser={currentUser}
                        onResolveAlert={handleResolveAlert}
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
                        devices={devices}
                        sensors={sensors}
                        currentUser={currentUser}
                        onAddMaintenance={handleAddMaintenance}
                      />
                    )}

                    {activeTab === 'simulator' && (
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
            {showSimulator && (
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

      {/* Global Toast Notification — SIMOA Eco Capsule */}
      {toastMessage && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-[36px] bg-sheet-white border border-canopy  text-bark text-[14px] font-semibold leading-[18px] tracking-[-0.224px] animate-slideUp"
        >
          {toastType === 'success' ? (
            <Check className="w-4 h-4 text-canopy shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
          )}
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
