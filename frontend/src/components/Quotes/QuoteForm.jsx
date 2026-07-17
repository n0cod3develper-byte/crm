import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, ShieldAlert, AlertTriangle, Check, Layers, UserCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

const itemSchema = z.object({
  description: z.string().min(1, 'Descripción obligatoria'),
  quantity: z.coerce.number().min(0.01, 'Cantidad mínima 0.01'),
  unit_price: z.coerce.number().min(0, 'Precio mínimo 0'),
  discount: z.coerce.number().min(0).max(100).default(0),
  origen: z.enum(['inventario', 'proveedor']).default('inventario'),
  inventario_id: z.string().nullable().optional(),
  proveedor_id: z.string().nullable().optional(),
  supplier_quote_id: z.string().nullable().optional(),
  costo_base: z.coerce.number().min(0).default(0),
  porcentaje_incremento: z.coerce.number().default(23),
  autorizado_por: z.string().nullable().optional(),
  justificacion_descuento: z.string().nullable().optional(),
  max_quantity: z.number().nullable().optional(),
});

const quoteSchema = z.object({
  company_id: z.string().optional(),
  opportunity_id: z.string().optional(),
  status: z.enum(['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired']).default('draft'),
  valid_until: z.string().optional(),
  currency: z.string().default('COP'),
  tax_rate: z.coerce.number().min(0).max(100).default(19),
  notes: z.string().nullable().optional(),
  items: z.array(itemSchema).min(1, 'Debe haber al menos un ítem'),
});

export function QuoteForm({ quote, onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const isEditing = !!quote;

  const [activeTab, setActiveTab] = useState('catalogo'); // 'catalogo' | 'proveedor'
  const [searchFilter, setSearchFilter] = useState('');

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(quoteSchema),
    defaultValues: quote
      ? {
          ...quote,
          company_id: quote.company_id?.toString() || '',
          opportunity_id: quote.opportunity_id?.toString() || '',
          valid_until: quote.valid_until?.split('T')[0] || '',
          tax_rate: Number(quote.tax_rate) || 19,
          items: quote.items?.length ? quote.items.map(it => ({
            ...it,
            inventario_id: it.inventario_id || null,
            proveedor_id: it.proveedor_id || null,
            supplier_quote_id: it.supplier_quote_id || null,
            origen: it.origen || 'inventario',
            costo_base: Number(it.costo_base) || 0,
            porcentaje_incremento: Number(it.porcentaje_incremento) || 23,
            autorizado_por: it.autorizado_por || '',
            justificacion_descuento: it.justificacion_descuento || '',
          })) : [{ description: '', quantity: 1, unit_price: 0, discount: 0, origen: 'inventario', costo_base: 0, porcentaje_incremento: 23 }]
        }
      : {
          currency: 'COP', status: 'draft', tax_rate: 19,
          items: [{ description: '', quantity: 1, unit_price: 0, discount: 0, origen: 'inventario', costo_base: 0, porcentaje_incremento: 23 }]
        },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  // ─── Queries de Datos ────────────────────────────────────
  const { data: companies } = useQuery({
    queryKey: ['companies-select'],
    queryFn: async () => { const { data } = await api.get('/companies', { params: { limit: 100 } }); return data.data; },
  });

  const { data: opportunities } = useQuery({
    queryKey: ['opportunities-select'],
    queryFn: async () => { const { data } = await api.get('/opportunities', { params: { limit: 100 } }); return data.data; },
  });

  const { data: catalogItems } = useQuery({
    queryKey: ['catalog-items-select'],
    queryFn: async () => { const { data } = await api.get('/catalogo', { params: { limit: 200 } }); return data.items; },
  });

  const { data: supplierQuotesPending } = useQuery({
    queryKey: ['supplier-quotes-pending'],
    queryFn: async () => { const { data } = await api.get('/quotes/supplier-quotes-pending'); return data.data; },
  });

  const { data: employees } = useQuery({
    queryKey: ['employees-select'],
    queryFn: async () => { const { data } = await api.get('/employees', { params: { limit: 100 } }); return data.data; },
  });

  // ─── Fix: re-aplicar FKs cuando las opciones asíncronas cargan ───
  // react-hook-form con register() es no-controlado: los defaultValues se
  // aplican solo al montar. Si las opciones del <select> llegan después
  // (query asíncrona), el browser no selecciona nada. setValue fuerza la
  // selección correcta una vez que las opciones están disponibles.
  React.useEffect(() => {
    if (isEditing && companies?.length && quote?.company_id) {
      setValue('company_id', quote.company_id.toString());
    }
  }, [companies]);

  React.useEffect(() => {
    if (isEditing && opportunities?.length && quote?.opportunity_id) {
      setValue('opportunity_id', quote.opportunity_id.toString());
    }
  }, [opportunities]);

  const itemsWatch = watch('items') || [];
  const taxRate = parseFloat(watch('tax_rate')) || 0;

  // Calculo de subtotal
  const subtotal = itemsWatch.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    const disc = parseFloat(item.discount) || 0;
    return sum + (qty * price * (1 - disc / 100));
  }, 0);

  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  // Guardado de Cotización
  const mutation = useMutation({
    mutationFn: async (values) => {
      const payload = { ...values, subtotal, tax_amount: taxAmount, total };
      if (!payload.company_id) payload.company_id = null;
      if (!payload.opportunity_id) payload.opportunity_id = null;
      if (!payload.valid_until) payload.valid_until = null;

      // Sanitizar items nulos de auth
      payload.items = payload.items.map(it => ({
        ...it,
        autorizado_por: it.autorizado_por || null,
        justificacion_descuento: it.justificacion_descuento || null,
        inventario_id: it.inventario_id || null,
        proveedor_id: it.proveedor_id || null,
        supplier_quote_id: it.supplier_quote_id || null,
      }));

      // Client‑side validation mirroring backend rules
      for (const it of payload.items) {
        const costo = parseFloat(it.costo_base || 0);
        const precioUnitario = parseFloat(it.unit_price || 0);
        const descuento = parseFloat(it.discount || 0);
        const precioNeto = precioUnitario * (1 - descuento / 100);
        const precioSugeridoConMarkup = Math.round(costo * 1.23);
        if (precioNeto < precioSugeridoConMarkup) {
          if (!it.autorizado_por || !it.justificacion_descuento || !it.justificacion_descuento.trim()) {
            throw new Error(`El ítem "${it.description || 'Sin descripción'}" requiere autorización y justificación del descuento.`);
          }
        }
      }

      if (isEditing) {
        const { data } = await api.patch(`/quotes/${quote.id}`, payload);
        return data;
      } else {
        const { data } = await api.post('/quotes', payload);
        return data;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Cotización actualizada' : 'Cotización creada con éxito');
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      onSuccess?.();
    },
    onError: (err) => {
      const apiError = err.response?.data?.error;
      const errorMsg = apiError?.details || apiError?.message || err.response?.data?.message || 'Error al guardar la cotización';
      toast.error(errorMsg);
    },
  });

  const handleAddFromCatalog = (item) => {
    const costoBase = parseFloat(item.costo_o_minimo || item.costo_reposicion || 0);
    const stockActual = parseFloat(item.stock_actual || 0);
    const origenSugerido = stockActual > 0 ? 'inventario' : 'proveedor';
    
    append({
      description: item.nombre_comercial || item.name,
      quantity: 1,
      unit_price: Math.round(costoBase * 1.23),
      discount: 0,
      origen: origenSugerido,
      inventario_id: item.id,
      proveedor_id: null,
      costo_base: costoBase,
      porcentaje_incremento: 23,
      autorizado_por: '',
      justificacion_descuento: '',
      max_quantity: stockActual > 0 ? stockActual : undefined
    });
    
    if (origenSugerido === 'proveedor') {
      toast.success(`Añadido: ${item.nombre_comercial} (Sin stock, como proveedor)`);
    } else {
      toast.success(`Añadido: ${item.nombre_comercial}`);
    }
  };

  const handleAddFromSupplierQuote = (sQuote, sItem) => {
    append({
      description: sItem.descripcion_manual || `Ítem de cotización ${sQuote.consecutivo}`,
      quantity: parseFloat(sItem.cantidad || 1),
      unit_price: Math.round(parseFloat(sItem.precio_unitario || 0) * 1.23), // Precio de venta base
      discount: 0,
      origen: 'proveedor',
      inventario_id: sItem.inventario_id || null,
      proveedor_id: sQuote.proveedor_id,
      supplier_quote_id: sQuote.id,
      costo_base: parseFloat(sItem.precio_unitario || 0),
      porcentaje_incremento: 23,
      autorizado_por: '',
      justificacion_descuento: '',
      max_quantity: parseFloat(sItem.cantidad || 0)
    });
    toast.success(`Añadido desde cotización de proveedor`);
  };

  function formatCurrency(val) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);
  }

  // Filtrado de ítems de catálogo (Opción A: Ocultar stock 0)
  const filteredCatalog = catalogItems?.filter(i => 
    parseFloat(i.stock_actual || 0) > 0 &&
    (i.nombre_comercial?.toLowerCase().includes(searchFilter.toLowerCase()) ||
     i.codigo_interno?.toLowerCase().includes(searchFilter.toLowerCase()))
  ) || [];

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col gap-4">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem', alignItems: 'start', color: 'var(--text-primary)' }}>
        
        {/* ── COLUMNA IZQUIERDA: Metadatos, Totales y Panel de Selección ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div className="flex gap-4">
            <div className="input-group w-full">
              <label className="input-label">Empresa / Cliente</label>
              <select {...register('company_id')} className="input">
                <option value="">— Seleccionar cliente —</option>
                {companies?.map(c => <option key={c.id} value={c.id}>{c.name} {c.nit ? `(${c.nit})` : ''}</option>)}
              </select>
            </div>
            <div className="input-group w-full">
              <label className="input-label">Oportunidad Vinculada</label>
              <select {...register('opportunity_id')} className="input">
                <option value="">— Ninguna —</option>
                {opportunities?.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="input-group w-full">
              <label className="input-label">Estado</label>
              <select {...register('status')} className="input" disabled={isEditing && quote.status === 'accepted'}>
                <option value="draft">Borrador</option>
                <option value="sent">Enviada</option>
                <option value="viewed">Vista</option>
                <option value="accepted">Aceptada</option>
                <option value="rejected">Rechazada</option>
                <option value="expired">Expirada</option>
              </select>
            </div>
            <div className="input-group w-full">
              <label className="input-label">Validez Oferta</label>
              <input {...register('valid_until')} className="input" type="date" />
            </div>
          </div>

          <div className="input-group w-full">
            <label className="input-label">Notas y Condiciones</label>
            <textarea {...register('notes')} className="input" rows="2" placeholder="Notas que aparecerán en el PDF de cara al cliente..." />
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} /> Panel de Selección de Artículos
            </h3>

            <div style={{ display: 'flex', gap: '4px', marginBottom: '0.75rem', background: 'var(--bg-app)', padding: '3px', borderRadius: '6px' }}>
              <button type="button" style={{ flex: 1, padding: '0.4rem', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', background: activeTab === 'catalogo' ? 'var(--bg-surface)' : 'transparent', color: 'var(--text-primary)', boxShadow: activeTab === 'catalogo' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }} onClick={() => setActiveTab('catalogo')}>
                Desde Catálogo/Inventario
              </button>
              <button type="button" style={{ flex: 1, padding: '0.4rem', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', background: activeTab === 'proveedor' ? 'var(--bg-surface)' : 'transparent', color: 'var(--text-primary)', boxShadow: activeTab === 'proveedor' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }} onClick={() => setActiveTab('proveedor')}>
                Desde Cotización Proveedor
              </button>
            </div>

            {activeTab === 'catalogo' ? (
              <div>
                <input className="input" style={{ marginBottom: '0.5rem', padding: '0.4rem 0.7rem', fontSize: '13px' }} placeholder="Buscar en catálogo..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} />
                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {filteredCatalog.slice(0, 50).map(i => (
                    <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '11px' }}>
                      <div>
                        <strong>{i.nombre_comercial}</strong>
                        <div style={{ color: '#64748b' }}>Stock: {i.stock_actual} | Precio: {formatCurrency(i.precio_venta)}</div>
                      </div>
                      <button type="button" className="btn btn--sm btn--primary" style={{ padding: '2px 8px', fontSize: '10px' }} onClick={() => handleAddFromCatalog(i)}>
                        + Agregar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ maxHeight: '230px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {supplierQuotesPending?.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '1rem' }}>No hay cotizaciones de proveedor "En espera".</p>
                ) : (
                  supplierQuotesPending?.map(sq => (
                    <div key={sq.id} style={{ background: 'var(--bg-surface)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#4338ca', borderBottom: '1px solid var(--border-color)', paddingBottom: '3px', marginBottom: '4px' }}>
                        {sq.consecutivo} - Proveedor: {sq.provider_name || 'Desconocido'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {sq.items?.map(sItem => (
                          <div key={sItem.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', paddingLeft: '4px' }}>
                            <span>{sItem.descripcion_manual || 'Ítem sin nombre'} ({sItem.cantidad} uds)</span>
                            <button type="button" className="btn btn--sm btn--secondary" style={{ padding: '1px 6px', fontSize: '9px' }} onClick={() => handleAddFromSupplierQuote(sq, sItem)}>
                              + Traer
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── COLUMNA DERECHA: Artículos Agregados y Alertas ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Artículos en Cotización</span>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => append({ description: '', quantity: 1, unit_price: 0, discount: 0, origen: 'inventario', costo_base: 0, porcentaje_incremento: 23, autorizado_por: '', justificacion_descuento: '' })}>
              + Crear ítem libre
            </button>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '55vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {fields.map((item, index) => {
              const itValues = itemsWatch[index] || {};
              const costo = parseFloat(itValues.costo_base || 0);
              const precioUnitario = parseFloat(itValues.unit_price || 0);
              const descuento = parseFloat(itValues.discount || 0);
              const precioNeto = precioUnitario * (1 - descuento / 100);
              const precioMinMarkup = Math.round(costo * 1.23);

              const requiresApproval = precioNeto < precioMinMarkup && costo > 0;

              return (
                <div key={item.id} style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '0.5rem', 
                  background: requiresApproval ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-surface)', 
                  border: requiresApproval ? '1px solid #f59e0b' : '1px solid var(--border-color)',
                  padding: '10px', 
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ flex: 2 }}>
                      <input {...register(`items.${index}.description`)} className="input" placeholder="Nombre/Descripción del ítem..." style={{ fontWeight: 600 }} />
                    </div>
                    <div style={{ width: '80px' }}>
                      <input {...register(`items.${index}.quantity`)} className="input" type="number" step="0.01" min="0.01" placeholder="Cant." title="Cantidad" />
                    </div>
                    <div style={{ width: '120px' }}>
                      <input {...register(`items.${index}.unit_price`)} className="input" type="number" step="1" min="0" placeholder="P. Unitario" title="Precio Unitario" />
                    </div>
                    <div style={{ width: '70px' }}>
                      <input {...register(`items.${index}.discount`)} className="input" type="number" step="0.1" min="0" max="100" placeholder="% Dto" title="Descuento" />
                    </div>
                    <button type="button" className="btn btn--ghost" style={{ padding: '0.375rem', color: 'var(--clr-danger)' }} onClick={() => remove(index)} disabled={fields.length === 1}>
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Alerta de Cantidad Excedida (No bloqueante) */}
                  {itValues.max_quantity !== undefined && parseFloat(itValues.quantity || 0) > itValues.max_quantity && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b45309', fontSize: '11px', background: 'rgba(245, 158, 11, 0.1)', padding: '4px 8px', borderRadius: '4px', marginTop: '4px', border: '1px solid #f59e0b' }}>
                      <AlertTriangle size={14} /> 
                      <span>La cantidad seleccionada supera {itValues.origen === 'proveedor' ? 'la cantidad cotizada por el proveedor' : 'el stock disponible'} ({itValues.max_quantity}).</span>
                    </div>
                  )}

                  {/* Campos adicionales de origen y costos */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '4px' }}>
                    <span>
                      Origen:
                      <select {...register(`items.${index}.origen`)} style={{ marginLeft: '4px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '2px', fontWeight: 'bold', outline: 'none', fontSize: '11px', padding: '1px' }}>
                        <option value="inventario">Inventario</option>
                        <option value="proveedor">Proveedor</option>
                      </select>
                    </span>
                    <span>Costo base: <strong>{formatCurrency(costo)}</strong></span>
                    <span>Precio Neto: <strong style={{ color: requiresApproval ? '#c2410c' : '#166534' }}>{formatCurrency(precioNeto)}</strong></span>
                    <span>Markup mínimo (23%): <strong>{formatCurrency(precioMinMarkup)}</strong></span>
                  </div>

                  {/* Formulario de Autorización si requiere */}
                  {requiresApproval && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '8px', background: 'rgba(245, 158, 11, 0.1)', border: '1px dashed #f59e0b', borderRadius: '6px', marginTop: '4px' }}>
                      <div style={{ color: '#b45309', fontWeight: 'bold', fontSize: '11px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <ShieldAlert size={14} /> Margen menor al 23% - Requiere Autorización Obligatoria
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <select {...register(`items.${index}.autorizado_por`)} className="input" style={{ fontSize: '12px', padding: '4px', flex: 1 }}>
                          <option value="">— Seleccionar Administrador —</option>
                          {employees?.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                        </select>
                        <input {...register(`items.${index}.justificacion_descuento`)} className="input" style={{ fontSize: '12px', padding: '4px', flex: 1.5 }} placeholder="Justificación del descuento..." />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {errors.items && !Array.isArray(errors.items) && <span className="input-error">{errors.items.message}</span>}
          </div>

          {/* Panel de Totales */}
          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '12px' }}>
              <span>Subtotal Neto:</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', alignItems: 'center' }}>
              <span style={{ fontSize: '12px' }}>
                Impuesto IVA (%) : <input {...register('tax_rate')} className="input" style={{ width: '50px', padding: '2px 4px', display: 'inline-block', marginLeft: '0.5rem', height: '1.5rem', textAlign: 'center' }} type="number" />
              </span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(taxAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #cbd5e1', fontWeight: 800, fontSize: '16px' }}>
              <span>Total Cotización:</span>
              <span style={{ color: '#4338ca' }}>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {Object.keys(errors).length > 0 && (
        <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '6px', fontSize: '11px' }}>
          <strong>Verifica los datos obligatorios del formulario.</strong>
        </div>
      )}

      <div className="modal__footer" style={{ padding: '1rem 0 0 0', border: 'none', marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
          {isSubmitting ? 'Procesando...' : (isEditing ? 'Actualizar Cotización' : 'Guardar y Generar Cotización')}
        </button>
      </div>
    </form>
  );
}
