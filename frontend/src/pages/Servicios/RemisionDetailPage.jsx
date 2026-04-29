import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Plus, Trash2, UserCheck, Edit } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import api from '../../lib/api';

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
  const [selectedOperario, setSelectedOperario] = React.useState('');

  const { data: remision, isLoading } = useQuery({
    queryKey: ['servicios', id],
    queryFn: async () => { const { data } = await api.get(`/servicios/${id}`); return data.data; },
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

  const handleDownloadPDF = async () => {
    try {
      const res = await api.get(`/servicios/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `Remision-${remision.numero_remision}.pdf`; a.click();
    } catch { toast.error('Error generando PDF'); }
  };

  if (isLoading) return <div className="app-layout"><Sidebar /><div className="empty-state"><div className="spinner" /></div></div>;
  if (!remision) return <div className="app-layout"><Sidebar /><div className="empty-state"><p>Remisión no encontrada</p></div></div>;

  const operariosAsignados = remision.operarios || [];
  const horarioRows = [
    { label: 'Diurno',           horas: remision.horas_diurnas,        valor: remision.valor_hora_diurna },
    { label: 'Nocturno',         horas: remision.horas_nocturnas,       valor: remision.valor_hora_nocturna },
    { label: 'Festivo Diurno',   horas: remision.horas_fest_diurnas,    valor: remision.valor_hora_fest_dia },
    { label: 'Festivo Nocturno', horas: remision.horas_fest_nocturnas,  valor: remision.valor_hora_fest_noc },
    { label: 'Otro',             horas: remision.horas_otras,           valor: remision.valor_hora_otras },
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <Topbar
        title={`Remisión No. ${remision.numero_remision}`}
        subtitle={remision.empresa_nombre}
        rightContent={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(remision.estado === 'BORRADOR' || remision.estado === 'PENDIENTE' || remision.estado === 'REALIZADA') && (
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
              <div><span style={labelStyle}>Equipo</span><span style={valueStyle}>{remision.equipo_marca} {remision.equipo_modelo} ({remision.equipo_serial})</span></div>
              <div><span style={labelStyle}>No. Máquina</span><span style={valueStyle}>{remision.numero_maquina || '—'}</span></div>
              <div><span style={labelStyle}>Cantidad Horas</span><span style={valueStyle}>{remision.cantidad_horas}</span></div>
              <div><span style={labelStyle}>Valor Hora</span><span style={valueStyle}>{formatCOP(remision.valor_hora)}</span></div>
            </div>

            <p style={sectionTitle}>Tiempos</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem 1.5rem' }}>
              <div><span style={labelStyle}>Salida CARGAR</span><span style={valueStyle}>{formatTime(remision.hora_salida_cargar)}</span></div>
              <div><span style={labelStyle}>Llegada Cliente</span><span style={valueStyle}>{formatTime(remision.hora_llegada_cliente)}</span></div>
              <div><span style={labelStyle}>Salida Cliente</span><span style={valueStyle}>{formatTime(remision.hora_salida_cliente)}</span></div>
              <div><span style={labelStyle}>Llegada CARGAR</span><span style={valueStyle}>{formatTime(remision.hora_llegada_cargar)}</span></div>
              <div><span style={labelStyle}>Horómetro Salida</span><span style={valueStyle}>{remision.horometro_salida ?? '—'}</span></div>
              <div><span style={labelStyle}>Horómetro Regreso</span><span style={valueStyle}>{remision.horometro_regreso ?? '—'}</span></div>
            </div>

            <p style={sectionTitle}>Desglose por Horario</p>
            <div className="table-wrapper" style={{ marginBottom: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Horario</th>
                    <th style={{ textAlign: 'right' }}>Horas</th>
                    <th style={{ textAlign: 'right' }}>Vr. Hora</th>
                    <th style={{ textAlign: 'right' }}>Vr. Parcial</th>
                  </tr>
                </thead>
                <tbody>
                  {horarioRows.map(row => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td style={{ textAlign: 'right' }}>{parseFloat(row.horas) > 0 ? row.horas : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{parseFloat(row.valor) > 0 ? formatCOP(row.valor) : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{(parseFloat(row.horas) > 0 && parseFloat(row.valor) > 0) ? formatCOP(parseFloat(row.horas) * parseFloat(row.valor)) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
              {[
                { l: 'Total Bruto', v: remision.total_bruto },
                { l: `IVA (${remision.iva_pct}%)`, v: remision.iva_valor },
                { l: 'Descuentos', v: remision.descuentos },
              ].map(({ l, v }) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{l}</span>
                  <span>{formatCOP(v)}</span>
                </div>
              ))}
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

            {(remision.estado === 'BORRADOR' || remision.estado === 'PENDIENTE') && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select className="input" style={{ flex: 1 }} value={selectedOperario} onChange={e => setSelectedOperario(e.target.value)}>
                  <option value="">Seleccionar operario...</option>
                  {operariosDisp
                    .filter(o => !operariosAsignados.find(a => a.empleado_id === o.id))
                    .map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)
                  }
                </select>
                <button
                  className="btn btn--primary btn--sm"
                  disabled={!selectedOperario || addOperarioMutation.isPending}
                  onClick={() => selectedOperario && addOperarioMutation.mutate(selectedOperario)}
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
