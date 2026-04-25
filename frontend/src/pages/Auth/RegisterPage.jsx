import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

export function RegisterPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore(state => state.setTokens);
  const setUser = useAuthStore(state => state.setUser);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    const full_name = formData.get('full_name');

    try {
      const res = await api.post('/auth/register', { email, password, full_name });
      if (res.data.success) {
        const { accessToken, refreshToken, user } = res.data.data;
        setTokens(accessToken, refreshToken);
        setUser(user);
        navigate('/dashboard');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error al registrar usuario');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #10b981, #047857)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1rem',
            boxShadow: '0 0 30px rgba(16,185,129,0.4)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, marginBottom: '0.25rem' }}>
            Registro CARGAR CRM
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            Crea una nueva cuenta
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: 'var(--text-sm)' }}>Nombre Completo</label>
            <input 
              name="full_name" 
              type="text" 
              required 
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: 'var(--text-sm)' }}>Email</label>
            <input 
              name="email" 
              type="email" 
              required 
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: 'var(--text-sm)' }}>Contraseña</label>
            <input 
              name="password" 
              type="password" 
              required 
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }} 
            />
          </div>
          <button type="submit" style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: '#10b981', color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer', marginTop: '0.5rem' }}>
            Registrarse
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: 'var(--text-sm)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            ¿Ya tienes cuenta? <Link to="/login" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 600 }}>Inicia sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
