import React, { useEffect, useState } from 'react';
import { FileText, AlertCircle, ArrowLeft } from 'lucide-react';

export function DescargarCertificadoPage() {
  const [error, setError] = useState(null);

  useEffect(() => {
    // Esta página se accede cuando el token de descarga es inválido/expirado
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) {
      setError(decodeURIComponent(params.get('error')));
    }
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ maxWidth: '480px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(239,68,68,0.1)', marginBottom: '1rem' }}>
            <AlertCircle size={32} color="#ef4444" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Enlace no disponible
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '1.5rem' }}>
            {error || 'El enlace de descarga ha expirado o no es válido. Solicita un nuevo código de verificación.'}
          </p>
          <a
            href="/certificados/solicitar"
            className="btn btn--primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
          >
            <ArrowLeft size={16} /> Solicitar nuevo certificado
          </a>
        </div>
      </div>
    </div>
  );
}
