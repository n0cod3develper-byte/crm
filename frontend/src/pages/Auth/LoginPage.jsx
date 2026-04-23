import React from 'react';
import { useSearchParams } from 'react-router-dom';

const GOOGLE_ICON = (
  <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M47.532 24.552c0-1.636-.146-3.2-.418-4.704H24v8.897h13.192c-.569 3.065-2.294 5.66-4.888 7.4v6.152h7.911c4.628-4.26 7.317-10.536 7.317-17.745z" fill="#4285F4"/>
    <path d="M24 48c6.624 0 12.18-2.196 16.24-5.96l-7.912-6.152c-2.196 1.472-5.004 2.34-8.328 2.34-6.408 0-11.832-4.328-13.776-10.148H1.976v6.352C6.02 42.652 14.392 48 24 48z" fill="#34A853"/>
    <path d="M10.224 28.08A14.94 14.94 0 019.36 24c0-1.42.244-2.8.864-4.08v-6.352H1.976A23.963 23.963 0 000 24c0 3.868.928 7.524 2.576 10.752L10.224 28.08z" fill="#FBBC05"/>
    <path d="M24 9.552c3.612 0 6.856 1.244 9.404 3.68l7.056-7.056C36.18 2.196 30.624 0 24 0 14.392 0 6.02 5.348 2.576 13.248l7.648 6.352C12.168 13.88 17.592 9.552 24 9.552z" fill="#EA4335"/>
  </svg>
);

const MICROSOFT_ICON = (
  <svg width="20" height="20" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
    <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
    <path fill="#f35325" d="M1 1h10v10H1z"/>
    <path fill="#81bc06" d="M12 1h10v10H12z"/>
    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
    <path fill="#ffba08" d="M12 12h10v10H12z"/>
  </svg>
);

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const errorMsg = searchParams.get('error');

  const apiBase = import.meta.env.VITE_API_URL || '/api/v1';

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo / Branding */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #6366f1, #4338ca)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1rem',
            boxShadow: '0 0 30px rgba(99,102,241,0.4)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zm-.5 1.5L21.96 13H17V9.5h2.5zM6 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2.22-3c-.55-.61-1.33-1-2.22-1-.89 0-1.67.39-2.22 1H3V6h12v9H8.22zM18 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, marginBottom: '0.25rem' }}>
            CARGAR SAS CRM
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            Gestión comercial para el sector logístico
          </p>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div style={{
            padding: '0.75rem 1rem',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#f87171',
            fontSize: 'var(--text-sm)',
            textAlign: 'center',
          }}>
            Error al iniciar sesión. Por favor intenta de nuevo.
          </div>
        )}

        {/* OAuth buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Iniciar sesión con
          </p>

          <a href={`${apiBase}/auth/google`} style={{ textDecoration: 'none' }}>
            <button className="oauth-btn" type="button">
              {GOOGLE_ICON}
              Continuar con Google
            </button>
          </a>

          <a href={`${apiBase}/auth/microsoft`} style={{ textDecoration: 'none' }}>
            <button className="oauth-btn" type="button">
              {MICROSOFT_ICON}
              Continuar con Microsoft
            </button>
          </a>
        </div>

        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'center' }}>
          Solo los usuarios autorizados pueden acceder al sistema.
        </p>
      </div>
    </div>
  );
}
