import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Package, ArrowLeft, ClipboardCheck, AlertTriangle,
  Info, Calendar, Building2, Hash, PlusCircle, X,
  ChevronRight, ChevronLeft, Layers, Tag, DollarSign,
  BarChart2, CheckCircle2
} from 'lucide-react';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import api from '../../lib/api';

// ─── Constantes de categorías ────────────────────────────────────────────────
const CATEGORIAS = [
  'Repuestos',
  'Insumos',
  'Herramientas',
  'Lubricantes',
  'Consumibles',
  'Equipos',
  'Material Eléctrico',
  'Material de Oficina',
  'Seguridad Industrial',
  'Otro',
];

// ─── Modal: Alta en Inventario ─────────────────────────────────────────────
function AltaInventarioModal({ items, onConfirm, onCancel }) {
  const [step, setStep] = useState(0); // índice del item actual
  const [invData, setInvData] = useState(
    items.map(item => ({
      oc_item_id: item.oc_item_id,
      sku: '',
      name: item.descripcion,
      description: item.descripcion,
      category: '',
      stock_minimum: 0,
      unit_price: item.precio_unitario || 0,
    }))
  );

  const current = invData[step];
  const total = items.length;

  const update = (field, value) => {
    setInvData(prev =>
      prev.map((d, i) => (i === step ? { ...d, [field]: value } : d))
    );
  };

  const canAdvance = current.name.trim() && current.category;

  const handleFinish = () => {
    onConfirm(invData);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div className="card" style={{
        width: '100%', maxWidth: 560,
        border: '1px solid rgba(99,102,241,0.4)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(67,56,202,0.05))',
          borderBottom: '1px solid var(--border-color)',
          padding: '1.25rem 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(99,102,241,0.2)',
              display: 'grid', placeItems: 'center',
            }}>
              <PlusCircle size={18} color="var(--clr-primary-400)" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>
                Alta en Inventario
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Ítem {step + 1} de {total} — nuevo producto
              </div>
            </div>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={onCancel} style={{ padding: '0.375rem' }}>
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--bg-elevated)' }}>
          <div style={{
            height: '100%',
            width: `${((step + 1) / total) * 100}%`,
            background: 'var(--clr-primary-500)',
            transition: 'width 0.35s ease',
          }} />
        </div>

        {/* Item banner */}
        <div style={{
          margin: '1.25rem 1.5rem 0',
          padding: '0.875rem 1rem',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-md)',
          borderLeft: '3px solid var(--clr-primary-500)',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
        }}>
          <Package size={16} color="var(--clr-primary-400)" />
          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
              {items[step].descripcion}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Cantidad a recibir: <strong>{items[step].cantidad_recibida} {items[step].unidad}</strong>
              {' · '}Costo unitario: <strong>
                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })
                  .format(items[step].precio_unitario || 0)}
              </strong>
            </div>
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Nombre en inventario */}
          <div className="input-group">
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Tag size={12} /> Nombre en Inventario <span style={{ color: 'var(--clr-danger)' }}>*</span>
            </label>
            <input
              className="input"
              value={current.name}
              onChange={e => update('name', e.target.value)}
              placeholder="Nombre con el que aparecerá en el catálogo"
            />
          </div>

          {/* SKU y Categoría en fila */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Hash size={12} /> SKU / Referencia
              </label>
              <input
                className="input"
                value={current.sku}
                onChange={e => update('sku', e.target.value.toUpperCase())}
                placeholder="Ej: REP-0042"
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <div className="input-group">
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Layers size={12} /> Categoría <span style={{ color: 'var(--clr-danger)' }}>*</span>
              </label>
              <select
                className="input"
                value={current.category}
                onChange={e => update('category', e.target.value)}
              >
                <option value="">Seleccionar...</option>
                {CATEGORIAS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Stock mínimo y Precio de venta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <BarChart2 size={12} /> Stock Mínimo
              </label>
              <input
                type="number"
                min="0"
                className="input"
                value={current.stock_minimum}
                onChange={e => update('stock_minimum', parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            <div className="input-group">
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <DollarSign size={12} /> Precio de Venta ($)
              </label>
              <input
                type="number"
                min="0"
                className="input"
                value={current.unit_price}
                onChange={e => update('unit_price', parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Descripción */}
          <div className="input-group">
            <label className="input-label">Descripción adicional</label>
            <textarea
              className="input"
              rows={2}
              value={current.description}
              onChange={e => update('description', e.target.value)}
              placeholder="Especificaciones técnicas, observaciones..."
              style={{ resize: 'none' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--bg-elevated)',
        }}>
          <button
            className="btn btn--ghost"
            onClick={() => step > 0 ? setStep(step - 1) : onCancel()}
          >
            <ChevronLeft size={16} />
            {step > 0 ? 'Anterior' : 'Cancelar'}
          </button>

          {step < total - 1 ? (
            <button
              className="btn btn--primary"
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance}
            >
              Siguiente ítem <ChevronRight size={16} />
            </button>
          ) : (
            <button
              className="btn btn--primary"
              onClick={handleFinish}
              disabled={!canAdvance}
              style={{ background: 'var(--clr-success)', borderColor: 'var(--clr-success)' }}
            >
              <CheckCircle2 size={16} /> Confirmar y Procesar Recepción
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────
export const RecepcionMercanciaPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [oc, setOc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ items: [], remision: '', observaciones: '' });

  // Modal state
  const [showAltaModal, setShowAltaModal] = useState(false);
  const [itemsSinInventario, setItemsSinInventario] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await api.get(`/compras/oc/${id}`);
        const ocData = data.data || data;
        setOc(ocData);

        const initialItems = ocData.items.map(item => {
          const pendiente = parseFloat(item.cantidad_ordenada) - parseFloat(item.cantidad_recibida || 0);
          return {
            oc_item_id: item.id,
            descripcion: item.descripcion,
            unidad: item.unidad,
            precio_unitario: parseFloat(item.precio_unitario || 0),
            item_inventario_id: item.item_inventario_id,
            pendiente,
            cantidad_recibida: pendiente > 0 ? pendiente : 0,
          };
        });

        setFormData(prev => ({ ...prev, items: initialItems }));
      } catch {
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
      ),
    }));
  };

  // Validar y determinar si hay items sin inventario
  const handleSubmitIntent = (e) => {
    e.preventDefault();

    const hasInvalid = formData.items.some(
      item => item.cantidad_recibida < 0 || item.cantidad_recibida > item.pendiente
    );
    if (hasInvalid) {
      return toast.error('Cantidades inválidas o superiores al pendiente');
    }
    if (formData.items.every(i => i.cantidad_recibida === 0)) {
      return toast.error('Debes recibir al menos un ítem');
    }
    if (!formData.remision.trim()) {
      return toast.error('El número de remisión / factura es obligatorio');
    }

    // Detectar items que se van a recibir y NO tienen vínculo a inventario
    const sinInv = formData.items.filter(
      i => i.cantidad_recibida > 0 && !i.item_inventario_id
    );

    if (sinInv.length > 0) {
      setItemsSinInventario(sinInv);
      setShowAltaModal(true);
    } else {
      // Todos tienen inventario → procesar directamente
      confirmarRecepcion([]);
    }
  };

  const confirmarRecepcion = async (altaData = []) => {
    if (!window.confirm('¿Confirmas la recepción? El inventario se actualizará automáticamente.')) {
      return;
    }

    setSubmitting(true);
    setShowAltaModal(false);

    try {
      // Construir payload enriquecido
      const itemsPayload = formData.items.map(i => {
        const alta = altaData.find(a => a.oc_item_id === i.oc_item_id);
        return {
          oc_item_id: i.oc_item_id,
          cantidad_recibida: i.cantidad_recibida,
          ...(alta && {
            new_inventory_data: {
              sku: alta.sku || null,
              name: alta.name,
              description: alta.description,
              category: alta.category,
              stock_minimum: alta.stock_minimum,
              unit_price: alta.unit_price,
            },
          }),
        };
      });

      await api.post(`/compras/oc/${id}/recibir`, {
        remision: formData.remision,
        observaciones: formData.observaciones,
        items: itemsPayload,
      });

      toast.success('¡Mercancía recibida e inventario actualizado!');
      navigate('/compras/oc');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al procesar la recepción');
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = v =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

  const itemsSinVinculo = formData.items.filter(i => !i.item_inventario_id);

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

      {/* Modal de Alta en Inventario */}
      {showAltaModal && (
        <AltaInventarioModal
          items={itemsSinInventario}
          onConfirm={confirmarRecepcion}
          onCancel={() => setShowAltaModal(false)}
        />
      )}

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
                <div>{new Date(oc.created_at).toLocaleDateString('es-CO')}</div>
              </div>
            </div>

            {/* Aviso de ítems sin inventario */}
            {itemsSinVinculo.length > 0 && (
              <div style={{
                padding: '0.875rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.3)',
                display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
              }}>
                <PlusCircle size={18} color="var(--clr-primary-400)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--clr-primary-400)', marginBottom: '0.25rem' }}>
                    {itemsSinVinculo.length} ítem{itemsSinVinculo.length > 1 ? 's' : ''} sin ficha de inventario
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    Al confirmar la recepción, podrás darlos de alta en el catálogo de inventario con SKU, categoría y stock mínimo. Así quedarán disponibles para futuras requisiciones.
                  </div>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmitIntent} className="card">
              <div className="flex items-center gap-2 mb-6">
                <ClipboardCheck size={20} className="text-primary" />
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Detalle de Ítems</h2>
              </div>

              <div className="table-wrapper mb-6">
                <table>
                  <thead>
                    <tr>
                      <th>Descripción</th>
                      <th>Estado</th>
                      <th style={{ textAlign: 'right' }}>Pedida</th>
                      <th style={{ textAlign: 'right' }}>Pendiente</th>
                      <th style={{ textAlign: 'right', width: '180px' }}>Cant. a Recibir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map(item => (
                      <tr key={item.oc_item_id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{item.descripcion}</div>
                          {!item.item_inventario_id && (
                            <span style={{
                              fontSize: '10px', fontWeight: 700, padding: '1px 6px',
                              borderRadius: 8, background: 'rgba(99,102,241,0.12)',
                              color: 'var(--clr-primary-400)', display: 'inline-block', marginTop: 4,
                            }}>
                              NUEVO EN INVENTARIO
                            </span>
                          )}
                        </td>
                        <td>
                          {item.item_inventario_id
                            ? <span className="badge badge--success" style={{ fontSize: '11px' }}>En catálogo</span>
                            : <span className="badge badge--primary" style={{ fontSize: '11px' }}>Por dar de alta</span>
                          }
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {item.pendiente + (oc.items.find(i => i.id === item.oc_item_id)?.cantidad_recibida || 0)} {item.unidad}
                        </td>
                        <td style={{
                          textAlign: 'right', fontWeight: 600,
                          color: item.pendiente > 0 ? 'var(--clr-warning)' : 'var(--clr-success)',
                        }}>
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
                            onChange={e => handleCantidadChange(item.oc_item_id, e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="input-group">
                  <label className="input-label">Número de Remisión / Factura <span style={{ color: 'var(--clr-danger)' }}>*</span></label>
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
                  disabled={
                    submitting ||
                    oc.estado === 'RECIBIDA_TOTAL' ||
                    oc.estado === 'ANULADA' ||
                    formData.items.every(i => i.cantidad_recibida === 0)
                  }
                >
                  {submitting
                    ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Procesando...</>
                    : <><Package size={20} /> Confirmar Recepción</>
                  }
                </button>
              </div>
            </form>
          </div>

          {/* Right Panel */}
          <div className="flex flex-col gap-4">
            <div className="card" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--clr-primary-500)' }}>
              <div className="flex gap-3">
                <Info size={20} className="text-primary" />
                <div style={{ fontSize: 'var(--text-xs)' }}>
                  <p className="font-bold mb-1">Información de Proceso</p>
                  <p className="text-muted">
                    Al confirmar, el stock de los productos vinculados al catálogo se actualiza automáticamente.
                    Los ítems nuevos se darán de alta en el inventario durante el proceso.
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="font-bold text-sm mb-3">Resumen de OC</h3>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-muted">Ítems totales</span>
                <span>{oc.items.length}</span>
              </div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-muted">En catálogo</span>
                <span style={{ color: 'var(--clr-success)', fontWeight: 600 }}>
                  {oc.items.filter(i => i.item_inventario_id).length}
                </span>
              </div>
              <div className="flex justify-between text-xs mb-3">
                <span className="text-muted">Por dar de alta</span>
                <span style={{ color: 'var(--clr-primary-400)', fontWeight: 600 }}>
                  {oc.items.filter(i => !i.item_inventario_id).length}
                </span>
              </div>
              <div style={{ height: 1, background: 'var(--border-color)', margin: '0.75rem 0' }} />
              <div className="flex justify-between text-xs">
                <span className="text-muted">Valor Total</span>
                <span className="font-bold">{fmt(oc.total)}</span>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};
