import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Download, 
  Receipt, 
  Building2, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle,
  FileText,
  AlertTriangle,
  Send,
  Trash2,
  Edit
} from 'lucide-react';
import { facturacionApi } from '../../services/facturacionApi';
import { Layout } from '../../components/Layout';
import { formatCurrency, formatDateLocal } from '../../utils/formatters';
import { toast } from 'react-hot-toast';

export const FacturaDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [numFactura, setNumFactura] = useState('');
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split('T')[0]);
  const [descripcionFactura, setDescripcionFactura] = useState('');
  const [sistemaContable] = useState('SIIGO');

  const { data: factura, isLoading } = useQuery({
    queryKey: ['factura', id],
    queryFn: () => facturacionApi.getFactura(id)
  });

  const confirmMutation = useMutation({
    mutationFn: (data) => facturacionApi.confirmarFactura(id, data),
    onSuccess: () => {
      toast.success('Factura confirmada correctamente');
      queryClient.invalidateQueries(['factura', id]);
      setIsConfirmModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Error al confirmar la factura');
    }
  });

  const anularMutation = useMutation({
    mutationFn: (motivo) => facturacionApi.anularFactura(id, motivo),
    onSuccess: () => {
      toast.success('Factura anulada correctamente');
      queryClient.invalidateQueries(['factura', id]);
      navigate('/facturacion/facturas');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Error al anular');
    }
  });

  const handleAnular = () => {
    const motivo = window.prompt('Indique el motivo de la anulación:');
    if (motivo) {
      anularMutation.mutate(motivo);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      toast.loading('Generando PDF...', { id: 'download-pdf' });
      const response = await facturacionApi.downloadFacturaPdf(id);
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${fact.consecutivo_interno}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF generado con éxito', { id: 'download-pdf' });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('No se pudo generar el PDF', { id: 'download-pdf' });
    }
  };

  if (isLoading) return <Layout><div className="flex items-center justify-center min-h-[400px]"><div className="spinner" /></div></Layout>;
  if (!factura?.data) return <Layout><div className="text-center py-20">Factura no encontrada</div></Layout>;

  const fact = factura.data;
  const isPrefactura = fact.estado === 'PREFACTURA';
  const isFacturada = fact.estado === 'FACTURADA';
  
  const titleNumbers = fact.ots?.length > 0 
    ? fact.ots.map(ot => ot.ot_consecutivo).join(', ') 
    : fact.consecutivo_interno;

  // Compute proportional display values for each remision so they add up exactly to total_rem.
  // Formula: total_neto = total_bruto + recargos - descuentos + iva
  // We round recargos/descuentos/iva and derive bruto as the balancing figure.
  const remisionesDisplay = (fact.remisiones || []).map(rem => {
    const totalRem = parseFloat(rem.total_rem || 0);
    const origTotal = parseFloat(rem.orig_total || 0);
    if (origTotal === 0) return { ...rem, d_bruto: totalRem, d_recargos: 0, d_descuentos: 0, d_iva: 0 };
    
    const p = totalRem / origTotal; // proportion for this invoice
    const d_recargos = Math.round(parseFloat(rem.orig_recargos || 0) * p * 100) / 100;
    const d_descuentos = Math.round(parseFloat(rem.orig_descuentos || 0) * p * 100) / 100;
    const d_iva = Math.round(parseFloat(rem.orig_iva || 0) * p * 100) / 100;
    // bruto = total_rem - recargos + descuentos - iva (balancing figure, guaranteed to add up)
    const d_bruto = Math.round((totalRem - d_recargos + d_descuentos - d_iva) * 100) / 100;
    return { ...rem, d_bruto, d_recargos, d_descuentos, d_iva };
  });

  // Compute column totals from display values
  const computed = (() => {
    const ots = fact.ots || [];
    const bruto = remisionesDisplay.reduce((s, r) => s + r.d_bruto, 0)
                + ots.reduce((s, o) => s + parseFloat(o.subtotal_ot || 0), 0);
    const recargos = remisionesDisplay.reduce((s, r) => s + r.d_recargos, 0);
    const descuentos = remisionesDisplay.reduce((s, r) => s + r.d_descuentos, 0);
    const iva = remisionesDisplay.reduce((s, r) => s + r.d_iva, 0)
              + ots.reduce((s, o) => s + parseFloat(o.iva_ot || 0), 0);
    return { bruto, recargos, descuentos, iva };
  })();

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
        
        {/* Header Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <button onClick={() => navigate(-1)} className="btn-ghost flex items-center gap-2 group">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Volver
          </button>
          
          <div className="flex gap-3 w-full md:w-auto">
            {isPrefactura && (
              <button 
                onClick={() => setIsConfirmModalOpen(true)}
                className="btn-primary flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 shadow-lg shadow-accent/20"
              >
                <CheckCircle2 size={18} /> Registrar Nro Factura
              </button>
            )}
            <button 
              onClick={handleDownloadPDF}
              className="btn-secondary flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5"
            >
              <Download size={18} /> Descargar PDF
            </button>
            {isPrefactura && (
              <button 
                onClick={() => navigate(`/facturacion/facturas/${id}/editar`)}
                className="btn-secondary flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5"
                title="Editar Remisiones"
              >
                <Edit size={18} /> Editar Remisiones
              </button>
            )}
            {isPrefactura && (
              <button 
                onClick={handleAnular}
                className="btn-danger p-2.5" 
                title="Anular"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Summary Card */}
            <div className="card-premium relative overflow-hidden" style={{ padding: '2.5rem' }}>
              <div className={`absolute top-0 right-0 px-8 py-2 rounded-bl-3xl font-bold text-xs uppercase tracking-widest ${isFacturada ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>
                {fact.estado}
              </div>
              
              <div className="flex items-start gap-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isFacturada ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                  <Receipt size={32} />
                </div>
                <div>
                  <h2 className="text-3xl font-black break-words">{titleNumbers}</h2>
                  <p className="text-muted flex items-center gap-2 mt-1">
                    <Calendar size={14} /> Emitida el {formatDateLocal(fact.fecha_prefactura)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10 pt-8 border-t border-color">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase text-muted tracking-widest">Información del Cliente</h4>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-subtle flex items-center justify-center text-accent">
                      <Building2 size={24} />
                    </div>
                    <div>
                      <div className="font-bold text-lg">{fact.empresa_nombre}</div>
                      <div className="text-sm text-muted">NIT: {fact.empresa_nit}</div>
                    </div>
                  </div>
                  <div className="text-sm space-y-1 pl-16">
                    <p className="text-muted">{fact.empresa_direccion}</p>
                    <p className="text-muted">{fact.empresa_telefono}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase text-muted tracking-widest">Condiciones Comerciales</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl bg-subtle/50 border border-color">
                      <p className="text-[10px] text-muted uppercase font-bold">Condición Pago</p>
                      <p className="font-bold">{fact.condicion_pago || '—'}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-subtle/50 border border-color">
                      <p className="text-[10px] text-muted uppercase font-bold">Vencimiento</p>
                      <p className="font-bold">{formatDateLocal(fact.fecha_vencimiento)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* OTs Table */}
            <div className="card-premium overflow-hidden">
              <div className="border-b border-color bg-subtle/30 flex items-center gap-2" style={{ padding: '1.5rem 2.5rem' }}>
                <FileText size={20} className="text-accent" />
                <h3 className="font-bold">Órdenes de Trabajo / Remisiones Incluidas</h3>
              </div>
              <table className="w-full">
                <thead className="bg-subtle/50 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-6 py-4 text-left">Documento</th>
                    <th className="px-6 py-4 text-left">Tipo</th>
                    <th className="px-6 py-4 text-right">Total Bruto</th>
                    <th className="px-6 py-4 text-right">Recargos</th>
                    <th className="px-6 py-4 text-right text-red-500/80">Dctos</th>
                    <th className="px-6 py-4 text-right">IVA</th>
                    <th className="px-6 py-4 text-right">Total Neto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-color">
                  {remisionesDisplay.map(rem => (
                    <tr key={rem.id} className="hover:bg-subtle/20 transition-colors">
                      <td className="px-6 py-4 font-bold">{rem.numero_remision || rem.remision_numero}</td>
                      <td className="px-6 py-4 text-xs font-semibold uppercase text-accent">Remisión</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(rem.d_bruto)}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(rem.d_recargos)}</td>
                      <td className="px-6 py-4 text-right text-red-500">{formatCurrency(rem.d_descuentos)}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(rem.d_iva)}</td>
                      <td className="px-6 py-4 text-right font-bold text-accent">{formatCurrency(rem.total_rem)}</td>
                    </tr>
                  ))}
                  {fact.ots?.map(ot => (
                    <tr key={ot.id} className="hover:bg-subtle/20 transition-colors">
                      <td className="px-6 py-4 font-bold">{ot.ot_consecutivo}</td>
                      <td className="px-6 py-4 text-xs font-semibold uppercase">{ot.tipo_mantenimiento}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(ot.subtotal_ot)}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(0)}</td>
                      <td className="px-6 py-4 text-right text-red-500">{formatCurrency(0)}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(ot.iva_ot)}</td>
                      <td className="px-6 py-4 text-right font-bold text-accent">{formatCurrency(ot.total_ot)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-subtle/30">
                  <tr className="border-t-2 border-color">
                    <td colSpan="2" className="px-6 py-4 text-right font-bold uppercase text-xs text-muted tracking-wider">Totales:</td>
                    <td className="px-6 py-4 text-right font-bold">{formatCurrency(computed.bruto)}</td>
                    <td className="px-6 py-4 text-right font-bold">{formatCurrency(computed.recargos)}</td>
                    <td className="px-6 py-4 text-right font-bold text-red-500">{formatCurrency(computed.descuentos)}</td>
                    <td className="px-6 py-4 text-right font-bold">{formatCurrency(computed.iva)}</td>
                    <td className="px-6 py-4 text-right font-black text-xl text-accent">{formatCurrency(fact.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {fact.notas && (
              <div className="card-premium" style={{ padding: '2rem 2.5rem' }}>
                <h4 className="text-xs font-bold uppercase text-muted mb-4 tracking-widest">Notas del Facturador</h4>
                <div className="p-4 bg-subtle/50 rounded-xl border border-color text-sm italic">
                  "{fact.notas}"
                </div>
              </div>
            )}

          </div>

          {/* Sidebar Info */}
          <div className="space-y-8">
            
            {/* Status Card */}
            <div className="card-premium space-y-6" style={{ padding: '2rem' }}>
              <h3 className="font-bold border-b border-color pb-4">Estado del Proceso</h3>
              
              <div className="space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-color">
                
                <div className="flex gap-4 relative z-10">
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white ring-4 ring-background">
                    <Clock size={16} />
                  </div>
                  <div>
                    <div className="font-bold">Prefactura Creada</div>
                    <div className="text-xs text-muted">{new Date(fact.created_at).toLocaleString()}</div>
                    <div className="text-[10px] text-muted uppercase mt-1">Por: {fact.creada_por}</div>
                  </div>
                </div>

                <div className={`flex gap-4 relative z-10 ${!isFacturada ? 'opacity-40 grayscale' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ring-4 ring-background ${isFacturada ? 'bg-green-500' : 'bg-color'}`}>
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <div className="font-bold">Facturado / Confirmado</div>
                    {isFacturada ? (
                      <>
                        <div className="text-xs text-muted">{formatDateLocal(fact.fecha_factura)}</div>
                        <div className="text-[10px] text-muted uppercase mt-1">Nro: {fact.numero_factura}</div>
                      </>
                    ) : (
                      <div className="text-xs text-muted italic">Pendiente de registro</div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Auditoria Card */}
            {isFacturada && (
              <div className="card-premium space-y-4 bg-accent/5 border-accent/20" style={{ padding: '2rem' }}>
                <div className="flex items-center gap-2 text-accent font-bold">
                  <AlertTriangle size={18} /> Detalle Sistema Contable
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Sistema:</span>
                    <span className="font-bold">{fact.sistema_contable}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">ID Externo:</span>
                    <span className="font-mono text-xs">{fact.sistema_contable_id || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Sincronizado:</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-500 font-bold">EXITOSO</span>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      </div>

      {/* Modal - Confirmar Factura */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsConfirmModalOpen(false)}>
          <div 
            className="card-premium w-full animate-in zoom-in-95 duration-200"
            style={{ 
              maxWidth: '700px',
              padding: 0,
              overflow: 'hidden',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
              animation: 'modalIn 0.2s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center border-b border-color" style={{ padding: '2rem 3rem', background: 'var(--color-subtle, rgba(255,255,255,0.03))' }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                  <FileText size={24} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-foreground tracking-tight">Confirmar Facturación</h3>
                  <p className="text-sm text-muted font-medium">Asignar número definitivo a la prefactura</p>
                </div>
              </div>
              <button 
                onClick={() => setIsConfirmModalOpen(false)} 
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-subtle transition-colors text-muted hover:text-foreground"
              >
                <XCircle size={20} />
              </button>
            </div>
            
            {/* Body */}
            <div className="space-y-8" style={{ padding: '2.5rem 3rem' }}>
              
              {/* Tabla Resumen */}
              <div className="bg-subtle/40 rounded-2xl border border-color overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-subtle/50 text-xs uppercase text-muted sticky top-0 backdrop-blur-md">
                    <tr>
                      <th className="px-5 py-3 text-left tracking-wider">Documento</th>
                      <th className="px-5 py-3 text-right tracking-wider">Monto a Confirmar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-color">
                    {fact.remisiones?.map(r => (
                      <tr key={r.id} className="hover:bg-subtle/20 transition-colors">
                        <td className="px-5 py-3 font-bold">{r.numero_remision}</td>
                        <td className="px-5 py-3 text-right font-medium text-accent">{formatCurrency(r.total_rem)}</td>
                      </tr>
                    ))}
                    {fact.ots?.map(o => (
                      <tr key={o.id} className="hover:bg-subtle/20 transition-colors">
                        <td className="px-5 py-3 font-bold">{o.ot_consecutivo}</td>
                        <td className="px-5 py-3 text-right font-medium text-accent">{formatCurrency(o.total_ot)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-subtle/50 sticky bottom-0 border-t border-color">
                    <tr>
                      <td className="px-5 py-3 text-right font-bold uppercase text-muted tracking-widest text-[11px]">Total General:</td>
                      <td className="px-5 py-3 text-right font-black text-lg text-accent">{formatCurrency(fact.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Campos del formulario */}
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-bold uppercase text-muted mb-3 block tracking-widest">
                    Número de Factura Real <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    className="input-premium w-full font-bold text-accent text-xl py-4 px-5"
                    placeholder="Ej: FV-2026-00123"
                    value={numFactura}
                    onChange={(e) => setNumFactura(e.target.value)}
                    autoFocus
                  />
                  <p className="text-xs text-muted mt-2 font-medium">Ingresa el número generado en su sistema contable externo.</p>
                </div>

                  <div>
                    <label className="text-sm font-bold uppercase text-muted mb-3 block tracking-widest">
                      Fecha Factura <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="date" 
                      className="input-premium w-full font-bold text-base py-4 px-5"
                      value={fechaFactura}
                      onChange={(e) => setFechaFactura(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-bold uppercase text-muted mb-3 block tracking-widest">
                      Descripción / Notas
                    </label>
                    <textarea 
                      className="input-premium w-full py-4 px-5 text-sm"
                      rows="3"
                      placeholder="Notas opcionales sobre la factura..."
                      value={descripcionFactura}
                      onChange={(e) => setDescripcionFactura(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-4 border-t border-color" style={{ padding: '2rem 3rem', background: 'var(--color-subtle, rgba(255,255,255,0.02))' }}>
              <button 
                className="btn-secondary flex-1 py-4 rounded-2xl font-bold text-base hover:bg-subtle transition-colors" 
                onClick={() => setIsConfirmModalOpen(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary flex-[2] py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-xl shadow-accent/20 transition-all hover:scale-[1.02] active:scale-[0.98]" 
                onClick={() => confirmMutation.mutate({
                  numero_factura: numFactura,
                  fecha_factura: fechaFactura,
                  sistema_contable: sistemaContable,
                  notas: descripcionFactura
                })}
                disabled={!numFactura.trim() || confirmMutation.isLoading}
              >
                {confirmMutation.isLoading ? (
                  <>
                    <div className="spinner h-5 w-5 border-2" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} strokeWidth={2.5} />
                    Confirmar y Finalizar
                  </>
                )}
              </button>
            </div>
          </div>

      )}
    </Layout>
  );
};
