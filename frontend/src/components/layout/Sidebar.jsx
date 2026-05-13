import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, TrendingUp, CheckSquare,
  MessageSquare, FileText, Megaphone, Package, LifeBuoy,
  Zap, BrainCircuit, Phone, BarChart3, Settings, LogOut, Truck, Box, Wrench,
  ShoppingCart, ShoppingBag, Receipt, Clock, BookOpen, MapPin, History,
  Bookmark, ClipboardList
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { section: 'Comercial' },
  { label: 'Empresas', icon: Building2, to: '/companies', modulo: 'empresas' },
  { label: 'Contactos', icon: Users, to: '/contacts', modulo: 'contactos' },
  { label: 'Pipeline', icon: TrendingUp, to: '/pipeline', modulo: 'pipeline' },
  { label: 'Tareas', icon: CheckSquare, to: '/tasks', modulo: 'tareas' },
  { label: 'Cotizaciones', icon: FileText, to: '/quotes', modulo: 'cotizaciones' },
  { section: 'Marketing' },
  { label: 'Leads', icon: Megaphone, to: '/leads', modulo: 'leads' },
  { label: 'Campañas', icon: Zap, to: '/campaigns', modulo: 'campanas' },
  { section: 'Operaciones' },
  { label: 'Inventario', icon: Box, to: '/inventory', modulo: 'inventario' },
  { label: 'Ubicaciones', icon: MapPin, to: '/inventory/ubicaciones', modulo: 'inventario', indent: true },
  { label: 'Movimientos', icon: History, to: '/inventario/movimientos', modulo: 'inventario', indent: true },
  { label: 'Catálogo PRO', icon: BookOpen, to: '/catalogo', modulo: 'catalogo' },
  { label: 'Soporte', icon: LifeBuoy, to: '/support', modulo: 'soporte' },
  { label: 'Empleados', icon: Users, to: '/employees', modulo: 'empleados' },
  { label: 'Equipos', icon: Truck, to: '/equipos', modulo: 'equipos' },
  { label: 'Mantenimiento', icon: Wrench, to: '/mantenimiento', modulo: 'ordenes_trabajo' },
  { label: 'Plantillas PM', icon: Settings, to: '/mantenimiento/configuracion', modulo: 'ordenes_trabajo' },
  { label: 'Catálogo Serv.', icon: Bookmark, to: '/catalogo-servicios', modulo: 'servicios' },
  { label: 'Servicios', icon: ClipboardList, to: '/servicios', modulo: 'servicios' },
  { section: 'Logística' },
  { label: 'Proveedores', icon: ShoppingBag, to: '/proveedores', modulo: 'proveedores' },
  { label: 'Facturación', icon: Receipt, to: '/facturacion', modulo: 'facturacion' },
  { label: 'Pendientes', icon: Clock, to: '/facturacion/pendientes', modulo: 'facturacion', indent: true },
  { label: 'Historial Facturas', icon: FileText, to: '/facturacion/facturas', modulo: 'facturacion', indent: true },
  { label: 'Compras', icon: ShoppingCart, to: '/compras', modulo: 'ordenes_compra' },
  { label: 'Solicitudes', icon: FileText, to: '/compras/solicitudes', modulo: 'ordenes_compra', indent: true },
  { label: 'Órdenes de Compra', icon: ShoppingCart, to: '/compras/oc', modulo: 'ordenes_compra', indent: true },
  { section: 'Administración' },
  { label: 'Roles y Permisos', icon: Shield, to: '/admin/roles', adminOnly: true },
  { label: 'Usuarios', icon: Users, to: '/admin/usuarios', adminOnly: true },
];

import { useThemeStore } from '../../stores/themeStore';
import { Sun, Moon, Monitor, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';

export function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useThemeStore();
  const { puede, esAdmin, rolActual, loading: loadingPermisos } = usePermissions();
  const navigate = useNavigate();

  async function handleLogout() {
    logout();
  }

  const filteredNavItems = navItems.filter(item => {
    if (item.section) return true; // Mantener etiquetas de sección por ahora (se limpiarán si quedan vacías)
    if (item.adminOnly) return esAdmin();
    if (item.modulo) return puede(item.modulo, 'ver');
    return true; // Dashboard etc
  });

  // Limpiar secciones vacías
  const finalItems = [];
  filteredNavItems.forEach((item, i) => {
    if (item.section) {
      const hasContent = filteredNavItems.slice(i + 1).some(next => !next.section);
      // Nota: Esta lógica es simplificada, pero sirve para el ejemplo
      if (hasContent) finalItems.push(item);
    } else {
      finalItems.push(item);
    }
  });

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
        {finalItems.map((item, i) => {
          if (item.section) {
            return <div key={i} className="nav-section-label">{item.section}</div>;
          }
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={!item.indent}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item--active' : ''}`
              }
              style={item.indent ? { paddingLeft: '2rem', fontSize: 'var(--text-xs)', opacity: 0.85 } : undefined}
            >
              <Icon size={item.indent ? 14 : 16} />
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
              alt={user.nombre}
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
              {user?.nombre?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.nombre} {user?.apellido}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.rol_nombre || 'Sin Rol'}
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
