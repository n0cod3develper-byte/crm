import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserPlus, User, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    password: '',
    confirmPassword: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      toast.error('Token de invitación requerido');
      navigate('/login');
    }
  }, [token, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      return toast.error('Las contraseñas no coinciden');
    }
    if (formData.password.length < 6) {
      return toast.error('La contraseña debe tener al menos 6 caracteres');
    }

    setIsSubmitting(true);
    const success = await register({
      token,
      nombre: formData.nombre,
      apellido: formData.apellido,
      password: formData.password
    });
    
    if (success) {
      navigate('/dashboard');
    }
    setIsSubmitting(false);
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
        maxWidth: '480px', 
        padding: '2.5rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, var(--clr-success-500), var(--clr-success-700))',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1rem',
            boxShadow: '0 8px 16px rgba(34,197,94,0.2)',
          }}>
            <UserPlus size={28} color="white" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            Activa tu cuenta
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Completa tu perfil para acceder al CRM de CARGAR SAS
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Nombre</label>
              <input 
                type="text" 
                className="input" 
                placeholder="Ej. Juan"
                required
                value={formData.nombre}
                onChange={e => setFormData({...formData, nombre: e.target.value})}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Apellido</label>
              <input 
                type="text" 
                className="input" 
                placeholder="Ej. Pérez"
                required
                value={formData.apellido}
                onChange={e => setFormData({...formData, apellido: e.target.value})}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Nueva Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type={showPassword ? 'text' : 'password'} 
                className="input" 
                placeholder="Mínimo 6 caracteres"
                style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                required
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Confirmar Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type={showPassword ? 'text' : 'password'} 
                className="input" 
                placeholder="Repite tu contraseña"
                style={{ paddingLeft: '2.5rem' }}
                required
                value={formData.confirmPassword}
                onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
              />
            </div>
          </div>

          <div style={{ padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem' }}>
            <ShieldCheck size={20} style={{ color: 'var(--clr-success-500)', flexShrink: 0 }} />
            <p>Tu información está protegida. Al activar tu cuenta, aceptas las políticas de seguridad y uso de datos de CARGAR SAS.</p>
          </div>

          <button 
            type="submit" 
            className="btn btn--primary" 
            style={{ width: '100%', padding: '0.875rem', marginTop: '0.5rem', fontSize: '1rem', fontWeight: 600 }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Activando cuenta...' : 'Activar mi cuenta'}
          </button>
        </form>
      </div>
    </div>
  );
}
