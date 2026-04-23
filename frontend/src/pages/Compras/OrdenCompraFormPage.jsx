import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Download, Send, CheckCircle, XCircle,
  FileText, Building2, CreditCard, Calendar, Truck,
  DollarSign, MessageSquare, Package
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Sidebar } from '../../components/layout/Sidebar';
import api from '../../lib/api';

export function OrdenCompraFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  
  const { data: oc, isLoading } = useQuery({
    queryKey: ['oc-detail', id],
    queryFn: async () => {
      const { data } = await api.get(`/compras/oc/${id}`);
      // Normalize: handle both { data: {...} } and direct object shapes
      const result = data?.data ?? data;
      if (result && result.estado) result.estado = result.estado.trim();
      return result;
    },
    enabled: !!id,
  });

  const sendForApprovalMut = useMutation({
    mutationFn: () => api.post(`/compras/oc/${id}/enviar-aprobacion`),
    onSuccess: () => {
      toast.success('OC enviada para aprobación');
      qc.invalidateQueries({ queryKey: ['oc-detail', id] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al enviar'),
  });

  const approveMut = useMutation({
    mutationFn: (comentario) => api.post(`/compras/oc/${id}/aprobar`, { comentario }),
    onSuccess: () => {
      toast.success('OC aprobada correctamente');
      qc.invalidateQueries({ queryKey: ['oc-detail', id] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al aprobar'),
  });

  const rejectMut = useMutation({
    mutationFn: (comentario) => api.post(`/compras/oc/${id}/rechazar`, { comentario }),
    onSuccess: () => {
      toast.success('OC rechazada');
      qc.invalidateQueries({ queryKey: ['oc-detail', id] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al rechazar'),
  });

  const emitMut = useMutation({
    mutationFn: () => api.post(`/compras/oc/${id}/emitir`),
    onSuccess: () => {
      toast.success('OC emitida formalmente');
      qc.invalidateQueries({ queryKey: ['oc-detail', id] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al emitir'),
  });

  const handleDownloadPDF = async () => {
    try {
      toast.loading('Generando PDF...', { id: 'pdf-oc' });
      const response = await api.get(`/compras/oc/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `OC-${oc.consecutivo}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF descargado', { id: 'pdf-oc' });
    } catch {
      toast.error('Error al generar el PDF', { id: 'pdf-oc' });
    }
  };

  if (isLoading) return <div className="app-layout"><Sidebar /><main className="main-content"><div className="spinner" /></main></div>;
  if (!oc) return <div className="app-layout"><Sidebar /><main className="main-content"><div className="empty-state">OC no encontrada</div></main></div>;

  const fmt = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CO') : '—';

  const estado = oc?.estado?.trim() || '';
  const canSend    = estado === 'BORRADOR';
  const canApprove = estado === 'EN_APROBACION';
  const canEmit    = estado === 'APROBADA';
  const canReceive = estado === 'EMITIDA' || estado === 'RECIBIDA_PARCIAL';

  return (
    <div className="app-layout">
      <Sidebar />
      <header className="header">
        <div className="flex items-center gap-3">
          <button className="btn btn--ghost" onClick={() => navigate('/compras/oc')}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
               <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Orden de Compra {oc.consecutivo}</h1>
               <span className={`badge ${oc.estado === 'APROBADA' || oc.estado.startsWith('RECIBIDA') ? 'badge--success' : (oc.estado === 'EN_APROBACION' ? 'badge--warning' : 'badge--gray')}`}>
                  {oc.estado}
               </span>
            </div>
            <p className="text-sm text-muted">Gestión de detalle y autorizaciones</p>
          </div>
        </div>
        <div className="flex gap-2">
           <button className="btn btn--secondary" onClick={handleDownloadPDF}>
              <Download size={16} /> PDF
           </button>
           {canSend && (
             <button className="btn btn--primary" onClick={() => sendForApprovalMut.mutate()} disabled={sendForApprovalMut.isPending}>
                <Send size={16} /> Solicitar Aprobación
             </button>
           )}
           {canEmit && (
              <button className="btn btn--primary" onClick={() => emitMut.mutate()} disabled={emitMut.isPending}>
                 <CheckCircle size={16} /> Emitir OC
              </button>
           )}
           {canReceive && (
              <button className="btn btn--primary" onClick={() => navigate(`/compras/recepcion/${id}`)}>
                 <Package size={16} /> Recibir Mercancía
              </button>
           )}
        </div>
      </header>

      <main className="main-content" style={{ maxWidth: 1100, display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Section 1: General Data */}
          <div className="card">
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Building2 size={18} color="var(--clr-primary-400)" /> Información del Proveedor y Compra
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
               <div>
                  <div className="text-xs text-muted font-bold uppercase mb-1">Proveedor</div>
                  <div className="font-semibold text-lg">{oc.proveedor_nombre}</div>
                  <div className="text-sm text-muted">{oc.proveedor_nit}</div>
                  <div className="text-sm text-muted">{oc.proveedor_direccion}</div>
                  <div className="text-sm text-muted">{oc.email_principal} | {oc.telefono_principal}</div>
               </div>
               <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '0.5rem 1rem', alignItems: 'center' }}>
                  <div className="text-xs text-muted font-bold uppercase">Condición Pago</div>
                  <div className="text-sm font-semibold">{oc.condicion_pago?.replace('_', ' ')}</div>
                  <div className="text-xs text-muted font-bold uppercase">Fecha OC</div>
                  <div className="text-sm">{fmtDate(oc.created_at)}</div>
                  <div className="text-xs text-muted font-bold uppercase">Moneda</div>
                  <div className="text-sm">COP (Peso Colombiano)</div>
               </div>
            </div>
          </div>

          {/* Section 2: Items */}
          <div className="card">
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Package size={18} color="var(--clr-primary-400)" /> Ítems de la Orden
            </h2>
            <div className="table-wrapper">
               <table>
                  <thead>
                     <tr>
                        <th>Descripción</th>
                        <th>Marca</th>
                        <th style={{ textAlign: 'right' }}>Cant.</th>
                        <th>Unidad</th>
                        <th style={{ textAlign: 'right' }}>Unitario</th>
                        <th style={{ textAlign: 'right' }}>IVA %</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                     </tr>
                  </thead>
                  <tbody>
                     {oc.items?.map((item, idx) => (
                       <tr key={idx}>
                          <td className="font-medium">{item.descripcion}</td>
                          <td className="text-muted">{item.marca || '—'}</td>
                          <td style={{ textAlign: 'right' }}>{item.cantidad_ordenada}</td>
                          <td>{item.unidad}</td>
                          <td style={{ textAlign: 'right' }}>{fmt(item.precio_unitario)}</td>
                          <td style={{ textAlign: 'right' }}>{item.iva_pct}%</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(item.total_item)}</td>
                       </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          </div>

          {/* Section 3: Approvals Log */}
          {oc.aprobaciones?.length > 0 && (
            <div className="card">
               <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={18} color="var(--clr-primary-400)" /> Historial de Aprobaciones
               </h2>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {oc.aprobaciones.map((a, i) => (
                    <div key={i} className="flex gap-4 p-3" style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', borderLeft: `4px solid ${a.estado === 'APROBADO' ? 'var(--clr-success)' : 'var(--clr-danger)'}` }}>
                       <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-surface)', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 800 }}>
                          {a.aprobador?.charAt(0)}
                       </div>
                       <div className="flex-1">
                          <div className="flex justify-between">
                             <div className="font-bold text-sm">{a.aprobador} <span className="text-muted font-normal">(Nivel {a.nivel})</span></div>
                             <div className="text-xs text-muted">{fmtDate(a.fecha_accion)}</div>
                          </div>
                          <div className="text-xs font-bold" style={{ color: a.estado === 'APROBADO' ? 'var(--clr-success)' : 'var(--clr-danger)' }}>{a.estado}</div>
                          {a.comentario && <div className="text-sm mt-1 p-2 bg-surface rounded italic" style={{ fontSize: '13px' }}>"{a.comentario}"</div>}
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}
        </div>

        {/* Sidebar: Totals and Approval Actions */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: 'calc(var(--header-height) + 1.5rem)' }}>
          <div className="card" style={{ background: 'var(--clr-gray-900)', color: 'white', border: 'none' }}>
             <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '1.5rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Resumen Financiero
             </h2>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem 2rem', fontSize: '14px' }}>
                <span style={{ opacity: 0.6 }}>Subtotal</span>
                <span className="font-semibold">{fmt(oc.subtotal)}</span>
                <span style={{ opacity: 0.6 }}>IVA Total</span>
                <span className="font-semibold">{fmt(oc.iva_valor)}</span>
                <div style={{ gridColumn: '1 / -1', height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0.5rem 0' }} />
                <span style={{ fontSize: '18px', fontWeight: 800 }}>TOTAL</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--clr-primary-400)' }}>{fmt(oc.total)}</span>
             </div>
          </div>

          {canApprove && (
            <div className="card" style={{ border: '1px solid var(--clr-warning)', background: 'rgba(245,158,11,0.05)' }}>
               <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <MessageSquare size={16} color="var(--clr-warning)" /> Acciones de Gerencia
               </h3>
               <textarea 
                  className="input mb-3" 
                  placeholder="Añadir un comentario (opcional)..." 
                  style={{ fontSize: '13px', background: 'var(--bg-surface)' }} 
                  id="approval-comment"
               />
               <div className="flex flex-col gap-2">
                  <button className="btn btn--primary w-full" onClick={() => approveMut.mutate(document.getElementById('approval-comment').value)}>
                     <CheckCircle size={16} /> Aprobar Orden
                  </button>
                  <button className="btn btn--danger w-full" onClick={() => rejectMut.mutate(document.getElementById('approval-comment').value)}>
                     <XCircle size={16} /> Rechazar
                  </button>
               </div>
            </div>
          )}

          <div className="card--elevated" style={{ padding: '1rem' }}>
             <div className="flex items-center gap-2 text-xs text-muted mb-2 font-bold uppercase">
                <Truck size={12} /> Logística
             </div>
             <p className="text-xs">
                Esta OC debe ser enviada al proveedor una vez emitida. El sistema registrará el ingreso al inventario automáticamente al procesar la recepción.
             </p>
          </div>
        </aside>

      </main>
    </div>
  );
}
