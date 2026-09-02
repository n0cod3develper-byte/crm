import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle,
  Building2,
  Calendar,
  Receipt,
  Trash2,
  Save
} from 'lucide-react';
import { facturacionApi } from '../../services/facturacionApi';
import { Layout } from '../../components/Layout';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-hot-toast';

export const FacturaEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [selectedItems, setSelectedItems] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // 1. Obtener la factura actual
  const { data: facturaRes, isLoading: loadingFactura } = useQuery({
    queryKey: ['factura', id],
    queryFn: () => facturacionApi.getFactura(id),
    onSuccess: (res) => {
      if (res.data && res.data.estado !== 'PREFACTURA') {
        toast.error('Solo se pueden editar facturas en estado PREFACTURA');
        navigate(`/facturacion/facturas/${id}`);
      }
    }
  });

  const factura = facturaRes?.data;
  const isRemisiones = factura?.remisiones?.length > 0 || factura?.ots?.length === 0;

  // 2. Obtener pendientes de la misma empresa
  const { data: pendientesRes, isLoading: loadingPendientes } = useQuery({
    queryKey: [isRemisiones ? 'remisionesPendientes' : 'otsPendientes', factura?.empresa_id],
    queryFn: () => {
      if (isRemisiones) return facturacionApi.getRemisionesPendientes({ empresa_id: factura.empresa_id });
      return facturacionApi.getOtsPendientes({ empresa_id: factura.empresa_id });
    },
    enabled: !!factura?.empresa_id
  });

  // Inicializar selección con los ítems que ya tiene la factura
  useEffect(() => {
    if (factura && !isInitialized) {
      if (isRemisiones && factura.remisiones) {
        const preSelected = factura.remisiones.map(r => ({
          id: r.remision_id,
          consecutivo: r.numero_remision,
          empresa_id: factura.empresa_id,
          subtotal: parseFloat(r.subtotal_rem),
          iva_valor: parseFloat(r.iva_rem),
          total: parseFloat(r.total_rem),
          // para lógica UI
          is_already_in_factura: true,
          original_saldo_pendiente: parseFloat(r.total_rem) // Esto es lo que está en esta factura
        }));
        setSelectedItems(preSelected);
      } else if (factura.ots) {
        const preSelected = factura.ots.map(o => ({
          id: o.ot_id,
          consecutivo: o.ot_consecutivo,
          empresa_id: factura.empresa_id,
          subtotal: parseFloat(o.subtotal_ot),
          iva_valor: parseFloat(o.iva_ot),
          total: parseFloat(o.total_ot),
          is_already_in_factura: true
        }));
        setSelectedItems(preSelected);
      }
      setIsInitialized(true);
    }
  }, [factura, isInitialized, isRemisiones]);

  // Combinar pendientes con seleccionados para mostrar en la tabla
  const allItems = useMemo(() => {
    if (!pendientesRes?.data) return selectedItems;
    
    const combined = [...selectedItems];
    pendientesRes.data.forEach(p => {
      if (!combined.find(s => s.id === p.id)) {
        combined.push({
          ...p,
          subtotal: parseFloat(p.subtotal),
          iva_valor: parseFloat(p.iva_valor),
          total: parseFloat(p.total),
          original_saldo_pendiente: parseFloat(p.total)
        });
      }
    });
    return combined;
  }, [pendientesRes?.data, selectedItems]);

  const toggleSelect = (item) => {
    setSelectedItems(prev => {
      const exists = prev.find(o => o.id === item.id);
      if (exists) return prev.filter(o => o.id !== item.id);
      
      return [...prev, item];
    });
  };

  const updateItemTotal = (id, newTotalStr) => {
    const newTotal = parseFloat(newTotalStr) || 0;
    
    setSelectedItems(prev => prev.map(item => {
      if (item.id === id) {
        // En base al nuevo total, calcular subtotal e IVA proporcional
        const originalSaldo = item.original_saldo_pendiente || item.total;
        
        // Evitar facturar más del saldo original (si es remisión y existe saldo)
        // Para simplificar, si el usuario excede, se restringe visualmente al máximo
        const finalTotal = newTotal > originalSaldo && !item.is_already_in_factura ? originalSaldo : newTotal;
        
        const ratio = finalTotal / (item.total_neto || item.total || 1); // aproximación
        // Lo ideal sería que el backend recalcule, pero hacemos un estimado rápido
        // Como el item tiene total, podemos deducir un IVA del 19% si aplica
        const subtotalCalc = finalTotal / 1.19;
        const ivaCalc = finalTotal - subtotalCalc;

        return { ...item, total: finalTotal, subtotal: subtotalCalc, iva_valor: ivaCalc };
      }
      return item;
    }));
  };

  const totals = useMemo(() => {
    return selectedItems.reduce((acc, item) => ({
      subtotal: acc.subtotal + parseFloat(item.subtotal),
      iva: acc.iva + parseFloat(item.iva_valor),
      total: acc.total + parseFloat(item.total)
    }), { subtotal: 0, iva: 0, total: 0 });
  }, [selectedItems]);

  const updateMutation = useMutation({
    mutationFn: (data) => facturacionApi.updateFactura(id, data),
    onSuccess: () => {
      toast.success('Factura actualizada correctamente');
      queryClient.invalidateQueries(['factura', id]);
      queryClient.invalidateQueries(['remisionesPendientes']);
      navigate(`/facturacion/facturas/${id}`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Error al actualizar la factura');
    }
  });

  const handleSave = () => {
    if (selectedItems.length === 0) {
      toast.error('Debe seleccionar al menos un ítem');
      return;
    }

    const payloadKey = isRemisiones ? 'remisiones' : 'ots';
    const data = {
      [payloadKey]: selectedItems.map(o => ({
        id: o.id,
        subtotal: o.subtotal,
        iva_valor: o.iva_valor,
        total: o.total
      }))
    };

    updateMutation.mutate(data);
  };

  if (loadingFactura || !isInitialized) return <Layout><div className="flex items-center justify-center min-h-[400px]"><div className="spinner" /></div></Layout>;
  if (!factura) return <Layout><div className="text-center py-20">Factura no encontrada</div></Layout>;

  return (
    <Layout title={`Editar Prefactura ${factura.consecutivo_interno}`}>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={() => navigate(`/facturacion/facturas/${id}`)}
            className="btn-ghost flex items-center gap-2"
          >
            <ArrowLeft size={16} /> Volver a la factura
          </button>
        </div>

        {/* ─── Resumen Prefactura ────────────────────────────────────────── */}
        <div 
          className="card-premium border-l-4 border-l-accent"
          style={{ padding: '1.5rem 2.5rem' }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Receipt size={20} className="text-accent" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-muted tracking-wider">Editando</p>
                  <p className="font-bold text-sm">
                    {selectedItems.length} {isRemisiones ? 'Remisiones' : 'OTs'} seleccionadas
                  </p>
                </div>
              </div>
            </div>

            {/* Totales y acciones */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-6 text-sm">
                <div className="text-right">
                  <p className="text-[10px] uppercase text-muted font-bold">Subtotal Estimado</p>
                  <p className="font-semibold">{formatCurrency(totals.subtotal)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-muted font-bold">IVA Estimado</p>
                  <p className="font-semibold">{formatCurrency(totals.iva)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-accent font-bold">Total Factura</p>
                  <p className="font-bold text-lg text-accent">{formatCurrency(totals.total)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  className="btn-primary px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-accent/20 font-bold"
                  onClick={handleSave}
                  disabled={updateMutation.isLoading}
                >
                  <Save size={18} />
                  {updateMutation.isLoading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Tabla Principal ──────────────────────────────────────── */}
        <div className="card-premium overflow-hidden" style={{ position: 'relative' }}>
          {(loadingPendientes || updateMutation.isLoading) && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, borderRadius: 'inherit' }}>
              <div className="spinner h-8 w-8" />
            </div>
          )}
          <table className="w-full">
            <thead className="bg-subtle text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-4 text-center w-12">Sel</th>
                <th className="px-5 py-4 text-left">{isRemisiones ? 'Remisión' : 'Orden'}</th>
                <th className="px-5 py-4 text-right">Saldo Pendiente</th>
                <th className="px-5 py-4 text-right w-48">Monto a Facturar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-color">
              {allItems.map((item) => {
                const isSelected = selectedItems.find(o => o.id === item.id);
                return (
                  <tr 
                    key={item.id} 
                    className={`transition-all ${isSelected ? 'bg-accent/5 hover:bg-accent/10' : 'hover:bg-subtle/30'}`}
                  >
                    <td className="px-5 py-4 text-center cursor-pointer" onClick={() => toggleSelect(item)}>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all mx-auto ${
                        isSelected ? 'bg-accent border-accent text-white' : 'border-color'
                      }`}>
                        {isSelected && <CheckCircle2 size={12} />}
                      </div>
                    </td>
                    <td className="px-5 py-4 cursor-pointer" onClick={() => toggleSelect(item)}>
                      <span className="font-bold">{item.consecutivo}</span>
                    </td>
                    <td className="px-5 py-4 text-right cursor-pointer" onClick={() => toggleSelect(item)}>
                      <span className="font-bold text-muted">{formatCurrency(item.original_saldo_pendiente || item.total)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {isSelected ? (
                        <div className="flex items-center justify-end">
                          <span className="text-muted mr-1">$</span>
                          <input 
                            type="number"
                            className="input-premium text-right w-32 py-1 px-2 text-accent font-bold"
                            value={item.total}
                            onChange={(e) => updateItemTotal(item.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      ) : (
                        <span className="text-muted italic">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </Layout>
  );
};
