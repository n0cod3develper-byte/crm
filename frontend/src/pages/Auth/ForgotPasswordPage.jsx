import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, AlertCircle, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      // El backend siempre retorna success, pero por si acaso
      setSent(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-page" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top right, var(--bg-elevated), var(--bg-app))',
      padding: '2rem'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '2.5rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, var(--clr-primary-500), var(--clr-primary-700))',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1.25rem',
            boxShadow: '0 10px 20px rgba(37,99,235,0.2)',
          }}>
            <KeyRound size={28} color="white" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            Recuperar contraseña
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Ingresa tu correo y te enviaremos un enlace para restablecerla
          </p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.1)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <CheckCircle size={28} color="#22c55e" />
            </div>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Si el correo está registrado, recibirás un enlace en breve
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
              Revisa tu bandeja de entrada y la carpeta de spam. El enlace expirará en 15 minutos.
            </p>
            <Link to="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              color: 'var(--clr-primary-500)', fontSize: '0.875rem', fontWeight: 600,
              textDecoration: 'none'
            }}>
              <ArrowLeft size={16} /> Volver al login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.875rem 1.25rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 'var(--radius-md, 0.75rem)',
                color: '#ef4444', fontSize: '0.875rem'
              }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span style={{ fontWeight: 500 }}>{error}</span>
              </div>
            )}
            <div className="input-group">
              <label className="input-label">Correo electrónico</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  className="input"
                  placeholder="nombre@empresa.com"
                  style={{ paddingLeft: '2.5rem' }}
                  required
                  autoFocus
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn--primary"
              style={{ width: '100%', padding: '0.875rem', marginTop: '0.25rem', fontSize: '1rem', fontWeight: 600 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <div className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} />
                  <span>Enviando enlace...</span>
                </div>
              ) : 'Enviar enlace de recuperación'}
            </button>
          </form>
        )}

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <Link to="/login" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            color: 'var(--text-muted)', fontSize: '0.8rem', textDecoration: 'none'
          }}>
            <ArrowLeft size={14} /> Volver al login
          </Link>
        </div>
      </div>
    </div>
  );
}
