import React from 'react';
import { AlertTriangle, Clock, PowerOff, Wifi, WifiOff } from 'lucide-react';
import { DeviceConnectivity, DispositivoEstado, formatLastContact } from '../../services/deviceService';

const states = {
  ONLINE: { icon: Wifi, color: 'bg-emerald-400/15 text-emerald-300', detail: 'Conexión confirmada' },
  ADVERTENCIA: { icon: AlertTriangle, color: 'bg-signal-yellow/15 text-signal-yellow', detail: 'Retraso en la comunicación' },
  OFFLINE: { icon: WifiOff, color: 'bg-red-500/15 text-red-300', detail: 'Comunicación interrumpida' },
  INACTIVO: { icon: PowerOff, color: 'bg-graphite-fill/40 text-slate-text', detail: 'Desactivado administrativamente' },
  PENDIENTE: { icon: Clock, color: 'bg-graphite-fill/40 text-slate-text', detail: 'Esperando la primera comunicación válida' },
  ERROR: { icon: AlertTriangle, color: 'bg-red-500/15 text-red-300', detail: 'Error reportado' },
  UNKNOWN: { icon: Clock, color: 'bg-graphite-fill/40 text-slate-text', detail: 'Estado sin verificar' },
};

export function DeviceConnectivityBadge({ state }: { state?: DispositivoEstado }) {
  const { icon: Icon, color, detail } = states[state ?? 'UNKNOWN'];
  return (
    <span title={detail} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${color}`}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {state ?? 'SIN ESTADO'}
    </span>
  );
}

export function DeviceConnectivityPanel({ devices }: { devices: DeviceConnectivity[] | null }) {
  return (
    <section aria-label="Conectividad de nodos" className="rounded-[16px] bg-sheet-white p-5">
      <h2 className="apple-card-heading">Conectividad de nodos</h2>
      {devices === null ? (
        <p role="status" className="mt-2 text-sm text-slate">Estado de conectividad no disponible.</p>
      ) : devices.length === 0 ? (
        <p className="mt-2 text-sm text-slate">Sin dispositivos registrados.</p>
      ) : (
        <ul className="mt-3 divide-y divide-sage-mist">
          {devices.map((device) => (
            <li key={device.id_dispositivo} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="font-medium">{device.nombre}</p>
                <p className="text-xs text-slate">{device.codigo || device.id_dispositivo} · {device.ubicacion}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DeviceConnectivityBadge state={device.estado} />
                <span className="text-xs text-slate">Último contacto · {formatLastContact(device.ultimo_ping)}</span>
                {(device.estado === 'ADVERTENCIA' || device.estado === 'OFFLINE') && (
                  <span className={`text-xs ${states[device.estado].color}`}>{states[device.estado].detail}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
