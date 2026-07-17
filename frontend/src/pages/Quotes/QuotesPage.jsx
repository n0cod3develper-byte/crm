import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, Search, FileText, Trash2, Eye, Edit2,
  ChevronLeft, ChevronRight, Filter, Package, Download, CheckCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import { QuoteForm } from '../../components/Quotes/QuoteForm';
import api from '../../lib/api';
import { generateQuotePDF } from '../../lib/pdfGenerator';

const STATUS_COLORS = {
  draft:    { bg: 'var(--badge-draft-bg, #f1f5f9)',   color: 'var(--badge-draft-color, #475569)',   label: 'Borrador' },
  sent:     { bg: 'var(--badge-info-bg, #e0f2fe)',     color: 'var(--badge-info-color, #0284c7)',    label: 'Enviada' },
  viewed:   { bg: '#fef08a',                           color: '#854d0e',                             label: 'Vista' },
  accepted: { bg: 'var(--badge-success-bg, #dcfce7)',  color: 'var(--badge-success-color, #166534)', label: 'Aceptada' },
  rejected: { bg: 'var(--badge-danger-bg, #fee2e2)',   color: 'var(--badge-danger-color, #991b1b)',  label: 'Rechazada' },
  expired:  { bg: '#f4f4f5',                           color: '#52525b',                             label: 'Expirada' },
};

function formatCurrency(val) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

const PAGE_SIZE = 15;

export function QuotesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // ─── Estado para crear / editar cotización ─────────────
  const [isModalOpen, setIsModalOpen] = useState(!!location.state?.prefillQuote);
  const [editingQuote, setEditingQuote] = useState(location.state?.prefillQuote || null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);

  // ─── Filtros ─────────────────────────────────────────────
  const [search, setSearch] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('search') || '';
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [isGroupedModalOpen, setIsGroupedModalOpen] = useState(false);

  // Clear state so it doesn't reopen on reload
  React.useEffect(() => {
    if (location.state?.prefillQuote) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // ─── Fetch ───────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['quotes', search, statusFilter, page],
    queryFn: async () => {
      const params = { limit: PAGE_SIZE };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/quotes', { params });
      return data;
    },
  });

  // ─── Eliminar ────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/quotes/${id}`),
    onSuccess: () => {
      toast.success('Cotización eliminada');
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al eliminar');
    },
  });

  // ─── Aprobar ─────────────────────────────────────────────
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => api.patch(`/quotes/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Estado actualizado correctamente');
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al actualizar el estado');
    }
  });

  const handleDownloadPDF = async (q) => {
    const loadingToast = toast.loading('Generando y descargando PDF...');
    try {
      const response = await api.get(`/quotes/${q.id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `cotizacion-${q.quote_number || q.id}.pdf`;
      link.click();
      toast.success('PDF descargado con éxito', { id: loadingToast });
    } catch (err) {
      console.error(err);
      toast.error('Error al descargar el PDF', { id: loadingToast });
    }
  };

  const handleCreate = () => { setEditingQuote(null); setIsModalOpen(true); };

  // Carga el detalle completo (con items) antes de abrir el modal
  const handleEdit = async (q) => {
    setIsLoadingEdit(true);
    try {
      const { data } = await api.get(`/quotes/${q.id}`);
      const fullQuote = data.data;
      setEditingQuote(fullQuote);
      setIsModalOpen(true);
    } catch (err) {
      toast.error('No se pudo cargar la cotización para editar');
    } finally {
      setIsLoadingEdit(false);
    }
  };

  const handleClose = () => { setIsModalOpen(false); setEditingQuote(null); };

  const quotes = data?.data || [];
  const hasMore = data?.pagination?.hasMore || false;

  return (
    <div className="app-layout">
      <Topbar
        title="Cotizaciones"
        subtitle="Gestiona propuestas y presupuestos comerciales"
        rightContent={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn--secondary" onClick={() => setIsGroupedModalOpen(true)}>
              <FileText size={16} /> Ver por Empresa
            </button>
            <button className="btn btn--primary" onClick={handleCreate}>
              <Plus size={16} /> Nueva cotización
            </button>
          </div>
        }
      />

      <main className="main-content">
        {/* ── Barra de filtros ──────────────────────────── */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 420 }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Buscar por número o empresa…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              className="input"
              style={{ width: 160 }}
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">Todos los estados</option>
              <option value="draft">Borrador</option>
              <option value="sent">Enviada</option>
              <option value="viewed">Vista</option>
              <option value="accepted">Aceptada</option>
              <option value="rejected">Rechazada</option>
              <option value="expired">Expirada</option>
            </select>
          </div>
        </div>

        {/* ── Contenido ───────────────────────────────── */}
        {isLoading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : quotes.length === 0 ? (
          <div className="empty-state">
            <Package size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Sin cotizaciones</h2>
            <p className="empty-state__desc">Aún no has creado ninguna cotización. Genera la primera propuesta.</p>
            <button className="btn btn--primary" onClick={handleCreate}>
              <Plus size={16} /> Crear cotización
            </button>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>N° Cotización</th>
                    <th>Empresa</th>
                    <th>Oportunidad</th>
                    <th>Subtotal</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th>Vigencia</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => {
                    const badge = STATUS_COLORS[q.status] || STATUS_COLORS.draft;
                    const isExpired = q.valid_until && new Date(q.valid_until) < new Date() && q.status !== 'accepted';
                    const displayBadge = isExpired ? STATUS_COLORS.expired : badge;

                    return (
                      <tr key={q.id}>
                        <td style={{ fontWeight: 600, color: 'var(--clr-primary-500)' }}>{q.quote_number}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{q.company_name || '—'}</div>
                          {q.contact_name && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{q.contact_name}</div>}
                        </td>
                        <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                          {q.opportunity_title || '—'}
                        </td>
                        <td>{formatCurrency(q.subtotal)}</td>
                        <td style={{ fontWeight: 700 }}>{formatCurrency(q.total)}</td>
                        <td>
                          <span style={{
                            padding: '0.25rem 0.625rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: displayBadge.bg,
                            color: displayBadge.color,
                          }}>
                            {isExpired ? 'Expirada' : displayBadge.label}
                          </span>
                        </td>
                        <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                          {formatDate(q.created_at)}
                        </td>
                        <td style={{ fontSize: 'var(--text-xs)', color: isExpired ? 'var(--clr-danger)' : 'var(--text-secondary)' }}>
                          {q.valid_until ? formatDate(q.valid_until) : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.375rem' }}>
                            {q.status !== 'accepted' && (
                              <button
                                className="btn btn--ghost btn--sm"
                                style={{ padding: '0.375rem', color: '#16a34a' }}
                                onClick={() => {
                                  if (window.confirm('¿Aprobar esta cotización?')) {
                                    updateStatusMutation.mutate({ id: q.id, status: 'accepted' });
                                  }
                                }}
                                title="Aprobar"
                              >
                                <CheckCircle size={16} />
                              </button>
                            )}
                            <button
                              className="btn btn--ghost btn--sm"
                              style={{ padding: '0.375rem', color: 'var(--clr-primary-500)' }}
                              onClick={() => navigate(`/quotes/${q.id}`)}
                              title="Ver detalle"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              className="btn btn--ghost btn--sm"
                              style={{ padding: '0.375rem', color: 'var(--text-secondary)' }}
                              onClick={() => handleDownloadPDF(q)}
                              title="Descargar PDF"
                            >
                              <Download size={16} />
                            </button>
                            {q.status !== 'accepted' && (
                              <button
                                className="btn btn--ghost btn--sm"
                                style={{ padding: '0.375rem', color: '#d97706', opacity: isLoadingEdit ? 0.5 : 1 }}
                                onClick={() => handleEdit(q)}
                                disabled={isLoadingEdit}
                                title="Editar cotización"
                              >
                                {isLoadingEdit ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Edit2 size={16} />}
                              </button>
                            )}
                            <button
                              className="btn btn--ghost btn--sm"
                              style={{ padding: '0.375rem', color: 'var(--clr-danger)' }}
                              onClick={() => {
                                if (window.confirm('¿Seguro de eliminar esta cotización?')) {
                                  deleteMutation.mutate(q.id);
                                }
                              }}
                              title="Eliminar"
                            >
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

            {/* ── Paginación ──────────────────────────────── */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: '1.25rem', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
            }}>
              <span>Mostrando {quotes.length} resultados · Página {page}</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn--ghost btn--sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} /> Anterior
                </button>
                <button
                  className="btn btn--ghost btn--sm"
                  disabled={!hasMore}
                  onClick={() => setPage(p => p + 1)}
                >
                  Siguiente <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── Modal: Nueva / Editar cotización ───────────── */}
      {isModalOpen && (
        <Modal
          title={editingQuote ? `Editar Cotización ${editingQuote.quote_number}` : 'Nueva Cotización'}
          onClose={handleClose}
          maxWidth="1100px"
        >
          <div style={{ width: '100%', minWidth: 'min(90vw, 800px)' }}>
            <QuoteForm
              quote={editingQuote || undefined}
              onSuccess={handleClose}
              onCancel={handleClose}
            />
          </div>
        </Modal>
      )}

      {/* ── Modal: Ver por Empresa ─────────────────────── */}
      {isGroupedModalOpen && (
        <Modal
          title="Cotizaciones por Empresa"
          onClose={() => setIsGroupedModalOpen(false)}
          maxWidth="800px"
        >
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {quotes.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No hay cotizaciones para mostrar.</p>
            ) : (
              Object.entries(
                quotes.reduce((acc, q) => {
                  const company = q.company_name || 'Sin empresa';
                  if (!acc[company]) acc[company] = [];
                  acc[company].push(q);
                  return acc;
                }, {})
              ).map(([companyName, companyQuotes]) => (
                <div key={companyName} style={{ marginBottom: '1.5rem', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem 1rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{companyName}</span>
                    <span className="badge badge--primary">{companyQuotes.length}</span>
                  </div>
                  <div style={{ padding: '0.5rem' }}>
                    <table style={{ background: 'transparent', margin: 0, fontSize: 'var(--text-sm)' }}>
                      <thead>
                        <tr>
                          <th>N° Cotización</th>
                          <th>Total</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {companyQuotes.map(q => {
                          const badge = STATUS_COLORS[q.status] || STATUS_COLORS.draft;
                          return (
                            <tr key={q.id}>
                              <td style={{ fontWeight: 600, color: 'var(--clr-primary-500)' }}>{q.quote_number}</td>
                              <td>{formatCurrency(q.total)}</td>
                              <td>
                                <span style={{
                                  padding: '0.25rem 0.625rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                                  background: badge.bg, color: badge.color
                                }}>
                                  {badge.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end mt-4">
            <button className="btn btn--primary" onClick={() => setIsGroupedModalOpen(false)}>
              Cerrar
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
}
