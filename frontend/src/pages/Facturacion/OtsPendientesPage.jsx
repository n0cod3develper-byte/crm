import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  FilePlus, 
  CheckCircle2, 
  AlertTriangle,
  Building2,
  Calendar,
  X,
  Plus
} from 'lucide-react';
import { facturacionApi } from '../../services/facturacionApi';
import { Layout } from '../../components/Layout';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-hot-toast';

export const OtsPendientesPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [selectedOts, setSelectedOts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notas, setNotas] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [nroFactura, setNroFactura] = useState('');

  const empresaIdParam = searchParams.get('empresa_id');

  const { data: ots, isLoading } = useQuery({
    queryKey: ['otsPendientes', empresaIdParam, search],
    queryFn: () => facturacionApi.getOtsPendientes({ empresa_id: empresaIdParam, search })
  });

  const toggleSelect = (ot) => {
    setSelectedOts(prev => {
      const exists = prev.find(o => o.id === ot.id);
      if (exists) return prev.filter(o => o.id !== ot.id);
      
      // Validar misma empresa
      if (prev.length > 0 && prev[0].empresa_id !== ot.empresa_id) {
        toast.error(`Solo puedes agrupar OTs de la misma empresa. ${ot.consecutivo} pertenece a ${ot.empresa_nombre}.`);
        return prev;
      }
      
      return [...prev, ot];
    });
  };

  const totals = useMemo(() => {
    return selectedOts.reduce((acc, ot) => ({
      subtotal: acc.subtotal + parseFloat(ot.subtotal),
      iva: acc.iva + parseFloat(ot.iva_valor),
      total: acc.total + parseFloat(ot.total)
    }), { subtotal: 0, iva: 0, total: 0 });
  }, [selectedOts]);

  const createPrefacturaMutation = useMutation({
    mutationFn: facturacionApi.createPrefactura,
    onSuccess: (res) => {
      toast.success(res.data.estado === 'FACTURADA' ? 'Factura generada correctamente' : 'Prefactura creada correctamente');
      queryClient.invalidateQueries(['otsPendientes']);
      navigate(`/facturacion/facturas/${res.data.id}`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Error al crear la prefactura');
    }
  });

  const handleCreate = () => {
    if (selectedOts.length === 0) return;
    setIsModalOpen(true);
  };

  const confirmCreate = () => {
    createPrefacturaMutation.mutate({
      empresa_id: selectedOts[0].empresa_id,
      ot_ids: selectedOts.map(o => o.id),
      condicion_pago: selectedOts[0].condicion_pago || '30_DIAS',
      fecha_vencimiento: vencimiento,
      notas: notas,
      numero_factura: nroFactura
    });
  };

  if (isLoading) return (
    <Layout title="Órdenes de Trabajo por Facturar">
      <div className="flex items-center justify-center py-20">
        <div className="spinner h-12 w-12" />
      </div>
    </Layout>
  );

  return (
    <Layout title="Órdenes de Trabajo por Facturar">
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Main Content - List */}
        <div className="flex-1 space-y-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por OT o empresa..."
                className="input-premium pl-10 w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary flex items-center gap-2">
                <Filter size={18} /> Filtrar
              </button>
            </div>
          </div>

          <div className="card-premium overflow-hidden">
            <table className="w-full">
              <thead className="bg-subtle text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-6 py-4 text-center w-12">Select</th>
                  <th className="px-6 py-4 text-left">Orden</th>
                  <th className="px-6 py-4 text-left">Empresa</th>
                  <th className="px-6 py-4 text-left">Liquidada</th>
                  <th className="px-6 py-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-color">
                {ots?.data?.map((ot) => (
                  <tr 
                    key={ot.id} 
                    className={`hover:bg-subtle/30 transition-colors cursor-pointer ${selectedOts.find(o => o.id === ot.id) ? 'bg-accent/5' : ''}`}
                    onClick={() => toggleSelect(ot)}
                  >
                    <td className="px-6 py-4 text-center">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedOts.find(o => o.id === ot.id) ? 'bg-accent border-accent text-white' : 'border-color'}`}>
                        {selectedOts.find(o => o.id === ot.id) && <Plus size={14} strokeWidth={4} />}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold">{ot.consecutivo}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-muted" />
                        <span className="font-semibold">{ot.empresa_nombre}</span>
                      </div>
                      <div className="text-[10px] text-muted uppercase tracking-tighter">NIT: {ot.empresa_nit}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-muted" />
                        <span>{new Date(ot.fecha_liquidacion).toLocaleDateString()}</span>
                      </div>
                      <div className={`text-[10px] font-bold ${ot.dias_desde_liquidacion > 30 ? 'text-red-500' : 'text-muted'}`}>
                        Hace {ot.dias_desde_liquidacion} días
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-accent">
                      {formatCurrency(ot.total)}
                    </td>
                  </tr>
                ))}
                {ots?.data?.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-20 text-center text-muted italic">
                      No se encontraron órdenes de trabajo liquidadas pendientes de facturar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar - Selection Summary */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="card-premium p-6 sticky top-24 space-y-6">
            <h3 className="font-bold text-lg border-b border-color pb-2 flex items-center gap-2">
              <FilePlus size={20} className="text-accent" />
              Prefactura
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Seleccionadas:</span>
                <span className="font-bold">{selectedOts.length} OTs</span>
              </div>
              
              {selectedOts.length > 0 && (
                <div className="bg-subtle/50 p-3 rounded-xl border border-color animate-in zoom-in-95 duration-200">
                  <p className="text-[10px] uppercase font-bold text-muted mb-1">Empresa</p>
                  <p className="text-sm font-bold truncate">{selectedOts[0].empresa_nombre}</p>
                </div>
              )}

              <div className="space-y-2 pt-4 border-t border-color">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Subtotal:</span>
                  <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">IVA (19%):</span>
                  <span className="font-semibold">{formatCurrency(totals.iva)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-accent pt-2">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>

              <button 
                className="btn-primary w-full py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-accent/20 disabled:opacity-50 disabled:grayscale"
                disabled={selectedOts.length === 0}
                onClick={handleCreate}
              >
                <CheckCircle2 size={20} /> Generar Factura
              </button>

              {selectedOts.length === 0 && (
                <div className="flex items-start gap-2 p-3 bg-blue-500/10 text-blue-500 rounded-xl text-[11px]">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  Selecciona una o varias órdenes de trabajo de la misma empresa para comenzar el proceso.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal - Confirmar Prefactura */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="card-premium w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Generar Prefactura</h3>
              <button onClick={() => setIsModalOpen(false)} className="btn-ghost p-1"><X size={20} /></button>
            </div>
            
            <div className="space-y-5">
              <div className="bg-subtle/50 p-4 rounded-2xl border border-color">
                <div className="text-sm text-muted">Empresa</div>
                <div className="font-bold text-lg">{selectedOts[0].empresa_nombre}</div>
                <div className="text-sm font-bold text-accent mt-2">Total a facturar: {formatCurrency(totals.total)}</div>
              </div>

              <div className="space-y-4">
                <div className="form-group">
                  <label className="text-xs font-bold uppercase text-muted mb-1 block">Número de Factura (Externo)</label>
                  <input 
                    type="text" 
                    className="input-premium w-full font-bold text-accent"
                    placeholder="Ej: FE-1234"
                    value={nroFactura}
                    onChange={(e) => setNroFactura(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="text-xs font-bold uppercase text-muted mb-1 block">Fecha Vencimiento</label>
                  <input 
                    type="date" 
                    className="input-premium w-full"
                    value={vencimiento}
                    onChange={(e) => setVencimiento(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="text-xs font-bold uppercase text-muted mb-1 block">Notas / Observaciones</label>
                  <textarea 
                    className="input-premium w-full h-24 resize-none"
                    placeholder="Ej: Servicios correspondientes al mes de Abril..."
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button className="btn-secondary flex-1 py-3" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button 
                  className="btn-primary flex-1 py-3" 
                  onClick={confirmCreate}
                  disabled={createPrefacturaMutation.isLoading}
                >
                  {createPrefacturaMutation.isLoading ? 'Generando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
