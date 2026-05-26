/**
 * ResumenTurnoModal.jsx
 * Modal para registrar el Evento 5 (fin de turno) y confirmar el cierre de la jornada.
 * Maneja el flujo de forzar cierre si hay servicios inconclusos.
 */
import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';

export function ResumenTurnoModal({ isOpen, onClose, onConfirm, isSubmitting, errorIncompletos }) {
  const [finTurno, setFinTurno] = useState('');
  const [forzarCierre, setForzarCierre] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const offset = now.getTimezoneOffset() * 60000;
      const localISOTime = new Date(now - offset).toISOString().slice(0, 16);
      setFinTurno(localISOTime);
      setForzarCierre(false);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (!finTurno) return;
    onConfirm({
      fin_turno: new Date(finTurno).toISOString(),
      forzar: forzarCierre || !!errorIncompletos,
    });
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '480px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-app)'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>
              Cerrar Jornada Laboral
            </h3>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Registra tu hora final para calcular tus horas extras
            </span>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          {/* Alerta de servicios incompletos */}
          {errorIncompletos ? (
            <div style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--clr-danger)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                <AlertTriangle size={18} /> ¡Servicios Incompletos!
              </div>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Tienes <strong>{errorIncompletos.servicios?.length || 1} servicio(s)</strong> que no has reportado como "Completado" (Llegada a CARGAR).
              </p>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '0.25rem',
                padding: '0.5rem',
                background: 'rgba(239, 68, 68, 0.05)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer'
              }} onClick={() => setForzarCierre(!forzarCierre)}>
                <input 
                  type="checkbox"
                  id="forzar_check"
                  checked={forzarCierre}
                  onChange={(e) => setForzarCierre(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="forzar_check" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--clr-danger)', cursor: 'pointer' }}>
                  Entiendo e instruyo cerrar la jornada forzadamente.
                </label>
              </div>
            </div>
          ) : (
            <div style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--clr-success)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600
            }}>
              <ShieldCheck size={18} /> Todos tus servicios del día han sido completados correctamente.
            </div>
          )}

          {/* Selector de Fecha/Hora fin */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem'
            }}>
              <Calendar size={14} /> HORA DE CIERRE DE JORNADA
            </label>
            <input 
              type="datetime-local" 
              value={finTurno}
              onChange={(e) => setFinTurno(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.625rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-sm)'
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              * Indica la hora exacta en la que finalizas tu día laboral completo en CARGAR.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem',
          background: 'var(--bg-app)'
        }}>
          <button 
            type="button"
            onClick={onClose}
            className="btn btn--outline"
            style={{ padding: '0.5rem 1rem', fontSize: 'var(--text-sm)' }}
          >
            Cancelar
          </button>
          
          <button 
            type="button"
            disabled={!finTurno || isSubmitting || (!!errorIncompletos && !forzarCierre)}
            onClick={handleConfirm}
            className="btn btn--primary"
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: 'var(--text-sm)',
              background: 'var(--clr-primary-500)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              opacity: (!finTurno || isSubmitting || (!!errorIncompletos && !forzarCierre)) ? 0.6 : 1,
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={16} /> Cerrando...
              </>
            ) : (
              'Confirmar Cierre de Jornada'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResumenTurnoModal;
