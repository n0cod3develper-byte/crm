import React from 'react';
import { Search, Bell, Plus, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export function Topbar({ title, subtitle, rightContent }) {
  const { user } = useAuthStore();

  return (
    <header className="header" style={{ padding: '0 1.5rem', height: 'var(--header-height)' }}>
      {/* Left side: Page Title */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 700, lineHeight: 1.2, color: 'var(--text-primary)' }}>{title}</h1>
        {subtitle && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Middle: Global Search */}
      <div style={{ flex: 2, maxWidth: 480, margin: '0 2rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar en todo el CRM (Ctrl+K)..."
            style={{
              width: '100%',
              padding: '0.4rem 1rem 0.4rem 2.5rem',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-app)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              outline: 'none',
              transition: 'all var(--transition-fast)'
            }}
            onFocus={(e) => {
              e.target.style.background = 'var(--bg-surface)';
              e.target.style.borderColor = 'var(--clr-primary-400)';
              e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)';
            }}
            onBlur={(e) => {
              e.target.style.background = 'var(--bg-app)';
              e.target.style.borderColor = 'var(--border-color)';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

      {/* Right side: Actions, Notifications, Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, justifyContent: 'flex-end' }}>
        
        {rightContent}

        <div style={{ width: 1, height: 24, background: 'var(--border-color)', margin: '0 0.5rem' }} />

        {/* Notifications */}
        <button className="btn--ghost" style={{ position: 'relative', padding: '0.5rem', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bell size={18} color="var(--text-secondary)" />
          <span style={{ position: 'absolute', top: 6, right: 8, width: 8, height: 8, background: 'var(--clr-danger)', borderRadius: '50%', border: '2px solid var(--bg-surface)' }}></span>
        </button>

        {/* Avatar Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.25rem', borderRadius: 'var(--radius-full)', transition: 'background var(--transition-fast)' }} className="hover-bg-elevated">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="Avatar" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--clr-primary-500)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              {user?.full_name?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <ChevronDown size={14} color="var(--text-secondary)" />
        </div>
      </div>
    </header>
  );
}
