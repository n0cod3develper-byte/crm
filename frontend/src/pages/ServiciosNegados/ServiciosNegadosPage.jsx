import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, XCircle, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Topbar } from '../../components/layout/Topbar';

const CAUSAS = [
  'Falta de maquina disponible', 'Maquina no disponible', 'Operario no disponible',
  'Falta de tecnicos disponibles', 'Incompatibilidad de horario', 'Precio fuera de presupuesto', 'Otro'
];

const fmt = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

function EmpresaSearch({ value, onChange }) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isCustom, setIsCustom] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data: empresas } = useQuery({
    queryKey: ['companiesSearch', search],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      const { data } = await api.get('/companies?search=' + encodeURIComponent(search) + '&limit=10');
      return data.data || [];
    },
    enabled: search.length >= 2 && !isCustom,
    staleTime: 30000
  });

  const [quickForm, setQuickForm] = useState({ name: '', nit: '', telefono: '', email: '', contacto: '' });
  const crearProspectoMutation = useMutation({
    mutationFn: async (data) => {
      const { data: res } = await api.post('/companies', data);
      return res;
    },
    onSuccess: (res) => {
      const newCompany = res.data;
      onChange({ empresa_id: newCompany.id, empresa_nombre: newCompany.name });
      setSearch(newCompany.name);
      setIsCustom(true);
      setShowQuickCreate(false);
      setQuickForm({ name: '', nit: '', telefono: '', email: '', contacto: '' });
      queryClient.invalidateQueries(['companies']);
      toast.success('Prospecto registrado correctamente');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al crear prospecto')
  });

  const handleQuickCreate = (e) => {
    e.preventDefault();
    if (!quickForm.name.trim()) return toast.error('El nombre es obligatorio');
    crearProspectoMutation.mutate(quickForm);
  };

  const openQuickCreate = () => {
    setQuickForm(f => ({ ...f, name: search }));
    setShowQuickCreate(true);
    setShowDropdown(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input type="text" placeholder="Buscar empresa o escribir nombre nuevo..." value={search}
          onChange={e => { setSearch(e.target.value); setIsCustom(false); setShowDropdown(true); onChange({ empresa_id: null, empresa_nombre: e.target.value }); }}
          onFocus={() => search.length >= 2 && setShowDropdown(true)}
          style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }} />
        {value?.empresa_id && (
          <button type="button" onClick={() => { setSearch(''); onChange({ empresa_id: null, empresa_nombre: '' }); setIsCustom(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><XCircle size={18} /></button>
        )}
      </div>
      {showDropdown && empresas && empresas.length > 0 && !isCustom && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 50, maxHeight: '250px', overflow: 'auto' }}>
          {empresas.map(e => (
            <div key={e.id} onClick={() => { onChange({ empresa_id: e.id, empresa_nombre: e.name }); setSearch(e.name); setShowDropdown(false); setIsCustom(true); }}
              style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border-color)' }}
              onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-app)'}
              onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
              <div style={{ fontWeight: 600 }}>{e.name}</div>
              {e.nit && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>NIT: {e.nit}</div>}
            </div>
          ))}
          {search && !empresas.find(e => e.name.toLowerCase() === search.toLowerCase()) && (
            <div onClick={openQuickCreate}
              style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--clr-primary-500)', fontWeight: 600, borderTop: '1px solid var(--border-color)', background: 'var(--bg-app)' }}
              onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={ev => ev.currentTarget.style.background = 'var(--bg-app)'}>
              <UserPlus size={14} /> Registrar "<span style={{ fontWeight: 700 }}>{search}</span>" como nuevo prospecto
            </div>
          )}
        </div>
      )}
      {showDropdown && search.length >= 2 && empresas && empresas.length === 0 && !isCustom && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 50, padding: '0.75rem' }}>
          <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>No se encontraron empresas</div>
          <button type="button" onClick={openQuickCreate}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--clr-primary-500)', background: 'rgba(59,130,246,0.05)', color: 'var(--clr-primary-500)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <UserPlus size={14} /> Registrar "{search}" como nuevo prospecto
          </button>
        </div>
      )}
      {showQuickCreate && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Registrar Prospecto</h3>
              <button onClick={() => setShowQuickCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><XCircle size={20} /></button>
            </div>
            <form onSubmit={handleQuickCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Nombre / Razon Social *</label>
                <input type="text" value={quickForm.name} onChange={e => setQuickForm(f => ({...f, name: e.target.value}))} required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>NIT</label>
                  <input type="text" value={quickForm.nit} onChange={e => setQuickForm(f => ({...f, nit: e.target.value}))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Telefono</label>
                  <input type="text" value={quickForm.telefono} onChange={e => setQuickForm(f => ({...f, telefono: e.target.value}))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Correo</label>
                  <input type="email" value={quickForm.email} onChange={e => setQuickForm(f => ({...f, email: e.target.value}))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Contacto</label>
                  <input type="text" value={quickForm.contacto} onChange={e => setQuickForm(f => ({...f, contacto: e.target.value}))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn--secondary" onClick={() => setShowQuickCreate(false)}>Cancelar</button>
                <button type="submit" className="btn btn--primary" disabled={crearProspectoMutation.isPending}>
                  {crearProspectoMutation.isPending ? 'Registrando...' : 'Registrar Prospecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function ServiciosNegadosPage() {
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ fecha_inicio: '', fecha_fin: '', causa: '' });
  const [form, setForm] = useState({ fecha_solicitud: new Date().toISOString().split('T')[0], empresa_id: null, empresa_nombre: '', tipo_equipo: '', causa: '', observacion: '', valor_estimado: '' });
  const queryClient = useQueryClient();

  const { data: registros } = useQuery({
    queryKey: ['serviciosNegados', filters, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.fecha_inicio) params.set('fecha_inicio', filters.fecha_inicio);
      if (filters.fecha_fin) params.set('fecha_fin', filters.fecha_fin);
      if (filters.causa) params.set('causa', filters.causa);
      params.set('page', page);
      params.set('limit', '50');
      const { data } = await api.get('/servicios-negados?' + params.toString());
      return data.data;
    }
  });

  const crearMutation = useMutation({
    mutationFn: async (data) => { const { data: res } = await api.post('/servicios-negados', data); return res; },
    onSuccess: () => { toast.success('Registro creado'); queryClient.invalidateQueries(['serviciosNegados']); setShowForm(false); setForm({ fecha_solicitud: new Date().toISOString().split('T')[0], empresa_id: null, empresa_nombre: '', tipo_equipo: '', causa: '', observacion: '', valor_estimado: '' }); },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al crear')
  });

  const eliminarMutation = useMutation({
    mutationFn: async (id) => { await api.delete('/servicios-negados/' + id); },
    onSuccess: () => { toast.success('Eliminado'); queryClient.invalidateQueries(['serviciosNegados']); },
    onError: () => toast.error('Error al eliminar')
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.causa) return toast.error('Selecciona una causa');
    if (!form.tipo_equipo) return toast.error('Ingresa el tipo de equipo');
    if (!form.empresa_id && !form.empresa_nombre) return toast.error('Selecciona o ingresa una empresa');
    if (form.causa === 'Otro' && !form.observacion) return toast.error('La observacion es obligatoria para causa Otro');
    crearMutation.mutate(form);
  };

  const causaColor = (causa) => {
    const colors = { 'Falta de maquina disponible': '#ef4444', 'Maquina no disponible': '#f59e0b', 'Operario no disponible': '#8b5cf6', 'Falta de tecnicos disponibles': '#6366f1', 'Incompatibilidad de horario': '#ec4899', 'Precio fuera de presupuesto': '#f97316', 'Otro': '#6b7280' };
    return colors[causa] || '#6b7280';
  };

  return (
    <div className="app-layout">
      <Topbar title="Servicios Negados" subtitle="Registro y seguimiento de solicitudes rechazadas"
        rightContent={<button className="btn btn--primary" onClick={() => setShowForm(!showForm)}><Plus size={16} /><span>Nuevo registro</span></button>} />
      <main className="main-content">
        {showForm && (
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Registrar solicitud negada</h3>
              <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Fecha *</label>
                  <input type="date" value={form.fecha_solicitud} onChange={e => setForm(f => ({...f, fecha_solicitud: e.target.value}))} required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Empresa / Prospecto *</label>
                  <EmpresaSearch value={form} onChange={({ empresa_id, empresa_nombre }) => setForm(f => ({...f, empresa_id, empresa_nombre}))} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Tipo de equipo *</label>
                  <input type="text" value={form.tipo_equipo} onChange={e => setForm(f => ({...f, tipo_equipo: e.target.value}))} placeholder="Ej: Excavadora, Grua..." required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Causa *</label>
                  <select value={form.causa} onChange={e => setForm(f => ({...f, causa: e.target.value}))} required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                    <option value="">Seleccionar...</option>
                    {CAUSAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Valor estimado (COP)</label>
                  <input type="number" value={form.valor_estimado} onChange={e => setForm(f => ({...f, valor_estimado: e.target.value}))} min="0"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Observacion {form.causa === 'Otro' ? '*' : '(opcional)'}</label>
                  <textarea value={form.observacion} onChange={e => setForm(f => ({...f, observacion: e.target.value}))} rows={3} required={form.causa === 'Otro'}
                    placeholder={form.causa === 'Otro' ? 'Describe la causa de la negacion...' : 'Detalles adicionales (opcional)...'}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', resize: 'vertical' }} />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn--secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                  <button type="submit" className="btn btn--primary" disabled={crearMutation.isPending}>
                    {crearMutation.isPending ? 'Guardando...' : 'Guardar registro'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'end' }}>
            <div><label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Desde</label>
              <input type="date" value={filters.fecha_inicio} onChange={e => setFilters(f => ({...f, fecha_inicio: e.target.value}))} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }} /></div>
            <div><label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Hasta</label>
              <input type="date" value={filters.fecha_fin} onChange={e => setFilters(f => ({...f, fecha_fin: e.target.value}))} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }} /></div>
            <div><label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Causa</label>
              <select value={filters.causa} onChange={e => setFilters(f => ({...f, causa: e.target.value}))} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                <option value="">Todas</option>
                {CAUSAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select></div>
          </div>
        </div>
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  {['Fecha', 'Empresa', 'Tipo Equipo', 'Causa', 'Valor Est.', 'Registrado por', ''].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(registros?.data || []).map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>{new Date(r.fecha_solicitud).toLocaleDateString('es-CO')}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{r.empresa_nombre || 'Sin empresa'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{r.tipo_equipo}</td>
                    <td style={{ padding: '0.75rem 1rem' }}><span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: causaColor(r.causa) + '15', color: causaColor(r.causa), fontSize: '11px', fontWeight: 600 }}>{r.causa}</span></td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{fmt(r.valor_estimado)}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '12px', color: 'var(--text-muted)' }}>{r.registrado_por_nombre || '-'}</td>
                    <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                      <button onClick={() => { if (confirm('Eliminar este registro?')) eliminarMutation.mutate(r.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                {(!registros?.data || registros.data.length === 0) && (
                  <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay registros de servicios negados</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {registros?.totalPages > 1 && (
            <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
              {Array.from({ length: Math.min(5, registros.totalPages) }, (_, idx) => {
                const pageNum = Math.max(1, Math.min(page - 2, registros.totalPages - 4)) + idx;
                if (pageNum > registros.totalPages) return null;
                return (<button key={pageNum} className={`btn ${pageNum === page ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setPage(pageNum)} style={{ minWidth: '32px' }}>{pageNum}</button>);
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
