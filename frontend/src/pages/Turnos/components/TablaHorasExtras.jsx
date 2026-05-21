/**
 * TablaHorasExtras.jsx
 * Tabla para supervisores para auditar, filtrar y aprobar horas extras calculadas por turno.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, AlertTriangle, MessageSquare, ShieldCheck, Loader2, BarChart3, UserCheck, Clock, ClipboardCheck, DollarSign } from 'lucide-react';
import turnosService from '../../../services/turnosService';
import DesgloseRecargos from './DesgloseRecargos';

export function TablaHorasExtras({ turnos = [], onApprove, isApproving, resumenSemanal }) {
  const [selectedTurnoId, setSelectedTurnoId] = useState(null);
  const [observaciones, setObservaciones] = useState('');

  const formatDateTime = (isoString) => {
    if (!isoString) return '--';
    const d = new Date(isoString);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' })
      + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatTime = (isoString) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatMin = (mins) => {
    if (mins == null) return '0.00h';
    return `${(mins / 60).toFixed(2)}h`;
  };

  const formatCOP = (value) => {
    if (value == null || value === 0) return '$0';
    return '$' + Number(value).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const getAprobadorNombre = (t) => {
    if (t.aprobador_nombre) {
      return `${t.aprobador_nombre}${t.aprobador_apellido ? ' ' + t.aprobador_apellido : ''}`;
    }
    if (t.aprobador_email) return t.aprobador_email;
    return null;
  };

  const handleApproveSubmit = (turnoId) => {
    onApprove({
      turnoId,
      data: {
        aprobado: true,
        observaciones: observaciones,
      }
    }).then(() => {
      setSelectedTurnoId(null);
      setObservaciones('');
    });
  };

  const closedTurnos = turnos.filter(t => t.estado === 'CERRADO' || t.estado === 'CERRADO_AUTO');
  const approvedCount = closedTurnos.filter(t => t.aprobado_por).length;
  const pendingCount = closedTurnos.length - approvedCount;

  // Costo total = base extras + recargo diurno (25%) + recargo nocturno (75%)
  const costoTotal = closedTurnos.reduce((sum, t) => {
    const base = Number(t.costo_extras) || 0;
    const recDiurno = Number(t.costo_recargo_diurno) || 0;
    const recNocturno = Number(t.costo_recargo_nocturno) || 0;
    return sum + base + recDiurno + recNocturno;
  }, 0);

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-md)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-app)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 800 }}>
              Auditoría e Historial de Horas Extras
            </h3>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Revisa el desglose de turnos cerrados y aprueba el registro de horas extras
            </span>
          </div>

          {/* Mini resumen */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.375rem 0.75rem',
              background: approvedCount > 0 ? 'rgba(34, 197, 94, 0.06)' : 'transparent',
              border: `1px solid ${approvedCount > 0 ? 'rgba(34, 197, 94, 0.2)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-sm)',
            }}>
              <ShieldCheck size={13} style={{ color: 'var(--clr-success)' }} />
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--clr-success)' }}>
                {approvedCount} aprobados
              </span>
            </div>
            {pendingCount > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.375rem 0.75rem',
                background: 'rgba(245, 158, 11, 0.06)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <ClipboardCheck size={13} style={{ color: 'var(--clr-warning)' }} />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--clr-warning)' }}>
                  {pendingCount} pendientes
                </span>
              </div>
            )}
            {costoTotal > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.375rem 0.75rem',
                background: 'rgba(16, 185, 129, 0.06)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <DollarSign size={13} style={{ color: 'var(--clr-success)' }} />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--clr-success)' }}>
                  Costo hoy: {formatCOP(costoTotal)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Resumen semanal */}
        {resumenSemanal && resumenSemanal.length > 0 && (
          <div style={{
            marginTop: '0.75rem',
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
            padding: '0.625rem 0.75rem',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
          }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <BarChart3 size={12} /> Resumen Semanal:
            </span>
            {resumenSemanal.map((r, idx) => (
              <span key={r.empleado_id || idx} style={{
                fontSize: '10px',
                color: 'var(--text-primary)',
                padding: '2px 6px',
                background: 'var(--bg-app)',
                borderRadius: '3px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <UserCheck size={10} />
                <strong>{r.nombre_tecnico}</strong>:
                {r.total_horas_extras_semana}h extras
                {r.costo_extras_semanal > 0 && (
                  <span style={{ color: 'var(--clr-success)', fontWeight: 600 }}>
                    {' • '}{formatCOP(r.costo_extras_semanal)}
                  </span>
                )}
                {r.hay_alerta_diaria ? (
                  <AlertTriangle size={10} style={{ color: 'var(--clr-danger)' }} />
                ) : null}
                {r.alerta_limite_semanal ? (
                  <span style={{ color: 'var(--clr-danger)', fontWeight: 700 }}>⚠️ {'>'}12h/sem</span>
                ) : null}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-app)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '0.875rem 1rem', fontWeight: 700 }}>Técnico</th>
              <th style={{ padding: '0.875rem 1rem', fontWeight: 700 }}>Fecha</th>
              <th style={{ padding: '0.875rem 1rem', fontWeight: 700 }}>Horario</th>
              <th style={{ padding: '0.875rem 1rem', fontWeight: 700, textAlign: 'center' }}>Total</th>
              <th style={{ padding: '0.875rem 1rem', fontWeight: 700, textAlign: 'center' }}>Extras Diurnas</th>
              <th style={{ padding: '0.875rem 1rem', fontWeight: 700, textAlign: 'center' }}>Extras Noct.</th>
              <th style={{ padding: '0.875rem 1rem', fontWeight: 700, textAlign: 'center' }}>Costo Extras</th>
              <th style={{ padding: '0.875rem 1rem', fontWeight: 700, textAlign: 'center' }}>Límite</th>
              <th style={{ padding: '0.875rem 1rem', fontWeight: 700 }}>Aprobación / Estado</th>
            </tr>
          </thead>
          <tbody>
            {closedTurnos.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No hay turnos cerrados en el rango seleccionado.
                </td>
              </tr>
            ) : (
              closedTurnos.map((t) => {
                const isSelected = selectedTurnoId === t.id;
                const isAuto = t.estado === 'CERRADO_AUTO';
                const hasAlert = t.alerta_limite_legal;



  return (
                  <React.Fragment key={t.id}>
                    <tr style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: isSelected ? 'var(--clr-primary-50)' : 'transparent',
                      transition: 'background var(--transition-fast)'
                    }}>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>{t.nombre_tecnico}</td>
                      <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>{t.fecha_turno}</td>
                      <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap', fontSize: 'var(--text-xs)' }}>
                        {formatTime(t.inicio_turno)} - {formatTime(t.fin_turno)}
                        {isAuto && (
                          <span style={{
                            marginLeft: '6px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: 'var(--clr-danger)',
                            padding: '1px 4px',
                            borderRadius: '3px',
                            fontSize: '9px',
                            fontWeight: 700
                          }}>
                            AUTO
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        {formatMin(t.tiempo_total_min)}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'center', fontFamily: 'var(--font-mono)', color: t.horas_extras_diurnas > 0 ? 'var(--clr-warning)' : 'inherit', fontWeight: t.horas_extras_diurnas > 0 ? 700 : 400 }}>
                        {t.horas_extras_diurnas > 0 ? `${t.horas_extras_diurnas}h` : '0h'}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'center', fontFamily: 'var(--font-mono)', color: t.horas_extras_nocturnas > 0 ? 'var(--clr-danger)' : 'inherit', fontWeight: t.horas_extras_nocturnas > 0 ? 700 : 400 }}>
                        {t.horas_extras_nocturnas > 0 ? `${t.horas_extras_nocturnas}h` : '0h'}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                        {hasAlert ? (
                          <span title="Excede el límite diario legal" style={{ color: 'var(--clr-danger)' }}>
                            <AlertTriangle size={16} style={{ margin: '0 auto' }} />
                          </span>
                        ) : (
                          <span style={{ color: 'var(--clr-success)', fontSize: '11px' }}>OK</span>
                        )}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-success)' }}>
                        {t.costo_extras > 0 ? formatCOP(t.costo_extras) : '—'}
                        {t.costo_recargo_diurno > 0 && (
                          <div style={{ fontSize: '9px', color: 'var(--clr-warning)', fontWeight: 400, fontFamily: 'var(--font-sans)' }}>
                            +{formatCOP(t.costo_recargo_diurno)} rec. diurno
                          </div>
                        )}
                        {t.costo_recargo_nocturno > 0 && (
                          <div style={{ fontSize: '9px', color: 'var(--clr-danger)', fontWeight: 400, fontFamily: 'var(--font-sans)' }}>
                            +{formatCOP(t.costo_recargo_nocturno)} rec. noct.
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        {t.aprobado_por ? (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem', color: 'var(--clr-success)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                            <ShieldCheck size={14} style={{ marginTop: '1px', flexShrink: 0 }} />
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                                <span className="badge" style={{
                                  background: 'rgba(34, 197, 94, 0.1)',
                                  color: 'var(--clr-success)',
                                  padding: '1px 6px',
                                  borderRadius: '3px',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                }}>APROBADO</span>
                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 400 }}>
                                  por: <strong>{getAprobadorNombre(t) || '—'}</strong>
                                </span>
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={10} />
                                {formatDateTime(t.fecha_aprobacion)}
                              </div>
                              {t.observaciones && (
                                <div style={{
                                  marginTop: '4px',
                                  padding: '4px 6px',
                                  background: 'rgba(34, 197, 94, 0.04)',
                                  border: '1px solid rgba(34, 197, 94, 0.12)',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  color: 'var(--text-secondary)',
                                  fontWeight: 400,
                                  lineHeight: 1.4
                                }}>
                                  💬 {t.observaciones}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : isSelected ? (
                          <button 
                            className="btn btn--ghost"
                            onClick={() => setSelectedTurnoId(null)}
                            style={{ fontSize: 'var(--text-xs)', padding: '4px 8px' }}
                          >
                            Cancelar
                          </button>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                              <span style={{
                                background: 'rgba(245, 158, 11, 0.1)',
                                color: 'var(--clr-warning)',
                                padding: '1px 6px',
                                borderRadius: '3px',
                                fontSize: '9px',
                                fontWeight: 700,
                              }}>
                                PENDIENTE
                              </span>
                            </div>
                            <button 
                              disabled={isApproving}
                              onClick={() => {
                                setSelectedTurnoId(t.id);
                                setObservaciones('');
                              }}
                              className="btn btn--primary"
                              style={{
                                fontSize: 'var(--text-xs)',
                                padding: '4px 10px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'var(--clr-primary-500)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer'
                              }}
                            >
                              <Check size={12} /> Evaluar
                            </button>
                            <button
                              onClick={() => {
                                setSelectedTurnoId(t.id);
                              }}
                              title={t.min_dom_fest_ord > 0 ? 'Incluye horas dominicales/festivas — Ver desglose CST' : 'Ver desglose CST'}
                              style={{
                                fontSize: '10px',
                                padding: '2px 8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: t.min_dom_fest_ord > 0 ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                                color: t.min_dom_fest_ord > 0 ? 'var(--clr-warning)' : 'var(--text-muted)',
                                border: t.min_dom_fest_ord > 0 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                transition: 'all var(--transition-fast)'
                              }}
                            >
                              <BarChart3 size={10} />
                              CST
                              {t.min_dom_fest_ord > 0 && (
                                <span style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  background: 'var(--clr-warning)',
                                  display: 'inline-block',
                                  animation: t.min_dom_fest_ord > 0 ? 'pulse 2s infinite' : 'none'
                                }} />
                              )}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    
                    {/* Fila expandida: desglose CST + aprobación */}
                    {isSelected && <ExpandedTurnoRow turnoId={t.id} />}

                    {/* Fila de ingreso de observaciones de aprobación */}
                    {isSelected && (
                      <tr style={{ background: 'var(--clr-primary-50)' }}>
                        <td colSpan="9" style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                              <MessageSquare size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                              <input 
                                type="text"
                                placeholder="Escribe observaciones adicionales para la aprobación de nómina (ej. autorizado por jefe de área)..."
                                value={observaciones}
                                onChange={(e) => setObservaciones(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem 0.5rem 0.5rem 2rem',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--border-color)',
                                  background: 'var(--bg-surface)',
                                  color: 'var(--text-primary)',
                                  fontFamily: 'var(--font-sans)',
                                  fontSize: 'var(--text-xs)'
                                }}
                              />
                            </div>
                            <button
                              disabled={isApproving}
                              onClick={() => handleApproveSubmit(t.id)}
                              className="btn btn--primary"
                              style={{
                                padding: '0.5rem 1rem',
                                fontSize: 'var(--text-xs)',
                                background: 'var(--clr-success)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              {isApproving ? (
                                <Loader2 className="animate-spin" size={12} />
                              ) : (
                                'Aprobar Horas Extras'
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Subcomponente: fila expandida con desglose CST ───────
function ExpandedTurnoRow({ turnoId }) {
  const { data: desglose, isLoading } = useQuery({
    queryKey: ['desgloseRecargos', turnoId],
    queryFn: () => turnosService.getDesgloseRecargos(turnoId),
    staleTime: 60000,
  });

  return (
    <tr style={{ background: 'var(--bg-app)' }}>
      <td colSpan="9" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
        <DesgloseRecargos desglose={desglose} loading={isLoading} />
      </td>
    </tr>
  );
}

export default TablaHorasExtras;
