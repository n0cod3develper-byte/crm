import React from 'react';
import { Calendar, UserCheck, CircleDot, Pencil, Clock, Activity } from 'lucide-react';

const fmtFecha = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  dateStyle: 'medium',
  timeStyle: 'short',
});

const fmtSoloFecha = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  dateStyle: 'medium',
});

/** Etiqueta del estado en español, reutilizando los estados reales del módulo. */
export const ESTADO_LABEL = {
  new: 'Nuevo',
  contacted: 'Contactado',
  qualified: 'Calificado',
  converted: 'Convertido',
  dead: 'Descartado',
};

function formatear(valor, conHora = true) {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return (conHora ? fmtFecha : fmtSoloFecha).format(d);
}

/**
 * Resumen del ciclo de vida del lead.
 * Cuando un dato no tiene fuente real se muestra "No disponible": no se
 * reconstruyen valores que la base no respalda.
 */
export function LeadLifecycleSummary({ resumen, isLoading }) {
  if (isLoading) {
    return <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Cargando resumen…</div>;
  }
  if (!resumen) return null;

  const items = [
    {
      icon: Calendar, label: 'Creado el',
      valor: formatear(resumen.fechaCreacionOriginal || resumen.fecha_creacion, false),
    },
    {
      icon: UserCheck, label: 'Primera asignación',
      valor: formatear(resumen.fecha_primera_asignacion),
    },
    {
      icon: Activity, label: 'Responsable actual',
      valor: resumen.responsable_actual || null,
    },
    {
      icon: CircleDot, label: 'Estado actual',
      valor: ESTADO_LABEL[resumen.estado_actual] || resumen.estado_actual,
    },
    {
      icon: Pencil, label: 'Última modificación',
      valor: formatear(resumen.ultima_modificacion),
    },
    {
      icon: Clock, label: 'Última gestión comercial',
      // Solo una actividad comercial real. Si no la hay, NO se rellena con la
      // última modificación del lead: eso daría una imagen falsa de la gestión.
      valor: formatear(resumen.ultima_gestion),
      vacio: 'Sin gestión registrada',
    },
  ];

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
      gap: '0.75rem',
    }}>
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div key={it.label} style={{
            padding: '0.75rem', borderRadius: '6px',
            background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '0.3rem',
            }}>
              <Icon size={13} />
              {it.label}
            </div>
            <div style={{
              fontSize: 'var(--text-sm)', fontWeight: 600,
              color: it.valor ? 'var(--text-primary)' : 'var(--text-muted)',
            }}>
              {it.valor || it.vacio || 'No disponible'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
