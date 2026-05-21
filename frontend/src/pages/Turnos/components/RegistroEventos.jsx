/**
 * RegistroEventos.jsx
 * Panel táctil adaptativo según el estado del servicio activo.
 * Maneja los Eventos 2, 3 y 4.
 */
import React, { useState, useEffect } from 'react';
import { MapPin, CheckCircle, Navigation, Loader2, FileText } from 'lucide-react';

export function RegistroEventos({ servicio, onArrive, onFinish, onReturn, isSubmitting }) {
  const [eventTime, setEventTime] = useState('');
  const [notas, setNotas] = useState('');

  // Sincronizar el datetime local por defecto al cargar o cambiar de estado
  useEffect(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now - offset).toISOString().slice(0, 16);
    setEventTime(localISOTime);
    setNotas('');
  }, [servicio.estado_servicio, servicio.id]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!eventTime) return;

    const timeISO = new Date(eventTime).toISOString();

    if (servicio.estado_servicio === 'EN_DESPLAZAMIENTO') {
      onArrive({ servicioId: servicio.id, data: { inicio_servicio: timeISO } });
    } else if (servicio.estado_servicio === 'EN_SERVICIO') {
      onFinish({ servicioId: servicio.id, data: { fin_servicio: timeISO, notas_tecnico: notas } });
    } else if (servicio.estado_servicio === 'REGRESANDO') {
      onReturn({ servicioId: servicio.id, data: { ingreso_cargar: timeISO } });
    }
  };

  const getStatusConfig = () => {
    switch (servicio.estado_servicio) {
      case 'EN_DESPLAZAMIENTO':
        return {
          title: 'En Desplazamiento',
          subtitle: 'Vas en camino al cliente. Registra tu llegada cuando estés en el sitio.',
          btnText: 'Llegué donde el Cliente',
          color: 'var(--clr-primary-500)',
          bg: 'rgba(37, 99, 235, 0.05)',
          icon: Navigation,
          label: 'Llegada al sitio'
        };
      case 'EN_SERVICIO':
        return {
          title: 'Servicio en Curso',
          subtitle: 'Estás realizando el mantenimiento en el sitio del cliente.',
          btnText: 'Finalizar Mantenimiento',
          color: 'var(--clr-warning)',
          bg: 'rgba(245, 158, 11, 0.05)',
          icon: CheckCircle,
          label: 'Fin de mantenimiento'
        };
      case 'REGRESANDO':
        return {
          title: 'Regresando a CARGAR',
          subtitle: 'Mantenimiento finalizado. Vas de regreso a la sede central.',
          btnText: 'Ingresar a CARGAR',
          color: 'var(--clr-success)',
          bg: 'rgba(16, 185, 129, 0.05)',
          icon: MapPin,
          label: 'Llegada a base'
        };
      default:
        return {};
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <form 
      onSubmit={handleSubmit}
      style={{
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        position: 'relative'
      }}
    >
      {/* Indicador de OT activa */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
            SERVICIO ACTIVO
          </span>
          <h4 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--clr-primary-500)' }}>
            {servicio.ot_consecutivo || 'Servicio General'}
          </h4>
        </div>
        <div style={{
          padding: '4px 10px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '11px',
          fontWeight: 700,
          background: config.bg,
          color: config.color,
          border: `1px solid ${config.color}`
        }}>
          {config.title}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {servicio.empresa}
        </p>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {servicio.equipo} • {servicio.ot_detalle}
        </span>
      </div>

      <div style={{
        padding: '0.875rem',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-app)',
        borderLeft: `4px solid ${config.color}`,
        fontSize: 'var(--text-xs)',
        color: 'var(--text-secondary)'
      }}>
        {config.subtitle}
      </div>

      {/* Editor de Hora (Soporte Retroactivo) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>
          FECHA Y HORA DE REGISTRO ({config.label.toUpperCase()})
        </label>
        <input 
          type="datetime-local" 
          value={eventTime}
          onChange={(e) => setEventTime(e.target.value)}
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
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          * Si realizaste el evento anteriormente, ajusta la hora al valor exacto del suceso.
        </span>
      </div>

      {/* Campo Notas Técnico (Mandatorio en Evento 3: EN_SERVICIO → REGRESANDO) */}
      {servicio.estado_servicio === 'EN_SERVICIO' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <label style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}>
            <FileText size={14} /> NOTAS DEL TRABAJO REALIZADO *
          </label>
          <textarea 
            placeholder="Describe brevemente el mantenimiento, repuestos usados y reporte de horómetros..."
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            required
            rows={3}
            style={{
              width: '100%',
              padding: '0.625rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-sm)',
              resize: 'none'
            }}
          />
        </div>
      )}

      {/* Botón de Acción Táctil Grande */}
      <button
        type="submit"
        disabled={isSubmitting || (servicio.estado_servicio === 'EN_SERVICIO' && !notas.trim())}
        style={{
          width: '100%',
          padding: '0.875rem',
          borderRadius: 'var(--radius-md)',
          background: config.color,
          border: 'none',
          color: 'white',
          fontSize: 'var(--text-sm)',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          boxShadow: `0 4px 10px rgba(0, 0, 0, 0.05)`,
          opacity: (servicio.estado_servicio === 'EN_SERVICIO' && !notas.trim()) ? 0.6 : 1,
          transition: 'all var(--transition-fast)'
        }}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" size={18} /> Registrando evento...
          </>
        ) : (
          <>
            <Icon size={18} /> {config.btnText}
          </>
        )}
      </button>
    </form>
  );
}

export default RegistroEventos;
