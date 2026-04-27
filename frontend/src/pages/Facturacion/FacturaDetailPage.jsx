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
  Trash2
} from 'lucide-react';
import { facturacionApi } from '../../services/facturacionApi';
import { Layout } from '../../components/Layout';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-hot-toast';

export const FacturaDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [numFactura, setNumFactura] = useState('');
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split('T')[0]);
  const [sistemaContable, setSistemaContable] = useState('SIIGO');

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

  if (isLoading) return <Layout><div className="flex items-center justify-center min-h-[400px]"><div className="spinner" /></div></Layout>;
  if (!factura?.data) return <Layout><div className="text-center py-20">Factura no encontrada</div></Layout>;

  const fact = factura.data;
  const isPrefactura = fact.estado === 'PREFACTURA';
  const isFacturada = fact.estado === 'FACTURADA';

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
              onClick={() => window.open(facturacionApi.getFacturaPdfUrl(id), '_blank')}
              className="btn-secondary flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5"
            >
              <Download size={18} /> Descargar PDF
            </button>
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
            <div className="card-premium p-8 relative overflow-hidden">
              <div className={`absolute top-0 right-0 px-8 py-2 rounded-bl-3xl font-bold text-xs uppercase tracking-widest ${isFacturada ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>
                {fact.estado}
              </div>
              
              <div className="flex items-start gap-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isFacturada ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                  <Receipt size={32} />
                </div>
                <div>
                  <h2 className="text-3xl font-black">{fact.consecutivo_interno}</h2>
                  <p className="text-muted flex items-center gap-2 mt-1">
                    <Calendar size={14} /> Emitida el {new Date(fact.fecha_prefactura).toLocaleDateString()}
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
                      <p className="font-bold">{new Date(fact.fecha_vencimiento).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* OTs Table */}
            <div className="card-premium overflow-hidden">
              <div className="p-6 border-b border-color bg-subtle/30 flex items-center gap-2">
                <FileText size={20} className="text-accent" />
                <h3 className="font-bold">Órdenes de Trabajo Incluidas</h3>
              </div>
              <table className="w-full">
                <thead className="bg-subtle/50 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-6 py-4 text-left">OT</th>
                    <th className="px-6 py-4 text-left">Tipo</th>
                    <th className="px-6 py-4 text-right">Subtotal</th>
                    <th className="px-6 py-4 text-right">IVA</th>
                    <th className="px-6 py-4 text-right">Total OT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-color">
                  {fact.ots.map(ot => (
                    <tr key={ot.id} className="hover:bg-subtle/20 transition-colors">
                      <td className="px-6 py-4 font-bold">{ot.ot_consecutivo}</td>
                      <td className="px-6 py-4 text-xs font-semibold uppercase">{ot.tipo_mantenimiento}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(ot.subtotal_ot)}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(ot.iva_ot)}</td>
                      <td className="px-6 py-4 text-right font-bold text-accent">{formatCurrency(ot.total_ot)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-subtle/30">
                  <tr>
                    <td colSpan="3" className="px-6 py-4 text-right text-muted font-bold">Resumen:</td>
                    <td colSpan="2" className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted">Subtotal:</span>
                          <span className="font-semibold">{formatCurrency(fact.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted">IVA ({fact.iva_pct}%):</span>
                          <span className="font-semibold">{formatCurrency(fact.iva_valor)}</span>
                        </div>
                        <div className="flex justify-between text-xl font-black text-accent pt-2 border-t border-color mt-2">
                          <span>TOTAL:</span>
                          <span>{formatCurrency(fact.total)}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {fact.notas && (
              <div className="card-premium p-6">
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
            <div className="card-premium p-6 space-y-6">
              <h3 className="font-bold border-b border-color pb-2">Estado del Proceso</h3>
              
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
                        <div className="text-xs text-muted">{new Date(fact.fecha_factura).toLocaleDateString()}</div>
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
              <div className="card-premium p-6 space-y-4 bg-accent/5 border-accent/20">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="card-premium w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Confirmar Facturación</h3>
              <button onClick={() => setIsConfirmModalOpen(false)} className="btn-ghost p-1"><XCircle size={20} /></button>
            </div>
            
            <div className="space-y-6">
              <div className="bg-accent/10 p-4 rounded-2xl border border-accent/20">
                <p className="text-sm text-center text-accent font-semibold">
                  Al confirmar, las OTs asociadas cambiarán a estado <strong>FACTURADA</strong> y no podrán ser editadas.
                </p>
              </div>

              <div className="space-y-4">
                <div className="form-group">
                  <label className="text-xs font-bold uppercase text-muted mb-1 block">Número de Factura Real *</label>
                  <input 
                    type="text" 
                    placeholder="Ej: FV-2026-00123"
                    className="input-premium w-full font-bold text-lg"
                    value={numFactura}
                    onChange={(e) => setNumFactura(e.target.value)}
                  />
                  <p className="text-[10px] text-muted mt-1">Ingrese el número generado en su sistema contable externo.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="text-xs font-bold uppercase text-muted mb-1 block">Fecha Factura *</label>
                    <input 
                      type="date" 
                      className="input-premium w-full"
                      value={fechaFactura}
                      onChange={(e) => setFechaFactura(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs font-bold uppercase text-muted mb-1 block">Sistema Contable</label>
                    <select 
                      className="input-premium w-full"
                      value={sistemaContable}
                      onChange={(e) => setSistemaContable(e.target.value)}
                    >
                      <option value="SIIGO">Siigo</option>
                      <option value="WORLD_OFFICE">World Office</option>
                      <option value="MANUAL">Manual / Otro</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button className="btn-secondary flex-1 py-3" onClick={() => setIsConfirmModalOpen(false)}>Cancelar</button>
                <button 
                  className="btn-primary flex-1 py-3 shadow-lg shadow-accent/20" 
                  onClick={() => confirmMutation.mutate({
                    numero_factura: numFactura,
                    fecha_factura: fechaFactura,
                    sistema_contable: sistemaContable
                  })}
                  disabled={!numFactura || confirmMutation.isLoading}
                >
                  {confirmMutation.isLoading ? 'Procesando...' : 'Confirmar y Finalizar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
