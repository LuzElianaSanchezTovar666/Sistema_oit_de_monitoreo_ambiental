import React, { useEffect, useRef, useState } from 'react';
import { useSiteDataVersion } from '../../services/siteData';
import {
  Wrench,
  Plus,
  CheckCircle2,
  Cpu,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { Mantenimiento, Usuario } from '../../types/iot';
import {
  createGlobalMaintenance,
  DeviceConnectivity,
  fetchAllMaintenances,
  MantenimientoDTO,
} from '../../services/deviceService';
import { fetchSensores, SensorDTO } from '../../services/sensorService';
import { DeviceConnectivityPanel } from '../devices/DeviceConnectivity';

interface MaintenanceLogProps {
  connectivity: DeviceConnectivity[] | null;
  currentUser: Usuario;
}

export const MaintenanceLog: React.FC<MaintenanceLogProps> = ({
  connectivity,
  currentUser,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [sensors, setSensors] = useState<SensorDTO[]>([]);
  const [backendMaintenances, setBackendMaintenances] = useState<MantenimientoDTO[]>([]);
  const [listError, setListError] = useState('');
  const requestRef = useRef(0);
  const revision = useSiteDataVersion('mantenimientos', 'sensores', 'dispositivos');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const isAdminOrTecnico = currentUser.rol === 'admin' || currentUser.rol === 'tecnico';
  const devices = connectivity ?? [];

  const loadData = async () => {
    const request = ++requestRef.current;
    try {
      const [senRes, mntRes] = await Promise.all([fetchSensores(), fetchAllMaintenances()]);
      if (request !== requestRef.current) return;
      setSensors(senRes.items);
      setBackendMaintenances(mntRes.items);
      setListError('');
    } catch (err) {
      if (request === requestRef.current) {
        setListError(err instanceof Error ? err.message : 'No se pudo consultar la bitácora.');
      }
    }
  };

  useEffect(() => {
    void loadData();
    return () => { requestRef.current += 1; };
  }, [revision]);

  const [tipoMnt, setTipoMnt] = useState<Mantenimiento['tipo_mantenimiento']>('CALIBRACION');
  const [descripcion, setDescripcion] = useState('');
  const [costo, setCosto] = useState(85);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrTecnico) return;
    if (!devices.some((device) => device.id_dispositivo === selectedDeviceId)) return;
    const sens = sensors.find((s) => s.dispositivo_id === selectedDeviceId);

    setSubmitting(true);
    setFormError('');

    try {
      await createGlobalMaintenance({
        dispositivo_id: selectedDeviceId,
        sensor_id: sens?.id_sensor,
        tipo_mantenimiento: tipoMnt,
        descripcion,
        costo_estimado_usd: costo,
        resultado: 'EXITOSO',
        estado: 'COMPLETADO',
      });

      void loadData();
      setShowModal(false);
      setDescripcion('');
    } catch (err: any) {
      setFormError(err?.message || 'Error al persistir intervención en MySQL.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-[24px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="apple-card-heading text-bark flex items-center gap-2.5">
            <Wrench className="w-6 h-6 text-console-warning" />
            <span>Bitácora de Mantenimiento y Calibración Técnica</span>
          </h2>
          <p className="text-[14px] text-slate mt-1">
            Registro de intervenciones en sitio, trazabilidad metrológica y sustitución de hardware
          </p>
        </div>

        {isAdminOrTecnico ? (
          <button
            onClick={() => {
              setSelectedDeviceId(devices[0]?.id_dispositivo ?? '');
              setShowModal(true);
            }}
            disabled={devices.length === 0}
            className="apple-blue-pill flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Intervención Técnica</span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-500/10 text-green-700 border border-green-500/30">
            <ShieldAlert className="w-4 h-4 text-green-600" />
            <span>Solo lectura (RN-22: Requiere Administrador o Técnico)</span>
          </span>
        )}
      </div>

      <DeviceConnectivityPanel devices={connectivity} />
      {listError && <p role="alert" className="text-console-danger">{listError}</p>}

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
                    {s.modelo}
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
            <tbody className="divide-y divide-stone-border/40 font-sans">
              {backendMaintenances.map((mnt) => {
                const dev = devices.find((d) => d.id_dispositivo === mnt.dispositivo_id);
                const fecha = (mnt as any).fecha_intervencion || mnt.fecha_realizacion;
                const devName = (mnt as any).dispositivo_nombre || dev?.nombre || mnt.dispositivo_id;
                return (
                  <tr key={mnt.id_mantenimiento} className="hover:bg-cream-paper/50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-slate">
                      {fecha ? new Date(fecha).toLocaleDateString() : 'N/D'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="apple-badge-orange font-mono">{mnt.tipo_mantenimiento}</span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-bark">
                      {devName}
                    </td>
                    <td className="px-5 py-3.5 text-slate">
                      {mnt.tecnico_nombre}
                    </td>
                    <td className="px-5 py-3.5 text-slate max-w-xs truncate" title={mnt.descripcion}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-sheet-white border border-sage-mist rounded-[16px] w-full max-w-lg p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-sage-mist pb-3">
              <h3 className="text-[17px] font-semibold text-bark flex items-center gap-2">
                <Wrench className="w-5 h-5 text-console-warning" />
                <span>Registrar Intervención de Mantenimiento</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate hover:text-bark text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-700 text-xs">
                {formError}
              </div>
            )}

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
                        {d.nombre} ({d.codigo || d.id_dispositivo})
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
                  className="w-full px-4 py-3 rounded-[16px] border border-graphite-fill bg-cream-paper text-bark placeholder-slate-text focus:outline-none focus:border-canopy"
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
                  disabled={submitting}
                  className="apple-blue-pill px-5 py-2 font-semibold text-xs inline-flex items-center gap-1.5"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
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
