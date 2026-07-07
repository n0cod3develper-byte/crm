import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, Search, FileText, Trash2, Eye, Edit2,
  ChevronLeft, ChevronRight, Filter, Package, Download
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import api from '../../lib/api';
import { generateSupplierQuotePDF } from '../../lib/pdfGenerator';

const ESTADO_BADGE = {
  BORRADOR:  { bg: 'var(--badge-draft-bg, #f1f5f9)',   color: 'var(--badge-draft-color, #475569)',   label: 'Borrador' },
  CREADO:    { bg: 'var(--badge-info-bg, #e0f2fe)',     color: 'var(--badge-info-color, #0284c7)',    label: 'Creado' },
  APROBADO:  { bg: 'var(--badge-success-bg, #dcfce7)',  color: 'var(--badge-success-color, #166534)', label: 'Aprobado' },
  ANULADO:   { bg: 'var(--badge-danger-bg, #fee2e2)',   color: 'var(--badge-danger-color, #991b1b)',  label: 'Anulado' },
};

const ESTADO_COMERCIAL_BADGE = {
  EN_ESPERA: { bg: '#fef9c3', color: '#92400e', label: 'En espera' },
  ACEPTADO:  { bg: '#dcfce7', color: '#166534', label: 'Aceptado' },
  RECHAZADO: { bg: '#fee2e2', color: '#991b1b', label: 'Rechazado' },
};

function formatCurrency(val) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

const PAGE_SIZE = 15;

export function SupplierQuotesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // ─── Filtros ─────────────────────────────────────────────
  const [search, setSearch] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('search') || '';
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [isGroupedModalOpen, setIsGroupedModalOpen] = useState(false);

  // ─── Fetch ───────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['supplier-quotes', search, statusFilter, page],
    queryFn: async () => {
      const params = { limit: PAGE_SIZE };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/supplier-quotes', { params });
      return data;
    },
  });

  // ─── Eliminar ────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/supplier-quotes/${id}`),
    onSuccess: () => {
      toast.success('Cotización eliminada');
      queryClient.invalidateQueries({ queryKey: ['supplier-quotes'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al eliminar');
    },
  });

  const handleDownloadPDF = async (id) => {
    const loadingToast = toast.loading('Generando PDF...');
    try {
      const { data } = await api.get(`/supplier-quotes/${id}`);
      generateSupplierQuotePDF(data.data, 'download');
      toast.success('PDF generado exitosamente', { id: loadingToast });
    } catch (err) {
      toast.error('Error al generar PDF', { id: loadingToast });
    }
  };

  const quotes = data?.data || [];
  const hasMore = data?.pagination?.hasMore || false;

  return (
    <div className="app-layout">
      <Topbar
        title="Cotizaciones a Proveedores"
        subtitle="Gestiona cotizaciones de compra a proveedores"
        rightContent={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn--secondary" onClick={() => setIsGroupedModalOpen(true)}>
              <FileText size={16} /> Ver por Proveedor
            </button>
            <button className="btn btn--primary" onClick={() => navigate('/supplier-quotes/new')}>
              <Plus size={16} /> Nueva Cotización
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
              placeholder="Buscar por consecutivo o proveedor…"
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
              <option value="BORRADOR">Borrador</option>
              <option value="CREADO">Creado</option>
              <option value="APROBADO">Aprobado</option>
              <option value="ANULADO">Anulado</option>
            </select>
          </div>
        </div>

        {/* ── Contenido ───────────────────────────────── */}
        {isLoading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : quotes.length === 0 ? (
          <div className="empty-state">
            <Package size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Sin cotizaciones a proveedores</h2>
            <p className="empty-state__desc">Aún no has creado ninguna cotización a proveedores. Genera la primera.</p>
            <button className="btn btn--primary" onClick={() => navigate('/supplier-quotes/new')}>
              <Plus size={16} /> Crear cotización
            </button>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table" style={{ minWidth: 800 }}>
                <thead>
                  <tr>
                    <th>Consecutivo</th>
                    <th>Nº Prov</th>
                    <th>Proveedor</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Estado Comercial</th>
                    <th>Fecha</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => {
                    const badge = ESTADO_BADGE[q.estado] || ESTADO_BADGE.BORRADOR;
                    const ecb = ESTADO_COMERCIAL_BADGE[q.estado_comercial];
                    return (
                      <tr key={q.id}>
                        <td style={{ fontWeight: 600, color: 'var(--clr-primary-500)' }}>
                          {q.consecutivo}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {q.numero_cotizacion || '—'}
                        </td>
                        <td style={{ fontWeight: 600 }}>{q.provider_name || '—'}</td>
                        <td style={{ fontWeight: 700 }}>{formatCurrency(q.subtotal)}</td>
                        <td>
                          <span style={{
                            padding: '0.25rem 0.625rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: badge.bg,
                            color: badge.color,
                          }}>
                            {badge.label}
                          </span>
                        </td>
                        <td>
                          {ecb ? (
                            <span style={{
                              padding: '0.25rem 0.625rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: ecb.bg,
                              color: ecb.color,
                            }}>
                              {ecb.label}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                          {formatDate(q.created_at)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.375rem' }}>
                            <button
                              className="btn btn--ghost btn--sm"
                              style={{ padding: '0.375rem', color: 'var(--clr-primary-500)' }}
                              onClick={() => navigate(`/supplier-quotes/${q.id}`)}
                              title="Ver detalle"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              className="btn btn--ghost btn--sm"
                              style={{ padding: '0.375rem', color: 'var(--text-secondary)' }}
                              onClick={() => handleDownloadPDF(q.id)}
                              title="Descargar PDF"
                            >
                              <Download size={16} />
                            </button>
                            <button
                              className="btn btn--ghost btn--sm"
                              style={{ padding: '0.375rem', color: 'var(--clr-primary-500)' }}
                              onClick={() => navigate(`/supplier-quotes/${q.id}/edit`)}
                              title="Editar"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              className="btn btn--ghost btn--sm"
                              style={{ padding: '0.375rem', color: 'var(--clr-danger)' }}
                              onClick={() => {
                                if (window.confirm('¿Seguro que deseas eliminar esta cotización?')) {
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

      {isGroupedModalOpen && (
        <Modal
          title="Cotizaciones por Proveedor"
          onClose={() => setIsGroupedModalOpen(false)}
          maxWidth="800px"
        >
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {quotes.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No hay cotizaciones para mostrar.</p>
            ) : (
              Object.entries(
                quotes.reduce((acc, q) => {
                  const provider = q.provider_name || 'Sin proveedor';
                  if (!acc[provider]) acc[provider] = [];
                  acc[provider].push(q);
                  return acc;
                }, {})
              ).map(([providerName, providerQuotes]) => (
                <div key={providerName} style={{ marginBottom: '1.5rem', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem 1rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{providerName}</span>
                    <span className="badge badge--primary">{providerQuotes.length}</span>
                  </div>
                  <div style={{ padding: '0.5rem' }}>
                    <table style={{ background: 'transparent', margin: 0, fontSize: 'var(--text-sm)' }}>
                      <thead>
                        <tr>
                          <th>Consecutivo</th>
                          <th>Total</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {providerQuotes.map(q => {
                          const badge = ESTADO_BADGE[q.estado] || ESTADO_BADGE.BORRADOR;
                          return (
                            <tr key={q.id}>
                              <td style={{ fontWeight: 600, color: 'var(--clr-primary-500)' }}>{q.consecutivo}</td>
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
