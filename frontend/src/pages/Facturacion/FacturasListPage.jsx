import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  X,
  Edit,
  Save
} from 'lucide-react';
import { facturacionApi } from '../../services/facturacionApi';
import { Layout } from '../../components/Layout';
import { formatCurrency, formatDateLocal } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import { usePermissions } from '../../contexts/PermissionsContext';

export const FacturasListPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { esAdmin } = usePermissions();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('FACTURADA');

  // ─── Estado del modal de edición (admin) ───────────────────────
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFactura, setEditingFactura] = useState(null);
  const [editNumFactura, setEditNumFactura] = useState('');
  const [editFechaFactura, setEditFechaFactura] = useState('');
  const [editMonto, setEditMonto] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');

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

  // ─── Edición de factura (admin) ────────────────────────────────
  const openEditModal = (factura) => {
    setEditingFactura(factura);
    setEditNumFactura(factura.numero_factura || '');
    setEditFechaFactura(factura.fecha_factura ? factura.fecha_factura.split('T')[0] : '');
    setEditMonto(parseFloat(factura.total) || '');
    setEditDescripcion(factura.notas || '');
    setIsEditModalOpen(true);
  };

  const editMutation = useMutation({
    mutationFn: ({ id, data }) => facturacionApi.updateFacturaFields(id, data),
    onSuccess: () => {
      toast.success('Factura actualizada correctamente');
      queryClient.invalidateQueries(['facturas']);
      setIsEditModalOpen(false);
      setEditingFactura(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Error al actualizar la factura');
    }
  });

  const handleSaveEdit = () => {
    const montoNum = parseFloat(editMonto);
    if (isNaN(montoNum) || montoNum < 0) {
      toast.error('El monto debe ser un número válido');
      return;
    }
    if (editFechaFactura && isNaN(new Date(editFechaFactura).getTime())) {
      toast.error('La fecha ingresada no es válida');
      return;
    }

    editMutation.mutate({
      id: editingFactura.id,
      data: {
        numero_factura: editNumFactura,
        fecha_factura: editFechaFactura || null,
        total: montoNum,
        notas: editDescripcion
      }
    });
  };

  return (
    <Layout title="Listado de Facturas">
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
                  className="transition-all group cursor-pointer hover:bg-subtle/30"
                  onClick={() => navigate(`/facturacion/facturas/${factura.id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
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
                      {esAdmin() && tab === 'FACTURADA' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(factura);
                          }}
                          className="p-2 rounded-lg hover:bg-subtle text-muted hover:text-accent transition-all"
                          title="Editar Factura"
                        >
                          <Edit size={18} />
                        </button>
                      )}
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

      {/* ─── Modal: Editar Factura (Admin) ──────────────────────────── */}
      {isEditModalOpen && editingFactura && createPortal(
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
          onClick={(e) => { if (e.target === e.currentTarget && !editMutation.isLoading) setIsEditModalOpen(false); }}
        >
          <div 
            className="card-premium"
            style={{
              width: '100%',
              maxWidth: '600px',
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
                  <Edit size={24} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-foreground tracking-tight">Editar Factura</h3>
                  <p className="text-sm text-muted font-medium">{editingFactura.consecutivo_interno} — {editingFactura.empresa_nombre}</p>
                </div>
              </div>
              <button 
                onClick={() => { if (!editMutation.isLoading) setIsEditModalOpen(false); }}
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-subtle transition-colors text-muted hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Body */}
            <div className="space-y-6" style={{ padding: '2.5rem 3rem' }}>
              <div>
                <label className="text-sm font-bold uppercase text-muted mb-3 block tracking-widest">
                  Número de Factura
                </label>
                <input 
                  type="text" 
                  className="input-premium w-full font-bold text-accent text-lg py-4 px-5"
                  placeholder="Ej: FV-2026-00123"
                  value={editNumFactura}
                  onChange={(e) => setEditNumFactura(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-sm font-bold uppercase text-muted mb-3 block tracking-widest">
                  Fecha
                </label>
                <input 
                  type="date" 
                  className="input-premium w-full font-bold text-base py-4 px-5"
                  value={editFechaFactura}
                  onChange={(e) => setEditFechaFactura(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-bold uppercase text-muted mb-3 block tracking-widest">
                  Monto <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-muted font-bold text-lg">$</span>
                  <input 
                    type="number" 
                    className="input-premium w-full font-bold text-accent text-lg py-4 pl-10 pr-5"
                    placeholder="0"
                    value={editMonto}
                    onChange={(e) => setEditMonto(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-bold uppercase text-muted mb-3 block tracking-widest">
                  Descripción
                </label>
                <textarea 
                  className="input-premium w-full py-4 px-5 text-sm resize-none"
                  rows="3"
                  placeholder="Notas opcionales sobre la factura..."
                  value={editDescripcion}
                  onChange={(e) => setEditDescripcion(e.target.value)}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-4 border-t border-color" style={{ padding: '2rem 3rem', background: 'var(--color-subtle, rgba(255,255,255,0.02))' }}>
              <button 
                className="btn-secondary flex-1 py-4 rounded-2xl font-bold text-base hover:bg-subtle transition-colors" 
                onClick={() => { if (!editMutation.isLoading) setIsEditModalOpen(false); }}
                disabled={editMutation.isLoading}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary flex-[2] py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-xl shadow-accent/20 transition-all hover:scale-[1.02] active:scale-[0.98]" 
                onClick={handleSaveEdit}
                disabled={editMutation.isLoading}
              >
                {editMutation.isLoading ? (
                  <>
                    <div className="spinner h-5 w-5 border-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={20} strokeWidth={2.5} />
                    Guardar
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
