import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Plus, Trash2, Search,
  ShoppingBag, Package, AlertCircle, Send
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import api from '../../lib/api';

export function SolicitudFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEditing = Boolean(id);

  // Form state
  const [form, setForm] = React.useState({
    area_solicitante: '',
    fecha_requerida: new Date().toISOString().substring(0, 10),
    prioridad: 'MEDIA',
    justificacion: '',
    notas: '',
  });

  const [items, setItems] = React.useState([]);

  // Search state
  const [invSearch, setInvSearch] = React.useState('');
  const [invResults, setInvResults] = React.useState([]);
  const [showInvDropdown, setShowInvDropdown] = React.useState(false);

  // Load data if editing
  const { data: solData, isLoading: loadingData } = useQuery({
    queryKey: ['solicitud-detail', id],
    queryFn: async () => {
      const { data } = await api.get(`/compras/solicitudes/${id}`);
      return data.data;
    },
    enabled: isEditing,
  });

  React.useEffect(() => {
    if (solData) {
      setForm({
        area_solicitante: solData.area_solicitante || '',
        fecha_requerida: (solData.fecha_requerida || '').substring(0, 10),
        prioridad: solData.prioridad || 'MEDIA',
        justificacion: solData.justificacion || '',
        notas: solData.notas || '',
      });
      setItems(solData.items || []);
    }
  }, [solData]);

  // Inventory search
  React.useEffect(() => {
    if (invSearch.length < 2) { setInvResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/inventory/search', { params: { q: invSearch } });
        setInvResults(data.data || []);
        setShowInvDropdown(true);
      } catch { setInvResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [invSearch]);

  const saveMut = useMutation({
    mutationFn: async (payload) => {
      if (isEditing) return api.put(`/compras/solicitudes/${id}`, payload);
      return api.post('/compras/solicitudes', payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Solicitud actualizada' : 'Solicitud creada con éxito');
      qc.invalidateQueries({ queryKey: ['solicitudes-compra'] });
      qc.invalidateQueries({ queryKey: ['solicitud-detail', id] });
      navigate('/compras/solicitudes');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al guardar'),
  });

  const enviarMut = useMutation({
    mutationFn: () => api.post(`/compras/solicitudes/${id}/enviar`),
    onSuccess: () => {
      toast.success('Solicitud enviada a cotización');
      qc.invalidateQueries({ queryKey: ['solicitudes-compra'] });
      qc.invalidateQueries({ queryKey: ['solicitud-detail', id] });
      navigate('/compras/solicitudes');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al enviar'),
  });

  const handleAddItem = (invItem) => {
    const exists = items.find(i => i.item_inventario_id === invItem.id);
    if (exists) return toast.error('El item ya está en la lista');

    setItems([...items, {
      item_inventario_id: invItem.id,
      descripcion: invItem.name,
      unidad: invItem.unit || 'UND',
      cantidad_solicitada: 1,
      notas_item: ''
    }]);
    setInvSearch('');
    setShowInvDropdown(false);
  };

  const handleAddManualItem = () => {
    setItems([...items, {
      item_inventario_id: null,
      descripcion: '',
      unidad: 'UND',
      cantidad_solicitada: 1,
      notas_item: ''
    }]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSave = () => {
    if (!form.area_solicitante || !form.justificacion) {
      return toast.error('Área y Justificación son obligatorias');
    }
    if (items.length === 0) {
      return toast.error('Debe agregar al menos un item');
    }
    saveMut.mutate({ ...form, items });
  };

  if (loadingData) return <div className="app-layout"><Sidebar /><main className="main-content"><div className="spinner" /></main></div>;

  return (
    <div className="app-layout">
      <Sidebar />
      <Topbar 
        title={isEditing ? `Solicitud ${solData?.consecutivo}` : 'Nueva Solicitud de Compra'} 
        subtitle="Añade los productos o servicios que necesitas adquirir" 
        rightContent={
          <div className="flex items-center gap-2">
            <button className="btn btn--ghost" onClick={() => navigate('/compras/solicitudes')}>
              <ArrowLeft size={18} />
            </button>
            {(!isEditing || solData?.estado === 'BORRADOR') && (
              <button className="btn btn--secondary" onClick={handleSave} disabled={saveMut.isPending}>
                <Save size={16} /> {saveMut.isPending ? 'Guardando...' : 'Guardar Borrador'}
              </button>
            )}
            {isEditing && solData?.estado === 'BORRADOR' && (
              <button className="btn btn--primary" onClick={() => enviarMut.mutate()} disabled={enviarMut.isPending}>
                <Send size={16} /> {enviarMut.isPending ? 'Enviando...' : 'Enviar a Cotización'}
              </button>
            )}
          </div>
        } 
      />

      <main className="main-content" style={{ maxWidth: 900 }}>
        <div className="card mb-6">
          <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <Package size={18} color="var(--clr-primary-400)" /> Datos del Requerimiento
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 1fr 1fr', gap: '1.25rem' }}>
             <div className="input-group">
                <label className="input-label">Área Solicitante</label>
                <input className="input" value={form.area_solicitante} onChange={e => setForm({...form, area_solicitante: e.target.value})} placeholder="Ej: Mantenimiento, Ventas..." />
             </div>
             <div className="input-group">
                <label className="input-label">Fecha Requerida</label>
                <input className="input" type="date" value={form.fecha_requerida} onChange={e => setForm({...form, fecha_requerida: e.target.value})} />
             </div>
             <div className="input-group">
                <label className="input-label">Prioridad</label>
                <select className="input" value={form.prioridad} onChange={e => setForm({...form, prioridad: e.target.value})}>
                   <option value="BAJA">Baja</option>
                   <option value="MEDIA">Media</option>
                   <option value="ALTA">Alta</option>
                   <option value="URGENTE">Urgente</option>
                </select>
             </div>
          </div>

          <div className="input-group mt-4">
             <label className="input-label">Justificación de la Compra</label>
             <textarea className="input" rows={3} value={form.justificacion} onChange={e => setForm({...form, justificacion: e.target.value})} placeholder="¿Por qué se necesita esta compra?" />
          </div>
        </div>

        {/* ITEMS SECTION */}
        <div className="card">
           <div className="flex justify-between items-center mb-4">
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <ShoppingBag size={18} color="var(--clr-primary-400)" /> Items Solicitados
              </h2>
           </div>

           {/* Search in Inventory */}
           <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                 className="input" 
                 style={{ paddingLeft: '2.5rem' }} 
                 placeholder="Buscar en el catálogo de inventario..." 
                 value={invSearch}
                 onChange={e => setInvSearch(e.target.value)}
                 onFocus={() => invResults.length > 0 && setShowInvDropdown(true)}
                 onBlur={() => setTimeout(() => setShowInvDropdown(false), 200)}
              />
              {showInvDropdown && invResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                  maxHeight: 250, overflowY: 'auto', marginTop: '4px'
                }}>
                   {invResults.map(item => (
                     <div 
                       key={item.id} 
                       className="flex justify-between items-center"
                       style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                       onMouseDown={() => handleAddItem(item)}
                     >
                        <div>
                           <div style={{ fontWeight: 600, fontSize: '13px' }}>{item.name}</div>
                           <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SKU: {item.sku || 'N/A'} | Stock: {item.stock_current}</div>
                        </div>
                        <Plus size={14} color="var(--clr-primary-400)" />
                     </div>
                   ))}
                </div>
              )}
           </div>

           {/* Items Table */}
           {items.length === 0 ? (
             <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
                <Package size={32} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                <p className="text-sm text-muted">No has añadido items aún.</p>
                <button className="btn btn--ghost btn--sm mt-2" onClick={handleAddManualItem}>
                   Añadir item manualmente
                </button>
             </div>
           ) : (
             <div className="table-wrapper">
                <table>
                   <thead>
                      <tr>
                         <th style={{ width: '40%' }}>Descripción</th>
                         <th>Unidad</th>
                         <th style={{ width: 100 }}>Cant.</th>
                         <th>Observaciones</th>
                         <th style={{ width: 50 }}></th>
                      </tr>
                   </thead>
                   <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx}>
                           <td>
                              <input 
                                className="input" 
                                style={{ height: 32, fontSize: '13px' }} 
                                value={item.descripcion} 
                                onChange={e => updateItem(idx, 'descripcion', e.target.value)} 
                                placeholder="Nombre del producto..."
                              />
                           </td>
                           <td>
                              <input 
                                className="input" 
                                style={{ height: 32, fontSize: '13px' }} 
                                value={item.unidad} 
                                onChange={e => updateItem(idx, 'unidad', e.target.value)} 
                                placeholder="Ej: UND"
                              />
                           </td>
                           <td>
                              <input 
                                className="input" 
                                type="number"
                                style={{ height: 32, fontSize: '13px', textAlign: 'right' }} 
                                value={item.cantidad_solicitada} 
                                onChange={e => updateItem(idx, 'cantidad_solicitada', e.target.value)} 
                              />
                           </td>
                           <td>
                              <input 
                                className="input" 
                                style={{ height: 32, fontSize: '13px' }} 
                                value={item.notas_item} 
                                onChange={e => updateItem(idx, 'notas_item', e.target.value)} 
                                placeholder="Notas..."
                              />
                           </td>
                           <td>
                              <button className="btn btn--ghost btn--sm" style={{ color: 'var(--clr-danger)' }} onClick={() => removeItem(idx)}>
                                 <Trash2 size={14} />
                              </button>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
           )}
           
           {items.length > 0 && (
              <button className="btn btn--ghost btn--sm mt-4" onClick={handleAddManualItem}>
                 <Plus size={14} /> Añadir otro item manual
              </button>
           )}
        </div>
      </main>
    </div>
  );
}
