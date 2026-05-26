import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

/**
 * Página callback: después del OAuth redirect, las cookies ya están seteadas
 * por el backend. Solo cargamos el perfil y redirigimos.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');

    if (error) {
      navigate('/login?error=auth_failed', { replace: true });
      return;
    }

    // Las cookies httpOnly ya están seteadas por el backend (oauthCallback)
    // Solo cargamos el perfil del usuario
    api.get('/auth/me')
      .then(({ data }) => {
        navigate('/dashboard', { replace: true });
      })
      .catch(() => {
        navigate('/login?error=profile_failed', { replace: true });
      });
  }, []);

  return (
    <div className="login-page">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
        <p className="text-muted text-sm">Iniciando sesión…</p>
      </div>
    </div>
  );
}
