import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Receipt, 
  FileText, 
  Download, 
  Eye,
  Building2,
  Calendar,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { facturacionApi } from '../../services/facturacionApi';
import { Layout } from '../../components/Layout';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-hot-toast';

export const FacturasListPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('PREFACTURA');

  const { data: facturas, isLoading, isFetching } = useQuery({
    queryKey: ['facturas', tab, search],
    queryFn: () => facturacionApi.getFacturas({ estado: tab, search }),
    keepPreviousData: true
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

  const tabs = [
    { id: 'PREFACTURA', label: 'Prefacturas', count: 0 },
    { id: 'FACTURADA', label: 'Facturadas', count: 0 },
    { id: 'ANULADA', label: 'Anuladas', count: 0 }
  ];



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
                onClick={() => setTab(t.id)}
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
          {/* Loading overlay */}
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
                <th className="px-6 py-4 text-right">Monto Total</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-color">
              {facturas?.data?.map((factura) => (
                <tr 
                  key={factura.id} 
                  className="hover:bg-subtle/30 transition-colors group cursor-pointer"
                  onClick={() => navigate(`/facturacion/facturas/${factura.id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${factura.estado === 'FACTURADA' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                        <Receipt size={18} />
                      </div>
                      <span className="font-bold max-w-[200px] truncate" title={factura.numero_factura || factura.ots_list || factura.consecutivo_interno}>
                        {factura.numero_factura ? (
                          <span className="px-3 py-1 rounded-lg bg-green-500/10 text-green-500 font-bold text-sm uppercase">
                            {factura.numero_factura}
                          </span>
                        ) : (
                          <span className="text-muted italic">{factura.ots_list || factura.remisiones_list || factura.consecutivo_interno}</span>
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
                      <button className="p-2 rounded-lg hover:bg-subtle text-muted hover:text-accent transition-all">
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {facturas?.data?.length === 0 && !isLoading && (
                <tr>
                  <td colSpan="5" className="px-6 py-20 text-center text-muted italic">
                    No se encontraron facturas en este estado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
};
