import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, KeyRound, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token');

  const [tokenValid, setTokenValid] = useState(null); // null = loading, true = valid, false = invalid
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Validar token al cargar la página
  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      return;
    }
    api.get(`/auth/reset-password/validate/${token}`)
      .then(() => setTokenValid(true))
      .catch(() => setTokenValid(false));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword,
        confirmPassword
      });
      setSuccess(true);
      toast.success('Contraseña actualizada correctamente');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Error al actualizar la contraseña');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Token inválido o no proporcionado
  if (tokenValid === false) {
    return (
      <div className="login-page" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at top right, var(--bg-elevated), var(--bg-app))', padding: '2rem'
      }}>
        <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <AlertCircle size={28} color="#ef4444" />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Enlace inválido o expirado</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            El enlace de recuperación no es válido o ya expiró.
          </p>
          <Link to="/forgot-password" className="btn btn--primary" style={{ textDecoration: 'none', padding: '0.75rem 1.5rem' }}>
            Solicitar nuevo enlace
          </Link>
        </div>
      </div>
    );
  }

  // Cargando validación del token
  if (tokenValid === null) {
    return (
      <div className="login-page" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at top right, var(--bg-elevated), var(--bg-app))'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: '2rem', height: '2rem', borderWidth: '3px', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-muted)' }}>Validando enlace...</p>
        </div>
      </div>
    );
  }

  // Éxito
  if (success) {
    return (
      <div className="login-page" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at top right, var(--bg-elevated), var(--bg-app))', padding: '2rem'
      }}>
        <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <CheckCircle size={28} color="#22c55e" />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>¡Contraseña actualizada!</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Ya puedes iniciar sesión con tu nueva contraseña.
          </p>
          <Link to="/login" className="btn btn--primary" style={{ textDecoration: 'none', padding: '0.75rem 1.5rem' }}>
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  // Formulario de nueva contraseña
  return (
    <div className="login-page" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at top right, var(--bg-elevated), var(--bg-app))', padding: '2rem'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, var(--clr-primary-500), var(--clr-primary-700))',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1.25rem', boxShadow: '0 10px 20px rgba(37,99,235,0.2)',
          }}>
            <KeyRound size={28} color="white" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Nueva contraseña</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Ingresa tu nueva contraseña (mínimo 8 caracteres)</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.875rem 1.25rem', background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md, 0.75rem)',
              color: '#ef4444', fontSize: '0.875rem'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 500 }}>{error}</span>
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Nueva contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                className="input"
                placeholder="Mínimo 8 caracteres"
                style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                required
                autoFocus
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Confirmar contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type={showConfirm ? 'text' : 'password'}
                className="input"
                placeholder="Repite tu contraseña"
                style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '-0.5rem' }}>Las contraseñas no coinciden</p>
          )}

          <button
            type="submit"
            className="btn btn--primary"
            style={{ width: '100%', padding: '0.875rem', marginTop: '0.25rem', fontSize: '1rem', fontWeight: 600 }}
            disabled={isSubmitting || !newPassword || !confirmPassword}
          >
            {isSubmitting ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <div className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} />
                <span>Actualizando...</span>
              </div>
            ) : 'Actualizar contraseña'}
          </button>
        </form>

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