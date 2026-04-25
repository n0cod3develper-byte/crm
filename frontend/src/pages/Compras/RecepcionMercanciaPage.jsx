import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  Package, 
  ArrowLeft, 
  ClipboardCheck, 
  AlertTriangle,
  Info,
  Calendar,
  Building2,
  Hash
} from 'lucide-react';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import api from '../../lib/api';

export const RecepcionMercanciaPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [oc, setOc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ items: [], remision: '', observaciones: '' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await api.get(`/compras/oc/${id}`);
        const ocData = data.data || data;
        setOc(ocData);
        
        // Inicializar form data con las cantidades máximas pendientes por recibir
        const initialItems = ocData.items.map(item => {
           const pendiente = parseFloat(item.cantidad_ordenada) - parseFloat(item.cantidad_recibida || 0);
           return {
             oc_item_id: item.id,
             descripcion: item.descripcion,
             unidad: item.unidad,
             pendiente,
             cantidad_recibida: pendiente > 0 ? pendiente : 0
           };
        });
        
        setFormData(prev => ({ ...prev, items: initialItems }));
      } catch (err) {
        toast.error('Error al cargar la Orden de Compra');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleCantidadChange = (itemId, val) => {
    const newVal = parseFloat(val) || 0;
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.oc_item_id === itemId ? { ...item, cantidad_recibida: newVal } : item
      )
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const hasInvalid = formData.items.some(item => item.cantidad_recibida < 0 || item.cantidad_recibida > item.pendiente);
    if (hasInvalid) {
      return toast.error('Cantidades inválidas o superiores al pendiente');
    }

    if (!window.confirm('¿Confirmas la recepción? El inventario se actualizará automáticamente.')) {
      return;
    }

    try {
      await api.post(`/compras/oc/${id}/recibir`, {
        remision: formData.remision,
        observaciones: formData.observaciones,
        items: formData.items.map(i => ({ 
          oc_item_id: i.oc_item_id, 
          cantidad_recibida: i.cantidad_recibida 
        }))
      });
      toast.success('Mercancía e Inventario actualizados exitosamente');
      navigate('/compras/oc');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al procesar la recepción');
    }
  };

  if (loading) return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content flex items-center justify-center">
        <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
      </div>
    </div>
  );

  if (!oc) return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="card empty-state">
          <AlertTriangle size={48} className="empty-state__icon" />
          <h2 className="empty-state__title">Orden de Compra no encontrada</h2>
          <button className="btn btn--primary mt-4" onClick={() => navigate('/compras/oc')}>Volver a la lista</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-layout">
      <Sidebar />
      <Topbar 
        title="Recepción de Mercancía" 
        subtitle="Registro de ingreso al almacén y actualización de inventario" 
        rightContent={
          <div className="flex items-center gap-3">
            <button className="btn btn--ghost btn--sm" onClick={() => navigate(-1)}>
              <ArrowLeft size={18} />
            </button>
            <span className={`badge ${oc.estado === 'EMITIDA' ? 'badge--primary' : 'badge--warning'}`}>
              {oc.estado}
            </span>
          </div>
        } 
      />

      <main className="main-content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
          
          <div className="flex flex-col gap-6">
            {/* OC Info Header */}
            <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem' }}>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-muted" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase' }}>
                  <Hash size={12} /> OC Consecutivo
                </div>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{oc.consecutivo}</div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-muted" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase' }}>
                  <Building2 size={12} /> Proveedor
                </div>
                <div style={{ fontWeight: 600 }}>{oc.proveedor_nombre}</div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-muted" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase' }}>
                  <Calendar size={12} /> Fecha de OC
                </div>
                <div>{new Date(oc.created_at).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="card">
              <div className="flex items-center gap-2 mb-6">
                <ClipboardCheck size={20} className="text-primary" />
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Detalle de Ítems</h2>
              </div>

              <div className="table-wrapper mb-6">
                <table>
                  <thead>
                    <tr>
                      <th>Descripción</th>
                      <th style={{ textAlign: 'right' }}>Pedida</th>
                      <th style={{ textAlign: 'right' }}>Pendiente</th>
                      <th style={{ textAlign: 'right', width: '180px' }}>Cant. a Recibir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map(item => (
                      <tr key={item.oc_item_id}>
                        <td className="font-medium">{item.descripcion}</td>
                        <td style={{ textAlign: 'right' }}>{item.pendiente + (oc.items.find(i => i.id === item.oc_item_id)?.cantidad_recibida || 0)} {item.unidad}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: item.pendiente > 0 ? 'var(--clr-warning)' : 'var(--clr-success)' }}>
                          {item.pendiente} {item.unidad}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input 
                            type="number" 
                            min="0"
                            max={item.pendiente}
                            step="0.01"
                            className="input"
                            style={{ textAlign: 'right', padding: '0.5rem' }}
                            value={item.cantidad_recibida}
                            disabled={item.pendiente === 0}
                            onChange={(e) => handleCantidadChange(item.oc_item_id, e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="input-group">
                  <label className="input-label">Número de Remisión / Factura</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ej: FAC-1234 o REM-567"
                    className="input"
                    value={formData.remision}
                    onChange={e => setFormData({ ...formData, remision: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Observaciones de Recepción</label>
                  <textarea 
                    className="input"
                    rows="1"
                    placeholder="Estado de la mercancía, faltantes, etc."
                    value={formData.observaciones}
                    onChange={e => setFormData({ ...formData, observaciones: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                <button 
                  type="submit" 
                  className="btn btn--primary btn--lg" 
                  disabled={oc.estado === 'RECIBIDA_TOTAL' || oc.estado === 'ANULADA' || formData.items.every(i => i.cantidad_recibida === 0)}
                >
                  <Package size={20} />
                  Procesar Recepción e Inventario
                </button>
              </div>
            </form>
          </div>

          {/* Right Panel / Info */}
          <div className="flex flex-col gap-4">
            <div className="card" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--clr-primary-500)' }}>
              <div className="flex gap-3">
                <Info size={20} className="text-primary" />
                <div style={{ fontSize: 'var(--text-xs)' }}>
                  <p className="font-bold mb-1">Información de Proceso</p>
                  <p className="text-muted">Al confirmar la recepción, el sistema incrementará automáticamente el stock de los productos asociados en el módulo de Inventario.</p>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="font-bold text-sm mb-3">Resumen de OC</h3>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-muted">Ítems totales</span>
                <span>{oc.items.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted">Valor Total</span>
                <span className="font-bold">
                  {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(oc.total)}
                </span>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};
