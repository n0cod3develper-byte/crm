import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Search, 
  FilePlus, 
  CheckCircle2, 
  AlertTriangle,
  Building2,
  Calendar,
  X,
  FileText,
  Receipt,
  Layers,
  Trash2
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

  const { data: items, isLoading, isFetching } = useQuery({
    queryKey: [isRemisiones ? 'remisionesPendientes' : 'otsPendientes', empresaIdParam, search],
    queryFn: () => {
      if (isRemisiones) {
        return facturacionApi.getRemisionesPendientes({ empresa_id: empresaIdParam, search });
      }
      return facturacionApi.getOtsPendientes({ empresa_id: empresaIdParam, search });
    },
    keepPreviousData: true
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

  const selectAll = () => {
    if (!items?.data || items.data.length === 0) return;
    if (selectedItems.length === items.data.length) {
      setSelectedItems([]);
      return;
    }
    const firstEmpresa = items.data[0].empresa_id;
    const sameEmpresa = items.data.filter(i => i.empresa_id === firstEmpresa);
    setSelectedItems(sameEmpresa);
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
      setIsModalOpen(false);
      setNroFactura('');
      setNotas('');
      setSelectedItems([]);
      navigate(`/facturacion/facturas/${res.data.id}`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Error al crear la prefactura');
    }
  });

  const handleCreate = () => {
    if (selectedItems.length === 0) return;
    setNroFactura('');
    setNotas('');
    setIsModalOpen(true);
  };

  const confirmCreate = () => {
    if (!nroFactura.trim()) {
      toast.error('El número de factura es obligatorio');
      return;
    }

    const baseData = {
      empresa_id: selectedItems[0].empresa_id,
      condicion_pago: selectedItems[0].condicion_pago || '30_DIAS',
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

  return (
    <Layout title={isRemisiones ? 'Remisiones por Facturar' : 'Órdenes de Trabajo por Facturar'}>
      <div className="space-y-6 animate-in fade-in duration-500">

        {/* ─── Tab Selector + Search ─────────────────────────────────── */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex gap-1 p-1 bg-subtle/50 rounded-2xl border border-color w-fit" role="tablist">
            <button
              role="tab"
              aria-selected={!isRemisiones}
              onClick={() => setTab('ots')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-bold transition-all ${
                !isRemisiones 
                  ? 'btn-primary shadow-lg shadow-accent/20' 
                  : 'text-muted hover:text-foreground bg-subtle/30 hover:bg-subtle'
              }`}
              style={{ borderRadius: '0.75rem' }}
            >
              <Layers size={16} />
              OTs Pendientes
            </button>
            <button
              role="tab"
              aria-selected={isRemisiones}
              onClick={() => setTab('remisiones')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-bold transition-all ${
                isRemisiones 
                  ? 'btn-primary shadow-lg shadow-accent/20' 
                  : 'text-muted hover:text-foreground bg-subtle/30 hover:bg-subtle'
              }`}
              style={{ borderRadius: '0.75rem' }}
            >
              <Receipt size={16} />
              Remisiones Pendientes
            </button>
          </div>

          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por OT, remisión o empresa..."
              className="input-premium pl-10 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ─── Resumen Prefactura (Arriba de la tabla) ──────────────── */}
        {selectedItems.length > 0 ? (
          <div 
            className="card-premium border-l-4 border-l-accent animate-in slide-in-from-top-2 duration-300"
            style={{ padding: '1.5rem 2.5rem' }}
          >
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
              {/* Info izquierda */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <FilePlus size={20} className="text-accent" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-muted tracking-wider">Prefactura</p>
                    <p className="font-bold text-sm">
                      {selectedItems.length} {isRemisiones ? 'Remisiones' : 'OTs'} seleccionadas
                    </p>
                  </div>
                </div>

                <div className="hidden md:block h-8 w-px bg-color" />

                <div className="flex items-center gap-2">
                  <Building2 size={14} className="text-muted" />
                  <span className="font-bold text-sm">{selectedItems[0].empresa_nombre}</span>
                </div>
              </div>

              {/* Totales y acciones */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-muted font-bold">Subtotal</p>
                    <p className="font-semibold">{formatCurrency(totals.subtotal)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-muted font-bold">IVA</p>
                    <p className="font-semibold">{formatCurrency(totals.iva)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-accent font-bold">Total</p>
                    <p className="font-bold text-lg text-accent">{formatCurrency(totals.total)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    className="btn-ghost p-2 rounded-xl text-muted hover:text-red-500 transition-colors"
                    onClick={() => setSelectedItems([])}
                    title="Limpiar selección"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button 
                    className="btn-primary px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-accent/20 font-bold"
                    onClick={handleCreate}
                  >
                    <CheckCircle2 size={18} />
                    Generar Factura
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
            <AlertTriangle size={16} className="text-blue-500 shrink-0" />
            <p className="text-sm text-blue-400">
              {isRemisiones
                ? 'Selecciona una o varias remisiones de la misma empresa para generar una factura.'
                : 'Selecciona una o varias órdenes de trabajo de la misma empresa para generar una factura.'
              }
            </p>
          </div>
        )}

        {/* ─── Tabla Principal ──────────────────────────────────────── */}
        <div className="card-premium overflow-hidden" style={{ position: 'relative' }}>
          {/* Loading overlay sobre la tabla */}
          {(isLoading || isFetching) && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, borderRadius: 'inherit' }}>
              <div className="spinner h-8 w-8" />
            </div>
          )}
          <table className="w-full">
            <thead className="bg-subtle text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-4 text-center w-12">
                  <div 
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer mx-auto ${
                      items?.data?.length > 0 && selectedItems.length === items.data.length 
                        ? 'bg-accent border-accent text-white' 
                        : 'border-color hover:border-accent/50'
                    }`}
                    onClick={selectAll}
                  />
                </th>
                <th className="px-5 py-4 text-left">{isRemisiones ? 'Remisión' : 'Orden'}</th>
                <th className="px-5 py-4 text-left">Empresa</th>
                <th className="px-5 py-4 text-left">Liquidada</th>
                <th className="px-5 py-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-color">
              {items?.data?.map((item) => {
                const isSelected = selectedItems.find(o => o.id === item.id);
                return (
                  <tr 
                    key={item.id} 
                    className={`transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-accent/5 hover:bg-accent/10' 
                        : 'hover:bg-subtle/30'
                    }`}
                    onClick={() => toggleSelect(item)}
                  >
                    <td className="px-5 py-4 text-center">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all mx-auto ${
                        isSelected ? 'bg-accent border-accent text-white' : 'border-color'
                      }`}>
                        {isSelected && <CheckCircle2 size={12} />}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold">{item.consecutivo}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-muted" />
                        <span className="font-semibold">{item.empresa_nombre}</span>
                      </div>
                      <div className="text-[10px] text-muted uppercase tracking-tighter">NIT: {item.empresa_nit}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-muted" />
                        <span>{new Date(item.fecha_liquidacion).toLocaleDateString()}</span>
                      </div>
                      <div className={`text-[10px] font-bold ${item.dias_desde_liquidacion > 30 ? 'text-red-500' : 'text-muted'}`}>
                        Hace {item.dias_desde_liquidacion} días
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-accent">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                );
              })}
              {(!items?.data || items.data.length === 0) && !isLoading && (
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

      {/* ─── Modal Overlay: Generar Factura (Portal a body) ─────────── */}
      {isModalOpen && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div 
            className="card-premium"
            style={{
              width: '100%',
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
                  <h3 className="text-2xl font-black text-foreground tracking-tight">Generar Factura</h3>
                  <p className="text-sm text-muted font-medium">{selectedItems.length} {isRemisiones ? 'remisiones' : 'OTs'} seleccionadas</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-subtle transition-colors text-muted hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Body */}
            <div className="space-y-10" style={{ padding: '2.5rem 3rem' }}>
              {/* Resumen */}
              <div className="bg-subtle/40 p-5 rounded-2xl border border-color flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase font-bold text-muted tracking-widest mb-1">Empresa</p>
                  <p className="font-bold text-lg text-foreground">{selectedItems[0]?.empresa_nombre}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase font-bold text-muted tracking-widest mb-1">Total a Facturar</p>
                  <p className="font-black text-2xl text-accent">{formatCurrency(totals.total)}</p>
                </div>
              </div>

              {/* Campos del formulario */}
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-bold uppercase text-muted mb-3 block tracking-widest">
                    Número de Factura <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    className="input-premium w-full font-bold text-accent text-xl py-4 px-5"
                    placeholder="Ej: FE-1234"
                    value={nroFactura}
                    onChange={(e) => setNroFactura(e.target.value)}
                    autoFocus
                  />
                  <p className="text-xs text-muted mt-2 font-medium">Ingresa el número de factura electrónica asignado externamente.</p>
                </div>

                <div>
                  <label className="text-sm font-bold uppercase text-muted mb-3 block tracking-widest">
                    Descripción
                  </label>
                  <textarea 
                    className="input-premium w-full h-36 resize-none text-base py-4 px-5"
                    placeholder="Ej: Servicios correspondientes al mes de Abril..."
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-4 border-t border-color" style={{ padding: '2rem 3rem', background: 'var(--color-subtle, rgba(255,255,255,0.02))' }}>
              <button 
                className="btn-secondary flex-1 py-4 rounded-2xl font-bold text-base hover:bg-subtle transition-colors" 
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary flex-[2] py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-xl shadow-accent/20 transition-all hover:scale-[1.02] active:scale-[0.98]" 
                onClick={confirmCreate}
                disabled={createPrefacturaMutation.isLoading || !nroFactura.trim()}
              >
                {createPrefacturaMutation.isLoading ? (
                  <>
                    <div className="spinner h-5 w-5 border-2" />
                    Generando Factura...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} strokeWidth={2.5} />
                    Confirmar Factura
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </Layout>
  );
};
