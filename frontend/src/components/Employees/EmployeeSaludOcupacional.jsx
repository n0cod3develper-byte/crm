import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Heart, Plus, Trash2, ShieldAlert, HardHat, AlertOctagon, ChevronDown, ChevronUp, X, Loader2 } from 'lucide-react';
import api from '../../lib/api';

const fmtFecha = (d) => d ? new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
const RESULTADO_COLORS = { APTO: '#22c55e', APTO_CON_RESTRICCIONES: '#f59e0b', NO_APTO: '#ef4444' };
const RESULTADO_LABELS = { APTO: 'Apto', APTO_CON_RESTRICCIONES: 'Apto con Restricciones', NO_APTO: 'No Apto' };
const TIPOS_EXAMEN = ['INGRESO', 'PERIODICO', 'EGRESO', 'RETORNO'];
const TIPOS_ACCIDENTE = ['Leve', 'Grave', 'Con Incapacidad', 'Mortal'];
const lbl = { fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' };
const inputStyle = { width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' };

function Section({ title, icon: Icon, color, children, count }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', cursor: 'pointer', background: 'var(--bg-app)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Icon size={16} color={color} />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>{title}</span>
          {count > 0 && <span style={{ fontSize: '11px', padding: '0.1rem 0.5rem', borderRadius: '4px', background: color + '15', color }}>{count}</span>}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
      {open && <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>{children}</div>}
    </div>
  );
}

function LoadingSpinner() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}><Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>;
}

export function EmployeeSaludOcupacional({ employee, userRole }) {
  const qc = useQueryClient();
  const eid = employee?.id;
  const isAllowed = ['admin', 'rrhh', 'aprobador_1', 'gerencia'].includes(userRole);

  if (!isAllowed) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)' }}>
        <ShieldAlert size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
        <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Acceso Restringido</p>
        <p style={{ fontSize: '13px' }}>Solo roles Administrador, SST, RRHH o Gerencia pueden acceder a datos de salud ocupacional.</p>
      </div>
    );
  }

  // Queries
  const examenes = useQuery({ queryKey: ['so-examenes', eid], queryFn: async () => { const { data } = await api.get(`/salud-ocupacional/${eid}/examenes`); return data.data || []; }, enabled: !!eid });
  const restricciones = useQuery({ queryKey: ['so-restricciones', eid], queryFn: async () => { const { data } = await api.get(`/salud-ocupacional/${eid}/restricciones`); return data.data || []; }, enabled: !!eid });
  const epp = useQuery({ queryKey: ['so-epp', eid], queryFn: async () => { const { data } = await api.get(`/salud-ocupacional/${eid}/epp`); return data.data || []; }, enabled: !!eid });
  const accidentes = useQuery({ queryKey: ['so-accidentes', eid], queryFn: async () => { const { data } = await api.get(`/salud-ocupacional/${eid}/accidentes`); return data.data || []; }, enabled: !!eid });

  // Examenes mutations
  const createExamen = useMutation({ mutationFn: (d) => api.post(`/salud-ocupacional/${eid}/examenes`, d), onSuccess: () => { toast.success('Examen registrado'); qc.invalidateQueries({ queryKey: ['so-examenes', eid] }); }, onError: (e) => toast.error(e.response?.data?.message || 'Error') });
  const deleteExamen = useMutation({ mutationFn: (id) => api.delete(`/salud-ocupacional/examenes/${id}`), onSuccess: () => { toast.success('Eliminado'); qc.invalidateQueries({ queryKey: ['so-examenes', eid] }); }, onError: (e) => toast.error(e.response?.data?.message || 'Error') });

  // Restricciones mutations
  const createRestriccion = useMutation({ mutationFn: (d) => api.post(`/salud-ocupacional/${eid}/restricciones`, d), onSuccess: () => { toast.success('Restriccion registrada'); qc.invalidateQueries({ queryKey: ['so-restricciones', eid] }); }, onError: (e) => toast.error(e.response?.data?.message || 'Error') });
  const closeRestriccion = useMutation({ mutationFn: (d) => api.patch(`/salud-ocupacional/restricciones/${d.id}`, { activa: false, fecha_fin: new Date().toISOString().split('T')[0] }), onSuccess: () => { toast.success('Restriccion cerrada'); qc.invalidateQueries({ queryKey: ['so-restricciones', eid] }); }, onError: (e) => toast.error(e.response?.data?.message || 'Error') });
  const deleteRestriccion = useMutation({ mutationFn: (id) => api.delete(`/salud-ocupacional/restricciones/${id}`), onSuccess: () => { toast.success('Eliminado'); qc.invalidateQueries({ queryKey: ['so-restricciones', eid] }); }, onError: (e) => toast.error(e.response?.data?.message || 'Error') });

  // EPP mutations
  const createEPP = useMutation({ mutationFn: (d) => api.post(`/salud-ocupacional/${eid}/epp`, d), onSuccess: () => { toast.success('EPP registrado'); qc.invalidateQueries({ queryKey: ['so-epp', eid] }); }, onError: (e) => toast.error(e.response?.data?.message || 'Error') });
  const deleteEPP = useMutation({ mutationFn: (id) => api.delete(`/salud-ocupacional/epp/${id}`), onSuccess: () => { toast.success('Eliminado'); qc.invalidateQueries({ queryKey: ['so-epp', eid] }); }, onError: (e) => toast.error(e.response?.data?.message || 'Error') });

  // Accidentes mutations
  const createAccidente = useMutation({ mutationFn: (d) => api.post(`/salud-ocupacional/${eid}/accidentes`, d), onSuccess: () => { toast.success('Accidente registrado'); qc.invalidateQueries({ queryKey: ['so-accidentes', eid] }); }, onError: (e) => toast.error(e.response?.data?.message || 'Error') });
  const deleteAccidente = useMutation({ mutationFn: (id) => api.delete(`/salud-ocupacional/accidentes/${id}`), onSuccess: () => { toast.success('Eliminado'); qc.invalidateQueries({ queryKey: ['so-accidentes', eid] }); }, onError: (e) => toast.error(e.response?.data?.message || 'Error') });

  // Form states
  const [fExamen, setFExamen] = useState({ tipo: 'INGRESO', fecha: '', resultado: 'APTO', observaciones: '' });
  const [fRestriccion, setFRestriccion] = useState({ descripcion: '', fecha_inicio: '' });
  const [fEPP, setFEPP] = useState({ elemento: '', fecha_entrega: '', observaciones: '' });
  const [fAccidente, setFAccidente] = useState({ fecha: '', tipo: 'Leve', descripcion: '', genero_incapacidad: false, dias_incapacidad: '' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      {/* ─── Examenes Medicos ─── */}
      <Section title="Examenes Medicos Ocupacionales" icon={Heart} color="#ef4444" count={examenes.data?.length || 0}>
        <form onSubmit={e => { e.preventDefault(); if (!fExamen.fecha) return toast.error('Fecha requerida'); createExamen.mutate(fExamen); setFExamen({ tipo: 'INGRESO', fecha: '', resultado: 'APTO', observaciones: '' }); }} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
          <div><label style={lbl}>Tipo</label><select style={inputStyle} value={fExamen.tipo} onChange={e => setFExamen(f => ({ ...f, tipo: e.target.value }))}>{TIPOS_EXAMEN.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label style={lbl}>Fecha</label><input type="date" style={inputStyle} value={fExamen.fecha} onChange={e => setFExamen(f => ({ ...f, fecha: e.target.value }))} required /></div>
          <div><label style={lbl}>Resultado</label><select style={inputStyle} value={fExamen.resultado} onChange={e => setFExamen(f => ({ ...f, resultado: e.target.value }))}>{Object.entries(RESULTADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Observaciones</label><input style={inputStyle} placeholder="Opcional" value={fExamen.observaciones} onChange={e => setFExamen(f => ({ ...f, observaciones: e.target.value }))} /></div>
          <button type="submit" className="btn btn--primary btn--sm" style={{ gridColumn: '1 / -1' }} disabled={createExamen.isPending}><Plus size={14} /> {createExamen.isPending ? 'Guardando...' : 'Agregar Examen'}</button>
        </form>
        {examenes.isLoading ? <LoadingSpinner /> : examenes.data?.map(ex => (
          <div key={ex.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>{ex.tipo}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{fmtFecha(ex.fecha)}</span>
              <span style={{ fontSize: '11px', padding: '0.1rem 0.4rem', borderRadius: '4px', background: (RESULTADO_COLORS[ex.resultado] || '#ccc') + '20', color: RESULTADO_COLORS[ex.resultado] || '#ccc', marginLeft: '0.5rem' }}>{RESULTADO_LABELS[ex.resultado] || ex.resultado}</span>
              {ex.observaciones && <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>- {ex.observaciones}</span>}
            </div>
            <button onClick={() => { if (confirm('Eliminar este examen?')) deleteExamen.mutate(ex.id); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={14} /></button>
          </div>
        ))}
        {!examenes.isLoading && examenes.data?.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '1rem' }}>Sin examenes registrados</p>}
      </Section>

      {/* ─── Restricciones Medicas ─── */}
      <Section title="Restricciones Medicas Activas" icon={AlertOctagon} color="#f59e0b" count={restricciones.data?.filter(r => r.activa).length || 0}>
        <form onSubmit={e => { e.preventDefault(); if (!fRestriccion.descripcion || !fRestriccion.fecha_inicio) return toast.error('Descripcion y fecha son requeridas'); createRestriccion.mutate(fRestriccion); setFRestriccion({ descripcion: '', fecha_inicio: '' }); }} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
          <div><label style={lbl}>Descripcion de la restriccion</label><input style={inputStyle} placeholder="Ej: No levantar peso mayor a 10kg" value={fRestriccion.descripcion} onChange={e => setFRestriccion(f => ({ ...f, descripcion: e.target.value }))} required /></div>
          <div><label style={lbl}>Fecha inicio</label><input type="date" style={inputStyle} value={fRestriccion.fecha_inicio} onChange={e => setFRestriccion(f => ({ ...f, fecha_inicio: e.target.value }))} required /></div>
          <button type="submit" className="btn btn--primary btn--sm" style={{ gridColumn: '1 / -1' }} disabled={createRestriccion.isPending}><Plus size={14} /> {createRestriccion.isPending ? 'Guardando...' : 'Agregar Restriccion'}</button>
        </form>
        {restricciones.isLoading ? <LoadingSpinner /> : restricciones.data?.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)', opacity: r.activa ? 1 : 0.5 }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: '13px', textDecoration: r.activa ? 'none' : 'line-through' }}>{r.descripcion}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{fmtFecha(r.fecha_inicio)}{r.fecha_fin ? ` — ${fmtFecha(r.fecha_fin)}` : ''}</span>
              {!r.activa && <span style={{ fontSize: '11px', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', marginLeft: '0.5rem' }}>Cerrada</span>}
            </div>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {r.activa && <button onClick={() => closeRestriccion.mutate(r)} title="Cerrar restriccion" style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer' }}><X size={14} /></button>}
              <button onClick={() => { if (confirm('Eliminar?')) deleteRestriccion.mutate(r.id); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {!restricciones.isLoading && restricciones.data?.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '1rem' }}>Sin restricciones registradas</p>}
      </Section>

      {/* ─── Elementos de Proteccion Personal (EPP) ─── */}
      <Section title="Elementos de Proteccion Personal (EPP)" icon={HardHat} color="#6366f1" count={epp.data?.length || 0}>
        <form onSubmit={e => { e.preventDefault(); if (!fEPP.elemento) return toast.error('Elemento requerido'); createEPP.mutate({ ...fEPP, fecha_entrega: fEPP.fecha_entrega || new Date().toISOString().split('T')[0] }); setFEPP({ elemento: '', fecha_entrega: '', observaciones: '' }); }} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
          <div><label style={lbl}>Elemento</label><input style={inputStyle} placeholder="Ej: Casco, Guantes, Lentes" value={fEPP.elemento} onChange={e => setFEPP(f => ({ ...f, elemento: e.target.value }))} required /></div>
          <div><label style={lbl}>Fecha entrega</label><input type="date" style={inputStyle} value={fEPP.fecha_entrega} onChange={e => setFEPP(f => ({ ...f, fecha_entrega: e.target.value }))} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Observaciones</label><input style={inputStyle} placeholder="Opcional" value={fEPP.observaciones} onChange={e => setFEPP(f => ({ ...f, observaciones: e.target.value }))} /></div>
          <button type="submit" className="btn btn--primary btn--sm" style={{ gridColumn: '1 / -1' }} disabled={createEPP.isPending}><Plus size={14} /> {createEPP.isPending ? 'Guardando...' : 'Agregar EPP'}</button>
        </form>
        {epp.isLoading ? <LoadingSpinner /> : epp.data?.map(ep => (
          <div key={ep.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>{ep.elemento}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>entregado {fmtFecha(ep.fecha_entrega)}</span>
              {ep.observaciones && <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>- {ep.observaciones}</span>}
            </div>
            <button onClick={() => { if (confirm('Eliminar?')) deleteEPP.mutate(ep.id); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={14} /></button>
          </div>
        ))}
        {!epp.isLoading && epp.data?.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '1rem' }}>Sin EPP registrados</p>}
      </Section>

      {/* ─── Accidentes de Trabajo ─── */}
      <Section title="Accidentes de Trabajo" icon={AlertOctagon} color="#dc2626" count={accidentes.data?.length || 0}>
        <form onSubmit={e => { e.preventDefault(); if (!fAccidente.fecha || !fAccidente.descripcion) return toast.error('Fecha y descripcion requeridas'); createAccidente.mutate({ ...fAccidente, dias_incapacidad: fAccidente.genero_incapacidad ? (fAccidente.dias_incapacidad || null) : null }); setFAccidente({ fecha: '', tipo: 'Leve', descripcion: '', genero_incapacidad: false, dias_incapacidad: '' }); }} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
          <div><label style={lbl}>Fecha</label><input type="date" style={inputStyle} value={fAccidente.fecha} onChange={e => setFAccidente(f => ({ ...f, fecha: e.target.value }))} required /></div>
          <div><label style={lbl}>Tipo</label><select style={inputStyle} value={fAccidente.tipo} onChange={e => setFAccidente(f => ({ ...f, tipo: e.target.value }))}>{TIPOS_ACCIDENTE.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Descripcion</label><input style={inputStyle} placeholder="Detalle del accidente" value={fAccidente.descripcion} onChange={e => setFAccidente(f => ({ ...f, descripcion: e.target.value }))} required /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px', cursor: 'pointer' }}>
            <input type="checkbox" checked={fAccidente.genero_incapacidad} onChange={e => setFAccidente(f => ({ ...f, genero_incapacidad: e.target.checked }))} /> Genero incapacidad
          </label>
          {fAccidente.genero_incapacidad && <div><label style={lbl}>Dias de incapacidad</label><input type="number" min="1" style={inputStyle} value={fAccidente.dias_incapacidad} onChange={e => setFAccidente(f => ({ ...f, dias_incapacidad: e.target.value }))} /></div>}
          <button type="submit" className="btn btn--primary btn--sm" style={{ gridColumn: '1 / -1' }} disabled={createAccidente.isPending}><Plus size={14} /> {createAccidente.isPending ? 'Guardando...' : 'Registrar Accidente'}</button>
        </form>
        {accidentes.isLoading ? <LoadingSpinner /> : accidentes.data?.map(ac => (
          <div key={ac.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: '13px', color: '#dc2626' }}>{ac.tipo}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{fmtFecha(ac.fecha)}</span>
              <span style={{ fontSize: '12px', marginLeft: '0.5rem' }}>{ac.descripcion}</span>
              {ac.genero_incapacidad && <span style={{ fontSize: '11px', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(220,38,38,0.1)', color: '#dc2626', marginLeft: '0.5rem' }}>Incapacidad {ac.dias_incapacidad ? `${ac.dias_incapacidad} dias` : ''}</span>}
            </div>
            <button onClick={() => { if (confirm('Eliminar?')) deleteAccidente.mutate(ac.id); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={14} /></button>
          </div>
        ))}
        {!accidentes.isLoading && accidentes.data?.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '1rem' }}>Sin accidentes registrados</p>}
      </Section>
    </div>
  );
}
