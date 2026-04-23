import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, LifeBuoy, AlertTriangle, Clock, CheckCircle,
  MessageCircle, Building2, User, Filter,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Sidebar } from '../../components/layout/Sidebar';
import { Modal } from '../../components/common/Modal';
import { TicketForm } from '../../components/Support/TicketForm';
import { TicketDetail } from '../../components/Support/TicketDetail';
import api from '../../lib/api';

// ─── Colores y labels ────────────────────────────────────────
const STATUS_COLOR = {
  open:        { bg: '#3b82f620', tx: '#60a5fa', label: 'Abierto' },
  in_progress: { bg: '#f9731620', tx: '#f97316', label: 'En progreso' },
  waiting:     { bg: '#eab30820', tx: '#eab308', label: 'En espera' },
  resolved:    { bg: '#22c55e20', tx: '#22c55e', label: 'Resuelto' },
  closed:      { bg: '#94a3b820', tx: '#94a3b8', label: 'Cerrado' },
};

const PRIORITY_COLOR = {
  urgent: '#ef4444',
  high:   '#f97316',
  medium: '#eab308',
  low:    '#94a3b8',
};
const PRIORITY_LABEL = { urgent: 'Urgente', high: 'Alta', medium: 'Media', low: 'Baja' };

// ─── Stat Card ───────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{
        width: 42, height: 42, borderRadius: 'var(--radius-md)',
        background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>{value ?? '—'}</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{label}</div>
      </div>
    </div>
  );
}

// ─── Ticket Card ─────────────────────────────────────────────
function TicketCard({ ticket, isSelected, onClick, onEdit, onDelete }) {
  const stc = STATUS_COLOR[ticket.status] || STATUS_COLOR.open;
  const createdAt = new Date(ticket.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div
      onClick={onClick}
      style={{
        padding: '0.875rem 1rem',
        borderRadius: 'var(--radius-md)',
        background: isSelected ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        border: `1px solid ${isSelected ? 'var(--clr-primary-500)' : 'var(--border-color)'}`,
        cursor: 'pointer',
        transition: 'all 0.15s',
        borderLeft: `3px solid ${PRIORITY_COLOR[ticket.priority]}`,
        display: 'flex', flexDirection: 'column', gap: '0.5rem',
      }}
    >
      {/* Row 1: número + badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>#{ticket.ticket_number}</span>
        <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: 9999, fontWeight: 700, background: stc.bg, color: stc.tx }}>
          {stc.label}
        </span>
        <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: 9999, fontWeight: 700, background: `${PRIORITY_COLOR[ticket.priority]}20`, color: PRIORITY_COLOR[ticket.priority] }}>
          {PRIORITY_LABEL[ticket.priority]}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.375rem' }}>
          <button
            className="btn btn--ghost btn--sm"
            style={{ padding: '2px 6px', fontSize: 'var(--text-xs)' }}
            onClick={(e) => { e.stopPropagation(); onEdit(ticket); }}
          >
            Editar
          </button>
          <button
            className="btn btn--ghost btn--sm"
            style={{ padding: '2px 6px', fontSize: 'var(--text-xs)', color: 'var(--clr-danger)' }}
            onClick={(e) => { e.stopPropagation(); onDelete(ticket.id); }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Row 2: título */}
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, lineHeight: 1.3 }}>{ticket.title}</div>

      {/* Row 3: metadata */}
      <div style={{ display: 'flex', gap: '0.75rem', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        {ticket.company_name && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Building2 size={11} /> {ticket.company_name}
          </span>
        )}
        {ticket.assigned_to_name && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <User size={11} /> {ticket.assigned_to_name}
          </span>
        )}
        {Number(ticket.message_count) > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <MessageCircle size={11} /> {ticket.message_count}
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: 'auto' }}>
          <Clock size={11} /> {createdAt}
        </span>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────
export function SupportPage() {
  const qc = useQueryClient();
  const [search, setSearch]           = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [filterPriority, setFilterPriority] = React.useState('all');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingTicket, setEditingTicket] = React.useState(null);
  const [selectedTicket, setSelectedTicket] = React.useState(null);

  // ── Tickets ──
  const { data, isLoading } = useQuery({
    queryKey: ['support-tickets', search, filterStatus, filterPriority],
    queryFn: async () => {
      const params = { limit: 100 };
      if (search) params.search = search;
      if (filterStatus   !== 'all') params.status   = filterStatus;
      if (filterPriority !== 'all') params.priority  = filterPriority;
      const { data } = await api.get('/support', { params });
      return data;
    },
  });

  // ── Stats ──
  const { data: statsData } = useQuery({
    queryKey: ['support-stats'],
    queryFn: async () => {
      const { data } = await api.get('/support/stats');
      return data;
    },
    refetchInterval: 60_000,
  });

  const tickets = data?.data || [];
  const stats   = statsData?.data || {};

  // ── Mutations ──
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/support/${id}`),
    onSuccess: () => {
      toast.success('Ticket eliminado');
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      qc.invalidateQueries({ queryKey: ['support-stats'] });
      if (selectedTicket) setSelectedTicket(null);
    },
    onError: () => toast.error('Error al eliminar'),
  });

  function handleCreate() { setEditingTicket(null); setIsModalOpen(true); }
  function handleEdit(t) { setEditingTicket(t); setIsModalOpen(true); }
  function handleClose() { setIsModalOpen(false); setEditingTicket(null); }

  // Sincronizar ticket seleccionado si se edita
  function handleFormSuccess() {
    handleClose();
    if (selectedTicket) {
      // Re-fetch detail
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
    }
  }

  const STATUS_FILTERS = [
    { val: 'all',        label: 'Todos' },
    { val: 'open',       label: 'Abiertos' },
    { val: 'in_progress',label: 'En progreso' },
    { val: 'waiting',    label: 'Esperando' },
    { val: 'resolved',   label: 'Resueltos' },
    { val: 'closed',     label: 'Cerrados' },
  ];

  const showDetail = !!selectedTicket;

  return (
    <div className="app-layout">
      <Sidebar />

      <header className="header">
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <LifeBuoy size={22} style={{ color: 'var(--clr-primary-500)' }} />
            Soporte al cliente
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button id="btn-new-ticket" className="btn btn--primary" onClick={handleCreate}>
          <Plus size={16} /> Nuevo ticket
        </button>
      </header>

      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.875rem' }}>
          <StatCard icon={LifeBuoy}      label="Abiertos"     value={stats.open_count}        color="#60a5fa" />
          <StatCard icon={Filter}        label="En progreso"  value={stats.in_progress_count}  color="#f97316" />
          <StatCard icon={AlertTriangle} label="Urgentes"     value={stats.urgent_count}       color="#ef4444" />
          <StatCard icon={CheckCircle}   label="Resueltos"    value={stats.resolved_count}     color="#22c55e" />
          <StatCard icon={Clock}         label="Avg resolución (h)" value={stats.avg_resolution_hours} color="#a78bfa" />
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '0.875rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 400 }}>
            <Search size={15} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              id="support-search"
              className="input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Buscar por título, nº o descripción…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map(f => (
              <button
                key={f.val}
                className={`btn btn--sm ${filterStatus === f.val ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => setFilterStatus(f.val)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <select
            id="support-priority-filter"
            className="input"
            style={{ width: 'auto', minWidth: 130 }}
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="all">Toda prioridad</option>
            <option value="urgent">Urgente</option>
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </select>
        </div>

        {/* Layout: lista | detalle */}
        <div style={{ display: 'grid', gridTemplateColumns: showDetail ? '380px 1fr' : '1fr', gap: '1rem', alignItems: 'start', flex: 1, minHeight: 0 }}>

          {/* Lista */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
            {isLoading ? (
              <div className="empty-state"><div className="spinner" /></div>
            ) : tickets.length === 0 ? (
              <div className="empty-state">
                <LifeBuoy size={48} className="empty-state__icon" />
                <h2 className="empty-state__title">Sin tickets</h2>
                <p className="empty-state__desc">Crea el primer ticket de soporte.</p>
                <button className="btn btn--primary" onClick={handleCreate}><Plus size={16} /> Crear ticket</button>
              </div>
            ) : (
              tickets.map((t) => (
                <TicketCard
                  key={t.id}
                  ticket={t}
                  isSelected={selectedTicket?.id === t.id}
                  onClick={() => setSelectedTicket(selectedTicket?.id === t.id ? null : t)}
                  onEdit={handleEdit}
                  onDelete={(id) => {
                    if (window.confirm('¿Eliminar este ticket?')) deleteMutation.mutate(id);
                  }}
                />
              ))
            )}
          </div>

          {/* Detalle / conversación */}
          {showDetail && (
            <div style={{ position: 'sticky', top: 0, maxHeight: 'calc(100vh - 340px)' }}>
              <TicketDetail
                ticket={selectedTicket}
                onClose={() => setSelectedTicket(null)}
              />
            </div>
          )}
        </div>
      </main>

      {/* Modal Crear / Editar */}
      {isModalOpen && (
        <Modal
          title={editingTicket ? 'Editar Ticket' : 'Nuevo Ticket'}
          onClose={handleClose}
          maxWidth="560px"
        >
          <TicketForm
            ticket={editingTicket}
            onSuccess={handleFormSuccess}
            onCancel={handleClose}
          />
        </Modal>
      )}
    </div>
  );
}
