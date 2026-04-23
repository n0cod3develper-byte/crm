import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import api from '../../lib/api';

/**
 * Página callback: recibe los tokens del backend después del OAuth redirect
 * y los guarda en el store.
 *
 * URL: /auth/callback?token=xxx&refresh=yyy
 */
export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();

  useEffect(() => {
    const token   = searchParams.get('token');
    const refresh = searchParams.get('refresh');
    const error   = searchParams.get('error');

    if (error || !token) {
      navigate('/login?error=auth_failed', { replace: true });
      return;
    }

    setTokens(token, refresh);

    // Carga el perfil del usuario
    api.get('/auth/me')
      .then(({ data }) => {
        setUser(data.data);
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
