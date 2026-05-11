import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  FileText, 
  ShoppingCart, 
  Clock, 
  CheckCircle2, 
  ArrowUpRight, 
  Plus, 
  Users,
  Search,
  ChevronRight
} from 'lucide-react';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import api from '../../lib/api';
import { NavLink } from 'react-router-dom';

function KpiCard({ label, value, subtext, icon: Icon, color }) {
  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: color
        }}>
          <Icon size={20} />
        </div>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
        {value}
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        {subtext}
      </div>
    </div>
  );
}

function ShortcutCard({ title, description, to, icon: Icon, color }) {
  return (
    <NavLink to={to} className="card hover-lift" style={{ 
      padding: '1.25rem', 
      textDecoration: 'none', 
      display: 'flex', 
      flexDirection: 'column',
      gap: '0.75rem',
      border: '1px solid var(--border-color)',
      transition: 'all 0.2s ease'
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: `${color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: color
      }}>
        <Icon size={18} />
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{description}</div>
      </div>
    </NavLink>
  );
}

export const DashboardComprasPage = () => {
  const { data: solicitudes, isLoading: loadingSols } = useQuery({
    queryKey: ['solicitudes-compra'],
    queryFn: async () => {
      const { data } = await api.get('/compras/solicitudes');
      return data.data || [];
    }
  });

  const { data: ordenes, isLoading: loadingOcs } = useQuery({
    queryKey: ['ordenes-compra'],
    queryFn: async () => {
      const { data } = await api.get('/compras/oc');
      return data.data || [];
    }
  });

  const { data: proveedores, isLoading: loadingProvs } = useQuery({
    queryKey: ['proveedores'],
    queryFn: async () => {
      const { data } = await api.get('/proveedores');
      return (data.data || data) || [];
    }
  });

  const stats = React.useMemo(() => {
    const solList = Array.isArray(solicitudes) ? solicitudes : [];
    const ocList = Array.isArray(ordenes) ? ordenes : [];
    const provList = Array.isArray(proveedores) ? proveedores : [];

    const totalBudget = ocList.reduce((acc, oc) => acc + parseFloat(oc.total || 0), 0);
    const fmtBudget = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(totalBudget);

    return {
      solCount: solList.length,
      solPending: solList.filter(s => s.estado === 'BORRADOR').length,
      ocCount: ocList.length,
      ocActive: ocList.filter(o => ['EN_APROBACION', 'APROBADA', 'EMITIDA'].includes(o.estado)).length,
      provCount: provList.length,
      totalBudget: fmtBudget,
      recentSols: solList.slice(0, 5)
    };
  }, [solicitudes, ordenes, proveedores]);

  const kpis = [
    { label: 'Solicitudes', value: stats.solCount, subtext: `${stats.solPending} borradores pendientes`, icon: FileText, color: '#6366f1' },
    { label: 'O. de Compra', value: stats.ocCount, subtext: `${stats.ocActive} en proceso`, icon: ShoppingCart, color: '#22c55e' },
    { label: 'Proveedores', value: stats.provCount, subtext: 'Activos en sistema', icon: Users, color: '#f59e0b' },
    { label: 'Ejecutado', value: stats.totalBudget, subtext: 'Total órdenes de compra', icon: ArrowUpRight, color: '#ec4899' },
  ];

  if (loadingSols || loadingOcs || loadingProvs) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content flex justify-center items-center" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <div className="spinner" />
        </main>
      </div>
    );
  }

  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'BORRADOR':      return <span className="badge badge--gray">Borrador</span>;
      case 'EN_COTIZACION': return <span className="badge badge--warning">En Cotización</span>;
      case 'OC_GENERADA':   return <span className="badge badge--success">OC Generada</span>;
      default:              return <span className="badge badge--gray">{estado}</span>;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />

            <Topbar 
  title="Módulo de Compras"
  subtitle="Gestión de solicitudes, cotizaciones y órdenes de compra"
  rightContent={
    <div style={{ display: 'flex', gap: '0.75rem' }}>
      <NavLink
        to="/compras/solicitudes/nueva"
        className="btn btn--primary"
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
      >
        <Plus size={18} />
        Nueva Solicitud
      </NavLink>
    </div>
  }
/>

      <main className="main-content">
        {/* KPI Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {kpis.map((kpi, i) => (
            <KpiCard key={i} {...kpi} />
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          {/* Recent Activity / Table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Solicitudes Recientes</h2>
              <NavLink to="/compras/solicitudes" style={{ fontSize: 'var(--text-sm)', color: 'var(--clr-primary-500)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                Ver todas <ChevronRight size={16} />
              </NavLink>
            </div>
            
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Consecutivo</th>
                    <th>Área</th>
                    <th>Solicitante</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentSols.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No hay solicitudes registradas
                      </td>
                    </tr>
                  ) : stats.recentSols.map((sol) => (
                    <tr key={sol.id}>
                      <td style={{ fontWeight: 600, color: 'var(--clr-primary-500)' }}>
                        <NavLink to={`/compras/solicitudes/${sol.id}/editar`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {sol.consecutivo}
                        </NavLink>
                      </td>
                      <td>{sol.area_solicitante}</td>
                      <td>{sol.solicitante || 'Admin'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                        {new Date(sol.created_at).toLocaleDateString()}
                      </td>
                      <td>{getStatusBadge(sol.estado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem' }}>Accesos Rápidos</h2>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <ShortcutCard 
                  title="Catálogo de Proveedores" 
                  description="Gestiona tu base de suministros" 
                  to="/proveedores" 
                  icon={Users} 
                  color="#6366f1" 
                />
                <ShortcutCard 
                  title="Órdenes de Compra" 
                  description="Seguimiento de pedidos activos" 
                  to="/compras/oc" 
                  icon={ShoppingCart} 
                  color="#22c55e" 
                />
                <ShortcutCard 
                  title="Aprobaciones" 
                  description="Centro de control de gastos" 
                  to="/compras/aprobaciones" 
                  icon={CheckCircle2} 
                  color="#f59e0b" 
                />
              </div>
            </div>

            {/* Status Info */}
            <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-color)' }}>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={16} color="var(--text-muted)" />
                Próximas Entregas
              </h3>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                No hay entregas programadas para hoy.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
