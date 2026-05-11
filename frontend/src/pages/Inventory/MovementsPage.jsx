import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  History, ArrowUpRight, ArrowDownLeft, RefreshCcw, 
  Plus, Search, Calendar, User, FileText, Package,
  Repeat, AlertCircle, Info, Download, ShoppingCart, CheckCircle2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import api from '../../lib/api';
import { formatCurrency } from '../../utils/formatters';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function MovementsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const queryClient = useQueryClient();

  const { data: movementsData, isLoading } = useQuery({
    queryKey: ['inventory-movements', filterType],
    queryFn: async () => {
      const params = {};
      if (filterType !== 'all') params.type = filterType;
      const { data } = await api.get('/movements', { params });
      return data;
    }
  });

  const { data: statsData } = useQuery({
    queryKey: ['inventory-movements-stats'],
    queryFn: async () => {
      const { data } = await api.get('/movements/stats');
      return data;
    }
  });

  const movements = movementsData?.data || [];
  const stats = statsData?.data || {};

  const getMovementIcon = (type) => {
    if (type?.startsWith('ENTRADA')) return <ArrowDownLeft size={16} className="text-success-500" />;
    if (type?.startsWith('SALIDA')) return <ArrowUpRight size={16} className="text-danger-500" />;
    return <Repeat size={16} className="text-warning-500" />;
  };

  const getMovementColor = (type) => {
    if (type?.startsWith('ENTRADA')) return 'badge--success';
    if (type?.startsWith('SALIDA')) return 'badge--danger';
    return 'badge--warning';
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <Topbar 
        title="Movimientos de Inventario" 
        subtitle="Registro de entradas, salidas y trazabilidad completa de stock"
        rightContent={
          <div className="flex gap-2">
            <button className="btn btn--ghost flex items-center gap-2">
              <Download size={18} /> Exportar
            </button>
            <button className="btn btn--primary flex items-center gap-2" onClick={() => setIsModalOpen(true)}>
              <Plus size={18} /> Registrar Movimiento
            </button>
          </div>
        }
      />
      <main className="main-content">
        
        {/* Dashboard de Movimientos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="card" style={{ borderLeft: '4px solid var(--clr-success)' }}>
            <div className="flex items-center gap-3">
              <div style={{ padding: '0.75rem', background: 'rgba(34,197,94,0.1)', color: 'var(--clr-success)', borderRadius: '50%' }}>
                <ArrowDownLeft size={24} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Entradas (30d)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{stats.total_in || 0} <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>unid.</span></div>
              </div>
            </div>
          </div>
          <div className="card" style={{ borderLeft: '4px solid var(--clr-danger)' }}>
            <div className="flex items-center gap-3">
              <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.1)', color: 'var(--clr-danger)', borderRadius: '50%' }}>
                <ArrowUpRight size={24} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Salidas (30d)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{stats.total_out || 0} <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>unid.</span></div>
              </div>
            </div>
          </div>
          <div className="card" style={{ borderLeft: '4px solid var(--clr-primary-500)' }}>
            <div className="flex items-center gap-3">
              <div style={{ padding: '0.75rem', background: 'rgba(59,130,246,0.1)', color: 'var(--clr-primary-500)', borderRadius: '50%' }}>
                <History size={24} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Transacciones</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{movements.length} <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>total</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Listado de Movimientos */}
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Historial de Movimientos</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[
                { id: 'all', label: 'Todos' },
                { id: 'ENTRADA', label: 'Entradas' },
                { id: 'SALIDA', label: 'Salidas' },
                { id: 'AJUSTE', label: 'Ajustes' }
              ].map(type => (
                <button 
                  key={type.id}
                  onClick={() => setFilterType(type.id)}
                  className={`btn btn--sm ${filterType === type.id ? 'btn--primary' : 'btn--ghost'}`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="table-container">
            <table className="table table--hover">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Tipo / Documento</th>
                  <th style={{ textAlign: 'right' }}>Cant.</th>
                  <th style={{ textAlign: 'right' }}>Stock (Ant/Des)</th>
                  <th style={{ textAlign: 'right' }}>Costo Promedio</th>
                  <th>Referencia / Proveedor</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '4rem' }}><div className="spinner" /></td></tr>
                ) : movements.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    <div className="flex flex-col items-center gap-2">
                      <Info size={32} />
                      <span>No se encontraron movimientos con los filtros aplicados.</span>
                    </div>
                  </td></tr>
                ) : movements.map(m => {
                  const isPositive = m.tipo_movimiento?.startsWith('ENTRADA');
                  return (
                    <tr key={m.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div className="flex flex-col">
                          <span style={{ fontWeight: 600 }}>{format(new Date(m.created_at), 'dd/MM/yyyy', { locale: es })}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{format(new Date(m.created_at), 'HH:mm')}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col" style={{ maxWidth: '200px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9375rem' }} className="truncate">{m.producto_nombre || m.item_name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--clr-primary-500)', fontWeight: 700 }}>{m.producto_sku || m.codigo_interno}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <div className={`badge ${getMovementColor(m.tipo_movimiento)} flex items-center gap-1 w-fit`} style={{ fontSize: '0.6875rem' }}>
                            {getMovementIcon(m.tipo_movimiento)}
                            {m.tipo_movimiento?.replace('_', ' ')}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {m.tipo_documento}: {m.numero_documento || 'S/N'}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '1.125rem', fontWeight: 900, color: isPositive ? 'var(--clr-success)' : 'var(--clr-danger)' }}>
                          {isPositive ? '+' : '-'}{m.cantidad}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="flex flex-col items-end">
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.stock_antes} →</span>
                          <span style={{ fontWeight: 700 }}>{m.stock_despues}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="flex flex-col items-end">
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatCurrency(m.costo_promedio_antes)}</span>
                          <span style={{ fontWeight: 800, color: 'var(--clr-primary-600)' }}>{formatCurrency(m.costo_promedio_despues)}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ maxWidth: '200px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }} className="truncate">
                            {m.proveedor_nombre || m.proveedor_razon_social || 'N/A'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }} className="truncate">
                            {m.notas || 'Sin observaciones'}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {isModalOpen && (
        <Modal title="Registrar Movimiento de Inventario" onClose={() => setIsModalOpen(false)} maxWidth="800px">
          <InventoryEntryForm onSuccess={() => {
            setIsModalOpen(false);
            queryClient.invalidateQueries(['inventory-movements']);
            queryClient.invalidateQueries(['inventory-movements-stats']);
            queryClient.invalidateQueries(['catalog-items']);
          }} />
        </Modal>
      )}
    </div>
  );
}

function InventoryEntryForm({ onSuccess }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    inventario_id: '',
    tipo_movimiento: 'ENTRADA_COMPRA',
    cantidad: '',
    precio_unitario: '',
    iva_pct: 19,
    proveedor_id: '',
    proveedor_nombre_libre: '',
    usar_proveedor_catalogo: true,
    numero_documento: '',
    tipo_documento: 'FACTURA',
    fecha_documento: new Date().toISOString().split('T')[0],
    notas: ''
  });

  const [preview, setPreview] = useState(null);

  // Queries
  const { data: productsRes } = useQuery({
    queryKey: ['catalog-items-lite'],
    queryFn: async () => {
      const { data } = await api.get('/catalogo', { params: { tipo: 'PRODUCTO', limit: 1000 } });
      return data;
    }
  });

  const { data: providersRes } = useQuery({
    queryKey: ['providers-lite'],
    queryFn: async () => {
      const { data } = await api.get('/proveedores', { params: { limit: 1000 } });
      return data;
    }
  });

  const selectedProduct = productsRes?.items?.find(i => i.id === formData.inventario_id);

  // Preview Logic
  useEffect(() => {
    if (!selectedProduct || !formData.cantidad) {
      setPreview(null);
      return;
    }

    const cant = parseFloat(formData.cantidad) || 0;
    const precio = parseFloat(formData.precio_unitario) || 0;
    const stockAct = parseFloat(selectedProduct.stock_actual) || 0;
    const costoAct = parseFloat(selectedProduct.costo_promedio_ponderado || selectedProduct.costo_o_minimo || 0);

    const esEntrada = formData.tipo_movimiento.startsWith('ENTRADA');
    const stockNuevo = esEntrada ? stockAct + cant : stockAct - cant;

    let costoNuevo = costoAct;
    if (esEntrada && precio > 0 && formData.tipo_movimiento !== 'ENTRADA_AJUSTE') {
      if (stockAct <= 0) {
        costoNuevo = precio;
      } else {
        costoNuevo = ((stockAct * costoAct) + (cant * precio)) / (stockAct + cant);
      }
      costoNuevo = Math.round(costoNuevo * 100) / 100;
    }

    const subtotal = cant * precio;
    const ivaValor = subtotal * (formData.iva_pct / 100);
    const total = subtotal + ivaValor;

    setPreview({
      stockNuevo,
      costoNuevo,
      subtotal,
      ivaValor,
      total,
      costoChanged: Math.abs(costoNuevo - costoAct) > 0.01,
      precioPiso: Math.round(costoNuevo * 1.2 * 100) / 100,
      precioSugerido: Math.round(costoNuevo * 1.35 * 100) / 100
    });
  }, [formData, selectedProduct]);

  const mutation = useMutation({
    mutationFn: (data) => {
      const endpoint = data.tipo_movimiento.startsWith('ENTRADA') ? '/movements/entrada' : '/movements/salida';
      return api.post(endpoint, data);
    },
    onSuccess: (res) => {
      toast.success(res.data.mensaje || 'Movimiento registrado');
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Error al registrar');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.inventario_id) return toast.error('Seleccione un producto');
    if (formData.tipo_movimiento === 'ENTRADA_COMPRA') {
      if (formData.usar_proveedor_catalogo && !formData.proveedor_id) return toast.error('Seleccione un proveedor');
      if (!formData.usar_proveedor_catalogo && !formData.proveedor_nombre_libre) return toast.error('Ingrese nombre del proveedor');
      if (!formData.precio_unitario || parseFloat(formData.precio_unitario) <= 0) return toast.error('El precio unitario es obligatorio para compras');
    }
    
    mutation.mutate({
      ...formData,
      cantidad: parseFloat(formData.cantidad),
      precio_unitario: parseFloat(formData.precio_unitario || 0),
      iva_pct: parseFloat(formData.iva_pct || 0)
    });
  };

  const providers = providersRes?.data || (Array.isArray(providersRes) ? providersRes : []);

  return (
    <form onSubmit={handleSubmit} className="entry-form">
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', background: 'var(--bg-app)', padding: '0.5rem', borderRadius: 'var(--radius-lg)' }}>
        {[
          { id: 'ENTRADA_COMPRA', label: 'Compra Directa', icon: <ShoppingCart size={18} /> },
          { id: 'ENTRADA_AJUSTE', label: 'Ajuste Positivo', icon: <Plus size={18} /> },
          { id: 'SALIDA_AJUSTE', label: 'Ajuste Negativo', icon: <ArrowUpRight size={18} /> }
        ].map(type => (
          <button
            key={type.id}
            type="button"
            onClick={() => setFormData({...formData, tipo_movimiento: type.id})}
            style={{ 
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              padding: '0.75rem', borderRadius: 'var(--radius-md)', border: 'none',
              background: formData.tipo_movimiento === type.id ? 'var(--clr-primary-500)' : 'transparent',
              color: formData.tipo_movimiento === type.id ? 'white' : 'var(--text-muted)',
              fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            {type.icon} {type.label}
          </button>
        ))}
      </div>

      <div className="form-sections-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* Left Column */}
        <div className="flex flex-col gap-6">
          <div className="entry-section">
            <h3 className="section-title flex items-center gap-2 mb-4" style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>
              <Package size={18} className="text-primary-500" /> 1. Producto y Cantidad
            </h3>
            
            <div className="input-group mb-4">
              <label className="input-label">Seleccionar Producto</label>
              <select 
                className="input" 
                value={formData.inventario_id}
                onChange={e => setFormData({...formData, inventario_id: e.target.value})}
                required
              >
                <option value="">Buscar producto...</option>
                {productsRes?.items?.map(i => (
                  <option key={i.id} value={i.id}>{i.nombre_comercial} ({i.codigo_interno})</option>
                ))}
              </select>
            </div>

            {selectedProduct && (
              <div className="product-info-card p-3 bg-gray-50 rounded-lg border border-gray-100 mb-4 flex justify-between" style={{ background: 'var(--bg-app)', border: '1px solid var(--border-color)' }}>
                <div>
                  <div className="text-xs text-gray-500 uppercase font-bold">Stock Actual</div>
                  <div className="text-lg font-black text-gray-800" style={{ color: 'var(--text-primary)' }}>{selectedProduct.stock_actual} {selectedProduct.unidad_medida}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 uppercase font-bold">Costo Promedio</div>
                  <div className="text-lg font-bold text-primary-600" style={{ color: 'var(--clr-primary-500)' }}>{formatCurrency(selectedProduct.costo_promedio_ponderado || selectedProduct.costo_o_minimo)}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">Cantidad</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="input" 
                  value={formData.cantidad}
                  onChange={e => setFormData({...formData, cantidad: e.target.value})}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label">Costo Unitario (Opcional)</label>
                <div className="relative" style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>$</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="input" 
                    style={{ paddingLeft: '1.75rem' }}
                    value={formData.precio_unitario}
                    onChange={e => setFormData({...formData, precio_unitario: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>

          {formData.tipo_movimiento === 'ENTRADA_COMPRA' && (
            <div className="entry-section">
              <h3 className="section-title flex items-center gap-2 mb-4" style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>
                <ShoppingCart size={18} className="text-primary-500" /> 2. Proveedor
              </h3>
              
              <div className="flex bg-gray-100 p-1 rounded-lg mb-4" style={{ display: 'flex', background: 'var(--bg-app)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
                <button 
                  type="button"
                  style={{ flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: 'none', background: formData.usar_proveedor_catalogo ? 'var(--bg-surface)' : 'transparent', fontWeight: 600, fontSize: 'var(--text-xs)', cursor: 'pointer' }}
                  onClick={() => setFormData({...formData, usar_proveedor_catalogo: true})}
                >
                  Del Catálogo
                </button>
                <button 
                  type="button"
                  style={{ flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: 'none', background: !formData.usar_proveedor_catalogo ? 'var(--bg-surface)' : 'transparent', fontWeight: 600, fontSize: 'var(--text-xs)', cursor: 'pointer' }}
                  onClick={() => setFormData({...formData, usar_proveedor_catalogo: false})}
                >
                  Ocasional / Libre
                </button>
              </div>

              {formData.usar_proveedor_catalogo ? (
                <select 
                  className="input" 
                  value={formData.proveedor_id}
                  onChange={e => setFormData({...formData, proveedor_id: e.target.value})}
                >
                  <option value="">Seleccionar proveedor...</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.razon_social}</option>
                  ))}
                </select>
              ) : (
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Nombre del proveedor o 'Caja Menor'"
                  value={formData.proveedor_nombre_libre}
                  onChange={e => setFormData({...formData, proveedor_nombre_libre: e.target.value})}
                />
              )}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">
          <div className="entry-section">
            <h3 className="section-title flex items-center gap-2 mb-4" style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>
              <FileText size={18} className="text-primary-500" /> 3. Soporte Documental
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">Tipo Documento</label>
                <select 
                  className="input" 
                  value={formData.tipo_documento}
                  onChange={e => setFormData({...formData, tipo_documento: e.target.value})}
                >
                  <option value="FACTURA">Factura</option>
                  <option value="REMISION">Remisión</option>
                  <option value="AJUSTE_INTERNO">Ajuste Interno</option>
                  <option value="SIN_DOCUMENTO">Sin documento</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Nro. Documento</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Ej: FE-123" 
                  value={formData.numero_documento}
                  onChange={e => setFormData({...formData, numero_documento: e.target.value})}
                />
              </div>
            </div>

            <div className="input-group mb-4">
              <label className="input-label">Fecha</label>
              <input 
                type="date" 
                className="input" 
                value={formData.fecha_documento}
                onChange={e => setFormData({...formData, fecha_documento: e.target.value})}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Notas / Justificación</label>
              <textarea 
                className="input" 
                rows="2" 
                placeholder="Motivo del movimiento..."
                value={formData.notas}
                onChange={e => setFormData({...formData, notas: e.target.value})}
              />
            </div>
          </div>

          {/* Impact Preview */}
          <div className={`p-5 rounded-xl border-2 transition-all ${preview ? 'bg-primary-50/10' : 'opacity-50'}`} style={{ 
            border: preview ? '2px solid var(--clr-primary-100)' : '2px dashed var(--border-color)',
            background: preview ? 'rgba(37,99,235,0.05)' : 'transparent',
            borderRadius: 'var(--radius-lg)'
          }}>
            <h3 className="text-sm font-bold uppercase mb-4 flex items-center justify-between" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Resumen del Impacto {preview && <CheckCircle2 size={16} className="text-primary-500" />}
            </h3>
            
            {!preview ? (
              <div className="text-center py-4 text-gray-400 text-sm italic">
                Ingrese producto y cantidad para ver el impacto.
              </div>
            ) : (
              <div className="space-y-3" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="flex justify-between items-center text-sm" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-gray-600">Nuevo Stock Resultante:</span>
                  <span className="font-bold" style={{ color: preview.stockNuevo < 0 ? 'var(--clr-danger)' : 'var(--clr-success)', fontWeight: 700 }}>
                    {preview.stockNuevo} {selectedProduct.unidad_medida}
                  </span>
                </div>
                {formData.tipo_movimiento === 'ENTRADA_COMPRA' && (
                  <div className="flex justify-between items-center text-sm" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-gray-600">Nuevo Costo Promedio:</span>
                    <span className="font-bold" style={{ color: 'var(--clr-primary-500)', fontWeight: 700 }}>
                      {formatCurrency(preview.costoNuevo)}
                    </span>
                  </div>
                )}
                {preview.stockNuevo < 0 && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--clr-danger)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600 }}>
                    <AlertCircle size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                    Atención: El stock quedará en negativo.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
        <button 
          type="submit" 
          className="btn btn--primary"
          style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
          disabled={mutation.isPending || !preview}
        >
          {mutation.isPending ? 'Procesando...' : 'Registrar Movimiento'}
        </button>
      </div>
    </form>
  );
}
