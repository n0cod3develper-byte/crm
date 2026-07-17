import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Edit2, XCircle, FileText, Calendar, Building2, User, Download, Trash2, CheckCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import { QuoteForm } from '../../components/Quotes/QuoteForm';
import { useAuth } from '../../contexts/AuthContext';
import { generateQuotePDF } from '../../lib/pdfGenerator';
import api from '../../lib/api';

const STATUS_COLORS = {
  draft:    { bg: '#f1f5f9', color: '#475569', label: 'Borrador' },
  sent:     { bg: '#e0f2fe', color: '#0284c7', label: 'Enviada' },
  viewed:   { bg: '#fef08a', color: '#854d0e', label: 'Vista' },
  accepted: { bg: '#dcfce7', color: '#166534', label: 'Aceptada' },
  rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rechazada' },
  expired:  { bg: '#f4f4f5', color: '#52525b', label: 'Expirada' },
};

function formatCurrency(val) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function QuoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || user?.rol_nombre === 'Administrador';
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // ─── Fetch ───────────────────────────────────────────────
  const { data: quote, isLoading } = useQuery({
    queryKey: ['quote', id],
    queryFn: async () => {
      const { data } = await api.get(`/quotes/${id}`);
      return data.data;
    },
  });

  // ─── Mutaciones ──────────────────────────────────────────
  const updateStatusMutation = useMutation({
    mutationFn: async (status) => api.patch(`/quotes/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Estado actualizado');
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar estado'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => api.delete(`/quotes/${id}`),
    onSuccess: () => {
      toast.success('Cotización eliminada');
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      navigate('/quotes');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar'),
  });

  const handleDownloadPDF = async () => {
    const loadingToast = toast.loading('Generando y descargando PDF...');
    try {
      const response = await api.get(`/quotes/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `cotizacion-${quote.quote_number || id}.pdf`;
      link.click();
      toast.success('PDF descargado con éxito', { id: loadingToast });
    } catch (err) {
      console.error(err);
      toast.error('Error al descargar el PDF', { id: loadingToast });
    }
  };

  if (isLoading) {
    return (
      <div className="app-layout">
        <div className="empty-state"><div className="spinner" /></div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="app-layout">
        <div className="empty-state">
          <FileText size={48} className="empty-state__icon" />
          <h2 className="empty-state__title">Cotización no encontrada</h2>
          <button className="btn btn--primary" onClick={() => navigate('/quotes')}>
            <ArrowLeft size={16} /> Volver al listado
          </button>
        </div>
      </div>
    );
  }

  const badge = STATUS_COLORS[quote.status] || STATUS_COLORS.draft;
  const items = quote.items || [];
  const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date() && quote.status !== 'accepted';
  const displayBadge = isExpired ? STATUS_COLORS.expired : badge;

  return (
    <div className="app-layout">
      <Topbar
        title={`Cotización ${quote.quote_number}`}
        subtitle="Detalle de cotización a cliente"
        rightContent={
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
            {/* Fila 1: Navegación y acciones */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button className="btn btn--ghost btn--sm" onClick={() => navigate('/quotes')}>
                <ArrowLeft size={16} /> Volver
              </button>
              {quote.status !== 'accepted' && (
                <button
                  className="btn btn--sm"
                  style={{ background: '#d97706', color: 'white', border: 'none' }}
                  onClick={() => setIsEditModalOpen(true)}
                >
                  <Edit2 size={16} /> Editar
                </button>
              )}
              {quote.status !== 'accepted' && (
                <button
                  className="btn btn--sm"
                  style={{ background: '#16a34a', color: 'white', border: 'none' }}
                  disabled={updateStatusMutation.isPending}
                  onClick={() => {
                    if (window.confirm('¿Aprobar esta cotización?')) updateStatusMutation.mutate('accepted');
                  }}
                >
                  <CheckCircle size={16} /> Aprobar
                </button>
              )}
              {isAdmin && (
                <button
                  className="btn btn--sm"
                  style={{ background: 'var(--clr-danger, #ef4444)', color: 'white', border: 'none' }}
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm('¿Eliminar esta cotización permanentemente?')) deleteMutation.mutate();
                  }}
                >
                  <Trash2 size={16} /> {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar'}
                </button>
              )}
            </div>
            {/* Fila 2: PDF */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button className="btn btn--secondary btn--sm" onClick={handleDownloadPDF}>
                <Download size={16} /> Descargar PDF
              </button>
            </div>
          </div>
        }
      />

      <main className="main-content">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>

          {/* ── Encabezado info ──────────────────────────── */}
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <span style={{
                    fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--text-primary)',
                  }}>
                    {quote.quote_number}
                  </span>
                  <span style={{
                    padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700,
                    background: displayBadge.bg, color: displayBadge.color,
                  }}>
                    {isExpired ? 'Expirada' : displayBadge.label}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                    <Building2 size={16} />
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Empresa</div>
                      <div style={{ fontWeight: 600 }}>{quote.company_name || '—'}</div>
                    </div>
                  </div>

                  {quote.contact_name && quote.contact_name.trim() && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                      <User size={16} />
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Contacto</div>
                        <div style={{ fontWeight: 600 }}>{quote.contact_name}</div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                    <Calendar size={16} />
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Fecha de creación</div>
                      <div style={{ fontWeight: 600 }}>{formatDate(quote.created_at)}</div>
                    </div>
                  </div>

                  {quote.valid_until && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isExpired ? 'var(--clr-danger)' : 'var(--text-secondary)' }}>
                      <Calendar size={16} />
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Válida hasta</div>
                        <div style={{ fontWeight: 600 }}>{formatDate(quote.valid_until)}</div>
                      </div>
                    </div>
                  )}
                </div>

                {quote.opportunity_title && (
                  <div style={{ marginTop: '0.75rem', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                    <strong>Oportunidad:</strong> {quote.opportunity_title}
                  </div>
                )}

                {quote.notes && (
                  <div style={{ marginTop: '0.75rem', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                    <strong>Notas:</strong> {quote.notes}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Tabla de ítems ───────────────────────────── */}
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Ítems ({items.length})
            </h3>
            {items.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                Esta cotización no tiene ítems aún.
              </p>
            ) : (
              <div className="table-container">
                <table className="table" style={{ minWidth: 600 }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Descripción</th>
                      <th>Proveedor</th>
                      <th>Cant.</th>
                      <th>Precio Und.</th>
                      <th>% Ganancia</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => {
                      const margin = parseFloat(it.discount) || 0;
                      const lineTotal = (it.quantity || 0) * (it.unit_price || 0) * (1 + margin / 100);
                      return (
                        <tr key={it.id || i}>
                          <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                          <td style={{ fontWeight: 600 }}>{it.description || '—'}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{it.proveedor_nombre || '—'}</td>
                          <td>{it.quantity}</td>
                          <td>{formatCurrency(it.unit_price)}</td>
                          <td>{it.discount ? `${it.discount}%` : '—'}</td>
                          <td style={{ fontWeight: 600 }}>{formatCurrency(lineTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Resumen financiero ───────────────────────── */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Resumen Financiero
            </h3>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem',
              padding: '1.25rem', borderRadius: '10px', background: 'var(--bg-subtle, var(--bg-elevated))',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Subtotal
                </div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
                  {formatCurrency(quote.subtotal)}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  IVA ({quote.tax_rate || 19}%)
                </div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--clr-primary-500)' }}>
                  {formatCurrency(quote.tax_amount || (quote.subtotal * (quote.tax_rate || 19) / 100))}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total
                </div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--clr-success, #16a34a)' }}>
                  {formatCurrency(quote.total)}
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
      {isEditModalOpen && quote && (
        <Modal
          title={`Editar Cotización ${quote.quote_number}`}
          onClose={() => setIsEditModalOpen(false)}
          maxWidth="1100px"
        >
          <div style={{ width: '100%', minWidth: 'min(90vw, 800px)' }}>
            <QuoteForm
              quote={quote}
              onSuccess={() => {
                setIsEditModalOpen(false);
                queryClient.invalidateQueries({ queryKey: ['quote', id] });
                queryClient.invalidateQueries({ queryKey: ['quotes'] });
              }}
              onCancel={() => setIsEditModalOpen(false)}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
