import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, TrendingUp, CheckSquare,
  MessageSquare, FileText, Megaphone, Package, LifeBuoy,
  Zap, BrainCircuit, Phone, BarChart3, Settings, LogOut, Truck, Box, Wrench,
  ShoppingCart, ShoppingBag, Bookmark, ClipboardList
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { section: 'Comercial' },
  { label: 'Empresas', icon: Building2, to: '/companies' },
  { label: 'Contactos', icon: Users, to: '/contacts' },
  { label: 'Pipeline', icon: TrendingUp, to: '/pipeline' },
  { label: 'Tareas', icon: CheckSquare, to: '/tasks' },
  { label: 'Cotizaciones', icon: FileText, to: '/quotes' },
  { section: 'Marketing' },
  { label: 'Leads', icon: Megaphone, to: '/leads' },
  { label: 'Campañas', icon: Zap, to: '/campaigns' },
  { section: 'Operaciones' },
  { label: 'Inventario', icon: Box, to: '/inventory' },
  { label: 'Soporte', icon: LifeBuoy, to: '/support' },
  { label: 'Empleados', icon: Users, to: '/employees' },
  { label: 'Equipos', icon: Truck, to: '/equipos' },
  { label: 'Mantenimiento', icon: Wrench, to: '/mantenimiento' },
  { label: 'Plantillas PM', icon: Settings, to: '/mantenimiento/configuracion' },
  { label: 'Catálogo', icon: Bookmark, to: '/catalogo-servicios' },
  { label: 'Servicios', icon: ClipboardList, to: '/servicios' },
  { section: 'Logística' },
  { label: 'Proveedores', icon: ShoppingBag, to: '/proveedores' },
  { label: 'Compras', icon: ShoppingCart, to: '/compras' },
  { section: 'Herramientas' },
  { label: 'Comunicaciones', icon: MessageSquare, to: '/communications' },
  { label: 'Biométrico', icon: Phone, to: '/telephony' },
  { label: 'IA Sugerencias', icon: BrainCircuit, to: '/ai' },
  { label: 'Reportes', icon: BarChart3, to: '/reports' },
  { label: 'Automatizaciones', icon: Zap, to: '/automations' },
  { label: 'Configuración', icon: Settings, to: '/settings' },
];

import { useThemeStore } from '../../stores/themeStore';
import { Sun, Moon, Monitor } from 'lucide-react';

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await api.post('/auth/logout').catch(() => { });
    } finally {
      logout();
      navigate('/login');
    }
  }

  return (
    <aside className="sidebar">
      {/* ... (rest of sidebar remains same) ... */}
      {/* (Actual implementation below will replace the bottom part) */}
      {/* Logo */}
      <div className="sidebar__logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #4338ca)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Truck size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 'var(--text-sm)', lineHeight: 1.2 }}>CARGAR SAS</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>CRM & ERP Logístico</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar__nav">
        {navItems.map((item, i) => {
          if (item.section) {
            return <div key={i} className="nav-section-label">{item.section}</div>;
          }
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item--active' : ''}`
              }
            >
              <Icon size={16} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* User + theme + logout */}
      <div style={{ padding: '1rem 0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.full_name}
              style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--clr-primary-500)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--text-sm)', fontWeight: 700, color: 'white',
              flexShrink: 0,
            }}>
              {user?.full_name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.full_name || 'Usuario'}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.role || 'agent'}
            </div>
          </div>
        </div>

        {/* Theme Switcher */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-elevated)',
          padding: '2px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)'
        }}>
          {[
            { id: 'light', icon: Sun, label: 'Claro' },
            { id: 'system', icon: Monitor, label: 'Auto' },
            { id: 'dark', icon: Moon, label: 'Oscuro' },
          ].map((opt) => {
            const Icon = opt.icon;
            const active = theme === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setTheme(opt.id)}
                title={opt.label}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px',
                  borderRadius: 'calc(var(--radius-md) - 2px)',
                  border: 'none',
                  background: active ? 'var(--bg-surface)' : 'transparent',
                  color: active ? 'var(--clr-primary-500)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  boxShadow: active ? 'var(--shadow-sm)' : 'none',
                }}
              >
                <Icon size={14} />
              </button>
            );
          })}
        </div>

        <button className="nav-item btn--ghost" onClick={handleLogout} style={{ justifyContent: 'flex-start', padding: '0.625rem 0.875rem' }}>
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
