import React, { useState } from 'react';
import {
  SlidersHorizontal,
  Flame,
  DoorOpen,
  WifiOff,
  FileWarning,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Server,
  Zap,
} from 'lucide-react';
import { Dispositivo, Sensor, Ubicacion, DLQEntry } from '../../types/iot';

interface FieldSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: Dispositivo[];
  sensors: Sensor[];
  locations: Ubicacion[];
  dlqEntries: DLQEntry[];
  onInjectFault: (
    sensorId: string,
    fault: { tempOffset?: number; humOffset?: number; forceAnomaly?: boolean; forceOffline?: boolean }
  ) => void;
  onClearFault: (sensorId: string) => void;
  onAddDLQ: (entry: DLQEntry) => void;
  onToggleDeviceOffline: (deviceId: string) => void;
  activeFaults: { [sensorId: string]: any };
}

export const FieldSimulatorModal: React.FC<FieldSimulatorModalProps> = ({
  isOpen,
  onClose,
  devices,
  sensors,
  locations,
  dlqEntries,
  onInjectFault,
  onClearFault,
  onAddDLQ,
  onToggleDeviceOffline,
  activeFaults,
}) => {
  const [selectedSensorId, setSelectedSensorId] = useState(sensors[0]?.id_sensor || '');
  const [malformedJsonText, setMalformedJsonText] = useState('{"node":"esp32_01", "t": 999.99, "h": ERR_CRC_FAIL}');

  if (!isOpen) return null;

  const currentSensor = sensors.find((s) => s.id_sensor === selectedSensorId);
  const currentDevice = devices.find((d) => d.id_dispositivo === currentSensor?.dispositivo_id);
  const currentLocation = locations.find((l) => l.id_ubicacion === currentDevice?.ubicacion_id);

  const hasFault = !!activeFaults[selectedSensorId];

  // Inyectar falla de aire acondicionado
  const handleSimulateAcFailure = () => {
    onInjectFault(selectedSensorId, { tempOffset: 9.5, forceAnomaly: true });
  };

  // Inyectar apertura de puerta frigorífica
  const handleSimulateDoorOpen = () => {
    onInjectFault(selectedSensorId, { tempOffset: 6.2, humOffset: 25.0, forceAnomaly: true });
  };

  // Inyectar paquete corrupto a DLQ (Escenario B)
  const handleSendCorruptPayload = () => {
    const newEntry: DLQEntry = {
      id: `dlq-${Date.now().toString().slice(-6)}`,
      topic: currentDevice?.mqtt_topic || 'iot/telemetry/corrupt',
      raw_payload: malformedJsonText,
      error_motivo: 'JSONDecodeError: Payload con sintaxis corrupta o checksum CRC inválido rechazado en Node-RED',
      ip_origen: currentDevice?.ip_address || '192.168.10.45',
      fecha_hora: new Date().toISOString(),
    };
    onAddDLQ(newEntry);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Simulador de Campo IoT & Dead Letter Queue (DLQ)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inyección de fallas termodinámicas, pruebas de reconexión y manejo de paquetes corruptos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base font-semibold"
          >
            ✕
          </button>
        </div>

        {/* Content Scrollable */}
        <div className="p-5 space-y-6 overflow-y-auto text-xs">
          {/* Selector de Sensor Destino */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-0.5">
                Nodo IoT Objetivo para Inyección:
              </label>
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                {currentLocation?.nombre} · {currentDevice?.nombre} ({currentSensor?.tipo_sensor})
              </div>
            </div>

            <select
              value={selectedSensorId}
              onChange={(e) => setSelectedSensorId(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-medium"
            >
              {sensors.map((s) => {
                const dev = devices.find((d) => d.id_dispositivo === s.dispositivo_id);
                const loc = locations.find((l) => l.id_ubicacion === dev?.ubicacion_id);
                return (
                  <option key={s.id_sensor} value={s.id_sensor}>
                    {loc?.nombre} ({s.tipo_sensor})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Sección 1: Inyección de Fallas Físicas / Ambientales */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Escenarios de Falla Ambiental y Umbrales</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Botón Falla AC */}
              <button
                onClick={handleSimulateAcFailure}
                className="p-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100/60 dark:hover:bg-red-900/30 text-left transition-colors space-y-1.5"
              >
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold">
                  <Flame className="w-4 h-4" />
                  <span>Falla en Climatización</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Induce alza instantánea de +9.5°C para disparar umbral operacional superior.
                </p>
              </button>

              {/* Botón Puerta Fría */}
              <button
                onClick={handleSimulateDoorOpen}
                className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 text-left transition-colors space-y-1.5"
              >
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
                  <DoorOpen className="w-4 h-4" />
                  <span>Puerta Abierta</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Aumenta temperatura +6.2°C y humedad +25% simulando ingreso de aire ambiental.
                </p>
              </button>

              {/* Desconectar Nodo */}
              <button
                onClick={() => {
                  if (currentDevice) onToggleDeviceOffline(currentDevice.id_dispositivo);
                }}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors space-y-1.5"
              >
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
                  <WifiOff className="w-4 h-4 text-slate-500" />
                  <span>{currentDevice?.estado === 'ONLINE' ? 'Simular Offline' : 'Restablecer Online'}</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Simula timeout de ping MQTT (&gt;3 min) para verificar el estado Desconectado.
                </p>
              </button>
            </div>

            {hasFault && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Hay una simulación activa en este sensor. Las métricas continuarán alteradas.</span>
                </div>
                <button
                  onClick={() => onClearFault(selectedSensorId)}
                  className="flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300 underline"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restablecer
                </button>
              </div>
            )}
          </div>

          {/* Sección 2: Escenario B - Dead Letter Queue (DLQ) */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <FileWarning className="w-4 h-4 text-red-500" />
              <span>Escenario B: Dead Letter Queue (Payload Telemétrico Corrupto)</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Prueba la resiliencia del pipeline en Node-RED enviando un paquete JSON truncado o dañado. El broker no se detendrá y enrutará el fallo a la cola DLQ para auditoría.
            </p>

            <div className="flex gap-2 font-mono">
              <input
                type="text"
                value={malformedJsonText}
                onChange={(e) => setMalformedJsonText(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
              />
              <button
                onClick={handleSendCorruptPayload}
                className="px-3.5 py-1.5 font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shrink-0"
              >
                Inyectar a DLQ
              </button>
            </div>

            {/* Registros en DLQ */}
            <div className="bg-slate-950 text-slate-200 rounded-lg p-3 font-mono text-[11px] space-y-2 max-h-40 overflow-y-auto">
              <div className="text-slate-400 font-semibold border-b border-slate-800 pb-1">
                Cola Dead Letter Queue (Últimos eventos capturados):
              </div>
              {dlqEntries.length === 0 ? (
                <div className="text-slate-500 py-1">Cola vacía. Cero paquetes descartados.</div>
              ) : (
                dlqEntries.map((dlq) => (
                  <div key={dlq.id} className="space-y-0.5 border-b border-slate-800/60 pb-1.5">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-red-400">{dlq.id} · {dlq.topic}</span>
                      <span>{new Date(dlq.fecha_hora).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-slate-300 truncate">Payload: {dlq.raw_payload}</div>
                    <div className="text-amber-400 text-[10px]">{dlq.error_motivo}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 shrink-0">
          <button
            onClick={() => onClearFault(selectedSensorId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 text-xs font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restablecer Telemetría
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-white bg-slate-900 dark:bg-emerald-600 rounded-lg text-xs"
          >
            Cerrar Simulador
          </button>
        </div>
      </div>
    </div>
  );
};
