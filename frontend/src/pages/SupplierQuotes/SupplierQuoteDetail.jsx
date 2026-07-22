import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Edit2, XCircle, Package, Calendar, Truck, User, Phone, Clock, CreditCard, CheckCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { useAuth } from '../../contexts/AuthContext';
import { generateSupplierQuotePDF } from '../../lib/pdfGenerator';
import api from '../../lib/api';

const ESTADO_BADGE = {
  BORRADOR:  { bg: '#f1f5f9', color: '#475569', label: 'Borrador' },
  CREADO:    { bg: '#e0f2fe', color: '#0284c7', label: 'Creado' },
  APROBADO:  { bg: '#dcfce7', color: '#166534', label: 'Aprobado' },
  ANULADO:   { bg: '#fee2e2', color: '#991b1b', label: 'Anulado' },
};

const ESTADO_COMERCIAL_BADGE = {
  EN_ESPERA: { bg: '#fef9c3', color: '#92400e', label: 'En espera' },
  ACEPTADO:  { bg: '#dcfce7', color: '#166534', label: 'Aceptado' },
  RECHAZADO: { bg: '#fee2e2', color: '#991b1b', label: 'Rechazado' },
};

const FORMAS_PAGO_LABEL = {
  CONTADO:          'Contado',
  '15_DIAS':        '15 días',
  '30_DIAS':        '30 días',
  '45_DIAS':        '45 días',
  '60_DIAS':        '60 días',
  '90_DIAS':        '90 días',
  CREDITO_ESPECIAL: 'Crédito especial',
};

function formatCurrency(val) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function SupplierQuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || user?.rol_nombre === 'Administrador';

  // ─── Fetch ───────────────────────────────────────────────
  const { data: quote, isLoading } = useQuery({
    queryKey: ['supplier-quote', id],
    queryFn: async () => {
      const { data } = await api.get(`/supplier-quotes/${id}`);
      return data.data;
    },
  });

  // ─── Mutaciones de estado ────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: async () => api.patch(`/supplier-quotes/${id}`, { estado: 'ANULADO' }),
    onSuccess: () => {
      toast.success('Cotización anulada');
      queryClient.invalidateQueries({ queryKey: ['supplier-quote', id] });
      queryClient.invalidateQueries({ queryKey: ['supplier-quotes'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al anular'),
  });

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
          <Package size={48} className="empty-state__icon" />
          <h2 className="empty-state__title">Cotización no encontrada</h2>
          <button className="btn btn--primary" onClick={() => navigate('/supplier-quotes')}>
            <ArrowLeft size={16} /> Volver al listado
          </button>
        </div>
      </div>
    );
  }

  const badge = ESTADO_BADGE[quote.estado] || ESTADO_BADGE.BORRADOR;
  const items = quote.items || [];
  const canCancel = isAdmin && quote.estado !== 'ANULADO';
  const canEdit = quote.estado === 'BORRADOR';

  return (
    <div className="app-layout">
      <Topbar
        title={`Cotización ${quote.consecutivo}`}
        subtitle="Detalle de cotización a proveedor"
        rightContent={
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
            {/* Fila 1: Navegación y estado */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button className="btn btn--ghost btn--sm" onClick={() => navigate('/supplier-quotes')}>
                <ArrowLeft size={16} /> Volver
              </button>
              {canEdit && (
                <button className="btn btn--ghost btn--sm" onClick={() => navigate(`/supplier-quotes/${id}/edit`)}>
                  <Edit2 size={16} /> Editar
                </button>
              )}
              {canCancel && quote.estado !== 'ANULADO' && (
                <button
                  className="btn btn--sm"
                  style={{ background: 'var(--clr-danger, #ef4444)', color: 'white', border: 'none' }}
                  disabled={cancelMutation.isPending}
                  onClick={() => {
                    if (window.confirm('¿Anular esta cotización?')) cancelMutation.mutate();
                  }}
                >
                  <XCircle size={16} /> {cancelMutation.isPending ? 'Anulando…' : 'Anular'}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button className="btn btn--secondary btn--sm" onClick={() => generateSupplierQuotePDF(quote)}>
                Descargar PDF
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
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {quote.consecutivo}
                  </span>
                  <span style={{
                    padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700,
                    background: badge.bg, color: badge.color,
                  }}>
                    {badge.label}
                  </span>
                  {quote.estado_comercial && (() => {
                    const ecb = ESTADO_COMERCIAL_BADGE[quote.estado_comercial];
                    return ecb ? (
                      <span style={{
                        padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700,
                        background: ecb.bg, color: ecb.color,
                      }}>{ecb.label}</span>
                    ) : null;
                  })()}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                    <Truck size={16} />
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Proveedor</div>
                      <div style={{ fontWeight: 600 }}>{quote.provider_name || '—'}</div>
                      {quote.provider_nit && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>NIT: {quote.provider_nit}</div>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                    <User size={16} />
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Contacto</div>
                      <div style={{ fontWeight: 600 }}>{quote.contact_name?.trim() || '—'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                    <Phone size={16} />
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Teléfono</div>
                      <div style={{ fontWeight: 600 }}>{quote.telefono_contacto || '—'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                    <Calendar size={16} />
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Fecha creación</div>
                      <div style={{ fontWeight: 600 }}>{formatDate(quote.created_at)}</div>
                    </div>
                  </div>

                  {quote.validez_oferta && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                      <Clock size={16} />
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Validez oferta</div>
                        <div style={{ fontWeight: 600 }}>{quote.validez_oferta} días</div>
                      </div>
                    </div>
                  )}

                  {quote.forma_pago && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                      <CreditCard size={16} />
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Forma de pago</div>
                        <div style={{ fontWeight: 600 }}>{FORMAS_PAGO_LABEL[quote.forma_pago] || quote.forma_pago}</div>
                      </div>
                    </div>
                  )}

                  {quote.tiempo_envio && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                      <Clock size={16} />
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Tiempo de envío</div>
                        <div style={{ fontWeight: 600 }}>{quote.tiempo_envio}</div>
                      </div>
                    </div>
                  )}
                </div>
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
                <table className="table" style={{ minWidth: 700 }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Ítem / Descripción</th>
                      <th>Código</th>
                      <th>Cant.</th>
                      <th>V. Unitario</th>
                      <th>Descuento</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => {
                      const total = Math.max(0, (it.cantidad || 0) * (it.precio_unitario || 0) - (it.descuento || 0));
                      return (
                        <tr key={it.id || i}>
                          <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                          <td style={{ fontWeight: 600 }}>{it.descripcion_manual || it.inventario_nombre || '—'}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{it.codigo || '—'}</td>
                          <td>{it.cantidad}</td>
                          <td>{formatCurrency(it.precio_unitario)}</td>
                          <td style={{ color: 'var(--clr-danger, #ef4444)' }}>{formatCurrency(it.descuento || 0)}</td>
                          <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                        SUBTOTAL
                      </td>
                      <td style={{ fontWeight: 800, fontSize: 'var(--text-base)', color: 'var(--text-primary)', padding: '0.75rem 0.5rem' }}>
                        {formatCurrency(quote.subtotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* ── Resumen financiero ───────────────────────── */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Resumen
            </h3>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem',
              padding: '1.25rem', borderRadius: '10px', background: 'var(--bg-subtle, var(--bg-elevated))',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total ítems
                </div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
                  {items.length}
                </div>
              </div>
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
                  IVA ({quote.iva || 0}%)
                </div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
                  {formatCurrency((quote.total || 0) - (quote.subtotal || 0))}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Cotización
                </div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--clr-success, #16a34a)' }}>
                  {formatCurrency(quote.total)}
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
