import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { emailMarketingApi } from '../../services/emailMarketingApi';
import { Plus, Search, Trash2, Edit2, FileCode, Save, Eye, Code, Info, FlaskConical } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Modal } from '../../components/common/Modal';

export function PlantillasPage() {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlantilla, setEditingPlantilla] = useState(null);
  
  // Form states
  const [form, setForm] = useState({ nombre: '', asunto: '', cuerpo_handlebars: '' });
  const [previewMode, setPreviewMode] = useState(false);

  const queryClient = useQueryClient();

  // Variables disponibles para insertar
  const VARIABLES = [
    { token: '{{nombre}}', desc: 'Nombre del destinatario' },
    { token: '{{correo}}', desc: 'Correo electrónico' },
    { token: '{{empresa}}', desc: 'Nombre de la empresa vinculada' },
    { token: '{{unsubscribe_url}}', desc: 'Enlace para darse de baja (Unsubscribe)' },
  ];

  // Query
  const { data: plantillas, isLoading } = useQuery({
    queryKey: ['email_plantillas', search],
    queryFn: () => emailMarketingApi.getPlantillas({ search }).then(res => res.data || []),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: emailMarketingApi.createPlantilla,
    onSuccess: () => {
      toast.success('Plantilla guardada');
      queryClient.invalidateQueries({ queryKey: ['email_plantillas'] });
      setIsModalOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => emailMarketingApi.updatePlantilla(id, data),
    onSuccess: () => {
      toast.success('Plantilla actualizada');
      queryClient.invalidateQueries({ queryKey: ['email_plantillas'] });
      setIsModalOpen(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: emailMarketingApi.deletePlantilla,
    onSuccess: () => {
      toast.success('Plantilla eliminada');
      queryClient.invalidateQueries({ queryKey: ['email_plantillas'] });
    }
  });

  const pruebaMutation = useMutation({
    mutationFn: emailMarketingApi.enviarPruebaPlantilla,
    onSuccess: (data) => toast.success(data?.message || 'Correo de prueba enviado a tu email'),
    onError: (err) => toast.error(err?.response?.data?.error?.message || 'Error al enviar prueba'),
  });

  // Handlers
  const handleOpenModal = (p = null) => {
    if (p) {
      setEditingPlantilla(p);
      setForm({ nombre: p.nombre, asunto: p.asunto, cuerpo_handlebars: p.cuerpo_handlebars });
    } else {
      setEditingPlantilla(null);
      setForm({ nombre: '', asunto: '', cuerpo_handlebars: `<h3>Estimado/a {{nombre}},</h3>\n<p>Le escribimos desde CARGAR S.A.S. para informarle sobre...</p>\n\n<p>Saludos cordiales,</p>\n<p><strong>CARGAR S.A.S.</strong></p>` });
    }
    setPreviewMode(false);
    setIsModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (editingPlantilla) {
      updateMutation.mutate({ id: editingPlantilla.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const insertVariable = (token) => {
    setForm(prev => ({
      ...prev,
      cuerpo_handlebars: prev.cuerpo_handlebars + token
    }));
  };

  // Render mock preview
  const getPreviewHtml = () => {
    let html = form.cuerpo_handlebars;
    html = html.replace(/\{\{nombre\}\}/g, 'Robinson Cárdenas');
    html = html.replace(/\{\{correo\}\}/g, 'rcardenas@cargar.com.co');
    html = html.replace(/\{\{empresa\}\}/g, 'CARGAR S.A.S.');
    html = html.replace(/\{\{unsubscribe_url\}\}/g, '#');
    return html;
  };

  return (
    <Layout
      title="Plantillas de Correo"
      subtitle="Diseña y personaliza el cuerpo HTML de tus correos masivos"
      rightContent={
        <button className="btn btn--primary" onClick={() => handleOpenModal(null)}>
          <Plus size={16} style={{ marginRight: '4px' }} /> Nueva Plantilla
        </button>
      }
    >
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 420 }}>
          <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            className="input" 
            style={{ paddingLeft: '2.5rem' }} 
            placeholder="Buscar plantillas..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : plantillas?.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <FileCode size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3>No tienes plantillas creadas</h3>
          <p>Crea plantillas dinámicas usando HTML o lenguaje de etiquetas Handlebars.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {plantillas?.map((p) => (
            <div className="card" key={p.id} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                <FileCode size={20} color="#10b981" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{p.nombre}</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Asunto: {p.asunto}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: 'auto' }}>
                <button
                  className="btn btn--ghost btn--sm"
                  style={{ color: '#6366f1' }}
                  title="Enviar correo de prueba a mi email"
                  onClick={() => pruebaMutation.mutate(p.id)}
                  disabled={pruebaMutation.isPending}
                >
                  <FlaskConical size={16} />
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => handleOpenModal(p)}>
                  <Edit2 size={16} />
                </button>
                <button className="btn btn--ghost btn--sm" style={{ color: 'var(--clr-danger)' }} onClick={() => {
                  if (window.confirm('¿Eliminar esta plantilla?')) deleteMutation.mutate(p.id);
                }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL EDITOR */}
      {isModalOpen && (
        <Modal 
          title={editingPlantilla ? 'Editar Plantilla' : 'Nueva Plantilla'} 
          onClose={() => setIsModalOpen(false)}
          maxWidth="900px"
        >
          <div style={{ display: 'flex', gap: '1.5rem', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className={`btn btn--sm ${!previewMode ? 'btn--primary' : 'btn--secondary'}`} 
                type="button" 
                onClick={() => setPreviewMode(false)}
              >
                <Code size={16} style={{ marginRight: '4px' }} /> Editor HTML
              </button>
              <button 
                className={`btn btn--sm ${previewMode ? 'btn--primary' : 'btn--secondary'}`} 
                type="button" 
                onClick={() => setPreviewMode(true)}
              >
                <Eye size={16} style={{ marginRight: '4px' }} /> Preview
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label">Nombre interno</label>
                  <input className="input" required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                </div>
                <div>
                  <label className="label">Asunto del correo</label>
                  <input className="input" required value={form.asunto} onChange={e => setForm({ ...form, asunto: e.target.value })} />
                </div>
              </div>

              {!previewMode ? (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                  {/* Textarea de HTML */}
                  <div>
                    <label className="label">Cuerpo (HTML / Handlebars)</label>
                    <textarea 
                      className="input" 
                      style={{ minHeight: '300px', fontFamily: 'monospace', fontSize: '13px', lineHeight: 1.5 }}
                      required
                      value={form.cuerpo_handlebars}
                      onChange={e => setForm({ ...form, cuerpo_handlebars: e.target.value })}
                    />
                  </div>
                  {/* Variables Sidebar */}
                  <div className="card" style={{ padding: '1rem', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem', marginBottom: '10px', color: 'var(--text-primary)' }}>
                      <Info size={16} /> Variables Dinámicas
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      Haz clic en una variable para insertarla al final de tu plantilla:
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {VARIABLES.map((v, i) => (
                        <button 
                          key={i} 
                          type="button" 
                          className="btn btn--secondary btn--sm" 
                          style={{ justifyContent: 'flex-start', textAlign: 'left', display: 'block', width: '100%', fontSize: '0.8rem' }}
                          onClick={() => insertVariable(v.token)}
                        >
                          <strong>{v.token}</strong>
                          <div style={{ fontSize: '10px', opacity: 0.8 }}>{v.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* MOCK PREVIEW */
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', background: 'white', minHeight: '320px' }}>
                  <div style={{ borderBottom: '1px solid #edf2f7', paddingBottom: '10px', marginBottom: '16px', fontSize: '0.85rem' }}>
                    <strong>Asunto:</strong> {form.asunto}
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: getPreviewHtml() }} />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1rem' }}>
                <button type="button" className="btn btn--secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn--primary">
                  <Save size={16} style={{ marginRight: '4px' }} /> Guardar Plantilla
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
