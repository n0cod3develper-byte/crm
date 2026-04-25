import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import { Settings, Plus, Edit2, CheckCircle, Package, Trash2, Save, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';

export function PMAdminPage() {
  const qc = useQueryClient();
  const [selectedFreq, setSelectedFreq] = React.useState(null);

  // ─── Queries ──────────────────────────────────────────────
  const { data: frecuencias, isLoading: loadingFreqs } = useQuery({
    queryKey: ['pm-frecuencias'],
    queryFn: async () => {
      const { data } = await api.get('/mantenimiento/pm/frecuencias');
      return data.data;
    }
  });

  const { data: plantilla, isLoading: loadingPlantilla } = useQuery({
    queryKey: ['pm-plantilla', selectedFreq?.id],
    queryFn: async () => {
      const { data } = await api.get(`/mantenimiento/pm/frecuencias/${selectedFreq.id}/plantilla`);
      return data.data;
    },
    enabled: !!selectedFreq
  });

  // ─── Mutations Frecuencia ──────────────────────────────────
  const addFreqMut = useMutation({
    mutationFn: (body) => api.post('/mantenimiento/pm/frecuencias', body),
    onSuccess: () => { toast.success('Frecuencia creada'); qc.invalidateQueries(['pm-frecuencias']); }
  });

  const updateFreqMut = useMutation({
    mutationFn: ({ id, body }) => api.put(`/mantenimiento/pm/frecuencias/${id}`, body),
    onSuccess: () => { toast.success('Frecuencia actualizada'); qc.invalidateQueries(['pm-frecuencias']); }
  });

  // ─── Mutations Actividades ─────────────────────────────────
  const addActMut = useMutation({
    mutationFn: (body) => api.post(`/mantenimiento/pm/frecuencias/${selectedFreq.id}/actividades`, body),
    onSuccess: () => { toast.success('Actividad agregada'); qc.invalidateQueries(['pm-plantilla', selectedFreq?.id]); }
  });

  const updateActMut = useMutation({
    mutationFn: ({ id, body }) => api.put(`/mantenimiento/pm/actividades/${id}`, body),
    onSuccess: () => { toast.success('Actividad guardada'); qc.invalidateQueries(['pm-plantilla', selectedFreq?.id]); }
  });

  // ─── Mutations Insumos ─────────────────────────────────────
  const addInsMut = useMutation({
    mutationFn: (body) => api.post(`/mantenimiento/pm/frecuencias/${selectedFreq.id}/insumos`, body),
    onSuccess: () => { toast.success('Insumo agregado'); qc.invalidateQueries(['pm-plantilla', selectedFreq?.id]); }
  });

  const updateInsMut = useMutation({
    mutationFn: ({ id, body }) => api.put(`/mantenimiento/pm/insumos/${id}`, body),
    onSuccess: () => { toast.success('Insumo guardado'); qc.invalidateQueries(['pm-plantilla', selectedFreq?.id]); }
  });

  // Búsqueda Inventario
  const [invSearch, setInvSearch] = React.useState('');
  const [invResults, setInvResults] = React.useState([]);

  React.useEffect(() => {
    if (invSearch.length < 2) { setInvResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/inventory/search', { params: { q: invSearch } });
        setInvResults(data.data || []);
      } catch { setInvResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [invSearch]);


  // ─── Handlers Frecuencias ──────────────────────────────────
  const [isEditingFreq, setIsEditingFreq] = React.useState(null);
  const [freqForm, setFreqForm] = React.useState({ nombre: '', horas: '', descripcion: '', orden_display: 0 });

  const handleEditFreq = (f) => {
    setIsEditingFreq(f.id);
    setFreqForm({ nombre: f.nombre, horas: f.horas, descripcion: f.descripcion || '', orden_display: f.orden_display });
  };
  const handleSaveFreq = () => {
    if (isEditingFreq === 'new') addFreqMut.mutate(freqForm);
    else updateFreqMut.mutate({ id: isEditingFreq, body: freqForm });
    setIsEditingFreq(null);
  };

  // ─── Handlers Actividades ──────────────────────────────────
  const [isAddingAct, setIsAddingAct] = React.useState(false);
  const [actForm, setActForm] = React.useState({ nombre: '', descripcion: '', orden: 0 });
  
  const handleAddAct = () => {
    addActMut.mutate(actForm);
    setIsAddingAct(false);
    setActForm({ nombre: '', descripcion: '', orden: 0 });
  };
  const handleToggleActivoAct = (a) => updateActMut.mutate({ id: a.id, body: { activo: !a.activo } });

  // ─── Handlers Insumos ──────────────────────────────────────
  const [isAddingIns, setIsAddingIns] = React.useState(false);
  const [insForm, setInsForm] = React.useState({ item_inventario_id: null, descripcion_display: '', cantidad_sugerida: 1, unidad: 'unidad' });

  const handleSelectInv = (item) => {
    setInsForm(p => ({ ...p, item_inventario_id: item.id, descripcion_display: item.name, unidad: item.unit || 'unidad' }));
    setInvSearch('');
    setInvResults([]);
  };

  const handleAddIns = () => {
    if (!insForm.descripcion_display) return toast.error("La descripción es obligatoria");
    addInsMut.mutate(insForm);
    setIsAddingIns(false);
    setInsForm({ item_inventario_id: null, descripcion_display: '', cantidad_sugerida: 1, unidad: 'unidad' });
  };

  const handleToggleActivoIns = (i) => updateInsMut.mutate({ id: i.id, body: { activo: !i.activo } });


  return (
    <div className="app-layout">
      <Sidebar />
      <Topbar 
        title={
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Settings size={22} color="var(--clr-primary-400)" />
            <span>Configuración Preventivo</span>
          </div>
        }
        subtitle="Administra las frecuencias, actividades e insumos de los mantenimientos preventivos." 
      />

      <main className="main-content" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* PANEL IZQUIERDO: Lista de Frecuencias */}
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 700 }}>Frecuencias</h3>
            <button className="btn btn--primary btn--sm" onClick={() => { setIsEditingFreq('new'); setFreqForm({ nombre: '', horas: '', descripcion: '', orden_display: 0 }); }}>
              <Plus size={14} /> Nueva
            </button>
          </div>

          {isEditingFreq === 'new' && (
            <div style={{ background: 'var(--bg-elevated)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input className="input" placeholder="Nombre (ej. 250 horas)" value={freqForm.nombre} onChange={e => setFreqForm(p => ({...p, nombre: e.target.value}))} />
              <input className="input" type="number" placeholder="Horas" value={freqForm.horas} onChange={e => setFreqForm(p => ({...p, horas: e.target.value}))} />
              <textarea className="input" rows={2} placeholder="Descripción" value={freqForm.descripcion} onChange={e => setFreqForm(p => ({...p, descripcion: e.target.value}))} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn--primary btn--sm" onClick={handleSaveFreq} style={{ flex: 1 }}>Guardar</button>
                <button className="btn btn--ghost btn--sm" onClick={() => setIsEditingFreq(null)}>Cancelar</button>
              </div>
            </div>
          )}

          {loadingFreqs ? <div className="spinner" /> : (frecuencias || []).map(f => (
            <div key={f.id}>
              {isEditingFreq === f.id ? (
                <div style={{ background: 'var(--bg-elevated)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input className="input" value={freqForm.nombre} onChange={e => setFreqForm(p => ({...p, nombre: e.target.value}))} />
                  <input className="input" type="number" value={freqForm.horas} onChange={e => setFreqForm(p => ({...p, horas: e.target.value}))} />
                  <textarea className="input" rows={2} value={freqForm.descripcion} onChange={e => setFreqForm(p => ({...p, descripcion: e.target.value}))} />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn--primary btn--sm" onClick={handleSaveFreq} style={{ flex: 1 }}>Guardar</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => setIsEditingFreq(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div 
                  style={{
                    padding: '0.75rem', border: '1px solid', 
                    borderColor: selectedFreq?.id === f.id ? 'var(--clr-primary-400)' : 'var(--border-color)',
                    background: selectedFreq?.id === f.id ? 'rgba(67,56,202,0.05)' : 'white',
                    borderRadius: 'var(--radius-md)', marginBottom: '0.5rem',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedFreq(f)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, color: selectedFreq?.id === f.id ? 'var(--clr-primary-500)' : 'inherit' }}>{f.nombre}</div>
                    <button className="btn btn--ghost btn--sm" onClick={(e) => { e.stopPropagation(); handleEditFreq(f); }}><Edit2 size={14}/></button>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Horas: {f.horas} | Ver. {f.version}</div>
                  <div style={{ fontSize: '11px', display: 'flex', gap: '0.5rem', marginTop: '4px' }}>
                    <span className="badge badge--gray">{f.total_actividades} Act.</span>
                    <span className="badge badge--gray">{f.total_insumos} Ins.</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* PANEL DERECHO: Detalles de Plantilla */}
        {!selectedFreq ? (
          <div className="card" style={{ display: 'grid', placeItems: 'center', minHeight: 400, color: 'var(--text-muted)' }}>
            <div style={{ textAlign: 'center' }}>
              <Settings size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
              <p>Selecciona una frecuencia a la izquierda para configurar su plantilla</p>
            </div>
          </div>
        ) : loadingPlantilla ? (
          <div className="card"><div className="spinner" /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Actividades */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={18} color="var(--clr-primary-400)" /> Actividades ({plantilla?.actividades?.length || 0})
                </h2>
                <button className="btn btn--secondary btn--sm" onClick={() => setIsAddingAct(true)}><Plus size={14} /> Actividad</button>
              </div>

              {isAddingAct && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input className="input" style={{ width: 60 }} type="number" placeholder="Ord." value={actForm.orden} onChange={e => setActForm(p => ({...p, orden: e.target.value}))} />
                  <input className="input" style={{ flex: 1 }} placeholder="Nombre de actividad..." value={actForm.nombre} onChange={e => setActForm(p => ({...p, nombre: e.target.value}))} />
                  <button className="btn btn--primary" onClick={handleAddAct}><Save size={16}/></button>
                  <button className="btn btn--ghost" onClick={() => setIsAddingAct(false)}><X size={16}/></button>
                </div>
              )}

              <div className="table-wrapper">
                <table>
                  <thead><tr><th style={{ width: 40 }}>#</th><th>Actividad</th><th style={{ width: 80 }}>Estado</th></tr></thead>
                  <tbody>
                    {(plantilla?.actividades || []).map(a => (
                      <tr key={a.id} style={{ opacity: a.activo ? 1 : 0.5 }}>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{a.orden}</td>
                        <td style={{ fontWeight: 500 }}>{a.nombre}</td>
                        <td>
                          <button 
                            className={`btn btn--sm ${a.activo ? 'btn--ghost' : 'btn--secondary'}`} 
                            onClick={() => handleToggleActivoAct(a)}
                          >
                            {a.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Insumos */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Package size={18} color="var(--clr-primary-400)" /> Insumos / Repuestos ({plantilla?.insumos?.length || 0})
                </h2>
                <button className="btn btn--secondary btn--sm" onClick={() => setIsAddingIns(true)}><Plus size={14} /> Insumo</button>
              </div>

              {isAddingIns && (
                <div style={{ background: 'var(--bg-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', alignItems: 'start' }}>
                    <div style={{ position: 'relative' }}>
                      <input 
                        className="input" 
                        placeholder={insForm.item_inventario_id ? insForm.descripcion_display : "Buscar en inventario (opcional)..."} 
                        value={invSearch} 
                        onChange={e => setInvSearch(e.target.value)}
                      />
                      {invResults.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border-color)', zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
                          {invResults.map(item => (
                            <div key={item.id} style={{ padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }} onClick={() => handleSelectInv(item)}>
                              <strong>{item.name}</strong> <span style={{ fontSize: '11px', color: '#64748b' }}>({item.unit})</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {!insForm.item_inventario_id && (
                        <input className="input" style={{ marginTop: '0.5rem' }} placeholder="O escribe descripción manual..." value={insForm.descripcion_display} onChange={e => setInsForm(p => ({...p, descripcion_display: e.target.value}))} />
                      )}
                    </div>
                    <input className="input" style={{ width: 80 }} type="number" step="0.1" placeholder="Cant." value={insForm.cantidad_sugerida} onChange={e => setInsForm(p => ({...p, cantidad_sugerida: e.target.value}))} />
                    <input className="input" style={{ width: 100 }} placeholder="Unidad" value={insForm.unidad} onChange={e => setInsForm(p => ({...p, unidad: e.target.value}))} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                    <button className="btn btn--ghost btn--sm" onClick={() => setIsAddingIns(false)}>Cancelar</button>
                    <button className="btn btn--primary btn--sm" onClick={handleAddIns}>Agregar Insumo</button>
                  </div>
                </div>
              )}

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Insumo</th>
                      <th>Cant. Sug.</th>
                      <th>Unidad</th>
                      <th>Inventario Vinculado</th>
                      <th style={{ width: 80 }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(plantilla?.insumos || []).map(i => (
                      <tr key={i.id} style={{ opacity: i.activo ? 1 : 0.5 }}>
                        <td style={{ fontWeight: 500 }}>{i.descripcion_display}</td>
                        <td>{i.cantidad_sugerida}</td>
                        <td>{i.unidad}</td>
                        <td>
                          {i.item_inventario_id ? (
                            <span className="badge badge--success">Sí ({i.nombre_inventario})</span>
                          ) : (
                            <span className="badge badge--gray">Manual</span>
                          )}
                        </td>
                        <td>
                          <button 
                            className={`btn btn--sm ${i.activo ? 'btn--ghost' : 'btn--secondary'}`} 
                            onClick={() => handleToggleActivoIns(i)}
                          >
                            {i.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
