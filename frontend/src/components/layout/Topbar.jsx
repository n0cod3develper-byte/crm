import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebarStore } from '../../stores/sidebarStore';
import { useViewportType } from '../../hooks/useMediaQuery';

export function Topbar({ title, subtitle, rightContent }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { expanded, mobileOpen, toggleExpanded, toggleMobile } = useSidebarStore();
  const { isMobile, isDrawerMode } = useViewportType();

  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  const { data: notifications } = useQuery({
    queryKey: ['notifications_expiring'],
    queryFn: async () => {
      const { data } = await api.get('/tasks/expiring');
      return data.data || [];
    },
    refetchInterval: 60000 // Refrescar cada minuto
  });

  // Cerrar al clickear afuera
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
      toggleMobile();      // drawer overlay
    } else {
      toggleExpanded();    // collapse/expand
    }
  };

  // Visual: siempre tres líneas en desktop (nunca X)
  const showHamburgerX = isDrawerMode ? mobileOpen : false;
  // Accesibilidad: refleja el estado real del sidebar
  const sidebarOpen = isDrawerMode ? mobileOpen : expanded;

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
        <div className="header__search">
          <div className="header__search-wrapper">
            <Search size={16} className="header__search-icon" />
            <input
              type="text"
              placeholder="Buscar en todo el CRM (Ctrl+K)..."
              className="header__search-input"
            />
          </div>
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
