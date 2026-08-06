import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Trash2, Eye, Edit2,
  Filter, Package, Download, ArrowLeft, FilePlus
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import api from '../../lib/api';

const STATUS_COLORS = {
  BORRADOR:  { bg: 'var(--badge-draft-bg, #f1f5f9)',   color: 'var(--badge-draft-color, #475569)',   label: 'Borrador' },
  PENDIENTE: { bg: 'var(--badge-info-bg, #e0f2fe)',     color: 'var(--badge-info-color, #0284c7)',    label: 'Pendiente' },
  ACEPTADA:  { bg: 'var(--badge-success-bg, #dcfce7)',  color: 'var(--badge-success-color, #166534)', label: 'Aceptada' },
  RECHAZADA: { bg: 'var(--badge-danger-bg, #fee2e2)',   color: 'var(--badge-danger-color, #991b1b)',  label: 'Rechazada' },
};

function formatCurrency(val) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function QuotesServiciosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewingQuote, setViewingQuote] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['quotes-servicios', search, statusFilter],
    queryFn: async () => {
      const params = { limit: 50 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/quotes-servicios', { params });
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/quotes-servicios/${id}`),
    onSuccess: () => {
      toast.success('Cotización eliminada');
      queryClient.invalidateQueries({ queryKey: ['quotes-servicios'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ qId, status }) => api.patch(`/quotes-servicios/${qId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes-servicios'] });
    }
  });

  const handleViewQuote = async (q) => {
    const loadingToast = toast.loading('Cargando detalles...');
    try {
      const { data } = await api.get(`/quotes-servicios/${q.id}`);
      setViewingQuote(data);
      toast.dismiss(loadingToast);
    } catch (err) {
      toast.error('Error al cargar detalles', { id: loadingToast });
    }
  };

  const handleDownloadPDF = async (q) => {
    const loadingToast = toast.loading('Generando PDF...');
    try {
      const response = await api.get(`/quotes-servicios/${q.id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `cotizacion-servicio-${q.consecutivo}.pdf`;
      link.click();
      
      if (q.estado === 'BORRADOR') {
        statusMutation.mutate({ qId: q.id, status: 'PENDIENTE' });
      }

      toast.success('PDF descargado', { id: loadingToast });
    } catch (err) {
      toast.error('Error al descargar', { id: loadingToast });
    }
  };

  const quotes = data?.data || [];

  return (
    <div className="app-layout">
      <Topbar
        title="Cotizaciones Servicios"
        subtitle="Gestión de cotizaciones de servicios para clientes"
        rightContent={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn--secondary" onClick={() => navigate('/quotes')}>
              <ArrowLeft size={16} /> Volver
            </button>
            <button className="btn btn--primary" onClick={() => navigate('/quotes/servicios/nueva')}>
              <Plus size={16} /> Nueva Cotización
            </button>
          </div>
        }
      />

      <main className="main-content">
        {/* Filtros */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 420 }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Buscar por consecutivo o empresa…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              className="input"
              style={{ width: 160 }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="BORRADOR">Borrador</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="ACEPTADA">Aceptada</option>
              <option value="RECHAZADA">Rechazada</option>
            </select>
          </div>
        </div>

        {/* Contenido */}
        {isLoading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : quotes.length === 0 ? (
          <div className="empty-state">
            <Package size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Sin cotizaciones de servicio</h2>
            <p className="empty-state__desc">Crea la primera cotización de servicio para un cliente.</p>
            <button className="btn btn--primary" onClick={() => navigate('/quotes/servicios/nueva')}>
              <Plus size={16} /> Crear cotización
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Consecutivo</th>
                  <th>Fecha</th>
                  <th>Empresa</th>
                  <th>Contacto</th>
                  <th>Asunto</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => {
                  const st = STATUS_COLORS[q.estado] || STATUS_COLORS.BORRADOR;
                  return (
                    <tr key={q.id}>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{q.consecutivo}</td>
                      <td>{formatDate(q.fecha)}</td>
                      <td>{q.company_name || '—'}</td>
                      <td>{q.contact_name || '—'}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {q.asunto || '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(q.total)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          background: st.bg, color: st.color,
                          padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600
                        }}>
                          {st.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                          <button className="btn-icon" title="Ver Detalles"
                            onClick={() => handleViewQuote(q)}>
                            <Eye size={14} />
                          </button>
                          <button className="btn-icon" title="Ver/Editar"
                            onClick={() => navigate(`/quotes/servicios/${q.id}`)}>
                            <Edit2 size={14} />
                          </button>
                          <button className="btn-icon" title="Descargar PDF"
                            onClick={() => handleDownloadPDF(q)}>
                            <Download size={14} />
                          </button>
                          {q.estado === 'ACEPTADA' && (
                            <button className="btn-icon" title="Convertir a Remisión"
                              style={{ color: '#16a34a' }}
                              onClick={async () => {
                                try {
                                  const { data: fullQuote } = await api.get(`/quotes-servicios/${q.id}`);
                                  navigate('/servicios/nueva', { state: { prefillFromQuote: fullQuote } });
                                } catch (err) {
                                  toast.error('Error al cargar cotización');
                                }
                              }}>
                              <FilePlus size={14} />
                            </button>
                          )}
                          <button className="btn-icon btn-icon--danger" title="Eliminar"
                            onClick={() => {
                              if (confirm(`¿Eliminar cotización ${q.consecutivo}?`)) deleteMutation.mutate(q.id);
                            }}>
                            <Trash2 size={14} />
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
      </main>

      {viewingQuote && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#ffffff', color: '#111827', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <button style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }} onClick={() => setViewingQuote(null)}>
              <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>&times;</span>
            </button>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#111827' }}>
              <FilePlus size={24} style={{ color: '#0ea5e9' }} />
              Detalles Cotización {viewingQuote.consecutivo}
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
              <div>
                <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.25rem' }}>Empresa</p>
                <p style={{ fontWeight: 600, color: '#111827' }}>{viewingQuote.company_name || '—'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.25rem' }}>Contacto</p>
                <p style={{ fontWeight: 600, color: '#111827' }}>{viewingQuote.contact_name || '—'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.25rem' }}>Asunto</p>
                <p style={{ fontWeight: 600, color: '#111827' }}>{viewingQuote.asunto || '—'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.25rem' }}>Estado</p>
                <p style={{ fontWeight: 600, color: '#111827' }}>{viewingQuote.estado || '—'}</p>
              </div>
            </div>

            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', color: '#111827' }}>Ítems</h3>
            <div style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem', color: '#374151', fontWeight: 600 }}>Descripción</th>
                    <th style={{ padding: '0.75rem 1rem', color: '#374151', fontWeight: 600, textAlign: 'center' }}>Cant.</th>
                    <th style={{ padding: '0.75rem 1rem', color: '#374151', fontWeight: 600, textAlign: 'right' }}>V. Unitario</th>
                    <th style={{ padding: '0.75rem 1rem', color: '#374151', fontWeight: 600, textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingQuote.items?.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', background: '#ffffff' }}>
                      <td style={{ padding: '0.75rem 1rem', color: '#111827' }}>
                        {it.servicio_nombre && <div style={{ fontWeight: 600, color: '#0ea5e9', marginBottom: '0.25rem' }}>{it.servicio_nombre}</div>}
                        {it.descripcion || '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#111827', textAlign: 'center' }}>{it.cantidad}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#111827', textAlign: 'right' }}>{formatCurrency(it.valor_unitario)}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#111827', textAlign: 'right' }}>{formatCurrency(it.subtotal)}</td>
                    </tr>
                  ))}
                  {(!viewingQuote.items || viewingQuote.items.length === 0) && (
                    <tr>
                      <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>No hay ítems en esta cotización</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '2rem', fontSize: '1.1rem' }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>Subtotal</p>
                <p style={{ fontWeight: 600, color: '#111827' }}>{formatCurrency(viewingQuote.subtotal)}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>IVA</p>
                <p style={{ fontWeight: 600, color: '#111827' }}>{formatCurrency(viewingQuote.iva_valor)}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: '#0ea5e9', fontSize: '0.85rem' }}>Total</p>
                <p style={{ fontWeight: 700, color: '#0ea5e9' }}>{formatCurrency(viewingQuote.total)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
