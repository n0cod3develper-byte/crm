/**
 * PanelMonitoreo.jsx
 * Panel en tiempo real para supervisores, mostrando los técnicos activos,
 * sus turnos, servicios y alertas de límites legales.
 */
import React from 'react';
import { User, Clock, AlertTriangle, Play, CheckCircle, Navigation, MapPin } from 'lucide-react';

export function PanelMonitoreo({ turnos = [], loading = false }) {
  const getServiceStatusIcon = (status) => {
    switch (status) {
      case 'EN_DESPLAZAMIENTO':
        return <Navigation size={12} className="text-primary" style={{ color: 'var(--clr-primary-500)' }} />;
      case 'EN_SERVICIO':
        return <Play size={12} className="text-warning animate-pulse" style={{ color: 'var(--clr-warning)' }} />;
      case 'REGRESANDO':
        return <MapPin size={12} className="text-success" style={{ color: 'var(--clr-success)' }} />;
      default:
        return <CheckCircle size={12} style={{ color: 'var(--clr-gray-400)' }} />;
    }
  };

  const formatMin = (mins) => {
    if (mins == null) return '0 min';
    if (mins < 60) return `${mins} min`;
    const hrs = Math.round((mins / 60) * 100) / 100;
    return `${hrs}h`;
  };

  const activeTurnos = turnos.filter(t => t.estado === 'ACTIVO');
  const closedTurnos = turnos.filter(t => t.estado !== 'ACTIVO');

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ width: '2.5rem', height: '2.5rem' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Resumen numérico */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem'
      }}>
        <div style={{
          background: 'var(--bg-surface)',
          padding: '1.25rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>TÉCNICOS TRABAJANDO HOY</span>
          <h2 style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{turnos.length}</h2>
        </div>
        <div style={{
          background: 'var(--bg-surface)',
          padding: '1.25rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>TURNOS ACTIVOS</span>
          <h2 style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--clr-primary-500)' }}>{activeTurnos.length}</h2>
        </div>
        <div style={{
          background: 'var(--bg-surface)',
          padding: '1.25rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>ALERTAS LÍMITE LEGAL</span>
          <h2 style={{
            margin: '0.25rem 0 0 0',
            fontSize: 'var(--text-2xl)',
            fontWeight: 800,
            color: turnos.some(t => t.alerta_limite_legal) ? 'var(--clr-danger)' : 'var(--text-primary)'
          }}>
            {turnos.filter(t => t.alerta_limite_legal).length}
          </h2>
        </div>
      </div>

      {/* Grid de Técnicos Activos */}
      <div>
        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--clr-success)', display: 'inline-block' }} />
          Técnicos Activos en Campo ({activeTurnos.length})
        </h3>

        {activeTurnos.length === 0 ? (
          <div style={{
            background: 'var(--bg-surface)',
            padding: '2.5rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-sm)'
          }}>
            No hay técnicos con turnos activos en este momento.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem'
          }}>
            {activeTurnos.map((t) => {
              const totalTurnoMin = t.tiempo_total_min || 0;
              const hasAlert = t.alerta_limite_legal || (t.minutos_extras > 120);

              return (
                <div 
                  key={t.id}
                  style={{
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: `1px solid ${hasAlert ? 'var(--clr-danger)' : 'var(--border-color)'}`,
                    padding: '1.25rem',
                    boxShadow: hasAlert ? '0 0 12px rgba(239, 68, 68, 0.08)' : 'var(--shadow-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    transition: 'all var(--transition-base)'
                  }}
                >
                  {/* Cabecera Tarjeta */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', minWidth: 0 }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: 'var(--bg-app)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--clr-primary-500)',
                        flexShrink: 0
                      }}>
                        <User size={20} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h4 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.nombre_tecnico}
                        </h4>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Inicio: {new Date(t.inicio_turno).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {hasAlert && (
                      <span className="badge animate-pulse" style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: 'var(--clr-danger)',
                        border: '1px solid var(--clr-danger)',
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}>
                        <AlertTriangle size={10} /> +2h EXTRAS
                      </span>
                    )}
                  </div>

                  {/* Tiempos de Turno */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem',
                    background: 'var(--bg-app)',
                    borderRadius: 'var(--radius-md)'
                  }}>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>Tiempo Transcurrido</span>
                      <strong style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)' }}>{formatMin(totalTurnoMin)}</strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>Horas Extras</span>
                      <strong style={{
                        fontSize: 'var(--text-sm)',
                        fontFamily: 'var(--font-mono)',
                        color: t.minutos_extras > 0 ? 'var(--clr-warning)' : 'var(--text-primary)'
                      }}>
                        +{formatMin(t.minutos_extras)}
                      </strong>
                    </div>
                  </div>

                  {/* Servicios del Día */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)' }}>SERVICIOS HOY ({t.total_servicios})</span>
                    {(!t.servicios || t.servicios.length === 0) ? (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', italic: 'true' }}>
                        Sin servicios registrados aún.
                      </span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        {t.servicios.map((s, idx) => (
                          <div 
                            key={s.id || idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.5rem',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--bg-surface)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', minWidth: 0 }}>
                              {getServiceStatusIcon(s.estado_servicio)}
                              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {s.ot_consecutivo || 'Servicio'}
                              </span>
                              <span style={{
                                fontSize: '10px',
                                color: 'var(--text-secondary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                - {s.empresa}
                              </span>
                            </div>
                            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                              {formatMin(s.tiempo_total_servicio_min)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default PanelMonitoreo;
