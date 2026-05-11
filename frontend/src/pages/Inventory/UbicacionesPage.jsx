import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '../../services/catalogApi';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import {
  MapPin, Plus, Search, Trash2, Edit2, CheckCircle, XCircle,
  Layers, Tag, Settings, Package, ChevronRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// ─── Small inline editor modal ────────────────────────────────
function MiniModal({ title, item, onSave, onClose }) {
  const [code, setCode] = useState(item?.codigo || '');
  const [desc, setDesc] = useState(item?.descripcion || '');
  const [active, setActive] = useState(item?.activo !== undefined ? item.activo : true);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content card max-w-sm animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-base mb-4">{item ? `Editar ${title}` : `Nuevo ${title}`}</h3>
        <div className="space-y-3">
          <div className="input-group">
            <label className="input-label">Código</label>
            <input className="input font-mono uppercase" value={code} onChange={e => setCode(e.target.value)} placeholder="Ej: EST, N1..." maxLength={10} />
          </div>
          <div className="input-group">
            <label className="input-label">Descripción</label>
            <input className="input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción legible..." />
          </div>
          {item && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="act-chk" checked={active} onChange={e => setActive(e.target.checked)} className="w-4 h-4" />
              <label htmlFor="act-chk" className="text-sm">Activo</label>
            </div>
          )}
        </div>
        <div className="flex gap-3 justify-end mt-5 pt-4 border-t border-border">
          <button className="btn btn--secondary btn--sm" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn--primary btn--sm"
            disabled={!code.trim() || !desc.trim()}
            onClick={() => onSave({ codigo: code, descripcion: desc, activo: active })}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reusable card for managing a taxonomy table ───────────────
function TaxonomyCard({ title, icon: Icon, color, items = [], isLoading, onAdd, onEdit, onDelete }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon size={16} style={{ color }} />
          <h3 className="font-bold text-sm">{title}</h3>
          <span className="badge text-[10px]">{items.length}</span>
        </div>
        <button onClick={onAdd} className="btn btn--primary btn--sm flex items-center gap-1 py-1 px-3">
          <Plus size={13} /> Nuevo
        </button>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {isLoading && <div className="text-center text-xs text-muted py-4">Cargando...</div>}
        {!isLoading && items.length === 0 && (
          <div className="text-center text-xs text-muted py-6 border-2 border-dashed border-border rounded-lg">
            Sin {title.toLowerCase()} registrados.<br/>Agrega el primero con el botón.
          </div>
        )}
        {items.map(item => (
          <div
            key={item.id}
            className="flex items-center justify-between p-2 rounded-lg bg-surface-elevated hover:bg-surface-hover transition-colors group"
          >
            <div className="flex items-center gap-3">
              <span
                className="font-mono text-xs font-bold px-2 py-0.5 rounded"
                style={{ background: color + '20', color }}
              >{item.codigo}</span>
              <span className="text-sm">{item.descripcion}</span>
              {!item.activo && <span className="badge text-[9px] badge--neutral">Inactivo</span>}
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onEdit(item)} className="btn btn--ghost p-1"><Edit2 size={13} /></button>
              <button onClick={() => onDelete(item)} className="btn btn--ghost p-1 text-danger-500"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────
export function UbicacionesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isUbiModalOpen, setIsUbiModalOpen] = useState(false);
  const [selectedUbi, setSelectedUbi] = useState(null);

  // Taxonomy modals
  const [prefijoModal, setPrefijoModal] = useState(null); // null | 'new' | {item}
  const [nivelModal, setNivelModal] = useState(null);

  // ─ Queries ─
  const { data: ubicaciones, isLoading } = useQuery({
    queryKey: ['ubicaciones', search],
    queryFn: () => catalogApi.getUbicaciones({ search })
  });
  const { data: stats } = useQuery({
    queryKey: ['ubicaciones-stats'],
    queryFn: () => catalogApi.getUbicacionStats()
  });
  const { data: prefijosData, isLoading: loadingPrefijos } = useQuery({
    queryKey: ['ubicaciones-prefijos'],
    queryFn: () => catalogApi.getUbicacionesPrefijos()
  });
  const { data: nivelesData, isLoading: loadingNiveles } = useQuery({
    queryKey: ['ubicaciones-niveles'],
    queryFn: () => catalogApi.getUbicacionesNiveles()
  });

  const prefijos = prefijosData?.data || [];
  const niveles = nivelesData?.data || [];

  // ─ Ubicacion mutations ─
  const ubiMutation = useMutation({
    mutationFn: (data) => selectedUbi
      ? catalogApi.updateUbicacion(selectedUbi.id, data)
      : catalogApi.createUbicacion(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['ubicaciones']);
      queryClient.invalidateQueries(['ubicaciones-stats']);
      toast.success(selectedUbi ? 'Ubicación actualizada' : 'Ubicación creada');
      closeUbiModal();
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });
  const ubiDelete = useMutation({
    mutationFn: (id) => catalogApi.deleteUbicacion(id),
    onSuccess: () => { queryClient.invalidateQueries(['ubicaciones']); toast.success('Ubicación eliminada'); },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });

  // ─ Prefijo mutations ─
  const prefijoCreate = useMutation({
    mutationFn: (data) => catalogApi.createPrefijo(data),
    onSuccess: () => { queryClient.invalidateQueries(['ubicaciones-prefijos']); toast.success('Prefijo creado'); setPrefijoModal(null); },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });
  const prefijoUpdate = useMutation({
    mutationFn: ({ id, data }) => catalogApi.updatePrefijo(id, data),
    onSuccess: () => { queryClient.invalidateQueries(['ubicaciones-prefijos']); toast.success('Prefijo actualizado'); setPrefijoModal(null); },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });
  const prefijoDelete = useMutation({
    mutationFn: (id) => catalogApi.deletePrefijo(id),
    onSuccess: () => { queryClient.invalidateQueries(['ubicaciones-prefijos']); toast.success('Prefijo eliminado'); },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });

  // ─ Nivel mutations ─
  const nivelCreate = useMutation({
    mutationFn: (data) => catalogApi.createNivel(data),
    onSuccess: () => { queryClient.invalidateQueries(['ubicaciones-niveles']); toast.success('Nivel creado'); setNivelModal(null); },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });
  const nivelUpdate = useMutation({
    mutationFn: ({ id, data }) => catalogApi.updateNivel(id, data),
    onSuccess: () => { queryClient.invalidateQueries(['ubicaciones-niveles']); toast.success('Nivel actualizado'); setNivelModal(null); },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });
  const nivelDelete = useMutation({
    mutationFn: (id) => catalogApi.deleteNivel(id),
    onSuccess: () => { queryClient.invalidateQueries(['ubicaciones-niveles']); toast.success('Nivel eliminado'); },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });

  const openUbiModal = (u = null) => { setSelectedUbi(u); setIsUbiModalOpen(true); };
  const closeUbiModal = () => { setSelectedUbi(null); setIsUbiModalOpen(false); };

  const handleUbiSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    ubiMutation.mutate({ ...data, activo: data.activo === 'on' });
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <Topbar
        title="Ubicaciones de Bodega"
        subtitle="Gestión jerárquica de espacios físicos de almacenamiento"
        rightContent={
          <button onClick={() => openUbiModal()} className="btn btn--primary flex items-center gap-2">
            <Plus size={18} /> Nueva Ubicación
          </button>
        }
      />
      <main className="main-content">
        <div className="animate-in fade-in duration-500 space-y-6">

          {/* KPIs */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Ubicaciones</div>
              <div className="kpi-value">{ubicaciones?.data?.length || 0}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Tipos de Almacén</div>
              <div className="kpi-value">{prefijos.length}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Niveles Definidos</div>
              <div className="kpi-value">{niveles.length}</div>
            </div>
            <div className="kpi-card" style={{ borderLeft: '4px solid var(--clr-danger)' }}>
              <div className="kpi-label">Items sin Ubicación</div>
              <div className="kpi-value text-danger-500">{stats?.data?.sin_ubicacion || 0}</div>
            </div>
          </div>

          {/* ─── Taxonomy Management ─── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Settings size={16} className="text-muted" />
              <h2 className="text-sm font-bold text-secondary uppercase tracking-wide">Configuración del Sistema de Códigos</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TaxonomyCard
                title="Prefijos (Tipo de Almacén)"
                icon={Tag}
                color="var(--clr-primary-500)"
                items={prefijos}
                isLoading={loadingPrefijos}
                onAdd={() => setPrefijoModal('new')}
                onEdit={(item) => setPrefijoModal(item)}
                onDelete={(item) => {
                  if (window.confirm(`¿Eliminar prefijo "${item.codigo}"?`)) prefijoDelete.mutate(item.id);
                }}
              />
              <TaxonomyCard
                title="Niveles de Altura"
                icon={Layers}
                color="#7C3AED"
                items={niveles}
                isLoading={loadingNiveles}
                onAdd={() => setNivelModal('new')}
                onEdit={(item) => setNivelModal(item)}
                onDelete={(item) => {
                  if (window.confirm(`¿Eliminar nivel "${item.codigo}"?`)) nivelDelete.mutate(item.id);
                }}
              />
            </div>
          </div>

          {/* ─── Ubicaciones table ─── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-muted" />
                <h2 className="text-sm font-bold text-secondary uppercase tracking-wide">Ubicaciones Registradas</h2>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  className="input pl-9 py-1.5 text-xs w-64"
                  placeholder="Buscar código o descripción..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Prefijo / Nivel</th>
                    <th>Orientación</th>
                    <th>Posición</th>
                    <th>Items</th>
                    <th>Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={7} className="text-center py-8 text-muted">Cargando...</td></tr>
                  ) : (ubicaciones?.data || []).length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-muted">No hay ubicaciones registradas.</td></tr>
                  ) : (ubicaciones?.data || []).map(u => (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <MapPin size={13} className="text-primary-500" />
                          <span className="font-bold font-mono text-xs">{u.codigo_ubicacion}</span>
                        </div>
                      </td>
                      <td>
                        <div className="text-xs font-semibold">{u.prefijo_codigo}</div>
                        <div className="text-[10px] text-muted">{u.nivel_codigo} · {u.prefijo_desc}</div>
                      </td>
                      <td><span className="badge badge--neutral text-[10px]">{u.orientacion}</span></td>
                      <td className="font-mono text-xs">{u.nueva_posicion}</td>
                      <td>
                        <span className={`badge text-[10px] ${u.total_items > 0 ? 'badge--primary' : ''}`}>
                          {u.total_items} items
                        </span>
                      </td>
                      <td>
                        {u.activo
                          ? <span className="badge badge--success text-[10px] flex items-center gap-1 w-fit"><CheckCircle size={10} /> Activo</span>
                          : <span className="badge badge--neutral text-[10px] flex items-center gap-1 w-fit"><XCircle size={10} /> Off</span>
                        }
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openUbiModal(u)} className="btn btn--ghost p-1"><Edit2 size={13} /></button>
                          <button
                            onClick={() => { if (window.confirm('¿Eliminar ubicación?')) ubiDelete.mutate(u.id); }}
                            className="btn btn--ghost p-1 text-danger-500"
                          ><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* ─── Ubicación Modal ─── */}
      {isUbiModalOpen && (
        <div className="modal-overlay" onClick={closeUbiModal}>
          <div className="modal-content card max-w-md animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-5">{selectedUbi ? 'Editar Ubicación' : 'Nueva Ubicación'}</h2>
            <form onSubmit={handleUbiSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="input-group">
                  <label className="input-label">Prefijo (Tipo)</label>
                  <select name="prefijo_id" defaultValue={selectedUbi?.prefijo_id || ''} className="input" required>
                    <option value="">Seleccione...</option>
                    {prefijos.filter(p => p.activo).map(p => (
                      <option key={p.id} value={p.id}>{p.codigo} — {p.descripcion}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Nivel</label>
                  <select name="nivel_id" defaultValue={selectedUbi?.nivel_id || ''} className="input" required>
                    <option value="">Seleccione...</option>
                    {niveles.filter(n => n.activo).map(n => (
                      <option key={n.id} value={n.id}>{n.codigo} — {n.descripcion}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Orientación</label>
                  <input name="orientacion" defaultValue={selectedUbi?.orientacion || 'FRENTE'} className="input" required placeholder="Ej: FRENTE, IZQ..." />
                </div>
                <div className="input-group">
                  <label className="input-label">Posición</label>
                  <input name="nueva_posicion" defaultValue={selectedUbi?.nueva_posicion || '01'} className="input" required placeholder="Ej: 01, 02..." />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Descripción (opcional)</label>
                <input name="descripcion" defaultValue={selectedUbi?.descripcion || ''} className="input" placeholder="Descripción adicional..." />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="activo" id="ubi-act" defaultChecked={selectedUbi ? selectedUbi.activo : true} className="w-4 h-4" />
                <label htmlFor="ubi-act" className="text-sm font-medium">Ubicación habilitada</label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={closeUbiModal} className="btn btn--secondary">Cancelar</button>
                <button type="submit" disabled={ubiMutation.isLoading} className="btn btn--primary px-8">
                  {ubiMutation.isLoading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Prefijo Modal ─── */}
      {prefijoModal && (
        <MiniModal
          title="Prefijo"
          item={prefijoModal === 'new' ? null : prefijoModal}
          onClose={() => setPrefijoModal(null)}
          onSave={(data) => {
            if (prefijoModal === 'new') prefijoCreate.mutate(data);
            else prefijoUpdate.mutate({ id: prefijoModal.id, data });
          }}
        />
      )}

      {/* ─── Nivel Modal ─── */}
      {nivelModal && (
        <MiniModal
          title="Nivel"
          item={nivelModal === 'new' ? null : nivelModal}
          onClose={() => setNivelModal(null)}
          onSave={(data) => {
            if (nivelModal === 'new') nivelCreate.mutate(data);
            else nivelUpdate.mutate({ id: nivelModal.id, data });
          }}
        />
      )}
    </div>
  );
}
