import React, { useState } from 'react';
import {
  Wrench,
  Plus,
  CheckCircle2,
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
    <div className="space-y-[24px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="apple-card-heading text-bark flex items-center gap-2.5">
            <Wrench className="w-6 h-6 text-[#D97706]" />
            <span>Bitácora de Mantenimiento y Calibración Técnica</span>
          </h2>
          <p className="text-[14px] text-slate mt-1">
            Registro de intervenciones en sitio, trazabilidad metrológica y sustitución de hardware
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="apple-blue-pill flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Intervención Técnica</span>
        </button>
      </div>

      {/* Grid de Estado de Sensores y Calibración — Feature Metric Tiles (28px radius, 16px padding, no shadow) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px]">
        {sensors.map((s) => {
          const dev = devices.find((d) => d.id_dispositivo === s.dispositivo_id);
          return (
            <div
              key={s.id_sensor}
              className="bg-sheet-white rounded-[16px] p-[16px] space-y-3 text-xs flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[14px] text-bark flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-canopy" />
                    {s.tipo_sensor}
                  </span>
                  <span className="px-2 py-0.5 rounded-[5px] text-[10px] font-mono font-semibold bg-canopy/15 text-canopy">
                    {s.estado}
                  </span>
                </div>
                <div className="text-slate font-mono truncate">
                  Dispositivo: {dev?.nombre}
                </div>
              </div>
              <div className="pt-2.5 border-t border-sage-mist/60 space-y-1 font-mono text-[11px] text-slate">
                <div className="flex items-center justify-between">
                  <span>Última Calibración:</span>
                  <span className="text-bark">{new Date(s.ultima_calibracion).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Próximo Vencimiento:</span>
                  <span className="text-canopy font-semibold">90 días</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabla de Intervenciones Registradas — Charcoal Stage (#FFFFFF, 28px radius) */}
      <div className="bg-sheet-white rounded-[16px] overflow-hidden">
        <div className="px-6 py-4 border-b border-sage-mist/60">
          <h3 className="text-[17px] font-semibold text-bark">
            Histórico de Intervenciones Realizadas
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-cream-paper text-slate font-mono text-[11px] uppercase tracking-wider border-b border-sage-mist/60">
              <tr>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Dispositivo</th>
                <th className="px-5 py-3">Técnico Responsable</th>
                <th className="px-5 py-3">Descripción de Trabajos</th>
                <th className="px-5 py-3 text-right">Costo (USD)</th>
                <th className="px-5 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#afc4bf]/40 font-sans">
              {maintenances.map((mnt) => {
                const dev = devices.find((d) => d.id_dispositivo === mnt.dispositivo_id);
                return (
                  <tr key={mnt.id_mantenimiento} className="hover:bg-cream-paper/50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-slate">
                      {new Date(mnt.fecha_realizacion).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="apple-badge-orange font-mono">{mnt.tipo_mantenimiento}</span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-bark">
                      {dev?.nombre}
                    </td>
                    <td className="px-5 py-3.5 text-slate">
                      {mnt.tecnico_nombre}
                    </td>
                    <td className="px-5 py-3.5 text-slate max-w-xs truncate">
                      {mnt.descripcion}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-semibold text-bark">
                      ${mnt.costo_estimado_usd || 0}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] text-canopy font-semibold">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A2E17]/65 backdrop-blur-md animate-fadeIn">
          <div className="bg-sheet-white border border-sage-mist rounded-[16px] w-full max-w-lg p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-sage-mist pb-3">
              <h3 className="text-[17px] font-semibold text-bark flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[#D97706]" />
                <span>Registrar Intervención de Mantenimiento</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate hover:text-bark text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate font-semibold mb-1.5">
                    Dispositivo / Nodo
                  </label>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="apple-pill-select w-full py-2.5 text-xs"
                  >
                    {devices.map((d) => (
                      <option key={d.id_dispositivo} value={d.id_dispositivo}>
                        {d.nombre} ({d.mac_address})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate font-semibold mb-1.5">
                    Tipo de Intervención
                  </label>
                  <select
                    value={tipoMnt}
                    onChange={(e) => setTipoMnt(e.target.value as any)}
                    className="apple-pill-select w-full py-2.5 text-xs"
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
                <label className="block text-slate font-semibold mb-1.5">
                  Descripción Detallada de Trabajos y Hallazgos
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="ej. Se realizó calibración en 3 puntos con higrómetro de referencia certificado..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full px-4 py-3 rounded-[16px] border border-[#4A7C59] bg-cream-paper text-bark placeholder-[#4A7C59] focus:outline-none focus:border-canopy"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate font-semibold mb-1.5">
                    Técnico Responsable
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser.nombre}
                    className="apple-pill-input w-full py-2.5 text-xs opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-slate font-semibold mb-1.5">
                    Costo Estimado (USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={costo}
                    onChange={(e) => setCosto(parseFloat(e.target.value) || 0)}
                    className="apple-pill-input w-full font-mono py-2.5 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-sage-mist">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="apple-white-outline-pill py-2 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="apple-blue-pill px-5 py-2 font-semibold text-xs"
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
