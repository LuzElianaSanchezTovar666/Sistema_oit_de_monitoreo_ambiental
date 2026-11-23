import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  Plus,
  Search,
  RefreshCw,
  Edit3,
  Power,
  Cpu,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { UserRole } from '../../types/iot';
import { useDebounce } from '../../hooks/useDebounce';
import {
  createUbicacion,
  fetchDispositivosByUbicacion,
  fetchUbicaciones,
  isValidAreaCode,
  toggleUbicacionEstado,
  UbicacionDTO,
  updateUbicacion,
} from '../../services/locationService';

interface LocationCatalogViewProps {
  currentUserRole: UserRole;
  onNotify?: (msg: string, type?: 'success' | 'alert') => void;
  onLocationsChanged?: () => void;
}

export const LocationCatalogView: React.FC<LocationCatalogViewProps> = ({
  currentUserRole,
  onNotify,
  onLocationsChanged,
}) => {
  const isAdmin = currentUserRole === 'admin';

  const [items, setItems] = useState<UbicacionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 280);
  const [estadoFilter, setEstadoFilter] = useState('ALL');

  // Modal Crear / Editar
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UbicacionDTO | null>(null);
  const [nombre, setNombre] = useState('');
  const [codigoArea, setCodigoArea] = useState('');
  const [tipo, setTipo] = useState('Cultivo');
  const [descripcion, setDescripcion] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal Dispositivos por ubicación
  const [devicesModalUbi, setDevicesModalUbi] = useState<UbicacionDTO | null>(null);
  const [ubiDevices, setUbiDevices] = useState<
    Array<{ id_dispositivo: string; codigo: string; nombre: string; mac_address: string; tipo: string; estado: string }>
  >([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchUbicaciones({
        estado: estadoFilter,
        search: debouncedSearch,
      });
      setItems(res.items);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar el catálogo de ubicaciones.');
    } finally {
      setLoading(false);
    }
  }, [estadoFilter, debouncedSearch]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const openCreate = () => {
    setEditing(null);
    setNombre('');
    setCodigoArea('');
    setTipo('Cultivo');
    setDescripcion('');
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (u: UbicacionDTO) => {
    setEditing(u);
    setNombre(u.nombre);
    setCodigoArea(u.codigo_area);
    setTipo(u.tipo);
    setDescripcion(u.descripcion || '');
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!nombre.trim() || nombre.trim().length < 2) {
      setFormError('El nombre de la ubicación es obligatorio.');
      return;
    }
    if (!isValidAreaCode(codigoArea)) {
      setFormError('El código de área debe tener formato consistente (ejemplo: AREA-05).');
      return;
    }
    if (!tipo.trim()) {
      setFormError('El tipo de ubicación es obligatorio.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const res = await updateUbicacion(editing.ubicacion_id, {
          nombre: nombre.trim(),
          codigo_area: codigoArea.trim().toUpperCase(),
          tipo: tipo.trim(),
          descripcion: descripcion.trim() || undefined,
        });
        onNotify?.(res.message, 'success');
      } else {
        const res = await createUbicacion({
          nombre: nombre.trim(),
          codigo_area: codigoArea.trim().toUpperCase(),
          tipo: tipo.trim(),
          descripcion: descripcion.trim() || undefined,
        });
        onNotify?.(res.message, 'success');
      }
      setFormOpen(false);
      await loadCatalog();
      onLocationsChanged?.();
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo guardar la ubicación.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEstado = async (u: UbicacionDTO) => {
    const nextEstado = u.estado === 'ACTIVA' ? 'INACTIVA' : 'ACTIVA';
    try {
      const res = await toggleUbicacionEstado(u.ubicacion_id, nextEstado);
      onNotify?.(res.message, 'success');
      await loadCatalog();
      onLocationsChanged?.();
    } catch (err: any) {
      onNotify?.(err?.message || 'No fue posible cambiar el estado.', 'alert');
    }
  };

  const openDevicesForLocation = async (u: UbicacionDTO) => {
    setDevicesModalUbi(u);
    setLoadingDevices(true);
    try {
      const res = await fetchDispositivosByUbicacion(u.ubicacion_id);
      setUbiDevices(res.items);
    } catch (err: any) {
      onNotify?.(err?.message || 'Error al consultar dispositivos.', 'alert');
    } finally {
      setLoadingDevices(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="sauce-eyebrow text-neon-pulse">RF-03 · CATÁLOGO MYSQL</p>
          <h1 className="text-2xl font-medium text-pure-white mt-1">
            Zonas del Invernadero y Áreas de Monitoreo
          </h1>
          <p className="text-sm text-slate-text mt-0.5">
            Administra las zonas del invernadero, códigos de área y dispositivos asignados con reglas RN-04.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadCatalog}
            className="px-4 py-2.5 rounded-[56px] bg-deep-abyss border border-graphite-fill text-pure-white hover:border-neon-pulse text-xs font-medium inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>

          {isAdmin && (
            <button
              onClick={openCreate}
              className="sauce-btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nueva ubicación
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-deep-abyss border border-graphite-fill/50 rounded-[20px] p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-text" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código de área o tipo..."
            className="apple-pill-input w-full pl-10 pr-4 py-2 text-sm"
          />
        </div>

        <select
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value)}
          className="apple-pill-select py-2 text-sm"
          aria-label="Filtrar ubicaciones por estado"
        >
          <option value="ALL">Todos los estados</option>
          <option value="ACTIVA">ACTIVA</option>
          <option value="INACTIVA">INACTIVA</option>
        </select>
      </div>

      {error && (
        <div className="p-4 rounded-[20px] bg-[#DC2626]/15 border border-[#DC2626]/50 text-[#FCA5A5] text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tarjetas del Catálogo */}
      {loading ? (
        <div className="p-10 flex items-center justify-center gap-3 text-slate-text text-sm bg-deep-abyss rounded-[20px] border border-graphite-fill/50">
          <Loader2 className="w-5 h-5 animate-spin text-neon-pulse" />
          <span>Cargando catálogo de ubicaciones...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((u) => (
            <div
              key={u.ubicacion_id}
              className="bg-deep-abyss border border-graphite-fill/60 rounded-[20px] p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-[10px] bg-obsidian-shell flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-neon-pulse" />
                    </div>
                    <div>
                      <h3 className="text-base font-medium text-pure-white">{u.nombre}</h3>
                      <span className="text-xs font-mono text-neon-pulse">{u.codigo_area}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-[56px] text-[11px] font-mono font-medium ${
                      u.estado === 'ACTIVA'
                        ? 'bg-neon-pulse/20 text-neon-pulse border border-neon-pulse/50'
                        : 'bg-graphite-fill/40 text-slate-text border border-graphite-fill'
                    }`}
                  >
                    {u.estado}
                  </span>
                </div>

                <div className="text-xs text-slate-text">
                  <span className="text-pure-white/80 font-medium">Tipo:</span> {u.tipo}
                </div>
                {u.descripcion && (
                  <p className="text-xs text-slate-text leading-relaxed">{u.descripcion}</p>
                )}
              </div>

              <div className="pt-3 border-t border-graphite-fill/40 flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={() => openDevicesForLocation(u)}
                  className="text-xs text-neon-pulse hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  {u.dispositivos_count} dispositivo(s) ({u.dispositivos_activos_count} activos)
                </button>

                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(u)}
                      className="px-3 py-1.5 rounded-[56px] bg-obsidian-shell border border-graphite-fill text-pure-white hover:border-neon-pulse text-xs inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggleEstado(u)}
                      className={`px-3 py-1.5 rounded-[56px] text-xs inline-flex items-center gap-1 cursor-pointer border ${
                        u.estado === 'ACTIVA'
                          ? 'bg-[#DC2626]/15 border-[#DC2626]/40 text-[#FCA5A5]'
                          : 'bg-neon-pulse/15 border-neon-pulse/40 text-neon-pulse'
                      }`}
                    >
                      <Power className="w-3 h-3" />
                      {u.estado === 'ACTIVA' ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear / Editar Ubicación */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm">
          <div className="bg-deep-abyss border border-graphite-fill rounded-[20px] w-full max-w-md p-6 space-y-4 text-pure-white">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">
                {editing ? 'Editar ubicación física' : 'Nueva ubicación física'}
              </h2>
              <button onClick={() => setFormOpen(false)} className="text-slate-text hover:text-pure-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} noValidate className="space-y-3 text-sm">
              <div>
                <label className="block text-xs text-slate-text mb-1">Nombre *</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Invernadero Norte"
                  className="apple-pill-input w-full py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-text mb-1">Código de área *</label>
                  <input
                    type="text"
                    required
                    value={codigoArea}
                    onChange={(e) => setCodigoArea(e.target.value.toUpperCase())}
                    placeholder="AREA-05"
                    className="apple-pill-input w-full py-2 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-text mb-1">Tipo *</label>
                  <input
                    type="text"
                    required
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value)}
                    placeholder="Cultivo / Germinación"
                    className="apple-pill-input w-full py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-text mb-1">Descripción (opcional)</label>
                <textarea
                  rows={2}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="apple-pill-input w-full py-2"
                />
              </div>

              {formError && (
                <div className="p-3 rounded-[10px] bg-[#DC2626]/15 border border-[#DC2626]/50 text-[#FCA5A5] text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 rounded-[56px] border border-graphite-fill text-slate-text hover:text-pure-white text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="sauce-btn-primary px-5 py-2 text-xs inline-flex items-center gap-2 cursor-pointer"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dispositivos por Ubicación */}
      {devicesModalUbi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm">
          <div className="bg-deep-abyss border border-graphite-fill rounded-[20px] w-full max-w-lg p-6 space-y-4 text-pure-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="sauce-eyebrow text-neon-pulse">{devicesModalUbi.codigo_area}</p>
                <h3 className="text-lg font-medium">Dispositivos en {devicesModalUbi.nombre}</h3>
              </div>
              <button
                onClick={() => setDevicesModalUbi(null)}
                className="text-slate-text hover:text-pure-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingDevices ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-neon-pulse" />
              </div>
            ) : ubiDevices.length === 0 ? (
              <p className="text-xs text-slate-text py-4">No hay dispositivos asignados a esta ubicación.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto text-xs">
                {ubiDevices.map((d) => (
                  <div
                    key={d.id_dispositivo}
                    className="p-3 rounded-[10px] bg-obsidian-shell border border-graphite-fill flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-pure-white">{d.nombre}</div>
                      <div className="font-mono text-slate-text">
                        {d.codigo} · {d.mac_address} · {d.tipo}
                      </div>
                    </div>
                    <span className="font-mono text-neon-pulse">{d.estado}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
