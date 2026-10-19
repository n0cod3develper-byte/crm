import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Megaphone, Trash2, Edit2, ArrowRightCircle, Archive, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import { LeadForm } from '../../components/Leads/LeadForm';
import { usePermissions } from '../../contexts/PermissionsContext';
import { STATUS_COLORS } from '../../constants/leads';
import api from '../../lib/api';

const fmtFechaArchivado = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short',
});

export function LeadsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [filterEmpleado, setFilterEmpleado] = React.useState('all');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingLead, setEditingLead] = React.useState(null);
  // Vista de archivados: alterna entre los leads activos y los archivados.
  const [vistaArchivados, setVistaArchivados] = React.useState(false);
  const queryClient = useQueryClient();
  const { puede } = usePermissions();

  // Restaurar usa el MISMO permiso que archivar ('eliminar'): es su inverso.
  const puedeRestaurar = puede('leads', 'eliminar');

  // Empleados activos: alimentan el filtro y el texto "Sin asignar"
  const { data: empleados = [] } = useQuery({
    queryKey: ['leads-asignables'],
    queryFn: async () => {
      const { data } = await api.get('/leads/asignables');
      return data?.data || [];
    },
    staleTime: 60 * 1000,
    retry: 1,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['leads', search, filterStatus, filterEmpleado, vistaArchivados],
    queryFn: async () => {
      const params = { limit: 50 };
      if (search) params.search = search;
      if (filterStatus && filterStatus !== 'all') params.status = filterStatus;
      if (filterEmpleado && filterEmpleado !== 'all') params.assignedTo = filterEmpleado;
      // `archivados=true` → la API devuelve SOLO los archivados
      if (vistaArchivados) params.archivados = 'true';
      const { data } = await api.get('/leads', { params });
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/leads/${id}`),
    onSuccess: () => {
      toast.success('Lead archivado');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', undefined] });
    },
  });

  // Restauración: invierte el archivado. El backend no envía correos de
  // asignación, porque el responsable no cambia.
  const restoreMutation = useMutation({
    mutationFn: async (id) => api.post(`/leads/${id}/restaurar`),
    onSuccess: () => {
      toast.success('Lead restaurado. Conserva su estado y su responsable.');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-summary'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'No fue posible restaurar el lead');
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

      <Topbar 
        title="Leads" 
        subtitle={vistaArchivados
          ? 'Leads archivados — su información y trazabilidad se conservan completas'
          : 'Prospectos comerciales en fases iniciales'}
        rightContent={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`btn ${vistaArchivados ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setVistaArchivados((v) => !v)}
              title={vistaArchivados
                ? 'Volver a los leads activos'
                : 'Ver los leads archivados con su fecha y responsable'}
            >
              <Archive size={16} />
              {vistaArchivados ? 'Ver activos' : 'Ver archivados'}
            </button>
            {!vistaArchivados && (
              <button className="btn btn--primary" onClick={handleCreate}>
                <Plus size={16} /> Nuevo Lead
              </button>
            )}
          </div>
        } 
      />

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
          <select
            className="input"
            style={{ maxWidth: 240 }}
            value={filterEmpleado}
            onChange={(e) => setFilterEmpleado(e.target.value)}
            aria-label="Filtrar por empleado asignado"
          >
            <option value="all">Todos los responsables</option>
            <option value="none">Sin asignar</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : leads.length === 0 ? (
          <div className="empty-state">
            <Megaphone size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">
              {vistaArchivados ? 'Sin leads archivados' : 'Sin leads'}
            </h2>
            <p className="empty-state__desc">
              {vistaArchivados
                ? 'No hay leads archivados que coincidan con la búsqueda.'
                : 'No hay prospectos que coincidan con la búsqueda.'}
            </p>
            {vistaArchivados ? (
              <button className="btn btn--secondary" onClick={() => setVistaArchivados(false)}>
                Ver leads activos
              </button>
            ) : (
              <button className="btn btn--primary" onClick={handleCreate}><Plus size={16} /> Crear Lead</button>
            )}
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
                  <th>Asignado a</th>
                  <th>Scoring</th>
                  <th>Estado</th>
                  {vistaArchivados && <th>Archivado</th>}
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const statusInfo = STATUS_COLORS[lead.status] || STATUS_COLORS.new;
                  const isConverted = lead.status === 'converted';

                  return (
                    <tr key={lead.id} style={{ opacity: isConverted || lead.status === 'dead' || vistaArchivados ? 0.6 : 1 }}>
                      <td style={{ fontWeight: 600 }}>
                        <button
                          onClick={() => navigate(`/leads/${lead.id}`)}
                          title="Ver detalle y trazabilidad del lead"
                          style={{
                            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                            font: 'inherit', color: 'var(--text-primary)', textAlign: 'left',
                          }}
                        >
                          {lead.first_name} {lead.last_name || ''}
                        </button>
                      </td>
                      <td>{lead.company_name || '—'}</td>
                      <td>
                        <div style={{ fontSize: 'var(--text-sm)' }}>{lead.email || '—'}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{lead.phone || '—'}</div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{lead.source || '—'}</td>
                      <td>
                        {lead.assigned_employee_id ? (
                          <span
                            title="Responsable del lead"
                            style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}
                          >
                            {lead.assigned_employee_name || 'Empleado asignado'}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Sin asignar</span>
                        )}
                      </td>
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
                      {vistaArchivados && (
                        <td>
                          <div style={{ fontSize: 'var(--text-sm)' }}>
                            {lead.deleted_at ? fmtFechaArchivado.format(new Date(lead.deleted_at)) : '—'}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                            {lead.deleted_by_name ? `por ${lead.deleted_by_name}` : 'Responsable desconocido'}
                          </div>
                        </td>
                      )}
                      <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }}>
                        {vistaArchivados ? (
                          puedeRestaurar && (
                            <button
                              className="btn btn--sm"
                              style={{ padding: '0.375rem 0.5rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #1d4ed820' }}
                              onClick={() => {
                                if (window.confirm(
                                  '¿Restaurar este lead? Volverá al listado activo conservando su estado y su responsable. No se envían correos de asignación.'
                                )) {
                                  restoreMutation.mutate(lead.id);
                                }
                              }}
                              disabled={restoreMutation.isPending}
                              title="Restaurar lead archivado"
                            >
                              {restoreMutation.isPending
                                ? <Loader2 size={14} style={{ marginRight: '4px', animation: 'spin 1s linear infinite' }} />
                                : <RotateCcw size={14} style={{ marginRight: '4px' }} />}
                              Restaurar
                            </button>
                          )
                        ) : (
                          <>
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
                                if(window.confirm('¿Archivar este lead? Se retira del listado, pero se conserva su información y su trazabilidad completa.')) {
                                  deleteMutation.mutate(lead.id);
                                }
                              }}
                              title="Archivar"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
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
