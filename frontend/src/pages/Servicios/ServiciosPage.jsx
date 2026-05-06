import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, ClipboardList, FileText, Trash2, Eye, Edit, Calendar, Building2, Truck, DollarSign } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import api from '../../lib/api';

const ESTADOS = ['all', 'BORRADOR', 'PENDIENTE', 'REALIZADA', 'LIQUIDADA', 'ANULADO'];
const ESTADO_BADGE = { BORRADOR: 'gray', PENDIENTE: 'warning', REALIZADA: 'primary', LIQUIDADA: 'green', ANULADO: 'danger' };
const ESTADO_COLOR = { BORRADOR: '#64748b', PENDIENTE: '#f59e0b', REALIZADA: '#6366f1', LIQUIDADA: '#22c55e', ANULADO: '#ef4444' };

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`;
}
function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
}

export function ServiciosPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [filterEstado, setFilterEstado] = React.useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['servicios', search, filterEstado],
    queryFn: async () => {
      const params = { limit: 100 };
      if (search) params.search = search;
      if (filterEstado !== 'all') params.estado = filterEstado;
      const { data } = await api.get('/servicios', { params });
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/servicios/${id}`),
    onSuccess: () => { toast.success('Remisión anulada'); qc.invalidateQueries({ queryKey: ['servicios'] }); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al anular'),
  });

  const items = [...(data?.data || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Totales por estado
  const totales = React.useMemo(() => {
    const t = { total: items.length, monto: 0 };
    items.forEach(i => { t.monto += parseFloat(i.total_neto || 0); });
    return t;
  }, [items]);

  return (
    <div className="app-layout">
      <Sidebar />
      <Topbar
        title="Servicios / Remisiones"
        subtitle={`${totales.total} remisiones • ${formatCOP(totales.monto)} total`}
        rightContent={
          <button className="btn btn--primary" onClick={() => navigate('/servicios/nueva')}>
            <Plus size={16} /> Nueva Remisión
          </button>
        }
      />

      <main className="main-content">

        {/* ── Filtros ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 400 }}>
            <Search size={15} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Buscar por No. remisión o empresa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Filtros de estado como botones */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {ESTADOS.map(s => (
              <button
                key={s}
                onClick={() => setFilterEstado(s)}
                style={{
                  padding: '0.35rem 0.875rem',
                  borderRadius: 20,
                  border: `1px solid ${filterEstado === s ? (ESTADO_COLOR[s] || 'var(--clr-primary-500)') : 'var(--border-color)'}`,
                  background: filterEstado === s ? `${(ESTADO_COLOR[s] || 'var(--clr-primary-500)')}18` : 'transparent',
                  color: filterEstado === s ? (ESTADO_COLOR[s] || 'var(--clr-primary-500)') : 'var(--text-muted)',
                  fontWeight: filterEstado === s ? 700 : 400,
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {s === 'all' ? 'Todos' : s}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Sin remisiones</h2>
            <p className="empty-state__desc">Crea la primera remisión de servicio para comenzar.</p>
            <button className="btn btn--primary" onClick={() => navigate('/servicios/nueva')}><Plus size={16} /> Nueva Remisión</button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 100 }}>No. Rem.</th>
                  <th style={{ width: 100 }}><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} />Fecha</span></th>
                  <th><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={12} />Empresa</span></th>
                  <th><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Truck size={12} />Equipo / Servicio</span></th>
                  <th style={{ width: 90, textAlign: 'center' }}>Horas</th>
                  <th style={{ width: 120, textAlign: 'right' }}><span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}><DollarSign size={12} />Total Neto</span></th>
                  <th style={{ width: 110, textAlign: 'center' }}>Estado</th>
                  <th style={{ width: 100, textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const color = ESTADO_COLOR[item.estado] || '#64748b';
                  return (
                    <tr
                      key={item.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/servicios/${item.id}`)}
                    >
                      {/* No. Remisión */}
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <code
                            style={{ fontWeight: 800, fontSize: '13px', color: 'var(--clr-primary-400)', cursor: 'pointer' }}
                            onClick={() => navigate(`/servicios/${item.id}`)}
                          >
                            {item.numero_remision}
                          </code>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {new Date(item.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                          </span>
                        </div>
                      </td>

                      {/* Fecha servicio */}
                      <td>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{formatDate(item.fecha_servicio)}</span>
                      </td>

                      {/* Empresa */}
                      <td>
                        <span style={{ fontWeight: 600, fontSize: 13, display: 'block' }}>{item.empresa_nombre}</span>
                        {item.empresa_nit && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>NIT: {item.empresa_nit}</span>
                        )}
                      </td>

                      {/* Equipo / Servicio */}
                      <td>
                        <span style={{ fontWeight: 600, fontSize: 12, display: 'block' }}>
                          {item.equipo_marca} {item.equipo_modelo}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.servicio_codigo} — {item.servicio_nombre}
                        </span>
                      </td>

                      {/* Horas */}
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{item.cantidad_horas}h</span>
                      </td>

                      {/* Total Neto */}
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 800, fontSize: 14, color: color }}>
                          {formatCOP(item.total_neto)}
                        </span>
                      </td>

                      {/* Estado */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge badge--${ESTADO_BADGE[item.estado] || 'gray'}`}
                          style={{ fontSize: 11 }}>
                          {item.estado}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.2rem', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn--ghost btn--sm"
                            title="Ver Detalle"
                            onClick={() => navigate(`/servicios/${item.id}`)}
                          >
                            <Eye size={14} />
                          </button>
                          {(item.estado === 'BORRADOR' || item.estado === 'PENDIENTE' || item.estado === 'REALIZADA') && (
                            <button
                              className="btn btn--ghost btn--sm"
                              title="Editar"
                              onClick={() => navigate(`/servicios/${item.id}/editar`)}
                            >
                              <Edit size={14} />
                            </button>
                          )}
                          <button
                            className="btn btn--ghost btn--sm"
                            title="Descargar PDF"
                            onClick={async () => {
                              try {
                                const res = await api.get(`/servicios/${item.id}/pdf`, { responseType: 'blob' });
                                const url = URL.createObjectURL(res.data);
                                const a = document.createElement('a');
                                a.href = url; a.download = `Remision-${item.numero_remision}.pdf`; a.click();
                              } catch { toast.error('Error generando PDF'); }
                            }}
                          >
                            <FileText size={14} />
                          </button>
                          {item.estado !== 'ANULADO' && (
                            <button
                              className="btn btn--ghost btn--sm"
                              style={{ color: 'var(--clr-danger)' }}
                              title="Anular"
                              onClick={() => {
                                if (window.confirm('¿Anular esta remisión?')) {
                                  deleteMutation.mutate(item.id);
                                }
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
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
    </div>
  );
}
