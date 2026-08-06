import React, { useState } from 'react';
import { FileText, User, CreditCard, Send, Loader2, CheckCircle, Shield } from 'lucide-react';
import api from '../../lib/api';

export function SolicitarCertificadoPage() {
  const [form, setForm] = useState({ nombre_completo: '', numero_documento: '' });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('form'); // form | otp | success
  const [tokenId, setTokenId] = useState(null);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [empleadoInfo, setEmpleadoInfo] = useState(null);

  async function handleSolicitar(e) {
    e.preventDefault();
    setError('');
    if (!form.nombre_completo.trim() || !form.numero_documento.trim()) {
      return setError('Todos los campos son requeridos.');
    }
    setLoading(true);
    try {
      const { data } = await api.post('/certificados-publico/solicitar', form);
      if (data.success && data.data) {
        setTokenId(data.data.tokenId);
        setStep('otp');
      } else {
        // Respuesta genérica siempre
        setStep('otp');
        setTokenId(null);
      }
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Demasiados intentos. Por favor, espera antes de intentar de nuevo.');
      } else {
        setStep('otp');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleValidarOtp(e) {
    e.preventDefault();
    setError('');
    if (!otp.trim()) return setError('Ingresa el código de verificación.');
    setLoading(true);
    try {
      const { data } = await api.post('/certificados-publico/validar-otp', {
        token_id: tokenId,
        codigo: otp
      });
      if (data.success) {
        setEmpleadoInfo(data.data.empleado);
        // Descargar automáticamente
        window.location.href = `/api/v1/certificados-publico/descargar/${data.data.downloadToken}`;
        setStep('success');
      }
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Demasiados intentos fallidos. Espera antes de intentar de nuevo.');
      } else {
        setError(err.response?.data?.error?.message || 'Código incorrecto o expirado.');
      }
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: '100%', padding: '0.75rem 1rem', borderRadius: '8px',
    border: '1px solid var(--border-color)', background: 'var(--bg-elevated)',
    color: 'var(--text-primary)', fontSize: '14px'
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ maxWidth: '480px', width: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(99,102,241,0.1)', marginBottom: '1rem' }}>
            <FileText size={32} color="var(--clr-primary-500)" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Certificado Laboral
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Descarga tu certificado laboral de forma segura
          </p>
        </div>

        {/* Step 1: Formulario */}
        {step === 'form' && (
          <div className="card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={18} /> Verificación de identidad
            </h2>
            <form onSubmit={handleSolicitar}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                  Nombre completo
                </label>
                <input
                  style={inputStyle}
                  placeholder="Ej: Juan Pérez López"
                  value={form.nombre_completo}
                  onChange={e => setForm(f => ({ ...f, nombre_completo: e.target.value }))}
                  required
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                  <CreditCard size={12} style={{ marginRight: '0.25rem' }} /> Número de documento
                </label>
                <input
                  style={inputStyle}
                  placeholder="Ej: 1234567890"
                  value={form.numero_documento}
                  onChange={e => setForm(f => ({ ...f, numero_documento: e.target.value }))}
                  required
                />
              </div>
              {error && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '1rem' }}>{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="btn btn--primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {loading ? 'Enviando...' : 'Solicitar código'}
              </button>
            </form>
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(99,102,241,0.05)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.1)' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <Shield size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                Se enviará un código de verificación a tu correo personal registrado. El certificado se genera sin información salarial por tu seguridad.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: OTP */}
        {step === 'otp' && (
          <div className="card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={18} /> Código de verificación
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Se ha enviado un código de 6 dígitos a tu correo personal registrado.
            </p>
            <form onSubmit={handleValidarOtp}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                  Código OTP
                </label>
                <input
                  style={{ ...inputStyle, textAlign: 'center', fontSize: '24px', letterSpacing: '8px', fontFamily: 'monospace' }}
                  placeholder="000000"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>
              {error && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '1rem' }}>{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="btn btn--primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                {loading ? 'Validando...' : 'Validar y descargar'}
              </button>
            </form>
            <button
              onClick={() => { setStep('form'); setOtp(''); setError(''); }}
              style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}
            >
              Volver al formulario
            </button>
          </div>
        )}

        {/* Step 3: Exito */}
        {step === 'success' && (
          <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(34,197,94,0.1)', marginBottom: '1rem' }}>
              <CheckCircle size={32} color="#22c55e" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Descarga iniciada
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '1rem' }}>
              Tu certificado laboral se esta descargando.
            </p>
            {empleadoInfo && (
              <div style={{ padding: '1rem', background: 'var(--bg-app)', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <strong>{empleadoInfo.nombre}</strong>
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Ingreso: {empleadoInfo.fechaIngreso ? new Date(empleadoInfo.fechaIngreso).toLocaleDateString('es-CO') : 'N/A'}
                  {empleadoInfo.fechaRetiro && ` | Retiro: ${new Date(empleadoInfo.fechaRetiro).toLocaleDateString('es-CO')}`}
                </p>
              </div>
            )}
            <button
              onClick={() => { setStep('form'); setOtp(''); setTokenId(null); setError(''); setEmpleadoInfo(null); }}
              className="btn btn--ghost"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Solicitar otro certificado
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
