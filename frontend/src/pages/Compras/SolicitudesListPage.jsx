import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, ShoppingBag, FileText, Clock, CheckCircle,
  AlertCircle, ArrowRight, Send
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Sidebar } from '../../components/layout/Sidebar';
import api from '../../lib/api';

export function SolicitudesListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = React.useState('all');

  const { data: solicitudes, isLoading } = useQuery({
    queryKey: ['solicitudes-compra', filter],
    queryFn: async () => {
      const { data } = await api.get('/compras/solicitudes', {
        params: { estado: filter !== 'all' ? filter : undefined }
      });
      return data.data || [];
    },
  });

  const enviarMut = useMutation({
    mutationFn: (id) => api.post(`/compras/solicitudes/${id}/enviar`),
    onSuccess: () => {
      toast.success('Solicitud enviada a cotización');
      qc.invalidateQueries({ queryKey: ['solicitudes-compra'] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al enviar'),
  });

  const stats = React.useMemo(() => {
    if (!solicitudes) return { total: 0, pending: 0, closed: 0 };
    return {
      total: solicitudes.length,
      pending: solicitudes.filter(s => ['BORRADOR', 'EN_COTIZACION'].includes(s.estado)).length,
      closed: solicitudes.filter(s => s.estado === 'OC_GENERADA').length
    };
  }, [solicitudes]);

  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'BORRADOR':      return <span className="badge badge--gray">Borrador</span>;
      case 'EN_COTIZACION': return <span className="badge badge--warning">En Cotización</span>;
      case 'OC_GENERADA':   return <span className="badge badge--success">OC Generada</span>;
      default:              return <span className="badge badge--gray">{estado}</span>;
    }
  };

  const fmtDate = (d) => new Date(d).toLocaleDateString('es-CO');

  return (
    <div className="app-layout">
      <Sidebar />
      <header className="header">
        <div className="flex items-center gap-3">
          <div className="card--interactive" style={{ padding: '0.5rem', background: 'var(--clr-primary-500)', borderRadius: 'var(--radius-md)' }}>
             <ShoppingBag color="white" size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Solicitudes de Compra</h1>
            <p className="text-sm text-muted">Gestiona los requerimientos internos de materiales y servicios</p>
          </div>
        </div>
        <button className="btn btn--primary" onClick={() => navigate('/compras/solicitudes/nueva')}>
          <Plus size={18} /> Nueva Solicitud
        </button>
      </header>

      <main className="main-content">
        {/* KPI Row */}
        <div className="kpi-grid mb-6">
          <div className="kpi-card">
            <span className="kpi-label">Total Solicitudes</span>
            <span className="kpi-value">{stats.total}</span>
            <FileText size={40} style={{ position: 'absolute', right: -10, bottom: -10, opacity: 0.05 }} />
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Pendientes / Cotizando</span>
            <span className="kpi-value">{stats.pending}</span>
            <Clock size={40} style={{ position: 'absolute', right: -10, bottom: -10, opacity: 0.05, color: 'var(--clr-warning)' }} />
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Ordenadas / Cerradas</span>
            <span className="kpi-value">{stats.closed}</span>
            <CheckCircle size={40} style={{ position: 'absolute', right: -10, bottom: -10, opacity: 0.05, color: 'var(--clr-success)' }} />
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="card mb-6" style={{ padding: '0.75rem 1.25rem' }}>
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <button
                className={`btn btn--sm ${filter === 'all' ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => setFilter('all')}
              >
                Todas
              </button>
              <button
                className={`btn btn--sm ${filter === 'BORRADOR' ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => setFilter('BORRADOR')}
              >
                Borradores
              </button>
              <button
                className={`btn btn--sm ${filter === 'EN_COTIZACION' ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => setFilter('EN_COTIZACION')}
              >
                En Cotización
              </button>
            </div>

            <div className="flex items-center gap-2" style={{ position: 'relative', width: 300 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
              <input 
                className="input" 
                placeholder="Buscar por consecutivo..." 
                style={{ paddingLeft: '2rem', height: 36, fontSize: '13px' }} 
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        {isLoading ? (
          <div className="empty-state">
            <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
          </div>
        ) : !solicitudes || solicitudes.length === 0 ? (
          <div className="card empty-state">
            <AlertCircle size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">No se encontraron solicitudes</h2>
            <p className="empty-state__desc">Intenta cambiar los filtros o crea una nueva solicitud de compra.</p>
            <button className="btn btn--primary" onClick={() => navigate('/compras/solicitudes/nueva')}>
              Crear primera solicitud
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Consecutivo</th>
                  <th>Solicitante</th>
                  <th>Área</th>
                  <th>Fecha Requerida</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map((s) => (
                  <tr key={s.id}>
                    <td className="font-bold" style={{ color: 'var(--clr-primary-400)' }}>{s.consecutivo}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'grid', placeItems: 'center', fontSize: '10px', fontWeight: 600 }}>
                          {(s.solicitante || 'A').charAt(0)}
                        </div>
                        {s.solicitante || 'Admin'}
                      </div>
                    </td>
                    <td>{s.area_solicitante}</td>
                    <td>{fmtDate(s.fecha_requerida)}</td>
                    <td>
                      <span className={`badge ${s.prioridad === 'ALTA' || s.prioridad === 'URGENTE' ? 'badge--danger' : 'badge--primary'}`}>
                        {s.prioridad}
                      </span>
                    </td>
                    <td>{getStatusBadge(s.estado)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex justify-end gap-1">
                        {s.estado === 'BORRADOR' && (
                          <button 
                            className="btn btn--secondary btn--sm"
                            onClick={() => enviarMut.mutate(s.id)}
                            title="Enviar a Cotización"
                            disabled={enviarMut.isPending}
                          >
                            <Send size={14} />
                          </button>
                        )}
                        <button 
                             className="btn btn--ghost btn--sm" 
                             onClick={() => navigate(`/compras/solicitudes/${s.id}/editar`)}
                             title="Editar o Ver solicitud"
                        >
                          <FileText size={14} />
                        </button>
                        {s.estado === 'EN_COTIZACION' && (
                          <button 
                            className="btn btn--primary btn--sm"
                            onClick={() => navigate(`/compras/cotizaciones/comparativa/${s.id}`)}
                            title="Comparar cotizaciones"
                          >
                            <ArrowRight size={14} />
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
