import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Plus, Trash2, UserCheck, Edit, DollarSign } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import api from '../../lib/api';
import { usePermissions } from '../../contexts/PermissionsContext';
import { LiquidacionHorasModal } from './LiquidacionHorasModal';

const labelStyle = { fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 2 };
const valueStyle = { fontWeight: 500, fontSize: '13px' };
const sectionTitle = { fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '1.5rem 0 0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' };

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getUTCDate()).padStart(2,'0')}/${String(dt.getUTCMonth()+1).padStart(2,'0')}/${dt.getUTCFullYear()}`;
}
function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
}
function formatTime(t) { return t ? String(t).substring(0, 5) : '—'; }

const ESTADO_BADGE = { BORRADOR: 'gray', PENDIENTE: 'warning', REALIZADA: 'primary', LIQUIDADA: 'green', ANULADO: 'danger' };

export function RemisionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { esAdmin } = usePermissions();
  const [selectedOperario, setSelectedOperario] = React.useState('');
  const [showLiqModal, setShowLiqModal] = React.useState(false);

  const { data: remision, isLoading } = useQuery({
    queryKey: ['servicios', id],
    queryFn: async () => { const { data } = await api.get(`/servicios/${id}`); return data.data; },
  });

  const { data: horasLaborales = [] } = useQuery({
    queryKey: ['horas-laborales', id],
    queryFn: async () => { const { data } = await api.get(`/servicios/${id}/horas-laborales`); return data.data || []; },
    enabled: !!id,
  });

  const { data: operariosDisp = [] } = useQuery({
    queryKey: ['operarios-disponibles'],
    queryFn: async () => { const { data } = await api.get('/servicios/operarios-disponibles'); return data.data || []; },
  });

  const addOperarioMutation = useMutation({
    mutationFn: (empleado_id) => api.post(`/servicios/${id}/operarios`, { empleado_id }),
    onSuccess: () => { toast.success('Operario asignado'); qc.invalidateQueries({ queryKey: ['servicios', id] }); setSelectedOperario(''); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al asignar operario'),
  });

  const removeOperarioMutation = useMutation({
    mutationFn: (oid) => api.delete(`/servicios/${id}/operarios/${oid}`),
    onSuccess: () => { toast.success('Operario removido'); qc.invalidateQueries({ queryKey: ['servicios', id] }); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error'),
  });

  const updateEstadoMutation = useMutation({
    mutationFn: (estado) => api.put(`/servicios/${id}`, { estado }),
    onSuccess: () => { toast.success('Estado actualizado'); qc.invalidateQueries({ queryKey: ['servicios', id] }); qc.invalidateQueries({ queryKey: ['servicios'] }); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error'),
  });

  const deleteHorasMutation = useMutation({
    mutationFn: (hid) => api.delete(`/servicios/${id}/horas-laborales/${hid}`),
    onSuccess: () => { toast.success('Liquidación eliminada'); qc.invalidateQueries({ queryKey: ['horas-laborales', id] }); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar liquidación'),
  });

  const handleDownloadPDF = async () => {
    try {
      const res = await api.get(`/servicios/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `Remision-${remision.numero_remision}.pdf`; a.click();
    } catch { toast.error('Error generando PDF'); }
  };

  if (isLoading) return <div className="app-layout"><div className="empty-state"><div className="spinner" /></div></div>;
  if (!remision) return <div className="app-layout"><div className="empty-state"><p>Remisión no encontrada</p></div></div>;

  const operariosAsignados = remision.operarios || [];
  const totalLiquidado = horasLaborales.reduce((s, h) => s + parseFloat(h.total_liquidado || 0), 0);
  const horarioRows = [
    { label: 'Diurno',           horas: remision.horas_diurnas,        valor: remision.valor_hora_diurna },
    { label: 'Nocturno',         horas: remision.horas_nocturnas,       valor: remision.valor_hora_nocturna },
    { label: 'Festivo Diurno',   horas: remision.horas_fest_diurnas,    valor: remision.valor_hora_fest_dia },
    { label: 'Festivo Nocturno', horas: remision.horas_fest_nocturnas,  valor: remision.valor_hora_fest_noc },
    { label: 'Otro',             horas: remision.horas_otras,           valor: remision.valor_hora_otras },
  ];

  return (
    <div className="app-layout">
      <Topbar
        title={`Remisión No. ${remision.numero_remision}`}
        subtitle={remision.empresa_nombre}
        rightContent={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {remision.estado !== 'ANULADO' && (
              <button className="btn btn--outline" style={{ borderColor: 'rgba(34,197,94,0.5)', color: '#22c55e' }} onClick={() => setShowLiqModal(true)}>
                <DollarSign size={16} /> Horas Extras
              </button>
            )}
            {(esAdmin() || remision.estado === 'BORRADOR' || remision.estado === 'PENDIENTE' || remision.estado === 'REALIZADA') && (
              <button className="btn btn--ghost" onClick={() => navigate(`/servicios/${id}/editar`)}>
                <Edit size={16} /> Editar
              </button>
            )}
            {remision.estado === 'BORRADOR' && (
              <button className="btn btn--outline" onClick={() => updateEstadoMutation.mutate('PENDIENTE')}>Marcar como Pendiente</button>
            )}
            {remision.estado === 'PENDIENTE' && (
              <button className="btn btn--outline" onClick={() => updateEstadoMutation.mutate('REALIZADA')}>Marcar como Realizada</button>
            )}
            {remision.estado === 'REALIZADA' && (
              <button className="btn btn--outline" onClick={() => updateEstadoMutation.mutate('LIQUIDADA')}>Marcar como Liquidada</button>
            )}
            <button className="btn btn--primary" onClick={handleDownloadPDF}>
              <FileText size={16} /> Descargar PDF
            </button>
          </div>
        }
      />

      <main className="main-content">
        <button className="btn btn--ghost btn--sm" style={{ marginBottom: '1.5rem' }} onClick={() => navigate('/servicios')}>
          <ArrowLeft size={14} /> Volver
        </button>

        {/* ESTADO + METADATOS */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <span className={`badge badge--${ESTADO_BADGE[remision.estado] || 'gray'}`} style={{ fontSize: '12px', padding: '4px 12px' }}>
            {remision.estado}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Fecha: {formatDate(remision.fecha_servicio)}</span>
          {remision.hora_acordada && (
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              Hora Acordada: {new Date(remision.hora_acordada).toLocaleString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
            </span>
          )}
          {remision.forma_pago && (
            <span className={`badge badge--${remision.forma_pago === 'Credito' ? 'primary' : 'gray'}`} style={{ fontSize: '11px' }}>
              {remision.forma_pago}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          {/* Columna principal */}
          <div>
            <p style={sectionTitle}>Datos del Cliente</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem' }}>
              <div><span style={labelStyle}>Empresa</span><span style={valueStyle}>{remision.empresa_nombre}</span></div>
              <div><span style={labelStyle}>NIT</span><span style={valueStyle}>{remision.empresa_nit || '—'}</span></div>
              <div><span style={labelStyle}>Teléfono</span><span style={valueStyle}>{remision.empresa_telefono || '—'}</span></div>
              <div><span style={labelStyle}>Solicitado Por</span><span style={valueStyle}>{remision.solicitado_por || '—'}</span></div>
              <div style={{ gridColumn: '1 / -1' }}><span style={labelStyle}>Dirección de Servicio</span><span style={valueStyle}>{remision.direccion_servicio || '—'}</span></div>
            </div>

            <p style={sectionTitle}>Servicio Prestado</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem' }}>
              <div style={{ gridColumn: '1 / -1' }}><span style={labelStyle}>Servicio</span><span style={valueStyle}>{remision.servicio_codigo} — {remision.servicio_nombre}</span></div>
              <div><span style={labelStyle}>Equipo</span><span style={valueStyle}>{remision.equipo_marca ? `${remision.equipo_marca} ${remision.equipo_modelo} (${remision.equipo_serial || remision.equipo_serie || '—'})` : 'Sin equipo asignado'}</span></div>
              <div><span style={labelStyle}>No. Máquina</span><span style={valueStyle}>{remision.numero_maquina || '—'}</span></div>
              <div><span style={labelStyle}>Bonificación por Hora</span><span style={valueStyle}>{formatCOP(remision.bonificacion_hora)}</span></div>
              <div><span style={labelStyle}>Cantidad Horas</span><span style={valueStyle}>{remision.cantidad_horas}</span></div>
              <div><span style={labelStyle}>Valor Hora</span><span style={valueStyle}>{formatCOP(remision.valor_hora)}</span></div>
            </div>

            <p style={sectionTitle}>Tiempos — Operario Inicial</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem 1.5rem' }}>
              <div><span style={labelStyle}>Salida CARGAR</span><span style={valueStyle}>{formatTime(remision.hora_salida_cargar)}</span></div>
              <div><span style={labelStyle}>Llegada Cliente</span><span style={valueStyle}>{formatTime(remision.hora_llegada_cliente)}</span></div>
              <div><span style={labelStyle}>Salida Cliente</span><span style={valueStyle}>{formatTime(remision.hora_salida_cliente)}</span></div>
              <div><span style={labelStyle}>Llegada CARGAR</span><span style={valueStyle}>{formatTime(remision.hora_llegada_cargar)}</span></div>
              <div><span style={labelStyle}>Horómetro Salida</span><span style={valueStyle}>{remision.horometro_salida ?? '—'}</span></div>
              <div><span style={labelStyle}>Horómetro Regreso</span><span style={valueStyle}>{remision.horometro_regreso ?? '—'}</span></div>
            </div>

            {operariosAsignados.length > 1 && (
              <>
                <p style={sectionTitle}>Tiempos — Segundo Operario</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem 1.5rem' }}>
                  {remision.segundo_fecha_acordada && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={labelStyle}>Fecha Acordada (Op. 2)</span>
                      <span style={valueStyle}>{formatDate(remision.segundo_fecha_acordada)}</span>
                    </div>
                  )}
                  <div><span style={labelStyle}>Salida CARGAR</span><span style={valueStyle}>{formatTime(remision.segundo_hora_salida_cargar)}</span></div>
                  <div><span style={labelStyle}>Llegada Cliente</span><span style={valueStyle}>{formatTime(remision.segundo_hora_llegada_cliente)}</span></div>
                  <div><span style={labelStyle}>Salida Cliente</span><span style={valueStyle}>{formatTime(remision.segundo_hora_salida_cliente)}</span></div>
                  <div><span style={labelStyle}>Llegada CARGAR</span><span style={valueStyle}>{formatTime(remision.segundo_hora_llegada_cargar)}</span></div>
                  <div><span style={labelStyle}>Horómetro Salida</span><span style={valueStyle}>{remision.segundo_horometro_salida ?? '—'}</span></div>
                  <div><span style={labelStyle}>Horómetro Regreso</span><span style={valueStyle}>{remision.segundo_horometro_regreso ?? '—'}</span></div>
                </div>
              </>
            )}

            {horasLaborales.length > 0 && (() => {
              const colKeys = [
                { key: 'min_ord_diurna', label: 'Ord. Diurna' },
                { key: 'min_extra_diurna', label: 'Extra Diurna' },
              ];
              const colsToShow = colKeys.filter(col => horasLaborales.some(h => parseFloat(h[col.key] || 0) > 0));

              // Totales por columna
              const totalesMin = {};
              colsToShow.forEach(col => {
                totalesMin[col.key] = horasLaborales.reduce((s, h) => s + parseFloat(h[col.key] || 0), 0);
              });
              const totalLiqGeneral = horasLaborales.reduce((s, h) => s + parseFloat(h.total_liquidado || 0), 0);

              return (
                <div style={{ marginTop: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', margin: '1.5rem 0 0.75rem', paddingBottom: '0.4rem' }}>
                    <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                      Horas Extras
                    </p>
                    {remision.estado !== 'LIQUIDADA' && (
                      <button 
                        className="btn btn--primary btn--sm" 
                        onClick={() => { if(window.confirm('¿Confirmar liquidación? La remisión pasará a estado LIQUIDADA.')) updateEstadoMutation.mutate('LIQUIDADA'); }}
                        disabled={updateEstadoMutation.isPending}
                      >
                        Confirmar Liquidación
                      </button>
                    )}
                  </div>
                  <div className="table-wrapper" style={{ marginBottom: 0 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Operario</th>
                          <th>Fecha</th>
                          <th style={{ textAlign: 'center' }}>Entrada</th>
                          <th style={{ textAlign: 'center' }}>Salida</th>
                          {colsToShow.map(col => (
                            <th key={col.key} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{col.label}</th>
                          ))}
                          <th style={{ textAlign: 'right' }}>Total Horas Extras</th>
                          <th style={{ width: '40px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {horasLaborales.map(h => (
                          <tr key={h.id}>
                            <td style={{ fontWeight: 600 }}>{h.empleado_nombre}</td>
                            <td style={{ fontSize: 12 }}>{formatDate(h.fecha_trabajo)}</td>
                            <td style={{ fontSize: 12, textAlign: 'center' }}>{h.hora_entrada ? formatTime(h.hora_entrada) : '—'}</td>
                            <td style={{ fontSize: 12, textAlign: 'center' }}>{h.hora_salida ? formatTime(h.hora_salida) : '—'}</td>
                            {colsToShow.map(col => {
                              const min = parseFloat(h[col.key] || 0);
                              return (
                                <td key={col.key} style={{ textAlign: 'right', fontSize: 12 }}>
                                  {min > 0 ? `${Math.floor(min / 60)}h ${min % 60}m` : '—'}
                                </td>
                              );
                            })}
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>{formatCOP(h.total_liquidado)}</td>
                            <td style={{ textAlign: 'center' }}>
                              {(remision.estado === 'BORRADOR' || remision.estado === 'PENDIENTE' || remision.estado === 'REALIZADA') && (
                                <button className="btn btn--ghost btn--sm" style={{ color: 'var(--clr-danger)', padding: '0.25rem' }} onClick={() => { if(window.confirm('¿Eliminar esta liquidación?')) deleteHorasMutation.mutate(h.id); }}>
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {/* Fila de totales */}
                      <tfoot>
                        <tr style={{ borderTop: '2px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                          <td colSpan={4} style={{ fontWeight: 700, fontSize: 12, padding: '0.5rem 0.75rem' }}>TOTAL</td>
                          {colsToShow.map(col => {
                            const min = totalesMin[col.key] || 0;
                            return (
                              <td key={col.key} style={{ textAlign: 'right', fontWeight: 700, fontSize: 12, padding: '0.5rem 0.75rem' }}>
                                {min > 0 ? `${Math.floor(min / 60)}h ${min % 60}m` : '—'}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 13, color: '#22c55e', padding: '0.5rem 0.75rem' }}>{formatCOP(totalLiqGeneral)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })()}

            {remision.observaciones && (
              <>
                <p style={sectionTitle}>Observaciones</p>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '6px', padding: '0.75rem', fontSize: '13px' }}>{remision.observaciones}</div>
              </>
            )}
          </div>

          {/* Columna lateral: totales + operarios */}
          <div>
            <p style={sectionTitle}>Resumen Financiero</p>
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Bruto</span>
                <span>{formatCOP(remision.total_bruto)}</span>
              </div>
              {parseFloat(remision.iva_valor || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{`IVA (${remision.iva_pct}%)`}</span>
                  <span>{formatCOP(remision.iva_valor)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Descuentos</span>
                <span>{formatCOP(remision.descuentos)}</span>
              </div>
              {totalLiquidado > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Horas Extras</span>
                  <span style={{ color: '#22c55e', fontWeight: 600 }}>{formatCOP(totalLiquidado)}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.5rem', fontWeight: 700, fontSize: '14px' }}>
                <span>TOTAL NETO</span>
                <span style={{ color: 'var(--clr-primary-500)' }}>{formatCOP(remision.total_neto)}</span>
              </div>
            </div>

            <p style={sectionTitle}>Operarios Asignados</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {operariosAsignados.length === 0
                ? <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Sin operarios asignados</p>
                : operariosAsignados.map(op => (
                  <div key={op.asignacion_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <UserCheck size={14} color="var(--clr-primary-500)" />
                      <span style={{ fontWeight: 600, fontSize: '12px' }}>{op.full_name}</span>
                    </div>
                    {(remision.estado === 'BORRADOR' || remision.estado === 'PENDIENTE') && (
                      <button className="btn btn--ghost btn--sm" style={{ color: 'var(--clr-danger)' }} onClick={() => removeOperarioMutation.mutate(op.asignacion_id)}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))
              }
            </div>

            {/* Selector de operarios eliminado según solicitud del usuario */}
          </div>
        </div>
      </main>

      {showLiqModal && remision && (
        <LiquidacionHorasModal
          remision={remision}
          onClose={() => {
            setShowLiqModal(false);
            qc.invalidateQueries({ queryKey: ['servicios', id] });
            qc.invalidateQueries({ queryKey: ['horas-laborales', id] });
          }}
        />
      )}
    </div>
  );
}
