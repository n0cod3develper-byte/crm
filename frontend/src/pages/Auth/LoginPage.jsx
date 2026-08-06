import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogIn, Mail, Lock, Eye, EyeOff, AlertCircle, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LoginCarousel } from '../../components/Auth/LoginCarousel';

/* ─── Estilos globales del login ────────────────────────────── */
const CSS = `
  @keyframes lp-fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes lp-shake {
    0%,100% { transform: translateX(0); }
    18%     { transform: translateX(-5px); }
    36%     { transform: translateX(5px); }
    54%     { transform: translateX(-3px); }
    72%     { transform: translateX(3px); }
  }
  @keyframes lp-slideDown {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Layout */
  .lp-root {
    min-height: 100vh;
    display: flex;
    background: #f0f4f8;
  }

  /* Panel formulario */
  .lp-form-panel {
    flex: 0 0 460px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 3rem 2.5rem;
    background: #ffffff;
    position: relative;
    z-index: 1;
    box-shadow: 4px 0 40px rgba(0,0,0,0.08);
  }

  /* Panel carrusel */
  .lp-carousel-panel {
    flex: 1 1 0;
    position: relative;
    overflow: hidden;
    min-height: 100vh;
  }

  /* Wrapper del contenido del form */
  .lp-form-inner {
    width: 100%;
    max-width: 360px;
    animation: lp-fadeUp 0.55s cubic-bezier(.16,1,.3,1) both;
  }

  /* Inputs */
  .lp-input {
    width: 100%;
    height: 44px;
    padding: 0 0.875rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: #1a202c;
    background: #f8fafc;
    border: 1.5px solid #e2e8f0;
    border-radius: 10px;
    outline: none;
    transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  }
  .lp-input::placeholder { color: #a0aec0; }
  .lp-input:hover { border-color: #cbd5e1; background: #f1f5f9; }
  .lp-input:focus {
    border-color: #2563eb;
    background: #ffffff;
    box-shadow: 0 0 0 3.5px rgba(37,99,235,0.12);
  }
  .lp-input--icon-left  { padding-left: 2.625rem; }
  .lp-input--icon-right { padding-right: 2.625rem; }

  /* Botón submit */
  .lp-btn-submit {
    width: 100%;
    height: 46px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
    color: #ffffff;
    font-size: 0.9375rem;
    font-weight: 600;
    font-family: inherit;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
    box-shadow: 0 4px 14px rgba(37,99,235,0.3);
    letter-spacing: 0.01em;
  }
  .lp-btn-submit::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 60%);
    pointer-events: none;
  }
  .lp-btn-submit:not(:disabled):hover {
    transform: translateY(-1.5px);
    box-shadow: 0 8px 22px rgba(37,99,235,0.38);
  }
  .lp-btn-submit:not(:disabled):active { transform: translateY(0); box-shadow: 0 3px 10px rgba(37,99,235,0.25); }
  .lp-btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }

  /* Eye button */
  .lp-eye-btn {
    position: absolute;
    right: 11px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    padding: 4px;
    color: #94a3b8;
    cursor: pointer;
    display: flex;
    align-items: center;
    border-radius: 5px;
    transition: color 0.15s ease, background 0.15s ease;
  }
  .lp-eye-btn:hover { color: #475569; background: rgba(0,0,0,0.05); }

  /* Forgot link */
  .lp-forgot {
    font-size: 0.78rem;
    color: #2563eb;
    font-weight: 500;
    text-decoration: none;
    transition: color 0.15s ease;
  }
  .lp-forgot:hover { color: #1d4ed8; text-decoration: underline; }

  /* Error banner */
  .lp-error {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.75rem 0.875rem;
    background: #fef2f2;
    border: 1.5px solid #fecaca;
    border-radius: 10px;
    color: #dc2626;
    font-size: 0.825rem;
    font-weight: 500;
    animation: lp-slideDown 0.2s ease, lp-shake 0.45s ease 0.05s;
  }

  /* Divider sutil */
  .lp-divider {
    height: 1px;
    background: linear-gradient(to right, transparent, #e2e8f0 30%, #e2e8f0 70%, transparent);
    margin: 1.625rem 0;
  }

  /* Cert link */
  .lp-cert-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: #2563eb;
    font-weight: 500;
    text-decoration: none;
    padding: 0.5rem 0.875rem;
    border-radius: 8px;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    transition: all 0.15s ease;
  }
  .lp-cert-link:hover { background: #dbeafe; border-color: #93c5fd; transform: translateY(-1px); }

  /* Responsive */
  @media (max-width: 900px) {
    .lp-form-panel {
      flex: 1;
      box-shadow: none;
    }
    .lp-carousel-panel { display: none !important; }
  }
  @media (min-width: 901px) and (max-width: 1200px) {
    .lp-form-panel { flex: 0 0 400px; }
  }

  /* Spinner */
  .lp-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.65s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

import stratumLogo from '../../assets/stratum_logo.png';

export function LoginPage() {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]               = useState('');
  const [errorKey, setErrorKey]         = useState(0);
  const { login }  = useAuth();
  const navigate   = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    const res = await login(email, password);
    if (res.success) {
      navigate('/dashboard');
    } else {
      setError(res.error);
      setErrorKey(k => k + 1);
    }
    setIsSubmitting(false);
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="lp-root">

        {/* ── Panel formulario ──────────────────────────────── */}
        <div className="lp-form-panel">
          <div className="lp-form-inner">

            {/* Logo + marca */}
            <div style={{ marginBottom: '2.25rem' }}>
              <div style={{ marginBottom: '1.75rem' }}>
                <img src={stratumLogo} alt="STRATUM CRM" style={{ height: '200px', width: 'auto', display: 'block' }} />
              </div>

              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.375rem', letterSpacing: '-0.025em', lineHeight: 1.2 }}>
                Iniciar sesión
              </h1>
              <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.55 }}>
                Ingresa tus credenciales para continuar
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Error */}
              {error && (
                <div key={errorKey} className="lp-error">
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Campo email */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>
                  Correo electrónico
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                  <input
                    type="email"
                    id="login-email"
                    name="email"
                    className="lp-input lp-input--icon-left"
                    placeholder="nombre@empresa.com"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Campo contraseña */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
                    Contraseña
                  </label>
                  <Link to="/forgot-password" className="lp-forgot">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="login-password"
                    name="password"
                    className="lp-input lp-input--icon-left lp-input--icon-right"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="lp-eye-btn"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                id="login-submit"
                className="lp-btn-submit"
                disabled={isSubmitting}
                style={{ marginTop: '0.25rem' }}
              >
                {isSubmitting ? (
                  <>
                    <div className="lp-spinner" />
                    <span>Iniciando sesión…</span>
                  </>
                ) : (
                  <>
                    <LogIn size={16} />
                    <span>Entrar al sistema</span>
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="lp-divider" />

            {/* Footer */}
            <div style={{ textAlign: 'center' }}>
              <Link to="/certificados/solicitar" className="lp-cert-link" style={{ marginBottom: '1.125rem' }}>
                <FileText size={13} />
                Solicitar Certificado Laboral
              </Link>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '1rem' }}>
                © {new Date().getFullYear()} CARGAR SAS · Todos los derechos reservados
              </p>
            </div>

          </div>
        </div>

        {/* ── Panel carrusel ────────────────────────────────── */}
        <div className="lp-carousel-panel">
          <LoginCarousel />
        </div>

      </div>
    </>
  );
}
