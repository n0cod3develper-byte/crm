import React from 'react';
import { Search, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebarStore } from '../../stores/sidebarStore';
import { useViewportType } from '../../hooks/useMediaQuery';

export function Topbar({ title, subtitle, rightContent }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { expanded, mobileOpen, toggleExpanded, toggleMobile } = useSidebarStore();
  const { isMobile, isDrawerMode } = useViewportType();

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

        <button className="header__icon-btn" aria-label="Notificaciones">
          <Bell size={18} />
          <span className="header__notif-dot" />
        </button>

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
