import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Receipt, 
  FileText, 
  Download, 
  Building2,
  Calendar,
  ChevronRight,
  CheckCircle2,
  X,
  Trash2
} from 'lucide-react';
import { facturacionApi } from '../../services/facturacionApi';
import { Layout } from '../../components/Layout';
import { formatCurrency, formatDateLocal } from '../../utils/formatters';
import { toast } from 'react-hot-toast';

export const FacturasListPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('PREFACTURA');
  const [selectedFactura, setSelectedFactura] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [numFactura, setNumFactura] = useState('');
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split('T')[0]);
  const [descripcionFactura, setDescripcionFactura] = useState('');

  const { data: facturas, isLoading, isFetching } = useQuery({
    queryKey: ['facturas', tab, search],
    queryFn: () => facturacionApi.getFacturas({ estado: tab, search }),
    keepPreviousData: true
  });

  // Fetch full factura details when one is selected and modal is open
  const { data: fullFacturaRes } = useQuery({
    queryKey: ['factura', selectedFactura?.id],
    queryFn: () => facturacionApi.getFactura(selectedFactura?.id),
    enabled: !!selectedFactura && isModalOpen
  });
  const fullFactura = fullFacturaRes?.data;

  const confirmMutation = useMutation({
    mutationFn: (data) => facturacionApi.confirmarFactura(selectedFactura?.id, data),
    onSuccess: () => {
      toast.success('Factura confirmada correctamente');
      queryClient.invalidateQueries(['facturas']);
      setIsModalOpen(false);
      setSelectedFactura(null);
      setNumFactura('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Error al confirmar la factura');
    }
  });

  const handleDownloadPDF = async (factura) => {
    try {
      toast.loading('Generando PDF...', { id: 'download-pdf' });
      const response = await facturacionApi.downloadFacturaPdf(factura.id);
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${factura.consecutivo_interno}.pdf`);
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

  const toggleSelect = (factura, e) => {
    e.stopPropagation();
    if (selectedFactura?.id === factura.id) {
      setSelectedFactura(null);
    } else {
      setSelectedFactura(factura);
    }
  };

  const tabs = [
    { id: 'PREFACTURA', label: 'Prefacturas', count: 0 },
    { id: 'FACTURADA', label: 'Facturadas', count: 0 },
    { id: 'ANULADA', label: 'Anuladas', count: 0 }
  ];

  const sortedFacturas = useMemo(() => {
    if (!facturas?.data) return [];
    const list = [...facturas.data];
    if (tab === 'FACTURADA') {
      list.sort((a, b) => new Date(b.fecha_factura || b.created_at) - new Date(a.fecha_factura || a.created_at));
    }
    return list;
  }, [facturas?.data, tab]);

  return (
    <Layout title="Listado de Facturas / Prefacturas">
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Tabs and Search */}
        <div className="flex flex-col md:flex-row gap-6 justify-between items-center">
          <div className="flex gap-1 p-1 bg-subtle/50 rounded-2xl border border-color w-fit" role="tablist">
            {tabs.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => { setTab(t.id); setSelectedFactura(null); }}
                className={`px-6 py-3 text-sm font-bold transition-all ${
                  tab === t.id 
                    ? 'btn-primary shadow-lg shadow-accent/20' 
                    : 'text-muted hover:text-foreground bg-subtle/30 hover:bg-subtle'
                }`}
                style={{ borderRadius: '0.75rem' }}
              >
                {t.label}
              </button>
            ))}
          </div>
          
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input 
              type="text" 
              placeholder="Nro Factura, Consecutivo o Empresa..."
              className="input-premium pl-10 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* List Table */}
        <div className="card-premium overflow-hidden" style={{ position: 'relative' }}>
          {(isLoading || isFetching) && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, borderRadius: 'inherit' }}>
              <div className="spinner h-8 w-8" />
            </div>
          )}
          <table className="w-full">
            <thead className="bg-subtle text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-6 py-4 text-left">Nro Factura</th>
                <th className="px-6 py-4 text-left">Órdenes / Remisiones</th>
                <th className="px-6 py-4 text-left">Empresa</th>
                <th className="px-6 py-4 text-left">Fecha Factura</th>
                <th className="px-6 py-4 text-right">Monto Total</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-color">
              {sortedFacturas.map((factura) => (
                <tr 
                  key={factura.id} 
                  className={`transition-all group cursor-pointer ${
                    selectedFactura?.id === factura.id 
                      ? 'bg-accent/5 hover:bg-accent/10 ring-1 ring-inset ring-accent/20' 
                      : 'hover:bg-subtle/30'
                  }`}
                  onClick={(e) => {
                    if (tab === 'PREFACTURA') {
                      toggleSelect(factura, e);
                    } else {
                      navigate(`/facturacion/facturas/${factura.id}`);
                    }
                  }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {tab === 'PREFACTURA' && (
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          selectedFactura?.id === factura.id ? 'bg-accent border-accent text-white' : 'border-color'
                        }`}>
                          {selectedFactura?.id === factura.id && <CheckCircle2 size={12} />}
                        </div>
                      )}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${factura.estado === 'FACTURADA' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                        <Receipt size={18} />
                      </div>
                      <span className="font-bold max-w-[200px] truncate" title={factura.numero_factura || 'Pendiente'}>
                        {factura.numero_factura ? (
                          <span className="px-3 py-1 rounded-lg bg-green-500/10 text-green-500 font-bold text-sm uppercase">
                            {factura.numero_factura}
                          </span>
                        ) : (
                          <span className="text-muted opacity-50">-</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-sm text-muted max-w-[200px] truncate block" title={factura.ots_list || factura.remisiones_list || '-'}>
                      {factura.ots_list || factura.remisiones_list || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-muted" />
                      <span className="font-semibold">{factura.empresa_nombre}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-muted">
                      <Calendar size={14} />
                      <span>{formatDateLocal(factura.fecha_factura)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-accent">
                    {formatCurrency(factura.total)}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadPDF(factura);
                        }}
                        className="p-2 rounded-lg hover:bg-subtle text-muted hover:text-accent transition-all"
                        title="Descargar PDF"
                      >
                        <Download size={18} />
                      </button>
                      <button 
                        className="p-2 rounded-lg hover:bg-subtle text-muted hover:text-accent transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/facturacion/facturas/${factura.id}`);
                        }}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {facturas?.data?.length === 0 && !isLoading && (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center text-muted italic">
                    No se encontraron facturas en este estado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Barra Flotante Inferior (solo Prefacturas) ─────────────────── */}
      {selectedFactura && tab === 'PREFACTURA' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-10 fade-in duration-300 w-full px-4" style={{ maxWidth: '1200px' }}>
          <div className="card-premium flex items-center justify-between px-8 py-6 shadow-2xl shadow-black/50 border border-accent/30 bg-background/95 backdrop-blur-xl" style={{ borderRadius: '1.25rem' }}>
            <div className="flex items-center gap-6 pl-2">
              <div className="flex items-center gap-3 border-r border-color pr-6">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-muted tracking-wider">Prefactura</p>
                  <p className="font-bold text-sm">1 Seleccionada</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted">
                <Building2 size={16} />
                <span className="font-bold text-foreground">{selectedFactura.empresa_nombre}</span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-6 text-sm">
                <div className="text-right">
                  <p className="text-[10px] uppercase text-muted font-bold tracking-widest">Subtotal</p>
                  <p className="font-semibold">{formatCurrency(parseFloat(selectedFactura.subtotal) || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-muted font-bold tracking-widest">IVA</p>
                  <p className="font-semibold">{formatCurrency(parseFloat(selectedFactura.iva_valor) || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-accent font-bold tracking-widest">Total</p>
                  <p className="font-bold text-lg text-accent">{formatCurrency(parseFloat(selectedFactura.total) || 0)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 border-l border-color pl-6">
                <button 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-muted hover:bg-danger/10 hover:text-danger transition-colors"
                  onClick={() => setSelectedFactura(null)}
                  title="Cancelar Selección"
                >
                  <Trash2 size={18} />
                </button>
                <button 
                  className="btn-primary px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-accent/20"
                  onClick={() => {
                    setNumFactura('');
                    setFechaFactura(new Date().toISOString().split('T')[0]);
                    setDescripcionFactura('');
                    setIsModalOpen(true);
                  }}
                >
                  <CheckCircle2 size={18} /> Generar Factura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Confirmar Facturación ──────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" style={{ zIndex: 9999 }} onClick={() => setIsModalOpen(false)}>
          <div 
            className="card-premium w-full animate-in zoom-in-95 duration-200"
            style={{ 
              maxWidth: '700px',
              padding: 0,
              overflow: 'hidden',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
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
                onClick={() => setIsModalOpen(false)} 
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-subtle transition-colors text-muted hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Body */}
            <div className="space-y-8" style={{ padding: '2.5rem 3rem' }}>
              
              {/* Tabla Resumen */}
              {fullFactura && (
                <div className="bg-subtle/40 rounded-2xl border border-color overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-subtle/50 text-xs uppercase text-muted sticky top-0 backdrop-blur-md">
                      <tr>
                        <th className="px-5 py-3 text-left tracking-wider">Documento</th>
                        <th className="px-5 py-3 text-right tracking-wider">Monto a Confirmar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-color">
                      {fullFactura.remisiones?.map(r => (
                        <tr key={r.id} className="hover:bg-subtle/20 transition-colors">
                          <td className="px-5 py-3 font-bold">{r.numero_remision}</td>
                          <td className="px-5 py-3 text-right font-medium text-accent">{formatCurrency(r.total_rem)}</td>
                        </tr>
                      ))}
                      {fullFactura.ots?.map(o => (
                        <tr key={o.id} className="hover:bg-subtle/20 transition-colors">
                          <td className="px-5 py-3 font-bold">{o.ot_consecutivo}</td>
                          <td className="px-5 py-3 text-right font-medium text-accent">{formatCurrency(o.total_ot)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-subtle/50 sticky bottom-0 border-t border-color">
                      <tr>
                        <td className="px-5 py-3 text-right font-bold uppercase text-muted tracking-widest text-[11px]">Total General:</td>
                        <td className="px-5 py-3 text-right font-black text-lg text-accent">{formatCurrency(fullFactura.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

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
                onClick={() => confirmMutation.mutate({
                  numero_factura: numFactura,
                  fecha_factura: fechaFactura,
                  sistema_contable: 'SIIGO',
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
        </div>
      )}
    </Layout>
  );
};
