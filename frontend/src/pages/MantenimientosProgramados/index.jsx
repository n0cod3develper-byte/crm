import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Calendar, ListChecks, ClipboardList, History, RefreshCw, CalendarClock } from 'lucide-react';
import PlanesMantenimiento from './PlanesMantenimiento/PlanesLista';
import OrdenesMantenimiento from './OrdenesMantenimiento/OrdenesLista';
import CalendarioMantenimientos from './Calendario/CalendarioMantenimientos';
import HistorialMantenimientos from './Historial/HistorialMantenimientos';
import { KpiCards } from '../../components/MantenimientosProgramados/KpiCards';
import { mpService } from '../../services/mantenimientosProgramadosService';
import { Topbar } from '../../components/layout/Topbar';
import toast from 'react-hot-toast';

const TABS = [
  { label: 'Planes',     path: '/mantenimientos-programados/planes',     icon: ListChecks },
  { label: 'Órdenes',    path: '/mantenimientos-programados/ordenes',    icon: ClipboardList },
  { label: 'Calendario', path: '/mantenimientos-programados/calendario', icon: Calendar },
  { label: 'Historial',  path: '/mantenimientos-programados/historial',  icon: History },
];

export default function MantenimientosProgramados() {
  const location = useLocation();
  const [kpis, setKpis] = useState(null);

  useEffect(() => {
    const isRoot = /^\/mantenimientos-programados\/?$/.test(location.pathname);
    if (isRoot) {
      mpService.getKpis()
        .then(res => setKpis(res.data?.data))
        .catch(() => {});
    }
  }, [location.pathname]);

  return (
    <div className="app-layout">
      <Topbar
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarClock size={22} color="var(--clr-primary-400)" />
            <span>Prog. Mantenimientos</span>
          </div>
        }
        subtitle="Planes, órdenes, calendario e historial"
      />
      <main className="main-content" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '1px', borderBottom: '1px solid var(--border-color)', padding: '0 1.5rem', paddingTop: '1rem', background: 'var(--bg-surface)' }}>
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <NavLink
                key={t.path}
                to={t.path}
                className={() => `btn btn--ghost btn--sm`}
                style={({ isActive }) => ({
                  padding: '0.625rem 1rem', borderRadius: 0,
                  borderBottom: isActive ? '2px solid var(--clr-primary-500)' : '2px solid transparent',
                  color: isActive ? 'var(--clr-primary-500)' : 'var(--text-muted)',
                  fontWeight: isActive ? 700 : 500,
                  marginBottom: '-1px',
                  textDecoration: 'none',
                })}
              >
                <Icon size={16} /> {t.label}
              </NavLink>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
          <Routes>
            <Route index element={
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>Programación de Mantenimientos</h1>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Gestión de planes, órdenes, calendario e historial
                    </p>
                  </div>
                  <button onClick={() => mpService.getKpis().then(res => setKpis(res.data?.data)).catch(() => toast.error('Error al recargar KPIs'))}
                    className="btn btn--ghost" title="Recargar KPIs">
                    <RefreshCw size={18} />
                  </button>
                </div>
                <KpiCards kpis={kpis} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  <QuickLink to="/mantenimientos-programados/planes" icon={ListChecks} title="Planes de Mantenimiento"
                    desc="Cree y gestione plantillas recurrentes por equipo o área" />
                  <QuickLink to="/mantenimientos-programados/ordenes" icon={ClipboardList} title="Órdenes de Mantenimiento"
                    desc="Administre las instancias ejecutables de mantenimiento" />
                  <QuickLink to="/mantenimientos-programados/calendario" icon={Calendar} title="Calendario"
                    desc="Vista mensual de las órdenes programadas" />
                  <QuickLink to="/mantenimientos-programados/historial" icon={History} title="Historial"
                    desc="Consulte la trazabilidad por equipo o área" />
                </div>
              </div>
            } />
            <Route path="planes/*"     element={<PlanesMantenimiento />} />
            <Route path="ordenes/*"    element={<OrdenesMantenimiento />} />
            <Route path="calendario"   element={<CalendarioMantenimientos />} />
            <Route path="historial"    element={<HistorialMantenimientos />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function QuickLink({ to, icon: Icon, title, desc }) {
  return (
    <NavLink to={to}
      className="card card--interactive"
      style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1.25rem', textDecoration: 'none', color: 'inherit' }}>
      <div style={{
        padding: '0.75rem', borderRadius: 'var(--radius-lg)',
        background: 'rgba(37,99,235,0.1)', color: 'var(--clr-primary-400)',
        transition: 'transform 200ms ease',
      }}>
        <Icon size={24} />
      </div>
      <div>
        <h3 style={{ fontWeight: 700 }}>{title}</h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{desc}</p>
      </div>
    </NavLink>
  );
}
