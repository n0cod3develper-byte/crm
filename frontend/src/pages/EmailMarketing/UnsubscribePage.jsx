import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../lib/api';
import { Mail, CheckCircle2, AlertOctagon } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function UnsubscribePage() {
  const { token } = useParams();
  const [motivo, setMotivo] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Usar endpoint público directo
      await api.post(`/email-marketing/unsubscribe/${token}`, { motivo });
      setSubmitted(true);
      toast.success('Baja procesada correctamente');
    } catch (err) {
      setError(true);
      toast.error('Error al procesar la baja');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg-app)',
      padding: '24px',
      fontFamily: 'var(--font-sans)'
    }}>
      <div className="card" style={{
        maxWidth: '480px',
        width: '100%',
        padding: '2.5rem',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '24px', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
          CARGAR S.A.S.
        </div>

        {submitted ? (
          <div>
            <div style={{ display: 'inline-flex', padding: '12px', background: '#dcfce3', color: '#15803d', borderRadius: '50%', marginBottom: '1rem' }}>
              <CheckCircle2 size={32} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Baja confirmada exitosamente</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Tu correo ha sido removido de nuestras listas de distribución. Lamentamos que te vayas.
            </p>
          </div>
        ) : error ? (
          <div>
            <div style={{ display: 'inline-flex', padding: '12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '50%', marginBottom: '1rem' }}>
              <AlertOctagon size={32} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Enlace inválido o expirado</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              El token suministrado no es válido. Si continúas recibiendo correos no deseados por favor escribe a soporte@cargar.com.co
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)', textAlign: 'center' }}>
              Confirmar Solicitud de Baja
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'center' }}>
              ¿Estás seguro de que no deseas recibir más correos informativos de CARGAR S.A.S.?
            </p>

            <label className="label">Motivo (Opcional)</label>
            <select 
              className="input" 
              value={motivo} 
              onChange={e => setMotivo(e.target.value)}
              style={{ marginBottom: '1.5rem' }}
            >
              <option value="">Seleccionar...</option>
              <option value="No me interesa el contenido">No me interesa el contenido</option>
              <option value="Recibo demasiados correos">Recibo demasiados correos</option>
              <option value="No recuerdo haberme suscrito">No recuerdo haberme suscrito</option>
              <option value="Otro">Otro</option>
            </select>

            <button 
              type="submit" 
              className="btn btn--primary" 
              style={{ width: '100%', background: 'var(--clr-danger)', color: 'white', justifyContent: 'center' }}
              disabled={loading}
            >
              {loading ? 'Procesando...' : 'Confirmar baja'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
