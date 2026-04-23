import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Megaphone, Trash2, Edit2, ArrowRightCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Sidebar } from '../../components/layout/Sidebar';
import { Modal } from '../../components/common/Modal';
import { LeadForm } from '../../components/Leads/LeadForm';
import api from '../../lib/api';

const STATUS_COLORS = {
  new: { bg: '#e0f2fe', color: '#0284c7', label: 'Nuevo' },
  contacted: { bg: '#fef08a', color: '#854d0e', label: 'Contactado' },
  qualified: { bg: '#dcfce3', color: '#166534', label: 'Calificado' },
  converted: { bg: '#dbeafe', color: '#1e40af', label: 'Convertido' },
  dead: { bg: '#fee2e2', color: '#991b1b', label: 'Descartado' },
};

export function LeadsPage() {
  const [search, setSearch] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingLead, setEditingLead] = React.useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['leads', search, filterStatus],
    queryFn: async () => {
      const params = { limit: 50 };
      if (search) params.search = search;
      if (filterStatus && filterStatus !== 'all') params.status = filterStatus;
      const { data } = await api.get('/leads', { params });
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/leads/${id}`),
    onSuccess: () => {
      toast.success('Lead eliminado');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (id) => api.patch(`/leads/${id}/convert`),
    onSuccess: () => {
      toast.success('¡Lead convertido a Contacto y Empresa exitosamente!');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Error al convertir Lead');
    }
  });

  const leads = data?.data || [];

  const handleCreate = () => { setEditingLead(null); setIsModalOpen(true); };
  const handleEdit = (lead) => { setEditingLead(lead); setIsModalOpen(true); };
  const handleClose = () => { setIsModalOpen(false); setEditingLead(null); };

  return (
    <div className="app-layout">
      <Sidebar />

      <header className="header">
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Leads</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Prospectos comerciales en fases iniciales
          </p>
        </div>
        <button className="btn btn--primary" onClick={handleCreate}>
          <Plus size={16} /> Nuevo Lead
        </button>
      </header>

      <main className="main-content">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 420 }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="input" style={{ paddingLeft: '2.5rem' }} placeholder="Buscar prospectos…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '0.375rem', overflowX: 'auto' }}>
            {['all', 'new', 'contacted', 'qualified', 'converted', 'dead'].map(s => (
               <button
                 key={s}
                 className={`btn btn--sm ${filterStatus === s ? 'btn--primary' : 'btn--ghost'}`}
                 onClick={() => setFilterStatus(s)}
               >
                 {s === 'all' ? 'Todos' : STATUS_COLORS[s].label}
               </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : leads.length === 0 ? (
          <div className="empty-state">
            <Megaphone size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Sin leads</h2>
            <p className="empty-state__desc">No hay prospectos que coincidan con la búsqueda.</p>
            <button className="btn btn--primary" onClick={handleCreate}><Plus size={16} /> Crear Lead</button>
          </div>
        ) : (
          <div className="table-container">
            <table className="table" style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Empresa</th>
                  <th>Contacto</th>
                  <th>Fuente</th>
                  <th>Scoring</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const statusInfo = STATUS_COLORS[lead.status] || STATUS_COLORS.new;
                  const isConverted = lead.status === 'converted';

                  return (
                    <tr key={lead.id} style={{ opacity: isConverted || lead.status === 'dead' ? 0.6 : 1 }}>
                      <td style={{ fontWeight: 600 }}>
                        {lead.first_name} {lead.last_name || ''}
                      </td>
                      <td>{lead.company_name || '—'}</td>
                      <td>
                        <div style={{ fontSize: 'var(--text-sm)' }}>{lead.email || '—'}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{lead.phone || '—'}</div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{lead.source || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '40px', height: '6px', background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${lead.score}%`, height: '100%', background: lead.score > 70 ? '#22c55e' : lead.score > 30 ? '#eab308' : '#ef4444' }} />
                          </div>
                          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{lead.score}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                          background: statusInfo.bg, color: statusInfo.color
                        }}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }}>
                        {!isConverted && (
                          <button 
                            className="btn btn--sm" 
                            style={{ padding: '0.375rem 0.5rem', background: '#ecfdf5', color: '#10b981', border: '1px solid #10b98120' }} 
                            onClick={() => {
                              if(window.confirm('¿Convertir este lead en Contacto y Empresa real?')) {
                                convertMutation.mutate(lead.id);
                              }
                            }}
                            title="Convertir a Contacto"
                          >
                            <ArrowRightCircle size={14} style={{ marginRight: '4px' }} /> Convertir
                          </button>
                        )}
                        <button className="btn btn--ghost btn--sm" style={{ padding: '0.375rem', color: 'var(--clr-primary-500)' }} onClick={() => handleEdit(lead)} title="Editar">
                          <Edit2 size={16} />
                        </button>
                        <button 
                          className="btn btn--ghost btn--sm" 
                          style={{ padding: '0.375rem', color: 'var(--clr-danger)' }} 
                          onClick={() => {
                            if(window.confirm('¿Seguro de eliminar este lead?')) {
                              deleteMutation.mutate(lead.id);
                            }
                          }}
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {isModalOpen && (
        <Modal title={editingLead ? 'Editar Lead' : 'Nuevo Lead'} onClose={handleClose}>
          <LeadForm lead={editingLead} onSuccess={handleClose} onCancel={handleClose} />
        </Modal>
      )}
    </div>
  );
}
