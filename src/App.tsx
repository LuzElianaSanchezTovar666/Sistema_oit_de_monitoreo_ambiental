/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  USUARIOS_INICIALES,
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
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { LiveTelemetryView } from './components/dashboard/LiveTelemetryView';
import { DeviceManagement } from './components/devices/DeviceManagement';
import { AlertsManager } from './components/alerts/AlertsManager';
import { HistoricalAnalytics } from './components/analytics/HistoricalAnalytics';
import { AiDiagnosticPanel } from './components/ai/AiDiagnosticPanel';
import { MaintenanceLog } from './components/maintenance/MaintenanceLog';
import { FieldSimulatorModal } from './components/simulator/FieldSimulatorModal';
import { LoginModal } from './components/auth/LoginModal';
import { EnvironmentalLandingPage } from './components/landing/EnvironmentalLandingPage';
import { HeroSkeleton, CardGridSkeleton } from './components/common/SkeletonLoader';
import { Check, AlertCircle } from 'lucide-react';

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ecosense_theme');
      return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('ecosense_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('ecosense_theme', 'light');
    }
  }, [darkMode]);

  // Mode: 'landing' (Página pública de presentación) vs 'system' (Plataforma de gestión IoT)
  const [viewMode, setViewMode] = useState<'landing' | 'system'>('landing');

  // Skeleton loading states
  const [skeletonMode, setSkeletonMode] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);

  // Simulación de carga inicial progresiva con skeleton loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // App entities
  const [users] = useState<Usuario[]>(USUARIOS_INICIALES);
  const [currentUser, setCurrentUser] = useState<Usuario>(USUARIOS_INICIALES[0]);
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
  const [showLogin, setShowLogin] = useState<boolean>(false);
  const [selectedAlertForModal, setSelectedAlertForModal] = useState<Alerta | null>(null);

  // Streaming telemetry state
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [latestReadings, setLatestReadings] = useState<{ [sensorId: string]: Medicion }>({});
  const [readingsHistory, setReadingsHistory] = useState<{ [sensorId: string]: Medicion[] }>({});

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'alert'>('success');

  const showToast = (msg: string, type: 'success' | 'alert' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3800);
  };

  // Web Audio Beeper for alerts
  const playAlertSound = () => {
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
  };

  // Initialize historical buffer once
  useEffect(() => {
    const initialBuf = telemetryEngineInstance.generateInitialHistory(devices, sensors);
    setReadingsHistory({ ...initialBuf });

    // Set initial latest readings
    const latest: { [sensorId: string]: Medicion } = {};
    sensors.forEach((s) => {
      const history = initialBuf[s.id_sensor] || [];
      if (history.length > 0) {
        latest[s.id_sensor] = history[history.length - 1];
      }
    });
    setLatestReadings(latest);
  }, []);

  // Interval for real-time telemetry streaming (2.5 seconds)
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      const newReadings = telemetryEngineInstance.tick(devices, sensors, (newAlert) => {
        // Disparar nueva alerta respetando debouncing de 5 minutos
        setAlerts((prev) => {
          const updated = [newAlert, ...prev];
          saveStoredAlertas(updated);
          return updated;
        });

        playAlertSound();
        showToast(`¡Alerta detectada!: ${newAlert.mensaje}`, 'alert');
      });

      setLatestReadings((prev) => ({ ...prev, ...newReadings }));

      // Update local histories
      setReadingsHistory((prev) => {
        const updated = { ...prev };
        sensors.forEach((s) => {
          updated[s.id_sensor] = telemetryEngineInstance.getHistory(s.id_sensor);
        });
        return updated;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [isStreaming, devices, sensors]);

  // Handler: Add device
  const handleAddDevice = (device: Dispositivo, sensor: Sensor) => {
    const updatedDevices = [...devices, device];
    const updatedSensors = [...sensors, sensor];
    setDevices(updatedDevices);
    setSensors(updatedSensors);
    saveStoredDispositivos(updatedDevices);
    saveStoredSensores(updatedSensors);
    showToast(`Dispositivo ${device.nombre} dado de alta con éxito con credenciales MQTT.`);
  };

  // Handler: Update sensor limits
  const handleUpdateSensorLimits = (sensorId: string, limits: Sensor['limites']) => {
    const updated = sensors.map((s) => (s.id_sensor === sensorId ? { ...s, limites: limits } : s));
    setSensors(updated);
    saveStoredSensores(updated);
    showToast('Umbrales operacionales actualizados y sincronizados con el broker.');
  };

  // Handler: Toggle device offline
  const handleToggleDeviceOffline = (deviceId: string) => {
    const updated = devices.map((d) =>
      d.id_dispositivo === deviceId
        ? { ...d, estado: (d.estado === 'ONLINE' ? 'OFFLINE' : 'ONLINE') as any }
        : d
    );
    setDevices(updated);
    saveStoredDispositivos(updated);

    const dev = updated.find((d) => d.id_dispositivo === deviceId);
    showToast(
      dev?.estado === 'ONLINE'
        ? `Nodo ${dev.nombre} reconectado exitosamente.`
        : `Nodo ${dev?.nombre} desconectado (Escenario Offline verificado).`
    );
  };

  // Handler: Resolve Alert
  const handleResolveAlert = (
    alertId: string,
    motivo: string,
    notas: string,
    estado: 'RESUELTA' | 'EN_ATENCION'
  ) => {
    const updated = alerts.map((a) =>
      a.id_alerta === alertId
        ? {
            ...a,
            estado,
            motivo_resolucion: motivo,
            notas_resolucion: notas,
            atendido_por: currentUser.nombre,
            fecha_resolucion: new Date().toISOString(),
          }
        : a
    );
    setAlerts(updated);
    saveStoredAlertas(updated);
    showToast('Alerta registrada y resuelta con éxito');
  };

  // Handler: Add Maintenance
  const handleAddMaintenance = (entry: Mantenimiento) => {
    const updated = [entry, ...maintenances];
    setMaintenances(updated);
    saveStoredMantenimientos(updated);
    showToast('Intervención técnica registrada en la bitácora metrológica.');
  };

  // Handler: Add to DLQ (Escenario B)
  const handleAddDLQ = (entry: DLQEntry) => {
    const updated = [entry, ...dlqEntries];
    setDlqEntries(updated);
    saveStoredDLQ(updated);
    showToast('Payload corrupto enrutado exitosamente a la Dead Letter Queue (DLQ).');
  };

  const activeAlertsCount = alerts.filter((a) => a.estado !== 'RESUELTA').length;

  // Estado de carga inicial con Skeleton Shimmer elegante
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 flex flex-col justify-center items-center">
        <HeroSkeleton />
      </div>
    );
  }

  // 1. VISTA LANDING PAGE PÚBLICA (PRESENTACIÓN HERO, FUNCIONALIDADES, TECNOLOGÍAS, ETC.)
  if (viewMode === 'landing') {
    return (
      <EnvironmentalLandingPage
        onEnterSystem={() => setViewMode('system')}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        skeletonMode={skeletonMode}
        onToggleSkeletonMode={() => setSkeletonMode(!skeletonMode)}
      />
    );
  }

  // 2. VISTA SISTEMA DE GESTIÓN Y MONITOREO AMBIENTAL EN TIEMPO REAL
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Top Navigation Bar con acceso a volver a la Landing */}
      <Navbar
        currentUser={currentUser}
        allUsers={users}
        onSelectUser={setCurrentUser}
        activeAlertCount={activeAlertsCount}
        onOpenAlerts={() => setActiveTab('alerts')}
        onOpenSimulator={() => setShowSimulator(true)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isStreaming={isStreaming}
        onToggleStreaming={() => setIsStreaming(!isStreaming)}
        onBackToLanding={() => setViewMode('landing')}
      />

      {/* Main Layout Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          userRole={currentUser.rol}
          alertCount={activeAlertsCount}
          devicesCount={devices.length}
        />

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {skeletonMode ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-2">
                <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                  [Vista Skeleton Activa en Panel de Gestión]
                </span>
                <button
                  onClick={() => setSkeletonMode(false)}
                  className="px-3 py-1 text-xs rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  Ver Datos Reales
                </button>
              </div>
              <CardGridSkeleton count={4} cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
            </div>
          ) : (
            <>
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
                  users={users}
                  onAddDevice={handleAddDevice}
                  onUpdateSensorLimits={handleUpdateSensorLimits}
                  onToggleDeviceState={handleToggleDeviceOffline}
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
                  sensors={sensors}
                  readingsHistory={readingsHistory}
                />
              )}

              {activeTab === 'ai' && (
                <AiDiagnosticPanel
                  locations={locations}
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
                <div className="space-y-4">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Simulador de Campo & Pruebas E2E de Resiliencia
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Abra el panel de control para emular microcontroladores ESP32 en condiciones de sobrecalentamiento, desconexión de red o ingesta corrupta a DLQ.
                    </p>
                    <button
                      onClick={() => setShowSimulator(true)}
                      className="mt-4 px-4 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs"
                    >
                      Abrir Consola del Simulador Edge
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Edge Simulator Modal */}
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

      {/* Login Modal */}
      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        users={users}
        onLogin={(u) => {
          setCurrentUser(u);
          showToast(`Sesión iniciada con éxito como ${u.nombre} (${u.rol}).`);
        }}
      />

      {/* Global Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold border animate-slideUp ${
            toastType === 'success'
              ? 'bg-slate-900 text-white border-slate-700 dark:bg-white dark:text-slate-900 dark:border-slate-200'
              : 'bg-red-600 text-white border-red-700'
          }`}
        >
          {toastType === 'success' ? (
            <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-white shrink-0" />
          )}
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
