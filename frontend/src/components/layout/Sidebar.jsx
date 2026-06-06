import React, { useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, TrendingUp, CheckSquare,
  FileText, Megaphone, Package, LifeBuoy,
  Zap, BarChart3, Settings, LogOut, Truck, Box, Wrench,
  ShoppingCart, ShoppingBag, Receipt, Clock, BookOpen, MapPin, History,
  Bookmark, ClipboardList, Shield, Sun, Moon, Monitor,
  CalendarClock
} from 'lucide-react';
import { useSidebarStore } from '../../stores/sidebarStore';
import { useThemeStore } from '../../stores/themeStore';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useViewportType } from '../../hooks/useMediaQuery';
import { useNavigate } from 'react-router-dom';

// ─── Items de navegación ─────────────────────────────────────
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
  { label: 'Catálogo', icon: BookOpen, to: '/catalogo', modulo: 'catalogo' },
  { label: 'Soporte', icon: LifeBuoy, to: '/support', modulo: 'soporte' },
  { label: 'Empleados', icon: Users, to: '/employees', modulo: 'empleados' },
  { label: 'Equipos', icon: Truck, to: '/equipos', modulo: 'equipos' },
  { label: 'Mantenimiento', icon: Wrench, to: '/mantenimiento', modulo: 'ordenes_trabajo' },
  { label: 'Plantillas PM', icon: Settings, to: '/mantenimiento/configuracion', modulo: 'ordenes_trabajo' },
  { label: 'Turnos', icon: Clock, to: '/turnos', modulo: 'turnos' },
  { label: 'Prog. Mant.', icon: CalendarClock, to: '/mantenimientos-programados', modulo: 'ordenes_trabajo' },
  { label: 'Supervisor', icon: Users, to: '/turnos/supervisor', modulo: 'turnos' },
  { label: 'Catálogo Serv.', icon: Bookmark, to: '/catalogo-servicios', modulo: 'servicios' },
  { label: 'Servicios', icon: ClipboardList, to: '/servicios', modulo: 'servicios' },
  { section: 'Logística' },
  { label: 'Proveedores', icon: ShoppingBag, to: '/proveedores', modulo: 'proveedores' },
  { label: 'Facturación', icon: Receipt, to: '/facturacion', modulo: 'facturacion' },
  { label: 'Pendientes', icon: Clock, to: '/facturacion/pendientes', modulo: 'facturacion', indent: true },
  { label: 'Facturas', icon: FileText, to: '/facturacion/facturas', modulo: 'facturacion', indent: true },
  { label: 'Compras', icon: ShoppingCart, to: '/compras', modulo: 'ordenes_compra' },
  { label: 'Solicitudes', icon: FileText, to: '/compras/solicitudes', modulo: 'ordenes_compra', indent: true },
  { label: 'Órdenes Compra', icon: ShoppingCart, to: '/compras/oc', modulo: 'ordenes_compra', indent: true },
  { section: 'Administración' },
  { label: 'Analítica / BI', icon: BarChart3, to: '/reportes' },
  { label: 'Ventas Servicios', icon: ClipboardList, to: '/reportes/servicios', indent: true },
  { label: 'Ventas Mantenimiento', icon: Wrench, to: '/reportes/mantenimiento', indent: true },
  { label: 'Usuarios', icon: Users, to: '/admin/usuarios', adminOnly: true },
  { label: 'Roles y Permisos', icon: Shield, to: '/admin/roles', adminOnly: true },
  { label: 'Módulos del Sistema', icon: Settings, to: '/admin/modulos', adminOnly: true },
];

// ─── Componente principal ────────────────────────────────────
export function Sidebar() {
  const { expanded, mobileOpen, closeMobile, toggleExpanded } = useSidebarStore();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useThemeStore();
  const { puede, esAdmin } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const { isDesktop, isDrawerMode } = useViewportType();

  // Cerrar drawer al navegar (mobile y tablet)
  useEffect(() => {
    if (isDrawerMode && mobileOpen) {
      closeMobile();
    }
  }, [location.pathname, isDrawerMode]);

  // Cerrar drawer con Escape (mobile y tablet)
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e) => { if (e.key === 'Escape') closeMobile(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mobileOpen, closeMobile]);

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  // Filtrar items según permisos
  const filteredNavItems = navItems.filter(item => {
    if (item.section) return true;
    if (item.adminOnly) return esAdmin();
    if (item.modulo) return puede(item.modulo, 'ver');
    return true;
  });

  // Limpiar secciones vacías
  const finalItems = [];
  filteredNavItems.forEach((item, i) => {
    if (item.section) {
      const hasContent = filteredNavItems.slice(i + 1).some(n => !n.section);
      if (hasContent) finalItems.push(item);
    } else {
      finalItems.push(item);
    }
  });

  // Colapsado solo en desktop; en mobile/tablet se usa drawer
  const isCollapsed = !expanded && isDesktop;

  return (
    <>
      {/* Overlay para mobile/tablet */}
      {isDrawerMode && mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''} ${isDrawerMode && mobileOpen ? 'sidebar--drawer-open' : ''}`}
        aria-label="Navegación principal"
        role="navigation"
      >
        {/* ── Logo ───────────────────────────────── */}
        <div className="sidebar__logo">
          <div className="sidebar__logo-inner">
            <div className="sidebar__logo-icon">
              <Truck size={18} color="white" />
            </div>
            <div className="sidebar__logo-text">
              <div className="sidebar__logo-title">CARGAR SAS</div>
              <div className="sidebar__logo-sub">CRM & ERP</div>
            </div>
          </div>
        </div>

        {/* ── Navegación ─────────────────────────── */}
        <nav className="sidebar__nav" aria-label="Módulos">
          {finalItems.map((item, i) => {
            if (item.section) {
              return (
                <div key={i} className="nav-section-label">
                  <span className="nav-section-label__text">{item.section}</span>
                </div>
              );
            }
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={!item.indent}
                title={isCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'nav-item--active' : ''} ${item.indent ? 'nav-item--indent' : ''}`
                }
                role="menuitem"
              >
                <Icon size={item.indent ? 14 : 16} className="nav-item__icon" />
                <span className="nav-item__label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* ── Footer: usuario + tema + logout ────── */}
        <div className="sidebar__footer">
          {/* Perfil */}
          <div className="sidebar__user" title={isCollapsed ? `${user?.nombre} ${user?.apellido}` : undefined}
            onClick={() => navigate('/perfil')}
            style={{ cursor: 'pointer' }}
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.nombre}
                className="sidebar__avatar"
              />
            ) : (
              <div className="sidebar__avatar sidebar__avatar--fallback">
                {user?.nombre?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="sidebar__user-info">
              <div className="sidebar__user-name">{user?.nombre} {user?.apellido}</div>
              <div className="sidebar__user-rol">{user?.rol_nombre || 'Sin Rol'}</div>
            </div>
          </div>

          {/* Theme Switcher */}
          <div className="sidebar__theme">
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
                  className={`sidebar__theme-btn ${active ? 'sidebar__theme-btn--active' : ''}`}
                  aria-pressed={active}
                  aria-label={opt.label}
                >
                  <Icon size={14} />
                </button>
              );
            })}
          </div>

          {/* Logout */}
          <button
            className="nav-item sidebar__logout"
            onClick={handleLogout}
            title={isCollapsed ? 'Cerrar sesión' : undefined}
            aria-label="Cerrar sesión"
          >
            <LogOut size={16} className="nav-item__icon" />
            <span className="nav-item__label">Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}
