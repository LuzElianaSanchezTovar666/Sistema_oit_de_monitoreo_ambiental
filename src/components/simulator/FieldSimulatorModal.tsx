import React, { useState } from 'react';
import {
  SlidersHorizontal,
  Flame,
  DoorOpen,
  WifiOff,
  FileWarning,
  RotateCcw,
  AlertTriangle,
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

  const handleSimulateAcFailure = () => {
    onInjectFault(selectedSensorId, { tempOffset: 9.5, forceAnomaly: true });
  };

  const handleSimulateDoorOpen = () => {
    onInjectFault(selectedSensorId, { tempOffset: 6.2, humOffset: 25.0, forceAnomaly: true });
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A2E17]/65 backdrop-blur-md animate-fadeIn">
      <div className="bg-sheet-white border border-sage-mist rounded-[16px] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-sage-mist shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cream-paper text-[#D97706] flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[17px] font-semibold text-bark">
                Simulador de Campo IoT & Dead Letter Queue (DLQ)
              </h3>
              <p className="text-xs text-slate">
                Inyección de fallas termodinámicas, pruebas de reconexión y manejo de paquetes corruptos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate hover:text-bark text-base font-semibold"
          >
            ✕
          </button>
        </div>

        {/* Content Scrollable */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs">
          {/* Selector de Sensor Destino */}
          <div className="bg-cream-paper p-4 rounded-[16px] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="block text-slate font-semibold mb-0.5">
                Nodo IoT Objetivo para Inyección:
              </label>
              <div className="font-semibold text-bark text-sm">
                {currentLocation?.nombre} · {currentDevice?.nombre} ({currentSensor?.tipo_sensor})
              </div>
            </div>

            <select
              value={selectedSensorId}
              onChange={(e) => setSelectedSensorId(e.target.value)}
              className="apple-pill-select py-2 text-xs font-medium"
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
            <h4 className="text-xs font-semibold text-bark uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-canopy" />
              <span>Escenarios de Falla Ambiental y Umbrales</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Botón Falla AC */}
              <button
                onClick={handleSimulateAcFailure}
                className="p-4 rounded-[16px] bg-cream-paper hover:bg-cream-paper/50 border border-[#DC2626]/40 text-left transition-colors space-y-1.5"
              >
                <div className="flex items-center gap-2 text-[#DC2626] font-semibold">
                  <Flame className="w-4 h-4" />
                  <span>Falla Climatización</span>
                </div>
                <p className="text-[11px] text-slate">
                  Induce alza instantánea de +9.5°C para disparar umbral operacional superior.
                </p>
              </button>

              {/* Botón Puerta Fría */}
              <button
                onClick={handleSimulateDoorOpen}
                className="p-4 rounded-[16px] bg-cream-paper hover:bg-cream-paper/50 border border-[#D97706]/40 text-left transition-colors space-y-1.5"
              >
                <div className="flex items-center gap-2 text-[#D97706] font-semibold">
                  <DoorOpen className="w-4 h-4" />
                  <span>Puerta Abierta</span>
                </div>
                <p className="text-[11px] text-slate">
                  Aumenta temperatura +6.2°C y humedad +25% simulando ingreso de aire.
                </p>
              </button>

              {/* Desconectar Nodo */}
              <button
                onClick={() => {
                  if (currentDevice) onToggleDeviceOffline(currentDevice.id_dispositivo);
                }}
                className="p-4 rounded-[16px] bg-cream-paper hover:bg-cream-paper/50 border border-sage-mist text-left transition-colors space-y-1.5"
              >
                <div className="flex items-center gap-2 text-bark font-semibold">
                  <WifiOff className="w-4 h-4 text-slate" />
                  <span>{currentDevice?.estado === 'ONLINE' ? 'Simular Offline' : 'Restablecer Online'}</span>
                </div>
                <p className="text-[11px] text-slate">
                  Simula timeout de ping MQTT (&gt;3 min) para verificar estado Desconectado.
                </p>
              </button>
            </div>

            {hasFault && (
              <div className="flex items-center justify-between p-4 rounded-[16px] bg-cream-paper text-[#D97706] animate-fadeIn">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Hay una simulación activa en este sensor. Las métricas continuarán alteradas.</span>
                </div>
                <button
                  onClick={() => onClearFault(selectedSensorId)}
                  className="flex items-center gap-1 text-xs font-semibold text-bark underline shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restablecer
                </button>
              </div>
            )}
          </div>

          {/* Sección 2: Escenario B - Dead Letter Queue (DLQ) */}
          <div className="space-y-3 pt-3 border-t border-sage-mist">
            <h4 className="text-xs font-semibold text-bark uppercase tracking-wider flex items-center gap-1.5">
              <FileWarning className="w-4 h-4 text-[#DC2626]" />
              <span>Escenario B: Dead Letter Queue (Payload Telemétrico Corrupto)</span>
            </h4>
            <p className="text-[11px] text-slate">
              Prueba la resiliencia del pipeline en Node-RED enviando un paquete JSON truncado o dañado. El broker enrutará el fallo a la cola DLQ para auditoría.
            </p>

            <div className="flex gap-2 font-mono">
              <input
                type="text"
                value={malformedJsonText}
                onChange={(e) => setMalformedJsonText(e.target.value)}
                className="apple-pill-input flex-1 py-2 text-xs"
              />
              <button
                onClick={handleSendCorruptPayload}
                className="apple-blue-pill px-4 py-2 font-semibold text-xs shrink-0 font-sans"
              >
                Inyectar a DLQ
              </button>
            </div>

            {/* Registros en DLQ */}
            <div className="bg-cream-paper text-bark rounded-[16px] p-4 font-mono text-[11px] space-y-2 max-h-40 overflow-y-auto">
              <div className="text-slate font-semibold border-b border-sage-mist pb-1.5">
                Cola Dead Letter Queue (Últimos eventos capturados):
              </div>
              {dlqEntries.length === 0 ? (
                <div className="text-slate py-1">Cola vacía. Cero paquetes descartados.</div>
              ) : (
                dlqEntries.map((dlq) => (
                  <div key={dlq.id} className="space-y-0.5 border-b border-sage-mist/60 pb-1.5">
                    <div className="flex items-center justify-between text-slate">
                      <span className="text-[#DC2626]">{dlq.id} · {dlq.topic}</span>
                      <span>{new Date(dlq.fecha_hora).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-bark truncate">Payload: {dlq.raw_payload}</div>
                    <div className="text-[#D97706] text-[10px]">{dlq.error_motivo}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-cream-paper border-t border-sage-mist flex justify-end gap-2.5 shrink-0">
          <button
            onClick={() => onClearFault(selectedSensorId)}
            className="apple-white-outline-pill flex items-center gap-1.5 py-2 text-xs font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restablecer Telemetría
          </button>
          <button
            onClick={onClose}
            className="apple-blue-pill px-5 py-2 font-semibold text-xs"
          >
            Cerrar Simulador
          </button>
        </div>
      </div>
    </div>
  );
};
