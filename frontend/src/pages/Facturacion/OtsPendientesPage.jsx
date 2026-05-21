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
  Plus,
  FileText,
  Receipt,
  Layers
} from 'lucide-react';
import { facturacionApi } from '../../services/facturacionApi';
import { Layout } from '../../components/Layout';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-hot-toast';

export const OtsPendientesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notas, setNotas] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [nroFactura, setNroFactura] = useState('');

  const activeTab = searchParams.get('tab') || 'ots';
  const empresaIdParam = searchParams.get('empresa_id');

  const setTab = (tab) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    setSearchParams(params);
    setSelectedItems([]);
  };

  const isRemisiones = activeTab === 'remisiones';

  const { data: items, isLoading } = useQuery({
    queryKey: [isRemisiones ? 'remisionesPendientes' : 'otsPendientes', empresaIdParam, search],
    queryFn: () => {
      if (isRemisiones) {
        return facturacionApi.getRemisionesPendientes({ empresa_id: empresaIdParam, search });
      }
      return facturacionApi.getOtsPendientes({ empresa_id: empresaIdParam, search });
    }
  });

  const toggleSelect = (item) => {
    setSelectedItems(prev => {
      const exists = prev.find(o => o.id === item.id);
      if (exists) return prev.filter(o => o.id !== item.id);
      
      // Validar misma empresa
      if (prev.length > 0 && prev[0].empresa_id !== item.empresa_id) {
        toast.error(`Solo puedes agrupar items de la misma empresa.`);
        return prev;
      }
      
      return [...prev, item];
    });
  };

  const totals = useMemo(() => {
    return selectedItems.reduce((acc, item) => ({
      subtotal: acc.subtotal + parseFloat(item.subtotal),
      iva: acc.iva + parseFloat(item.iva_valor),
      total: acc.total + parseFloat(item.total)
    }), { subtotal: 0, iva: 0, total: 0 });
  }, [selectedItems]);

  const createPrefacturaMutation = useMutation({
    mutationFn: (data) => {
      if (isRemisiones) {
        return facturacionApi.createPrefacturaFromRemisiones(data);
      }
      return facturacionApi.createPrefactura(data);
    },
    onSuccess: (res) => {
      toast.success(res.data.estado === 'FACTURADA' ? 'Factura generada correctamente' : 'Prefactura creada correctamente');
      queryClient.invalidateQueries(['otsPendientes']);
      queryClient.invalidateQueries(['remisionesPendientes']);
      navigate(`/facturacion/facturas/${res.data.id}`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Error al crear la prefactura');
    }
  });

  const handleCreate = () => {
    if (selectedItems.length === 0) return;
    setIsModalOpen(true);
  };

  const confirmCreate = () => {
    const baseData = {
      empresa_id: selectedItems[0].empresa_id,
      condicion_pago: selectedItems[0].condicion_pago || '30_DIAS',
      fecha_vencimiento: vencimiento,
      notas: notas,
      numero_factura: nroFactura
    };

    if (isRemisiones) {
      createPrefacturaMutation.mutate({
        ...baseData,
        remision_ids: selectedItems.map(o => o.id),
      });
    } else {
      createPrefacturaMutation.mutate({
        ...baseData,
        ot_ids: selectedItems.map(o => o.id),
      });
    }
  };

  if (isLoading) return (
    <Layout title={isRemisiones ? 'Remisiones por Facturar' : 'Órdenes de Trabajo por Facturar'}>
      <div className="flex items-center justify-center py-20">
        <div className="spinner h-12 w-12" />
      </div>
    </Layout>
  );

  return (
    <Layout title={isRemisiones ? 'Remisiones por Facturar' : 'Órdenes de Trabajo por Facturar'}>
      {/* ─── Tab Selector ─────────────────────────────────── */}
      <div className="flex gap-1 mb-6 p-1 bg-subtle/50 rounded-2xl border border-color w-fit" role="tablist">
        <button
          role="tab"
          aria-selected={!isRemisiones}
          onClick={() => setTab('ots')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            !isRemisiones ? 'bg-white dark:bg-gray-800 shadow-sm text-accent' : 'text-muted hover:text-foreground'
          }`}
        >
          <Layers size={16} />
          OTs Pendientes
        </button>
        <button
          role="tab"
          aria-selected={isRemisiones}
          onClick={() => setTab('remisiones')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            isRemisiones ? 'bg-white dark:bg-gray-800 shadow-sm text-accent' : 'text-muted hover:text-foreground'
          }`}
        >
          <Receipt size={16} />
          Remisiones Pendientes
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Main Content - List */}
        <div className="flex-1 space-y-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input 
                type="text" 
                placeholder={isRemisiones ? 'Buscar por remisión o empresa...' : 'Buscar por OT o empresa...'}
                className="input-premium pl-10 w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="card-premium overflow-hidden">
            <table className="w-full">
              <thead className="bg-subtle text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-6 py-4 text-center w-12">Select</th>
                  <th className="px-6 py-4 text-left">{isRemisiones ? 'Remisión' : 'Orden'}</th>
                  <th className="px-6 py-4 text-left">Empresa</th>
                  <th className="px-6 py-4 text-left">Liquidada</th>
                  <th className="px-6 py-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-color">
                {items?.data?.map((item) => (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-subtle/30 transition-colors cursor-pointer ${selectedItems.find(o => o.id === item.id) ? 'bg-accent/5' : ''}`}
                    onClick={() => toggleSelect(item)}
                  >
                    <td className="px-6 py-4 text-center">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedItems.find(o => o.id === item.id) ? 'bg-accent border-accent text-white' : 'border-color'}`}>
                        {selectedItems.find(o => o.id === item.id) && <Plus size={14} strokeWidth={4} />}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold">{item.consecutivo}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-muted" />
                        <span className="font-semibold">{item.empresa_nombre}</span>
                      </div>
                      <div className="text-[10px] text-muted uppercase tracking-tighter">NIT: {item.empresa_nit}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-muted" />
                        <span>{new Date(item.fecha_liquidacion).toLocaleDateString()}</span>
                      </div>
                      <div className={`text-[10px] font-bold ${item.dias_desde_liquidacion > 30 ? 'text-red-500' : 'text-muted'}`}>
                        Hace {item.dias_desde_liquidacion} días
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-accent">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                ))}
                {(!items?.data || items.data.length === 0) && (
                  <tr>
                    <td colSpan="5" className="px-6 py-20 text-center text-muted italic">
                      {isRemisiones
                        ? 'No se encontraron remisiones liquidadas pendientes de facturar.'
                        : 'No se encontraron órdenes de trabajo liquidadas pendientes de facturar.'
                      }
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
                <span className="font-bold">{selectedItems.length} {isRemisiones ? 'Remisiones' : 'OTs'}</span>
              </div>
              
              {selectedItems.length > 0 && (
                <div className="bg-subtle/50 p-3 rounded-xl border border-color animate-in zoom-in-95 duration-200">
                  <p className="text-[10px] uppercase font-bold text-muted mb-1">Empresa</p>
                  <p className="text-sm font-bold truncate">{selectedItems[0].empresa_nombre}</p>
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
                disabled={selectedItems.length === 0}
                onClick={handleCreate}
              >
                <CheckCircle2 size={20} /> Generar Factura
              </button>

              {selectedItems.length === 0 && (
                <div className="flex items-start gap-2 p-3 bg-blue-500/10 text-blue-500 rounded-xl text-[11px]">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  {isRemisiones
                    ? 'Selecciona una o varias remisiones de la misma empresa para comenzar el proceso.'
                    : 'Selecciona una o varias órdenes de trabajo de la misma empresa para comenzar el proceso.'
                  }
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
                <div className="font-bold text-lg">{selectedItems[0]?.empresa_nombre}</div>
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
