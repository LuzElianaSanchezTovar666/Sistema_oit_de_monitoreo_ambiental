import React, { useState } from 'react';
import {
  Wrench,
  Plus,
  Calendar,
  CheckCircle2,
  DollarSign,
  User,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { Mantenimiento, Dispositivo, Sensor, Usuario } from '../../types/iot';

interface MaintenanceLogProps {
  maintenances: Mantenimiento[];
  devices: Dispositivo[];
  sensors: Sensor[];
  currentUser: Usuario;
  onAddMaintenance: (entry: Mantenimiento) => void;
}

export const MaintenanceLog: React.FC<MaintenanceLogProps> = ({
  maintenances,
  devices,
  sensors,
  currentUser,
  onAddMaintenance,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState(devices[0]?.id_dispositivo || '');
  const [tipoMnt, setTipoMnt] = useState<Mantenimiento['tipo_mantenimiento']>('CALIBRACION');
  const [descripcion, setDescripcion] = useState('');
  const [costo, setCosto] = useState(85);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const dev = devices.find((d) => d.id_dispositivo === selectedDeviceId);
    const sens = sensors.find((s) => s.dispositivo_id === selectedDeviceId);

    const newMnt: Mantenimiento = {
      id_mantenimiento: `mnt-${Date.now().toString().slice(-6)}`,
      dispositivo_id: selectedDeviceId,
      sensor_id: sens?.id_sensor,
      tecnico_id: currentUser.id_usuario,
      tecnico_nombre: currentUser.nombre,
      tipo_mantenimiento: tipoMnt,
      descripcion,
      fecha_realizacion: new Date().toISOString(),
      proxima_fecha_sugerida: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      costo_estimado_usd: costo,
      estado: 'COMPLETADO',
    };

    onAddMaintenance(newMnt);
    setShowModal(false);
    setDescripcion('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-500" />
            <span>Bitácora de Mantenimiento y Calibración Técnica</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Registro de intervenciones en sitio, trazabilidad metrológica y sustitución de hardware
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Intervención Técnica</span>
        </button>
      </div>

      {/* Grid de Estado de Sensores y Calibración */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sensors.map((s) => {
          const dev = devices.find((d) => d.id_dispositivo === s.dispositivo_id);
          return (
            <div
              key={s.id_sensor}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-emerald-500" />
                  {s.tipo_sensor}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {s.estado}
                </span>
              </div>
              <div className="text-slate-500 font-mono truncate">
                Dispositivo: {dev?.nombre}
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Última Calibración:</span>
                  <span>{new Date(s.ultima_calibracion).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Próximo Vencimiento:</span>
                  <span className="text-emerald-600 font-semibold">90 días</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabla de Intervenciones Registradas */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Histórico de Intervenciones Realizadas
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-2.5">Fecha</th>
                <th className="px-4 py-2.5">Tipo</th>
                <th className="px-4 py-2.5">Dispositivo</th>
                <th className="px-4 py-2.5">Técnico Responsable</th>
                <th className="px-4 py-2.5">Descripción de Trabajos</th>
                <th className="px-4 py-2.5 text-right">Costo (USD)</th>
                <th className="px-4 py-2.5 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
              {maintenances.map((mnt) => {
                const dev = devices.find((d) => d.id_dispositivo === mnt.dispositivo_id);
                return (
                  <tr key={mnt.id_mantenimiento} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                      {new Date(mnt.fecha_realizacion).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-amber-600 dark:text-amber-400">
                      {mnt.tipo_mantenimiento}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                      {dev?.nombre}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {mnt.tecnico_nombre}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {mnt.descripcion}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                      ${mnt.costo_estimado_usd || 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completado
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Registrar Intervención */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-500" />
                <span>Registrar Intervención de Mantenimiento</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Dispositivo / Nodo
                  </label>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
                  >
                    {devices.map((d) => (
                      <option key={d.id_dispositivo} value={d.id_dispositivo}>
                        {d.nombre} ({d.mac_address})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Tipo de Intervención
                  </label>
                  <select
                    value={tipoMnt}
                    onChange={(e) => setTipoMnt(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="CALIBRACION">Calibración con patrón trazable Fluke</option>
                    <option value="REEMPLAZO_BATERIA">Reemplazo de batería de respaldo</option>
                    <option value="LIMPIEZA_SONDA">Limpieza física de sonda higrométrica</option>
                    <option value="ACTUALIZACION_FIRMWARE">Actualización de Firmware OTA</option>
                    <option value="REVISION_GENERAL">Revisión Preventiva General</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Descripción Detallada de Trabajos y Hallazgos
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="ej. Se realizó calibración en 3 puntos con higrómetro de referencia certificado. Desviación ajustada: -0.3°C."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Técnico Responsable
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser.nombre}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Costo Estimado (USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={costo}
                    onChange={(e) => setCosto(parseFloat(e.target.value) || 0)}
                    className="w-full font-mono px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs"
                >
                  Guardar en Bitácora
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
