/**
 * DesgloseRecargos.jsx
 * Componente visual que muestra el desglose completo de horas trabajadas
 * clasificadas por los 7 tipos de recargo según el CST colombiano.
 */
import React from 'react';
import { Sun, Moon, Clock, AlertTriangle, Calendar, ShieldAlert } from 'lucide-react';

const TIPOS = [
  {
    key: 'ord_diurnos',
    label: 'Ordinarias diurnas',
    color: 'var(--clr-success)',
    bgColor: 'rgba(34, 197, 94, 0.08)',
    icon: <Sun size={16} />,
    recargo: '+0%',
    recargoLabel: 'Hora normal',
    legal: 'CST Art. 158 — Jornada 6am–9pm',
  },
  {
    key: 'ord_nocturnos',
    label: 'Ordinarias nocturnas',
    color: 'var(--clr-primary-500)',
    bgColor: 'rgba(59, 130, 246, 0.08)',
    icon: <Moon size={16} />,
    recargo: '+35%',
    recargoLabel: '135%',
    legal: 'CST Art. 168 No.1',
  },
  {
    key: 'extra_diurnos',
    label: 'Extras diurnas',
    color: 'var(--clr-warning)',
    bgColor: 'rgba(245, 158, 11, 0.08)',
    icon: <Clock size={16} />,
    recargo: '+25%',
    recargoLabel: '125%',
    legal: 'CST Art. 168 No.2',
  },
  {
    key: 'extra_nocturnos',
    label: 'Extras nocturnas',
    color: 'var(--clr-danger)',
    bgColor: 'rgba(239, 68, 68, 0.08)',
    icon: <Moon size={16} />,
    recargo: '+75%',
    recargoLabel: '175%',
    legal: 'CST Art. 168 No.3',
  },
  {
    key: 'dom_fest_ord',
    label: 'Dom/Festivo ordinarias',
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.08)',
    icon: <Calendar size={16} />,
    recargo: '+75%',
    recargoLabel: '175%',
    legal: 'CST Art. 171',
  },
  {
    key: 'dom_fest_extra_d',
    label: 'Dom/Festivo extras diurnas',
    color: '#dc2626',
    bgColor: 'rgba(220, 38, 38, 0.08)',
    icon: <ShieldAlert size={16} />,
    recargo: '+100%',
    recargoLabel: '200%',
    legal: 'CST Art. 171 y 168',
  },
  {
    key: 'dom_fest_extra_n',
    label: 'Dom/Festivo extras nocturnas',
    color: '#450a0a',
    bgColor: 'rgba(69, 10, 10, 0.08)',
    icon: <ShieldAlert size={16} />,
    recargo: '+150%',
    recargoLabel: '250%',
    legal: 'CST Art. 171 y 168',
  },
];

export default function DesgloseRecargos({ desglose, loading }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
      </div>
    );
  }

  if (!desglose) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
        No hay datos de recargos disponibles para este turno.
      </div>
    );
  }

  const tiposConHoras = TIPOS.filter(t => {
    const d = desglose.desglose?.[t.key];
    return d && d.minutos > 0;
  });

  // Generar resumen en texto plano
  const generarResumenTexto = () => {
    const partes = [];
    if (!desglose.desglose) return '';
    const d = desglose.desglose;
    if (d.ord_diurnos?.minutos > 0) partes.push(`${(d.ord_diurnos.minutos / 60).toFixed(1)}h ordinarias diurnas`);
    if (d.ord_nocturnos?.minutos > 0) partes.push(`${(d.ord_nocturnos.minutos / 60).toFixed(1)}h nocturnas`);
    if (d.extra_diurnos?.minutos > 0) partes.push(`${(d.extra_diurnos.minutos / 60).toFixed(1)}h extras diurnas`);
    if (d.extra_nocturnos?.minutos > 0) partes.push(`${(d.extra_nocturnos.minutos / 60).toFixed(1)}h extras nocturnas`);
    if (d.dom_fest_ord?.minutos > 0) partes.push(`${(d.dom_fest_ord.minutos / 60).toFixed(1)}h dom/fest ordinarias`);
    if (d.dom_fest_extra_d?.minutos > 0) partes.push(`${(d.dom_fest_extra_d.minutos / 60).toFixed(1)}h dom/fest extras diurnas`);
    if (d.dom_fest_extra_n?.minutos > 0) partes.push(`${(d.dom_fest_extra_n.minutos / 60).toFixed(1)}h dom/fest extras nocturnas`);
    return partes.length > 0 ? partes.join(' + ') : 'Sin horas registradas';
  };

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-color)',
      overflow: 'hidden',
    }}>
      {/* Cabecera con datos del día */}
      <div style={{
        padding: '1rem 1.25rem',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-app)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <h4 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 700 }}>
          Desglose de Horas CST
        </h4>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {desglose.es_festivo && (
            <span style={{
              background: 'rgba(139, 92, 246, 0.1)',
              color: '#8b5cf6',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '10px',
              fontWeight: 700,
              border: '1px solid rgba(139, 92, 246, 0.2)',
            }}>
              🎉 {desglose.nombre_festivo}
            </span>
          )}
          {desglose.es_domingo && !desglose.es_festivo && (
            <span style={{
              background: 'rgba(59, 130, 246, 0.1)',
              color: 'var(--clr-primary-500)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '10px',
              fontWeight: 700,
            }}>
              📅 Domingo
            </span>
          )}
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Jornada: {desglose.jornada_normal_min || 440}min
          </span>
        </div>
      </div>

      {/* Lista de tipos con horas */}
      <div style={{ padding: '1rem 1.25rem' }}>
        {tiposConHoras.length === 0 ? (
          <div style={{ padding: '1rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
            Solo horas ordinarias — sin recargos aplicables.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {tiposConHoras.map(tipo => {
              const d = desglose.desglose?.[tipo.key];
              if (!d || d.minutos === 0) return null;
              const totalMin = desglose.total_minutos || 1;
              const pct = Math.round((d.minutos / totalMin) * 100);

              return (
                <div key={tipo.key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.625rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  background: tipo.bgColor,
                  border: `1px solid ${tipo.color}20`,
                }}>
                  <div style={{ color: tipo.color, flexShrink: 0 }}>
                    {tipo.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {tipo.label}
                      </span>
                      <span style={{
                        fontSize: 'var(--text-xs)',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 800,
                        color: tipo.color,
                      }}>
                        {d.horas?.toFixed(2) || (d.minutos / 60).toFixed(2)}h
                      </span>
                    </div>
                    {/* Barra de proporción */}
                    <div style={{
                      marginTop: '4px',
                      height: '4px',
                      background: 'var(--bg-app)',
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: tipo.color,
                        borderRadius: '2px',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: '2px',
                    }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {d.minutos} min · {tipo.legal}
                      </span>
                      <span style={{ fontSize: '10px', color: tipo.color, fontWeight: 600 }}>
                        {tipo.recargo}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Resumen en texto plano */}
        <div style={{
          marginTop: '0.75rem',
          padding: '0.75rem',
          background: 'var(--bg-app)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          fontStyle: 'italic',
        }}>
          {generarResumenTexto()}
        </div>

        {/* Alerta límite legal */}
        {desglose.alerta_limite_legal && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.625rem 0.75rem',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid var(--clr-danger)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--clr-danger)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
          }}>
            <AlertTriangle size={14} />
            <span>Este turno supera las 2 horas extras diarias permitidas por el CST. Requiere aprobación del supervisor.</span>
          </div>
        )}
      </div>
    </div>
  );
}
