import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, ClipboardList, FileText, Trash2, Eye, Edit } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import api from '../../lib/api';

const ESTADOS = ['all', 'BORRADOR', 'PENDIENTE', 'REALIZADA', 'LIQUIDADA', 'ANULADO'];
const ESTADO_BADGE = { BORRADOR: 'gray', PENDIENTE: 'warning', REALIZADA: 'primary', LIQUIDADA: 'green', ANULADO: 'danger' };

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getUTCDate()).padStart(2,'0')}/${String(dt.getUTCMonth()+1).padStart(2,'0')}/${dt.getUTCFullYear()}`;
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

  const items = data?.data || [];

  return (
    <div className="app-layout">
      <Sidebar />
      <Topbar
        title="Servicios / Remisiones"
        subtitle={`${items.length} remisiones`}
        rightContent={
          <button className="btn btn--primary" onClick={() => navigate('/servicios/nueva')}>
            <Plus size={16} /> Nueva Remisión
          </button>
        }
      />

      <main className="main-content">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 420 }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Buscar por No. remisión o empresa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="input" style={{ width: 'auto' }} value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
            <option value="all">Todos los estados</option>
            {ESTADOS.slice(1).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
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
                  <th>No. Remisión</th>
                  <th>Fecha</th>
                  <th>Empresa</th>
                  <th>Servicio</th>
                  <th>Equipo</th>
                  <th>Total Neto</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td><code style={{ fontWeight: 700, fontSize: '12px' }}>{item.numero_remision}</code></td>
                    <td>{formatDate(item.fecha_servicio)}</td>
                    <td style={{ fontWeight: 600 }}>{item.empresa_nombre}</td>
                    <td style={{ fontSize: '11px', color: 'var(--text-secondary)', maxWidth: 200 }}>
                      {item.servicio_nombre?.substring(0, 60)}{item.servicio_nombre?.length > 60 ? '...' : ''}
                    </td>
                    <td style={{ fontSize: '11px' }}>{item.equipo_marca} {item.equipo_modelo}</td>
                    <td style={{ fontWeight: 600 }}>{formatCOP(item.total_neto)}</td>
                    <td>
                      <span className={`badge badge--${ESTADO_BADGE[item.estado] || 'gray'}`}>{item.estado}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn--ghost btn--sm" title="Ver Detalle" onClick={() => navigate(`/servicios/${item.id}`)}>
                          <Eye size={14} />
                        </button>
                        {(item.estado === 'BORRADOR' || item.estado === 'PENDIENTE' || item.estado === 'REALIZADA') && (
                          <button className="btn btn--ghost btn--sm" title="Editar" onClick={() => navigate(`/servicios/${item.id}/editar`)}>
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
                            onClick={() => { if (window.confirm('¿Anular esta remisión?')) deleteMutation.mutate(item.id); }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
