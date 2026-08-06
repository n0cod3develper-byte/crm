import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { AlertTriangle, Award, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../lib/api';

const fmtFecha = (d) => d ? new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';

export function EmployeeLlamados({ employee }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({ tipo: 'LLAMADO_ATENCION', gravedad: '', fecha: '', descripcion: '', observaciones: '', estado: 'CERRADO' });

  const { data: llamados = [], isLoading } = useQuery({
    queryKey: ['empleados-llamados', employee?.id],
    queryFn: async () => { const { data } = await api.get(`/empleados-llamados/empleado/${employee.id}`); return data.data || []; },
    enabled: Boolean(employee?.id)
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => api.post('/empleados-llamados', payload),
    onSuccess: () => { toast.success('Registro creado'); qc.invalidateQueries({ queryKey: ['empleados-llamados', employee?.id] }); setShowForm(false); setForm({ tipo: 'LLAMADO_ATENCION', gravedad: '', fecha: '', descripcion: '', observaciones: '', estado: 'CERRADO' }); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al crear'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/empleados-llamados/${id}`),
    onSuccess: () => { toast.success('Eliminado'); qc.invalidateQueries({ queryKey: ['empleados-llamados', employee?.id] }); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar'),
  });

  const handleSubmit = (e) => { e.preventDefault(); if (!form.descripcion) return toast.error('La descripcion es requerida'); createMutation.mutate({ ...form, empleado_id: employee.id }); };
  const lbl = { fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} color="#f59e0b" />
          <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Llamados de Atencion y Felicitaciones</h3>
        </div>
        <button className="btn btn--primary btn--sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} /> <span>Nuevo Registro</span>
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={lbl}>Tipo</label>
              <select className="input" style={{ width: '100%' }} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                <option value="LLAMADO_ATENCION">Llamado de Atencion</option>
                <option value="FELICITACION">Felicitacion</option>
              </select>
            </div>
            {form.tipo === 'LLAMADO_ATENCION' && (
              <div>
                <label style={lbl}>Gravedad</label>
                <select className="input" style={{ width: '100%' }} value={form.gravedad} onChange={e => setForm(f => ({ ...f, gravedad: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  <option value="VERBAL">Verbal</option>
                  <option value="ESCRITO">Escrito</option>
                </select>
              </div>
            )}
            <div>
              <label style={lbl}>Fecha</label>
              <input type="date" className="input" style={{ width: '100%' }} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={lbl}>Descripcion *</label>
            <textarea className="input" style={{ width: '100%', minHeight: '80px', resize: 'vertical' }} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} required />
          </div>
          <div>
            <label style={lbl}>Observaciones</label>
            <textarea className="input" style={{ width: '100%', minHeight: '60px', resize: 'vertical' }} value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>Cancelar</button>
            <button type="submit" className="btn btn--primary" disabled={createMutation.isPending}>{createMutation.isPending ? 'Guardando...' : 'Crear'}</button>
          </div>
        </form>
      )}
      {isLoading ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Cargando...</p>
      ) : llamados.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No hay registros de llamados o felicitaciones.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {llamados.map(item => (
            <div key={item.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
              <div onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', cursor: 'pointer', background: item.tipo === 'FELICITACION' ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)' }}>
                {item.tipo === 'FELICITACION' ? <Award size={16} color="#22c55e" /> : <AlertTriangle size={16} color="#ef4444" />}
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{item.tipo === 'FELICITACION' ? 'Felicitacion' : 'Llamado de Atencion'}</span>
                  {item.gravedad && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>({item.gravedad})</span>}
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '0.5rem' }}> - {fmtFecha(item.fecha)}</span>
                </div>
                <span style={{ fontSize: '11px', padding: '0.1rem 0.5rem', borderRadius: '4px', background: item.estado === 'CERRADO' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: item.estado === 'CERRADO' ? '#22c55e' : '#f59e0b' }}>{item.estado === 'CERRADO' ? 'Cerrado' : 'Pendiente Descargos'}</span>
                <button onClick={(e) => { e.stopPropagation(); if (confirm('Eliminar este registro?')) deleteMutation.mutate(item.id); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}><Trash2 size={14} /></button>
                {expandedId === item.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
              {expandedId === item.id && (
                <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-color)', fontSize: '13px' }}>
                  <p style={{ marginBottom: '0.5rem' }}><strong>Descripcion:</strong> {item.descripcion}</p>
                  {item.observaciones && <p style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)' }}><strong>Observaciones:</strong> {item.observaciones}</p>}
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Registrado por: {item.registrado_por_nombre || 'Sistema'}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
