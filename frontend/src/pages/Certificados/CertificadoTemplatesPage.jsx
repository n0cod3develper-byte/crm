import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { FileText, Plus, Edit3, Trash2, Save, X, ChevronDown, ChevronUp, History, Tag } from 'lucide-react';
import api from '../../lib/api';

const inputStyle = { width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'monospace' };

export function CertificadoTemplatesPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', descripcion: '', contenido: '', variables_disponibles: [], es_predeterminada: false });
  const [motivo, setMotivo] = useState('');
  const [showHistory, setShowHistory] = useState(null);

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['certificado-templates'],
    queryFn: async () => { const { data } = await api.get('/certificados/templates'); return data.data || []; },
  });

  // Fetch variables
  const { data: variables = [] } = useQuery({
    queryKey: ['certificado-variables'],
    queryFn: async () => { const { data } = await api.get('/certificados/templates/variables'); return data.data || []; },
  });

  // Fetch version history
  const { data: versions = [] } = useQuery({
    queryKey: ['certificado-versions', showHistory],
    queryFn: async () => { const { data } = await api.get(`/certificados/templates/${showHistory}/versiones`); return data.data || []; },
    enabled: !!showHistory,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (d) => api.post('/certificados/templates', d),
    onSuccess: () => { toast.success('Plantilla creada'); qc.invalidateQueries({ queryKey: ['certificado-templates'] }); setShowForm(false); resetForm(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Error al crear'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }) => api.patch(`/certificados/templates/${id}`, d),
    onSuccess: () => { toast.success('Plantilla actualizada'); qc.invalidateQueries({ queryKey: ['certificado-templates'] }); setEditingId(null); resetForm(); setMotivo(''); },
    onError: (e) => toast.error(e.response?.data?.message || 'Error al actualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/certificados/templates/${id}`),
    onSuccess: () => { toast.success('Plantilla desactivada'); qc.invalidateQueries({ queryKey: ['certificado-templates'] }); },
    onError: (e) => toast.error(e.response?.data?.message || 'Error al eliminar'),
  });

  function resetForm() {
    setForm({ nombre: '', descripcion: '', contenido: '', variables_disponibles: [], es_predeterminada: false });
  }

  function handleEdit(t) {
    setEditingId(t.id);
    setForm({ nombre: t.nombre, descripcion: t.descripcion || '', contenido: t.contenido, variables_disponibles: t.variables_disponibles || [], es_predeterminada: t.es_predeterminada });
    setShowForm(true);
  }

  function insertVariable(key) {
    const textarea = document.getElementById('template-editor');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = form.contenido;
    const newText = text.substring(0, start) + `{{${key}}}` + text.substring(end);
    setForm(f => ({ ...f, contenido: newText }));
    setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = start + key.length + 4; textarea.focus(); }, 0);
  }

  function handleSave() {
    if (!form.nombre || !form.contenido) return toast.error('Nombre y contenido son requeridos');
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form, motivo });
    } else {
      createMutation.mutate(form);
    }
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={22} color="var(--clr-primary-500)" /> Plantillas de Certificado Laboral
        </h1>
        {!showForm && (
          <button className="btn btn--primary" onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }}>
            <Plus size={16} /> Nueva Plantilla
          </button>
        )}
      </div>

      {/* Editor */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>{editingId ? 'Editar Plantilla' : 'Nueva Plantilla'}</h2>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Nombre *</label>
              <input style={{ ...inputStyle, fontFamily: 'inherit' }} placeholder="Ej: Certificado Laboral Estándar" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Descripción</label>
              <input style={{ ...inputStyle, fontFamily: 'inherit' }} placeholder="Descripción de la plantilla" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '13px', cursor: 'pointer', marginBottom: '0.75rem' }}>
            <input type="checkbox" checked={form.es_predeterminada} onChange={e => setForm(f => ({ ...f, es_predeterminada: e.target.checked }))} />
            Plantilla predeterminada
          </label>

          <div style={{ display: 'flex', gap: '1rem' }}>
            {/* Variable insertion panel */}
            <div style={{ width: '250px', flexShrink: 0 }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                <Tag size={12} style={{ marginRight: '0.25rem' }} /> Variables disponibles
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '400px', overflowY: 'auto' }}>
                {variables.map(v => (
                  <button key={v.key} onClick={() => insertVariable(v.key)} style={{ textAlign: 'left', padding: '0.375rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-app)', cursor: 'pointer', fontSize: '11px', color: 'var(--text-primary)' }}>
                    <code style={{ color: 'var(--clr-primary-500)' }}>{`{{${v.key}}}`}</code>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{v.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Template content editor */}
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                Contenido de la plantilla *
              </label>
              <textarea id="template-editor" style={{ ...inputStyle, minHeight: '400px', resize: 'vertical' }} placeholder="Escribe el contenido de la plantilla aquí. Usa {{variable}} para insertar datos del empleado y {{#if variable}}...{{/if}} para bloques condicionales." value={form.contenido} onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))} />
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Ejemplo: {'"'}La empresa CARGAR S.A.S. hace constar que {`{{nombre_completo}}`}...{'"'}
              </div>
            </div>
          </div>

          {editingId && (
            <div style={{ marginTop: '0.75rem' }}>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Motivo del cambio (opcional)</label>
              <input style={{ ...inputStyle, fontFamily: 'inherit' }} placeholder="Ej: Corrección de redacción" value={motivo} onChange={e => setMotivo(e.target.value)} />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button className="btn btn--ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancelar</button>
            <button className="btn btn--primary" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              <Save size={14} /> {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* Version history modal */}
      {showHistory && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={16} /> Historial de Versiones
            </h2>
            <button onClick={() => setShowHistory(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
          </div>
          {versions.map((v, i) => (
            <div key={v.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>Versión {v.version}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    {new Date(v.created_at).toLocaleDateString('es-CO')} {new Date(v.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {v.modificado_por_nombre && <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>por {v.modificado_por_nombre} {v.modificado_por_apellido}</span>}
                  {v.motivo && <span style={{ fontSize: '11px', color: 'var(--clr-primary-500)', marginLeft: '0.5rem' }}>({v.motivo})</span>}
                </div>
              </div>
            </div>
          ))}
          {versions.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Sin versiones registradas</p>}
        </div>
      )}

      {/* Template list */}
      <div className="card">
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem' }}>Plantillas Existentes</h2>
        {isLoading ? <p style={{ color: 'var(--text-muted)' }}>Cargando...</p> : templates.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>{t.nombre}</span>
                {t.es_predeterminada && <span style={{ fontSize: '10px', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontWeight: 600 }}>Predeterminada</span>}
                {!t.activa && <span style={{ fontSize: '10px', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 600 }}>Inactiva</span>}
              </div>
              {t.descripcion && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{t.descripcion}</p>}
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Creada: {new Date(t.created_at).toLocaleDateString('es-CO')}{t.creado_por_nombre ? ` por ${t.creado_por_nombre}` : ''}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button onClick={() => handleEdit(t)} style={{ background: 'none', border: 'none', color: 'var(--clr-primary-500)', cursor: 'pointer', padding: '0.25rem' }} title="Editar"><Edit3 size={14} /></button>
              <button onClick={() => setShowHistory(t.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }} title="Historial"><History size={14} /></button>
              {t.activa && !t.es_predeterminada && <button onClick={() => { if (confirm('¿Desactivar esta plantilla?')) deleteMutation.mutate(t.id); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }} title="Desactivar"><Trash2 size={14} /></button>}
            </div>
          </div>
        ))}
        {templates.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No hay plantillas registradas</p>}
      </div>
    </div>
  );
}
