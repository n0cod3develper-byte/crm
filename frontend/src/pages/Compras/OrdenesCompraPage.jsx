import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, ShoppingCart, FileText, CheckCircle,
  AlertCircle, DollarSign, Package
} from 'lucide-react';
import { Topbar } from '../../components/layout/Topbar';
import api from '../../lib/api';

export function OrdenesCompraPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = React.useState('all');

  const { data: ordenes, isLoading } = useQuery({
    queryKey: ['ordenes-compra', filter],
    queryFn: async () => {
      const { data } = await api.get('/compras/oc', {
        params: { estado: filter !== 'all' ? filter : undefined }
      });
      return data.data || [];
    },
  });

  const stats = React.useMemo(() => {
    if (!ordenes || !Array.isArray(ordenes)) return { total: 0, pending: 0, received: 0 };
    return {
      total: ordenes.length,
      pending: ordenes.filter(o => ['BORRADOR', 'EN_APROBACION', 'APROBADA', 'EMITIDA'].includes(o.estado || '')).length,
      received: ordenes.filter(o => (o.estado || '').startsWith('RECIBIDA')).length
    };
  }, [ordenes]);

  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'BORRADOR':       return <span className="badge badge--gray">Borrador</span>;
      case 'EN_APROBACION':  return <span className="badge badge--warning">En Aprobación</span>;
      case 'APROBADA':       return <span className="badge badge--primary">Aprobada</span>;
      case 'EMITIDA':        return <span className="badge badge--info" style={{background: 'rgba(59,130,246,0.15)', color: '#3b82f6'}}>Emitida</span>;
      case 'RECIBIDA_PARCIAL': return <span className="badge badge--warning">Recibida Parcial</span>;
      case 'RECIBIDA_TOTAL': return <span className="badge badge--success">Recibida Total</span>;
      case 'ANULADA':        return <span className="badge badge--danger">Anulada</span>;
      default:               return <span className="badge badge--gray">{estado}</span>;
    }
  };

  const fmt = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
  const fmtDate = (d) => new Date(d).toLocaleDateString('es-CO');

  return (
    <div className="app-layout">
      <Topbar 
        title="Órdenes de Compra" 
        subtitle="Aprobación, emisión y seguimiento de compras externalizadas" 
        rightContent={
          <div className="flex items-center gap-3">
            <div className="card--interactive" style={{ padding: '0.5rem', background: 'var(--clr-primary-500)', borderRadius: 'var(--radius-md)' }}>
              <ShoppingCart color="white" size={20} />
            </div>
          </div>
        } 
      />

      <main className="main-content">
        {/* KPI Row */}
        <div className="kpi-grid mb-6">
          <div className="kpi-card">
            <span className="kpi-label">Total Órdenes</span>
            <span className="kpi-value">{stats.total}</span>
            <FileText size={40} style={{ position: 'absolute', right: -10, bottom: -10, opacity: 0.05 }} />
          </div>
          <div className="kpi-card">
            <span className="kpi-label">En Proceso</span>
            <span className="kpi-value">{stats.pending}</span>
            <DollarSign size={40} style={{ position: 'absolute', right: -10, bottom: -10, opacity: 0.05, color: 'var(--clr-warning)' }} />
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Recibidas</span>
            <span className="kpi-value">{stats.received}</span>
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
                className={`btn btn--sm ${filter === 'EN_APROBACION' ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => setFilter('EN_APROBACION')}
              >
                Pend. Aprobación
              </button>
              <button
                className={`btn btn--sm ${filter === 'EMITIDA' ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => setFilter('EMITIDA')}
              >
                Emitidas
              </button>
            </div>

            <div className="flex items-center gap-2" style={{ position: 'relative', width: 300 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
              <input 
                className="input" 
                placeholder="Buscar OC o Proveedor..." 
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
        ) : !ordenes || ordenes.length === 0 ? (
          <div className="card empty-state">
            <AlertCircle size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">No se encontraron Órdenes de Compra</h2>
            <p className="empty-state__desc">Intenta cambiar los filtros o genera una nueva desde la comparativa de cotizaciones.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Consecutivo</th>
                  <th>Proveedor</th>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((oc) => (
                  <tr key={oc.id}>
                    <td className="font-bold" style={{ color: 'var(--clr-primary-400)' }}>{oc.consecutivo}</td>
                    <td className="font-medium">{oc.proveedor_nombre || `Prov #${oc.proveedor_id}`}</td>
                    <td>{fmtDate(oc.created_at)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(oc.total)}</td>
                    <td>{getStatusBadge(oc.estado)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex justify-end gap-1">
                        <button 
                             className="btn btn--ghost btn--sm" 
                             onClick={() => navigate(`/compras/oc/${oc.id}/editar`)}
                             title="Ver Detalle / Editar"
                        >
                          <FileText size={14} />
                        </button>
                        {oc.estado === 'EMITIDA' || oc.estado === 'RECIBIDA_PARCIAL' ? (
                          <button 
                            className="btn btn--primary btn--sm"
                            onClick={() => navigate(`/compras/recepcion/${oc.id}`)}
                            title="Recibir Mercancía"
                          >
                            <Package size={14} />
                          </button>
                        ) : null}
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
