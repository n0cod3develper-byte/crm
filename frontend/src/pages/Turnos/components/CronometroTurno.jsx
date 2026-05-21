/**
 * CronometroTurno.jsx
 * Visualizador premium del cronómetro de la jornada laboral en tiempo real.
 */
import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, ShieldCheck } from 'lucide-react';

export function CronometroTurno({ inicioTurno, jornadaNormalMin = 440 }) {
  const [elapsedMin, setElapsedMin] = useState(0);
  const [timeString, setTimeString] = useState('00:00:00');

  useEffect(() => {
    if (!inicioTurno) return;

    const updateTimer = () => {
      const start = new Date(inicioTurno).getTime();
      const now = new Date().getTime();
      const diffMs = Math.max(0, now - start);

      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);

      setElapsedMin(diffMs / 60000);
      setTimeString(
        `${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [inicioTurno]);

  const totalMin = elapsedMin;
  const progressPct = Math.min(100, (totalMin / jornadaNormalMin) * 100);
  const isOvertime = totalMin > jornadaNormalMin;
  const extraMin = Math.max(0, totalMin - jornadaNormalMin);
  
  // Limite legal de extras en Colombia es 2 horas diarias (120 minutos)
  const isLimitExceeded = extraMin > 120;

  // Formato para mostrar horas extras en hh:mm
  const formatMinutesToHoursMins = (minutes) => {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hrs}h ${mins}m`;
  };

  return (
    <div className={`turno-timer-card ${isLimitExceeded ? 'timer-danger-glow' : isOvertime ? 'timer-warning-glow' : ''}`} style={{
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-lg)',
      padding: '1.5rem',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-md)',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      transition: 'all var(--transition-base)'
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute',
        top: '-20px',
        right: '-20px',
        opacity: 0.05,
        color: 'var(--text-primary)',
        pointerEvents: 'none'
      }}>
        <Clock size={120} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock className={isLimitExceeded ? 'animate-pulse text-danger' : isOvertime ? 'text-warning' : 'text-primary'} size={20} style={{
            color: isLimitExceeded ? 'var(--clr-danger)' : isOvertime ? 'var(--clr-warning)' : 'var(--clr-primary-500)'
          }} />
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Tiempo de Jornada
          </span>
        </div>

        {isLimitExceeded ? (
          <span className="badge badge--danger animate-pulse" style={{
            background: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--clr-danger)',
            padding: '4px 8px',
            borderRadius: '9999px',
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}>
            <AlertTriangle size={12} /> Límite Legal Superado
          </span>
        ) : isOvertime ? (
          <span className="badge" style={{
            background: 'rgba(245, 158, 11, 0.1)',
            color: 'var(--clr-warning)',
            padding: '4px 8px',
            borderRadius: '9999px',
            fontSize: 'var(--text-xs)',
            fontWeight: 700
          }}>
            Horas Extras
          </span>
        ) : (
          <span className="badge" style={{
            background: 'rgba(16, 185, 129, 0.1)',
            color: 'var(--clr-success)',
            padding: '4px 8px',
            borderRadius: '9999px',
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}>
            <ShieldCheck size={12} /> Jornada Normal
          </span>
        )}
      </div>

      <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0.5rem 0' }}>
        <h1 style={{
          fontSize: 'var(--text-3xl)',
          fontWeight: 800,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.05em',
          margin: 0,
          color: isLimitExceeded ? 'var(--clr-danger)' : 'var(--text-primary)',
          textShadow: isLimitExceeded ? '0 0 10px rgba(239, 68, 68, 0.2)' : 'none'
        }}>
          {timeString}
        </h1>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Inicio: {new Date(inicioTurno).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <div style={{
          height: '8px',
          width: '100%',
          background: 'var(--bg-app)',
          borderRadius: '9999px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${progressPct}%`,
            background: isLimitExceeded 
              ? 'linear-gradient(90deg, var(--clr-primary-500), var(--clr-warning), var(--clr-danger))'
              : isOvertime 
                ? 'linear-gradient(90deg, var(--clr-primary-500), var(--clr-warning))'
                : 'var(--clr-primary-500)',
            borderRadius: '9999px',
            transition: 'width 0.5s ease-out'
          }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          <span>Progreso: {Math.round(progressPct)}%</span>
          <span>Jornada Normal: {formatMinutesToHoursMins(jornadaNormalMin)}</span>
        </div>
      </div>

      {isOvertime && (
        <div style={{
          zIndex: 1,
          padding: '0.75rem',
          borderRadius: 'var(--radius-md)',
          background: isLimitExceeded ? 'rgba(239, 68, 68, 0.05)' : 'rgba(245, 158, 11, 0.05)',
          border: `1px solid ${isLimitExceeded ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
            <span style={{ fontWeight: 600, color: isLimitExceeded ? 'var(--clr-danger)' : 'var(--clr-warning)' }}>
              Horas Extras Acumuladas:
            </span>
            <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: isLimitExceeded ? 'var(--clr-danger)' : 'var(--clr-warning)' }}>
              +{formatMinutesToHoursMins(extraMin)}
            </span>
          </div>
          {isLimitExceeded && (
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--clr-danger)', opacity: 0.9 }}>
              ⚠️ Has superado el límite diario legal de 2 horas extras del CST colombiano.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default CronometroTurno;
