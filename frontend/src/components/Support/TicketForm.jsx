import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';
import { SearchableSelect } from '../ui/SearchableSelect';

const STATUSES = [
  { value: 'open',        label: 'Abierto' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'waiting',     label: 'En espera' },
  { value: 'resolved',    label: 'Resuelto' },
  { value: 'closed',      label: 'Cerrado' },
];

const PRIORITIES = [
  { value: 'low',    label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high',   label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

export function TicketForm({ ticket, onSuccess, onCancel }) {
  const qc = useQueryClient();

  const [form, setForm] = React.useState({
    title:       ticket?.title       || '',
    description: ticket?.description || '',
    status:      ticket?.status      || 'open',
    priority:    ticket?.priority    || 'medium',
    company_id:  ticket?.company_id  || '',
    contact_id:  ticket?.contact_id  || '',
    assigned_to: ticket?.assigned_to || '',
  });

  const [selectedCompany, setSelectedCompany] = React.useState(null);

  React.useEffect(() => {
    if (ticket?.company_id) {
      api.get(`/companies/${ticket.company_id}`)
        .then(r => setSelectedCompany(r.data.data))
        .catch(() => {});
    }
  }, [ticket]);

  const searchCompanies = React.useCallback(async (searchTerm) => {
    const { data } = await api.get('/companies', {
      params: { search: searchTerm || undefined, limit: 20 }
    });
    return data.data || [];
  }, []);

  // Cargar empleados para asignar
  const { data: employeesData } = useQuery({
    queryKey: ['employees-select'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/employees', { params: { limit: 200 } });
        return data;
      } catch {
        return { data: [] };
      }
    },
    staleTime: 60_000,
  });

  const employees = employeesData?.data || [];

  const mutation = useMutation({
    mutationFn: async (payload) => {
      if (ticket) return api.patch(`/support/${ticket.id}`, payload);
      return api.post('/support', payload);
    },
    onSuccess: () => {
      toast.success(ticket ? 'Ticket actualizado' : 'Ticket creado');
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      qc.invalidateQueries({ queryKey: ['support-stats'] });
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al guardar');
    },
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('El título es requerido'); return; }
    const payload = { ...form };
    if (!payload.company_id) delete payload.company_id;
    if (!payload.contact_id) delete payload.contact_id;
    if (!payload.assigned_to) delete payload.assigned_to;
    mutation.mutate(payload);
  }

  const labelStyle = { fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' };
  const inputStyle = { width: '100%' };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>

      {/* Título */}
      <div>
        <label style={labelStyle}>Título *</label>
        <input
          id="ticket-title"
          className="input"
          style={inputStyle}
          placeholder="Describe brevemente el problema…"
          value={form.title}
          onChange={set('title')}
          required
        />
      </div>

      {/* Descripción */}
      <div>
        <label style={labelStyle}>Descripción</label>
        <textarea
          id="ticket-description"
          className="input"
          style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
          placeholder="Detalla el problema o solicitud…"
          value={form.description}
          onChange={set('description')}
        />
      </div>

      {/* Estado + Prioridad */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label style={labelStyle}>Estado</label>
          <select id="ticket-status" className="input" style={inputStyle} value={form.status} onChange={set('status')}>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Prioridad</label>
          <select id="ticket-priority" className="input" style={inputStyle} value={form.priority} onChange={set('priority')}>
            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* Empresa */}
      <div>
        <label style={labelStyle}>Empresa</label>
        <SearchableSelect
          fetchFn={searchCompanies}
          value={form.company_id}
          onChange={(val) => setForm(f => ({ ...f, company_id: val }))}
          initialItem={selectedCompany}
          placeholder="Buscar empresa por nombre o NIT..."
          name="company_id"
          noOptionsMessage="No se encontraron empresas"
        />
      </div>

      {/* Asignado a */}
      <div>
        <label style={labelStyle}>Asignado a</label>
        <select id="ticket-assigned" className="input" style={inputStyle} value={form.assigned_to} onChange={set('assigned_to')}>
          <option value="">— Sin asignar —</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
      </div>

      {/* Botones */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem' }}>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancelar</button>
        <button
          id="ticket-submit"
          type="submit"
          className="btn btn--primary"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Guardando…' : ticket ? 'Guardar cambios' : 'Crear ticket'}
        </button>
      </div>
    </form>
  );
}
