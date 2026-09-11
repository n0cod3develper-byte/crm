import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Bell, AlertTriangle, Building2, FileText, Wrench, Package, Users, UserCheck, Truck, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebarStore } from '../../stores/sidebarStore';
import { useViewportType } from '../../hooks/useMediaQuery';

// ─── Iconos por módulo ──────────────────────────────────────
const MODULE_ICONS = {
  empresas: Building2,
  remisiones: FileText,
  ordenes_trabajo: Wrench,
  productos: Package,
  contactos: Users,
  empleados: UserCheck,
  proveedores: Truck,
};

const MODULE_LABELS = {
  empresas: 'Empresas',
  remisiones: 'Remisiones',
  ordenes_trabajo: 'Órdenes de Trabajo',
  productos: 'Productos',
  contactos: 'Contactos',
  empleados: 'Empleados',
  proveedores: 'Proveedores',
};

const MODULE_ROUTES = {
  empresas: (item) => `/companies/${item.id}`,
  remisiones: (item) => `/servicios/${item.id}`,
  ordenes_trabajo: (item) => `/mantenimiento/ot/${item.id}`,
  productos: (item) => `/catalogo/${item.id}`,
  contactos: (item) => `/contacts?search=${encodeURIComponent(item.nombre || '')}`,
  empleados: (item) => `/employees?search=${encodeURIComponent(item.nombre || '')}`,
  proveedores: (item) => `/proveedores/${item.id}`,
};

// ─── Componentes del dropdown ───────────────────────────────
function SearchSection({ title, icon, children }) {
  return (
    <div>
      <div className="search-section-title">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function SearchResultItem({ onClick, children }) {
  return (
    <div className="search-result-item" onClick={onClick}>
      {children}
    </div>
  );
}

export function Topbar({ title, subtitle, rightContent }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { expanded, mobileOpen, toggleExpanded, toggleMobile } = useSidebarStore();
  const { isMobile, isDrawerMode } = useViewportType();

  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  // ─── Estado de búsqueda global ────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchInputRef = useRef(null);
  const searchDropdownRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const { data: notifications } = useQuery({
    queryKey: ['notifications_expiring'],
    queryFn: async () => {
      const { data } = await api.get('/tasks/expiring');
      return data.data || [];
    },
    refetchInterval: 60000
  });

  // ─── Búsqueda con debounce ────────────────────────────────
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (value.trim().length < 2) {
      setSearchResults(null);
      setShowSearchDropdown(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await api.get('/busqueda-global', { params: { q: value.trim() } });
        setSearchResults(data.data);
        setShowSearchDropdown(true);
      } catch (err) {
        console.error('Error en búsqueda global:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  // ─── Navegación al hacer clic en un resultado ─────────────
  const handleResultClick = useCallback((type, item) => {
    setShowSearchDropdown(false);
    setSearchQuery('');
    if (MODULE_ROUTES[type]) {
      navigate(MODULE_ROUTES[type](item));
    }
  }, [navigate]);

  // ─── Atajo Ctrl+K ─────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setShowSearchDropdown(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ─── Cerrar dropdown al hacer clic fuera ──────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Cleanup del timeout ──────────────────────────────────
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  // Cerrar notificaciones al clickear afuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (isDrawerMode) {
      toggleMobile();
    } else {
      toggleExpanded();
    }
  };

  const showHamburgerX = isDrawerMode ? mobileOpen : false;
  const sidebarOpen = isDrawerMode ? mobileOpen : expanded;

  // Verificar si hay resultados
  const hasResults = searchResults && Object.values(searchResults).some(arr => arr?.length > 0);

  return (
    <header className="header">
      {/* Left: Hamburguesa + título */}
      <div className="header__left">
        <button
          className="header__hamburger"
          onClick={handleToggle}
          aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={sidebarOpen}
          title={sidebarOpen ? 'Colapsar sidebar' : 'Expandir sidebar'}
        >
          <div className={`hamburger-icon ${showHamburgerX ? 'hamburger-icon--open' : ''}`}>
            <span />
            <span />
            <span />
          </div>
        </button>

        <div className="header__title-group">
          <h1 className="header__title">{title}</h1>
          {subtitle && <p className="header__subtitle">{subtitle}</p>}
        </div>
      </div>

      {/* Center: Búsqueda global (solo desktop y tablet) */}
      {!isMobile && (
        <div className="header__search" ref={searchDropdownRef} style={{ position: 'relative' }}>
          <div className="header__search-wrapper">
            <Search size={16} className="header__search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar en todo el CRM (Ctrl+K)..."
              className="header__search-input"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => searchResults && setShowSearchDropdown(true)}
            />
            {isSearching && (
              <Loader2 size={14} className="header__search-spinner" style={{ 
                position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                animation: 'spin 1s linear infinite', color: 'var(--text-muted)' 
              }} />
            )}
          </div>

          {/* Dropdown de resultados */}
          {showSearchDropdown && searchResults && (
            <div className="search-dropdown">
              {hasResults ? (
                <>
                  {searchResults.empresas?.length > 0 && (
                    <SearchSection title="Empresas" icon={<Building2 size={14} />}>
                      {searchResults.empresas.map(item => (
                        <SearchResultItem key={item.id} onClick={() => handleResultClick('empresas', item)}>
                          <span className="search-result-name">{item.nombre}</span>
                          <span className="search-result-detail">{item.nit}</span>
                        </SearchResultItem>
                      ))}
                    </SearchSection>
                  )}
                  {searchResults.remisiones?.length > 0 && (
                    <SearchSection title="Remisiones" icon={<FileText size={14} />}>
                      {searchResults.remisiones.map(item => (
                        <SearchResultItem key={item.id} onClick={() => handleResultClick('remisiones', item)}>
                          <span className="search-result-name">Remisión #{item.codigo}</span>
                          <span className="search-result-detail">{item.empresa}</span>
                        </SearchResultItem>
                      ))}
                    </SearchSection>
                  )}
                  {searchResults.ordenes_trabajo?.length > 0 && (
                    <SearchSection title="Órdenes de Trabajo" icon={<Wrench size={14} />}>
                      {searchResults.ordenes_trabajo.map(item => (
                        <SearchResultItem key={item.id} onClick={() => handleResultClick('ordenes_trabajo', item)}>
                          <span className="search-result-name">{item.codigo}</span>
                          <span className="search-result-detail">{item.empresa}</span>
                        </SearchResultItem>
                      ))}
                    </SearchSection>
                  )}
                  {searchResults.productos?.length > 0 && (
                    <SearchSection title="Productos" icon={<Package size={14} />}>
                      {searchResults.productos.map(item => (
                        <SearchResultItem key={item.id} onClick={() => handleResultClick('productos', item)}>
                          <span className="search-result-name">{item.nombre}</span>
                          <span className="search-result-detail">
                            {item.codigo_interno}{item.referencia ? ` • ${item.referencia}` : ''}
                          </span>
                        </SearchResultItem>
                      ))}
                    </SearchSection>
                  )}
                  {searchResults.contactos?.length > 0 && (
                    <SearchSection title="Contactos" icon={<Users size={14} />}>
                      {searchResults.contactos.map(item => (
                        <SearchResultItem key={item.id} onClick={() => handleResultClick('contactos', item)}>
                          <span className="search-result-name">{item.nombre}</span>
                          <span className="search-result-detail">
                            {item.email || item.phone || item.empresa || ''}
                          </span>
                        </SearchResultItem>
                      ))}
                    </SearchSection>
                  )}
                  {searchResults.empleados?.length > 0 && (
                    <SearchSection title="Empleados" icon={<UserCheck size={14} />}>
                      {searchResults.empleados.map(item => (
                        <SearchResultItem key={item.id} onClick={() => handleResultClick('empleados', item)}>
                          <span className="search-result-name">{item.nombre}</span>
                          <span className="search-result-detail">
                            {item.numero_documento || item.email || item.departamento || ''}
                          </span>
                        </SearchResultItem>
                      ))}
                    </SearchSection>
                  )}
                  {searchResults.proveedores?.length > 0 && (
                    <SearchSection title="Proveedores" icon={<Truck size={14} />}>
                      {searchResults.proveedores.map(item => (
                        <SearchResultItem key={item.id} onClick={() => handleResultClick('proveedores', item)}>
                          <span className="search-result-name">{item.nombre}</span>
                          <span className="search-result-detail">
                            {item.numero_documento}{item.nombre_comercial ? ` • ${item.nombre_comercial}` : ''}
                          </span>
                        </SearchResultItem>
                      ))}
                    </SearchSection>
                  )}
                </>
              ) : (
                <div className="search-dropdown-empty">
                  No se encontraron resultados para "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Right: Acciones */}
      <div className="header__right">
        {rightContent}

        <div className="header__divider" />

        <div style={{ position: 'relative' }} ref={notifRef}>
          <button 
            className="header__icon-btn" 
            aria-label="Notificaciones"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={18} />
            {notifications && notifications.length > 0 && (
              <span className="header__notif-dot" style={{
                position: 'absolute', top: '4px', right: '4px', width: '8px', height: '8px',
                background: '#ef4444', borderRadius: '50%'
              }} />
            )}
          </button>

          {showNotifications && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', width: '320px',
              background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              zIndex: 50, overflow: 'hidden'
            }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Notificaciones</h3>
                {notifications && notifications.length > 0 && (
                  <span style={{ fontSize: '11px', background: '#fee2e2', color: '#ef4444', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                    {notifications.length} nuevas
                  </span>
                )}
              </div>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {!notifications || notifications.length === 0 ? (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No tienes tareas por vencer pronto.
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} style={{ 
                      padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', cursor: 'pointer',
                      display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: 'var(--bg-elevated)', transition: 'background 0.2s'
                    }}
                    onClick={() => { setShowNotifications(false); navigate(`/tasks`); }}
                    >
                      <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <p style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {notif.codigo} por vencer
                        </p>
                        <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {notif.title}
                        </p>
                        <p style={{ margin: 0, fontSize: '11px', color: '#f59e0b', fontWeight: 600 }}>
                          Vence: {new Date(notif.due_date).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          className="header__avatar"
          onClick={() => navigate('/perfil')}
          title="Mi Perfil"
          style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
        >
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.nombre}
              className="header__avatar-img"
            />
          ) : (
            <div className="header__avatar-fallback">
              {user?.nombre?.[0]}{user?.apellido?.[0]}
            </div>
          )}
        </button>
      </div>
    </header>
  );
}
