import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Download, Edit, Wrench, User, Package,
  DollarSign, Building2, Clock, Truck, FileText, CheckCircle2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import api from '../../lib/api';

function getEstadoStyle(estado) {
  const map = {
    ABIERTA:    { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', label: 'Abierta' },
    EN_PROCESO: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', label: 'En Proceso' },
    LIQUIDADA:  { bg: 'rgba(34,197,94,0.15)',  color: '#4ade80', label: 'Liquidada' },
    CERRADA:    { bg: 'rgba(100,116,139,0.15)',color: '#94a3b8', label: 'Cerrada' },
  };
  return map[estado] || map.CERRADA;
}

const fmt = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CO') : '—';
const fmtTime = (t) => t ? t.substring(0, 5) : '—';
const fmtMins = (m) => m != null ? `${Math.floor(m/60)}h ${m%60}m` : '—';

export function OTDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: ot, isLoading } = useQuery({
    queryKey: ['ot-detail', id],
    queryFn: async () => {
      const { data } = await api.get(`/mantenimiento/ot/${id}`);
      return data.data;
    },
  });

  const handleDownloadPDF = async () => {
    try {
      toast.loading('Generando PDF...', { id: 'pdf' });
      const response = await api.get(`/mantenimiento/ot/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${ot.consecutivo}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF descargado', { id: 'pdf' });
    } catch {
      toast.error('Error al generar el PDF', { id: 'pdf' });
    }
  };

  const handleDownloadInvoicePDF = async () => {
    try {
      toast.loading('Descargando Factura...', { id: 'invoice-pdf' });
      const response = await api.get(`/facturacion/facturas/${ot.factura_id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${ot.factura_consecutivo || 'factura'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Factura descargada', { id: 'invoice-pdf' });
    } catch {
      toast.error('Error al descargar la factura', { id: 'invoice-pdf' });
    }
  };

  if (isLoading) {
    return (
      <div className="app-layout">
      <Topbar 
        title={ot?.consecutivo || 'Cargando...'} 
        subtitle={ot ? `Creada ${fmtDate(ot.created_at)}` : 'Espere un momento'} 
      />
      <main className="main-content">
        <div className="empty-state"><div className="spinner" style={{ width: '2rem', height: '2rem' }} /></div>
      </main>
      </div>
    );
  }

  if (!ot) {
    return (
      <div className="app-layout">
        <header className="header" />
        <main className="main-content">
          <div className="empty-state">
            <FileText size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">OT no encontrada</h2>
          </div>
        </main>
      </div>
    );
  }

  const est = getEstadoStyle(ot.estado);
  const tecnicos = ot.tecnicos_asignados || [];
  const repuestos = ot.repuestos_insumos || [];
  const actividadesPM = ot.pm_actividades || [];
  const liq = ot.liquidacion;
  const isPM = ot.tipo_mantenimiento === 'PREVENTIVO';
  
  const totalMO = tecnicos.reduce((s, t) => s + parseFloat(t.total_mano_obra || 0), 0);
  const totalRep = repuestos.reduce((s, r) => s + parseFloat(r.total || 0), 0);
  const canEdit = ot.estado === 'ABIERTA' || ot.estado === 'EN_PROCESO';

  return (
    <div className="app-layout">
      <Topbar 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <button className="btn btn--ghost" onClick={() => navigate('/mantenimiento')} style={{ padding: '0.25rem' }}>
              <ArrowLeft size={18} />
            </button>
            <div style={{ width: 1, height: 20, background: 'var(--border-color)' }} />
            <span>Orden de Trabajo #{ot.consecutivo}</span>
          </div>
        } 
        subtitle={`Creada el ${fmtDate(ot.created_at)}`} 
        rightContent={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {canEdit && (
              <button className="btn btn--secondary" onClick={() => navigate(`/mantenimiento/${id}/editar`)}>
                <Edit size={16} /> Editar
              </button>
            )}
            <button className="btn btn--primary" onClick={handleDownloadPDF}>
              <Download size={16} /> Descargar PDF
            </button>
          </div>
        } 
      />

      <main className="main-content" style={{ maxWidth: 1100 }}>

        {isPM && (
          <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(to right, rgba(67,56,202,0.05), transparent)', borderLeft: '4px solid var(--clr-primary-500)' }}>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem', color: 'var(--clr-primary-500)' }}>
              Información de Preventivo
            </h2>
            <div style={{ display: 'flex', gap: '2rem' }}>
              <Field label="Frecuencia Aplicada" value={ot.frecuencia_nombre || '—'} />
              <Field label="Horómetro Próximo Mantenimiento" value={ot.horometro_frecuencia ?? '—'} />
            </div>
          </div>
        )}

        {/* ─── Datos generales ──────────────────────────── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Wrench size={18} color="var(--clr-primary-400)" /> Datos Generales
          </h2>
          <div className="fields-grid-3cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <Field label="Empresa" icon={<Building2 size={14} />} value={ot.empresa_nombre} />
            <Field label="NIT" value={ot.empresa_nit || '—'} />
            <Field label="Responsable" value={ot.responsable || '—'} />
            <Field label="Equipo" icon={<Truck size={14} />} value={`${ot.equipo_marca} ${ot.equipo_modelo}`} />
            <Field label="Serial" value={ot.equipo_serial} />
            <Field label="Contacto" value={`${ot.contacto_empresa || '—'} ${ot.telefono_contacto ? '(' + ot.telefono_contacto + ')' : ''}`} />
            <Field label="Horómetro Inicial" value={ot.horometro_inicial ?? '—'} />
            <Field label="Horómetro Final" value={ot.horometro_final ?? '—'} />
          </div>

          {ot.detalle_servicio && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Detalle del servicio</div>
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '0.75rem', fontSize: '13px', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {ot.detalle_servicio}
              </div>
            </div>
          )}
          {ot.observaciones && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Observaciones</div>
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '0.75rem', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
                {ot.observaciones}
              </div>
            </div>
          )}
        </div>

        {/* ─── Actividades del Preventivo ──────────────── */}
        {isPM && actividadesPM.length > 0 && (
          <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(67,56,202,0.3)', borderTopWidth: 4 }}>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--clr-primary-500)' }}>
              <CheckCircle2 size={18} /> Actividades del Preventivo
            </h2>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}>#</th>
                    <th>Actividad</th>
                    <th>Estado</th>
                    <th>Ejecutor</th>
                    <th>Fecha/Hora</th>
                    <th>Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {actividadesPM.map(a => (
                    <tr key={a.id}>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>{a.orden}</td>
                      <td style={{ fontWeight: 600 }}>{a.nombre}</td>
                      <td>
                        <span className={`badge ${a.estado === 'COMPLETADA' ? 'badge--success' : a.estado === 'OMITIDA' ? 'badge--warning' : 'badge--gray'}`}>
                          {a.estado}
                        </span>
                      </td>
                      <td>{a.completada_por_nombre || '—'}</td>
                      <td style={{ fontSize: '12px' }}>{fmtDate(a.fecha_completado)}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{a.observacion || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── Técnicos ────────────────────────────────── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={18} color="var(--clr-primary-400)" /> Técnicos Asignados ({tecnicos.length})
          </h2>
          {tecnicos.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>Sin técnicos asignados</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Técnico</th>
                    <th>Fecha/Hora Salida</th>
                    <th>Fecha/Hora Regreso</th>
                    <th style={{ textAlign: 'right' }}>Tiempo</th>
                    <th style={{ textAlign: 'right' }}>Tarifa/h</th>
                    <th style={{ textAlign: 'right' }}>Total M.O.</th>
                  </tr>
                </thead>
                <tbody>
                  {tecnicos.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600 }}>{t.full_name}</td>
                      <td>{fmtDate(t.fecha_salida)} {fmtTime(t.hora_salida)}</td>
                      <td>{fmtDate(t.fecha_regreso)} {fmtTime(t.hora_regreso)}</td>
                      <td style={{ textAlign: 'right' }}>{fmtMins(t.tiempo_total_min)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(t.tarifa_hora)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(t.total_mano_obra)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ textAlign: 'right', marginTop: '0.75rem', fontWeight: 700, color: 'var(--clr-primary-400)', fontSize: '14px' }}>
            Total Mano de Obra: {fmt(totalMO)}
          </div>
        </div>

        {/* ─── Repuestos ───────────────────────────────── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={18} color="var(--clr-primary-400)" /> Repuestos e Insumos ({repuestos.length})
          </h2>
          {repuestos.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>Sin repuestos o insumos</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    {isPM && <th style={{ width: 80 }}>Origen</th>}
                    <th style={{ textAlign: 'right' }}>Cantidad</th>
                    <th>Unidad</th>
                    <th style={{ textAlign: 'right' }}>Precio Unit.</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th>Descargado</th>
                  </tr>
                </thead>
                <tbody>
                  {repuestos.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 500 }}>{r.descripcion}</td>
                      {isPM && (
                        <td>
                          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: 8, background: r.origen === 'PLANTILLA_PM' ? 'rgba(67,56,202,0.1)' : 'rgba(245,158,11,0.1)', color: r.origen === 'PLANTILLA_PM' ? '#4338ca' : '#f59e0b', fontWeight: 700 }}>
                            {r.origen === 'PLANTILLA_PM' ? 'PLANTILLA' : 'MANUAL'}
                          </span>
                        </td>
                      )}
                      <td style={{ textAlign: 'right' }}>{r.cantidad}</td>
                      <td>{r.unidad}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(r.precio_unitario)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(r.total)}</td>
                      <td>
                        <span className={`badge ${r.descargado ? 'badge--success' : 'badge--gray'}`}>
                          {r.descargado ? '✓ Sí' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ textAlign: 'right', marginTop: '0.75rem', fontWeight: 700, color: 'var(--clr-primary-400)', fontSize: '14px' }}>
            Total Repuestos: {fmt(totalRep)}
          </div>
        </div>

        {/* ─── Liquidación ─────────────────────────────── */}
        {liq && (
          <div className="liquid-grid-2cols" style={{ display: 'grid', gridTemplateColumns: ot.factura_id ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
            <div className="card" style={{
              border: '2px solid rgba(34,197,94,0.3)',
              background: 'linear-gradient(135deg, var(--bg-surface), rgba(34,197,94,0.03))',
            }}>
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DollarSign size={18} color="#22c55e" /> Liquidación
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem 3rem', maxWidth: 400, fontSize: '14px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Mano de Obra</span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(liq.total_mano_obra)}</span>
                <span style={{ color: 'var(--text-secondary)' }}>Total Repuestos</span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(liq.total_repuestos)}</span>
                <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                <span style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(liq.subtotal)}</span>
                <span style={{ color: 'var(--text-secondary)' }}>Impuesto ({liq.impuesto_pct}%)</span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(liq.impuesto_valor)}</span>
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#22c55e' }}>TOTAL FINAL</span>
                <span style={{ textAlign: 'right', fontSize: '20px', fontWeight: 800, color: '#22c55e' }}>{fmt(liq.total_final)}</span>
              </div>

              {liq.notas_liquidacion && (
                <div style={{ marginTop: '1rem', fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  Notas: {liq.notas_liquidacion}
                </div>
              )}
              <div style={{ marginTop: '0.75rem', fontSize: '12px', color: 'var(--text-muted)' }}>
                Liquidado el {fmtDate(liq.fecha_liquidacion)}
              </div>
            </div>

            {ot.factura_id && (
              <div className="card" style={{
                border: '2px solid var(--clr-primary-400)',
                background: 'linear-gradient(135deg, var(--bg-surface), rgba(59,130,246,0.03))',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={18} color="var(--clr-primary-500)" /> Información de Facturación
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <Field label="Consecutivo Interno" value={ot.factura_consecutivo} />
                    <Field label="Número Factura (SaaS)" value={ot.factura_numero_externo || 'Pendiente'} />
                    <Field label="Fecha Facturación" value={fmtDate(ot.fecha_facturada)} />
                    <Field label="Estado OT" value={<span className="badge badge--success" style={{ background: '#22c55e', color: 'white' }}>FACTURADA</span>} />
                  </div>
                </div>
                
                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <button 
                    className="btn btn--primary w-full" 
                    style={{ gap: '0.75rem', padding: '0.75rem' }}
                    onClick={handleDownloadInvoicePDF}
                  >
                    <Download size={18} /> Descargar Soporte de Factura
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

// Helper component
function Field({ label, value, icon }) {
  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.15rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
        {icon} {value}
      </div>
    </div>
  );
}
