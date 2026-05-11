import React from 'react';
import { Clock, Wrench, AlertTriangle, CheckCircle, XCircle, Package, Eye } from 'lucide-react';

const TIPO_LABELS = {
  correctivo: 'Correctivo',
  preventivo_250h: 'Preventivo 250h',
  preventivo_500h: 'Preventivo 500h',
  preventivo_1000h: 'Preventivo 1000h',
  inspeccion: 'Inspección',
  otro: 'Otro',
};

const TIPO_COLORS = {
  correctivo: { bg: 'rgba(239,68,68,0.12)', color: '#f87171' },
  preventivo_250h: { bg: 'rgba(34,197,94,0.12)', color: '#4ade80' },
  preventivo_500h: { bg: 'rgba(34,197,94,0.12)', color: '#4ade80' },
  preventivo_1000h: { bg: 'rgba(34,197,94,0.12)', color: '#4ade80' },
  inspeccion: { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa' },
  otro: { bg: 'rgba(156,163,175,0.12)', color: '#9ca3af' },
};

const CRITICIDAD_CONFIG = {
  leve:     { color: '#4ade80', bg: 'rgba(34,197,94,0.12)',   label: 'Leve' },
  moderado: { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', label: 'Moderado' },
  critico:  { color: '#f87171', bg: 'rgba(239,68,68,0.12)',   label: 'Crítico' },
};

const ESTADO_CIERRE = {
  operativo:                  { color: '#4ade80', icon: CheckCircle },
  operativo_con_restricciones:{ color: '#fbbf24', icon: AlertTriangle },
  en_espera_repuestos:        { color: '#60a5fa', icon: Package },
  fuera_de_servicio:          { color: '#f87171', icon: XCircle },
};

function formatMinutes(min) {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function HistorialTimeline({ registros = [], onVerDetalle, onNuevoRegistro }) {
  if (registros.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
        <Wrench size={40} style={{ opacity: 0.35, marginBottom: '0.75rem' }} />
        <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Sin registros de historial</p>
        <p style={{ fontSize: 'var(--text-sm)', marginBottom: '1.5rem' }}>
          Cada vez que el equipo ingrese al taller, crea un registro aquí.
        </p>
        {onNuevoRegistro && (
          <button className="btn btn--primary" onClick={onNuevoRegistro}>
            + Nuevo Registro
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Línea vertical */}
      <div style={{
        position: 'absolute', left: '1.25rem', top: '1.5rem', bottom: '1.5rem',
        width: 2, background: 'var(--border-color)', zIndex: 0,
      }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {registros.map((r) => {
          const tipoStyle = TIPO_COLORS[r.tipo_mantenimiento] || TIPO_COLORS.otro;
          const critConf = r.nivel_criticidad ? CRITICIDAD_CONFIG[r.nivel_criticidad] : null;
          const estadoConf = r.estado_equipo_al_cierre ? ESTADO_CIERRE[r.estado_equipo_al_cierre] : null;
          const EstadoIcon = estadoConf?.icon || CheckCircle;

          return (
            <div key={r.id} style={{ display: 'flex', gap: '1rem', position: 'relative', zIndex: 1 }}>
              {/* Nodo de la línea de tiempo */}
              <div style={{
                width: '2.5rem', height: '2.5rem', borderRadius: '50%', flexShrink: 0,
                background: tipoStyle.bg, border: `2px solid ${tipoStyle.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Wrench size={13} color={tipoStyle.color} />
              </div>

              {/* Tarjeta */}
              <div className="card" style={{ flex: 1, padding: '1rem', cursor: 'pointer' }}
                onClick={() => onVerDetalle?.(r)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {/* Izquierda */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '0.15rem 0.6rem', borderRadius: 'var(--radius-full)',
                        fontSize: 'var(--text-xs)', fontWeight: 700,
                        background: tipoStyle.bg, color: tipoStyle.color,
                      }}>
                        {TIPO_LABELS[r.tipo_mantenimiento] || r.tipo_mantenimiento}
                      </span>

                      {critConf && (
                        <span style={{
                          padding: '0.15rem 0.6rem', borderRadius: 'var(--radius-full)',
                          fontSize: 'var(--text-xs)', fontWeight: 700,
                          background: critConf.bg, color: critConf.color,
                        }}>
                          ⚠ {critConf.label}
                        </span>
                      )}

                      {r.ot_cerrada && (
                        <span style={{
                          padding: '0.15rem 0.6rem', borderRadius: 'var(--radius-full)',
                          fontSize: 'var(--text-xs)', fontWeight: 600,
                          background: 'rgba(34,197,94,0.1)', color: '#4ade80',
                        }}>
                          ✓ OT Cerrada
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      <span><Clock size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />{formatDate(r.fecha_hora_ingreso_taller)}</span>
                      <span>🔢 {r.horometro_al_ingreso} h</span>
                      {r.numero_ot && <span>OT: {r.numero_ot}</span>}
                    </div>

                    {r.fallas_encontradas && (
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, maxWidth: 420 }}>
                        {r.fallas_encontradas.length > 100
                          ? r.fallas_encontradas.slice(0, 100) + '…'
                          : r.fallas_encontradas}
                      </p>
                    )}
                  </div>

                  {/* Derecha */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem' }}>
                    {estadoConf && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--text-xs)', color: estadoConf.color }}>
                        <EstadoIcon size={12} />
                        <span style={{ fontWeight: 600 }}>
                          {r.estado_equipo_al_cierre?.replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}
                    {r.tiempo_en_taller_min != null && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        🔧 {formatMinutes(r.tiempo_en_taller_min)} en taller
                      </span>
                    )}
                    {r.costo_total_mantenimiento > 0 && (
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)' }}>
                        ${Number(r.costo_total_mantenimiento).toLocaleString('es-CO')}
                      </span>
                    )}
                    <button
                      className="btn btn--ghost btn--sm"
                      style={{ marginTop: '0.25rem', fontSize: 'var(--text-xs)' }}
                      onClick={(e) => { e.stopPropagation(); onVerDetalle?.(r); }}
                    >
                      <Eye size={12} /> Ver
                    </button>
                  </div>
                </div>

                {/* Técnicos */}
                {r.tecnicos?.length > 0 && (
                  <div style={{ marginTop: '0.625rem', paddingTop: '0.625rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {r.tecnicos.map(t => (
                      <span key={t.id} style={{
                        padding: '0.1rem 0.5rem', borderRadius: 'var(--radius-full)',
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
                        fontSize: '10px', color: 'var(--text-secondary)',
                      }}>
                        {t.full_name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
