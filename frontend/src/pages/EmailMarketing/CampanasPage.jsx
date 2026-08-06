import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { emailMarketingApi } from '../../services/emailMarketingApi';
import { Plus, Search, Trash2, Edit2, Play, Eye, Calendar, Award, FlaskConical } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Modal } from '../../components/common/Modal';

export function CampanasPage() {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampana, setEditingCampana] = useState(null);

  const [form, setForm] = useState({ nombre: '', plantilla_id: '', lista_id: '', programada_para: '' });

  const queryClient = useQueryClient();

  // Queries
  const { data: campanas, isLoading } = useQuery({
    queryKey: ['email_campanas', search],
    queryFn: () => emailMarketingApi.getCampanas({ search }).then(r => r.data || []),
  });

  const { data: plantillas } = useQuery({
    queryKey: ['email_plantillas_all'],
    queryFn: () => emailMarketingApi.getPlantillas({ limit: 500 }).then(r => r.data || []),
  });

  const { data: listas } = useQuery({
    queryKey: ['email_listas_all'],
    queryFn: () => emailMarketingApi.getListas({ limit: 500 }).then(r => r.data || []),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: emailMarketingApi.createCampana,
    onSuccess: () => {
      toast.success('Campaña creada');
      queryClient.invalidateQueries({ queryKey: ['email_campanas'] });
      setIsModalOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => emailMarketingApi.updateCampana(id, data),
    onSuccess: () => {
      toast.success('Campaña actualizada');
      queryClient.invalidateQueries({ queryKey: ['email_campanas'] });
      setIsModalOpen(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: emailMarketingApi.deleteCampana,
    onSuccess: () => {
      toast.success('Campaña eliminada');
      queryClient.invalidateQueries({ queryKey: ['email_campanas'] });
    }
  });

  const enviarMutation = useMutation({
    mutationFn: emailMarketingApi.enviarCampana,
    onSuccess: () => {
      toast.success('Envío de campaña programado / iniciado');
      queryClient.invalidateQueries({ queryKey: ['email_campanas'] });
    }
  });

  const cancelarMutation = useMutation({
    mutationFn: emailMarketingApi.cancelarCampana,
    onSuccess: () => {
      toast.success('Campaña cancelada');
      queryClient.invalidateQueries({ queryKey: ['email_campanas'] });
    }
  });

  const pruebaMutation = useMutation({
    mutationFn: emailMarketingApi.enviarPruebaCampana,
    onSuccess: (data) => toast.success(data?.message || 'Correo de prueba enviado a tu email'),
    onError: (err) => toast.error(err?.response?.data?.error?.message || 'Error al enviar prueba'),
  });

  // Handlers
  const handleOpenModal = (c = null) => {
    if (c) {
      setEditingCampana(c);
      setForm({ 
        nombre: c.nombre, 
        plantilla_id: c.plantilla_id, 
        lista_id: c.lista_id, 
        programada_para: c.programada_para ? new Date(c.programada_para).toISOString().slice(0, 16) : ''
      });
    } else {
      setEditingCampana(null);
      setForm({ nombre: '', plantilla_id: '', lista_id: '', programada_para: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      programada_para: form.programada_para ? new Date(form.programada_para).toISOString() : null,
      estado: form.programada_para ? 'programada' : 'borrador'
    };

    if (editingCampana) {
      updateMutation.mutate({ id: editingCampana.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Layout
      title="Campañas de Email Marketing"
      subtitle="Programa envíos masivos y analiza las tasas de entrega"
      rightContent={
        <button className="btn btn--primary" onClick={() => handleOpenModal(null)}>
          <Plus size={16} style={{ marginRight: '4px' }} /> Nueva Campaña
        </button>
      }
    >
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 420 }}>
          <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            className="input" 
            style={{ paddingLeft: '2.5rem' }} 
            placeholder="Buscar campañas..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : campanas?.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Calendar size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3>No has creado campañas de correo</h3>
          <p>Crea tu primera campaña, asóciala a una plantilla y a una lista de contactos.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Campaña</th>
                <th>Plantilla</th>
                <th>Lista de Destino</th>
                <th>Progreso / Envíos</th>
                <th>Métricas</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {campanas?.map((c) => {
                const total = c.total_envios || 0;
                const env = c.enviados || 0;
                const fall = c.fallidos || 0;
                const abiertos = c.abiertos || 0;
                const clics = c.clicks || 0;

                const pctApertura = env > 0 ? ((abiertos / env) * 100).toFixed(1) : 0;
                const pctClic = abiertos > 0 ? ((clics / abiertos) * 100).toFixed(1) : 0;

                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.nombre}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {c.programada_para ? `Programada: ${new Date(c.programada_para).toLocaleDateString()}` : 'Envío manual'}
                      </div>
                    </td>
                    <td>{c.plantilla_nombre || '—'}</td>
                    <td>{c.lista_nombre || '—'}</td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>
                        <strong>{env + fall}</strong> / {total} procesados
                      </div>
                      <div style={{ width: '100px', height: '6px', background: '#e2e8f0', borderRadius: '3px', marginTop: '4px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${total > 0 ? ((env + fall) / total) * 100 : 0}%`, 
                          height: '100%', 
                          background: '#10b981' 
                        }} />
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', display: 'flex', gap: '8px' }}>
                        <span>👁️ {pctApertura}%</span>
                        <span>🖱️ {pctClic}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge--${
                        c.estado === 'completada' ? 'success' : 
                        c.estado === 'enviando' ? 'primary' : 
                        c.estado === 'programada' ? 'warning' : 'secondary'
                      }`}>
                        {c.estado}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <Link to={`/email-marketing/campanas/${c.id}`} className="btn btn--ghost btn--sm" style={{ padding: '6px' }}>
                          <Eye size={16} />
                        </Link>
                        {['borrador', 'programada'].includes(c.estado) && (
                          <>
                            <button className="btn btn--ghost btn--sm" style={{ padding: '6px', color: '#10b981' }} onClick={() => {
                              if (window.confirm('¿Deseas iniciar el envío de esta campaña ahora mismo?')) enviarMutation.mutate(c.id);
                            }}>
                              <Play size={16} />
                            </button>
                            <button
                              className="btn btn--ghost btn--sm"
                              style={{ padding: '6px', color: '#6366f1' }}
                              title="Enviar correo de prueba a mi email"
                              onClick={() => pruebaMutation.mutate(c.id)}
                              disabled={pruebaMutation.isPending}
                            >
                              <FlaskConical size={16} />
                            </button>
                            <button className="btn btn--ghost btn--sm" style={{ padding: '6px' }} onClick={() => handleOpenModal(c)}>
                              <Edit2 size={16} />
                            </button>
                          </>
                        )}
                        {c.estado === 'enviando' && (
                          <button className="btn btn--ghost btn--sm" style={{ padding: '6px', color: 'var(--clr-danger)' }} onClick={() => {
                            if (window.confirm('¿Cancelar el envío de esta campaña?')) cancelarMutation.mutate(c.id);
                          }}>
                            X
                          </button>
                        )}
                        <button className="btn btn--ghost btn--sm" style={{ padding: '6px', color: 'var(--clr-danger)' }} onClick={() => {
                          if (window.confirm('¿Eliminar campaña y sus registros de envío?')) deleteMutation.mutate(c.id);
                        }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL CREAR/EDITAR */}
      {isModalOpen && (
        <Modal title={editingCampana ? 'Editar Campaña' : 'Nueva Campaña'} onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Nombre de la campaña</label>
              <input className="input" required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div>
              <label className="label">Plantilla de correo</label>
              <select className="input" required value={form.plantilla_id} onChange={e => setForm({ ...form, plantilla_id: e.target.value })}>
                <option value="">Seleccionar plantilla...</option>
                {plantillas?.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Lista de distribución (contactos)</label>
              <select className="input" required value={form.lista_id} onChange={e => setForm({ ...form, lista_id: e.target.value })}>
                <option value="">Seleccionar lista...</option>
                {listas?.map(l => (
                  <option key={l.id} value={l.id}>{l.nombre} ({l.total_contactos} contactos)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Programar envío (opcional - dejar vacío para envío manual)</label>
              <input className="input" type="datetime-local" value={form.programada_para} onChange={e => setForm({ ...form, programada_para: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1rem' }}>
              <button type="button" className="btn btn--secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn--primary">Guardar Campaña</button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
