/**
 * ServicioCard.jsx
 * Tarjeta premium para visualizar los tiempos detallados de un servicio finalizado.
 */
import React from 'react';
import { Calendar, MapPin, Wrench, Shield, FileText, ChevronRight } from 'lucide-react';

export function ServicioCard({ servicio }) {
  const formatTime = (isoString) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatMin = (mins) => {
    if (mins == null) return '--';
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
  };

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-color)',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      boxShadow: 'var(--shadow-sm)',
      position: 'relative'
    }}>
      {/* Cabecera */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '0.5rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span style={{ fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--clr-primary-500)' }}>
              {servicio.ot_consecutivo || 'Servicio General'}
            </span>
            <span style={{
              background: 'rgba(16, 185, 129, 0.1)',
              color: 'var(--clr-success)',
              fontSize: '9px',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '4px'
            }}>
              COMPLETADO
            </span>
          </div>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
            {servicio.empresa}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            Total: {formatMin(servicio.tiempo_total_servicio_min)}
          </span>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
            Nº {servicio.numero_servicio_dia} del día
          </span>
        </div>
      </div>

      {/* Tiempos de servicio */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0.5rem',
        background: 'var(--bg-app)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.625rem',
        textAlign: 'center'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', color: 'var(--text-secondary)' }}>
            <MapPin size={10} />
            <span style={{ fontSize: '9px', fontWeight: 600 }}>Ida (Cargar)</span>
          </div>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', display: 'block', marginTop: '2px' }}>
            {formatMin(servicio.tiempo_desplazamiento_ida_min)}
          </span>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
            {formatTime(servicio.salida_cargar)} - {formatTime(servicio.inicio_servicio)}
          </span>
        </div>

        <div style={{ borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', color: 'var(--text-secondary)' }}>
            <Wrench size={10} />
            <span style={{ fontSize: '9px', fontWeight: 600 }}>Ejecución OT</span>
          </div>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', display: 'block', marginTop: '2px' }}>
            {formatMin(servicio.tiempo_servicio_efectivo_min)}
          </span>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
            {formatTime(servicio.inicio_servicio)} - {formatTime(servicio.fin_servicio)}
          </span>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', color: 'var(--text-secondary)' }}>
            <MapPin size={10} />
            <span style={{ fontSize: '9px', fontWeight: 600 }}>Vuelta (Cargar)</span>
          </div>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', display: 'block', marginTop: '2px' }}>
            {formatMin(servicio.tiempo_desplazamiento_vuelta_min)}
          </span>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
            {formatTime(servicio.fin_servicio)} - {formatTime(servicio.ingreso_cargar)}
          </span>
        </div>
      </div>

      {/* Notas Técnico */}
      {servicio.notas_tecnico && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          padding: '0.5rem 0.75rem',
          background: 'rgba(37, 99, 235, 0.02)',
          border: '1px dashed var(--border-subtle)',
          borderRadius: 'var(--radius-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
            <FileText size={10} />
            <span style={{ fontSize: '9px', fontWeight: 700 }}>REPORTE TÉCNICO:</span>
          </div>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
            {servicio.notas_tecnico}
          </p>
        </div>
      )}
    </div>
  );
}

export default ServicioCard;
