import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, CheckCircle, Info, TrendingDown, Clock,
  ShoppingCart, Building2, Tag, ChevronRight, Plus
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import api from '../../lib/api';

export function ComparacionCotizacionesPage() {
  const { solicitudId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ proveedor_id: '', dias_entrega: '', items: [] });

  const { data: solicitud, isLoading: loadingSol } = useQuery({
    queryKey: ['solicitud-detail', solicitudId],
    queryFn: async () => {
      const { data } = await api.get(`/compras/solicitudes/${solicitudId}`);
      return data.data;
    },
  });

  const { data: proveedores } = useQuery({
    queryKey: ['proveedores-list'],
    queryFn: async () => {
      const { data } = await api.get('/proveedores');
      return data.data || data;
    }
  });

  useEffect(() => {
    if (solicitud && showModal) {
      setForm({
        proveedor_id: '',
        dias_entrega: '',
        fecha_cotizacion: new Date().toISOString().substring(0, 10),
        fecha_vencimiento: new Date(Date.now() + 15 * 86400000).toISOString().substring(0, 10),
        condicion_pago: '30_DIAS',
        items: solicitud.items.map(i => ({
          solicitud_item_id: i.id,
          descripcion: i.descripcion,
          cantidad: i.cantidad_solicitada,
          precio_unitario: '',
          marca: '',
          aplica_iva: true,
          iva_pct: 19
        }))
      });
    }
  }, [solicitud, showModal]);

  const { data: cotizaciones, isLoading: loadingCots } = useQuery({
    queryKey: ['cotizaciones-solicitud', solicitudId],
    queryFn: async () => {
      const { data } = await api.get(`/compras/solicitudes/${solicitudId}/cotizaciones`);
      return data.data || [];
    },
  });

  const selectMut = useMutation({
    mutationFn: (cotId) => api.post(`/compras/cotizaciones/${cotId}/seleccionar`),
    onSuccess: (res) => {
      // Axios: res.data = { data: { id: '...' }, success: true }
      const ocId = res?.data?.data?.id || res?.data?.id;
      toast.success('¡Orden de Compra generada exitosamente!');
      qc.invalidateQueries({ queryKey: ['ordenes-compra'] });
      qc.invalidateQueries({ queryKey: ['solicitudes-compra'] });
      if (ocId) {
        navigate(`/compras/oc/${ocId}/editar`);
      } else {
        // Si no llega el ID, igual la OC se creó — ir al listado
        navigate('/compras/oc');
      }
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al procesar selección'),
  });

  const createMut = useMutation({
    mutationFn: (payload) => api.post(`/compras/solicitudes/${solicitudId}/cotizaciones`, payload),
    onSuccess: () => {
      toast.success('Cotización registrada exitosamente');
      setShowModal(false);
      qc.invalidateQueries({ queryKey: ['cotizaciones-solicitud', solicitudId] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al guardar cotización')
  });

  const handleSaveCotizacion = () => {
    if (!form.proveedor_id) return toast.error('Selecciona un proveedor');
    if (!form.dias_entrega) return toast.error('Ingresa los días de entrega');
    if (form.items.some(i => !i.precio_unitario)) return toast.error('Completa todos los precios');
    
    createMut.mutate(form);
  };

  const updateItemPrice = (idx, field, val) => {
    const newItems = [...form.items];
    newItems[idx][field] = val;
    setForm({ ...form, items: newItems });
  };

  const fmt = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

  if (loadingSol || loadingCots) return <div className="app-layout"><Sidebar /><main className="main-content"><div className="spinner" /></main></div>;
  if (!solicitud) return <div className="app-layout"><Sidebar /><main className="main-content">Solicitud no encontrada</main></div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <Topbar 
        title="Comparativa de Cotizaciones" 
        subtitle={`Solicitud ${solicitud.consecutivo} — ${solicitud.area_solicitante}`} 
        rightContent={
          <div className="flex items-center gap-3">
            <button className="btn btn--ghost" onClick={() => navigate('/compras/solicitudes')}>
              <ArrowLeft size={18} />
            </button>
            <button className="btn btn--primary" onClick={() => setShowModal(true)}>
              <Plus size={16} /> Registrar Cotización
            </button>
          </div>
        } 
      />

      <main className="main-content">
        <div className="card mb-6" style={{ background: 'var(--bg-elevated)', border: 'none' }}>
           <div className="flex items-center gap-2 mb-2 font-bold text-sm">
              <Info size={16} color="var(--clr-primary-400)" /> Resumen del Requerimiento
           </div>
           <p className="text-sm">{solicitud.justificacion}</p>
        </div>

        {(!cotizaciones || cotizaciones.length === 0) ? (
          <div className="card empty-state">
            <Tag size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Aún no hay cotizaciones</h2>
            <p className="empty-state__desc">Debes registrar al menos una cotización de proveedor para realizar la comparación.</p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: '0' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 220, position: 'sticky', left: 0, zIndex: 5, background: 'var(--bg-elevated)' }}>Detalle Solicitado</th>
                  {cotizaciones.map(cot => (
                    <th key={cot.id} style={{ minWidth: 280, textAlign: 'center' }}>
                       <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700 }}>{cot.proveedor_nombre}</span>
                          <span style={{ fontSize: '11px', textTransform: 'none', fontWeight: 500, opacity: 0.6 }}>{cot.consecutivo}</span>
                       </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {solicitud.items?.map(reqItem => {
                  const prices = cotizaciones.map(c => c.items.find(i => i.solicitud_item_id === reqItem.id)?.precio_unitario).filter(p => p != null);
                  const minPrice = prices.length > 0 ? Math.min(...prices) : null;

                  return (
                    <tr key={reqItem.id}>
                      <td style={{ position: 'sticky', left: 0, zIndex: 4, background: 'var(--bg-surface)', fontWeight: 600 }}>
                         <div style={{ fontSize: '13px' }}>{reqItem.descripcion}</div>
                         <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cant: {reqItem.cantidad_solicitada} {reqItem.unidad}</div>
                      </td>
                      {cotizaciones.map(cot => {
                        const cItem = cot.items.find(i => i.solicitud_item_id === reqItem.id);
                        if (!cItem) return <td key={cot.id} style={{ textAlign: 'center', opacity: 0.3 }}>—</td>;
                        
                        const isBest = parseFloat(cItem.precio_unitario) === minPrice;

                        return (
                          <td key={cot.id} style={{ textAlign: 'center', background: isBest ? 'rgba(34,197,94,0.05)' : 'transparent' }}>
                             <div className="flex flex-col items-center">
                                <span style={{ fontWeight: 700, color: isBest ? 'var(--clr-success)' : 'inherit' }}>
                                   {fmt(cItem.precio_unitario)}
                                </span>
                                {isBest && (
                                  <span className="badge badge--success" style={{ fontSize: '9px', padding: '0px 6px', marginTop: '4px' }}>
                                     <TrendingDown size={10} /> Mejor Precio
                                  </span>
                                )}
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    {cItem.marca || 'N/A'}
                                </span>
                             </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                <tr style={{ background: 'var(--bg-elevated)' }}>
                   <td style={{ fontWeight: 800, textAlign: 'right', fontSize: '12px' }}>RESUMEN FINAL</td>
                   {cotizaciones.map(cot => (
                     <td key={cot.id}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1rem 0' }}>
                           <div style={{ textAlign: 'center' }}>
                              <div className="text-xs text-muted">Total con IVA</div>
                              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--clr-primary-400)' }}>{fmt(cot.total)}</div>
                           </div>
                           <div className="badge badge--gray" style={{ gap: '0.5rem' }}>
                              <Clock size={12} /> {cot.dias_entrega || '?'} días entrega
                           </div>
                           <button 
                             className="btn btn--primary btn--sm w-full"
                             style={{ marginTop: '0.5rem' }}
                             onClick={() => selectMut.mutate(cot.id)}
                             disabled={selectMut.isPending || cot.estado === 'SELECCIONADA'}
                           >
                             {cot.estado === 'SELECCIONADA' ? '✓ Seleccionada' : 'Seleccionar'}
                           </button>
                        </div>
                     </td>
                   ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="card" style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="flex justify-between items-center mb-4">
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Registrar Cotización</h2>
                <button className="btn btn--ghost" onClick={() => setShowModal(false)}>✕</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="input-group">
                  <label className="input-label">Proveedor</label>
                  <select className="input" value={form.proveedor_id} onChange={e => setForm({...form, proveedor_id: e.target.value})}>
                    <option value="">Selecciona proveedor</option>
                    {proveedores?.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Días de Entrega</label>
                  <input type="number" className="input" value={form.dias_entrega} onChange={e => setForm({...form, dias_entrega: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="input-label">Condición de Pago</label>
                  <select className="input" value={form.condicion_pago} onChange={e => setForm({...form, condicion_pago: e.target.value})}>
                    <option value="CONTADO">Contado</option>
                    <option value="15_DIAS">15 días</option>
                    <option value="30_DIAS">30 días</option>
                    <option value="45_DIAS">45 días</option>
                    <option value="60_DIAS">60 días</option>
                    <option value="90_DIAS">90 días</option>
                    <option value="CREDITO_ESPECIAL">Crédito especial</option>
                  </select>
                </div>
              </div>

              <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>Precios Ofertados</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {form.items.map((item, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '0.5rem' }}>{item.descripcion} (Cant: {item.cantidad})</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="input-group">
                        <label className="input-label text-xs">Precio Unitario ($)</label>
                        <input type="number" className="input" value={item.precio_unitario} onChange={e => updateItemPrice(idx, 'precio_unitario', e.target.value)} />
                      </div>
                      <div className="input-group">
                        <label className="input-label text-xs">Marca ofertada</label>
                        <input type="text" className="input" value={item.marca} onChange={e => updateItemPrice(idx, 'marca', e.target.value)} placeholder="Opcional" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <button className="btn btn--ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button className="btn btn--primary" onClick={handleSaveCotizacion} disabled={createMut.isPending}>
                  {createMut.isPending ? 'Guardando...' : 'Guardar Cotización'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
