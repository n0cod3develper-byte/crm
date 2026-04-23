import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

const itemSchema = z.object({
  description: z.string().min(1, 'Descripción obligatoria'),
  quantity: z.coerce.number().min(0.01),
  unit_price: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).max(100).default(0),
});

const quoteSchema = z.object({
  company_id: z.string().optional(),
  opportunity_id: z.string().optional(),
  status: z.enum(['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired']).default('draft'),
  valid_until: z.string().optional(),
  currency: z.string().default('COP'),
  tax_rate: z.coerce.number().min(0).max(100).default(19),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Debe haber al menos un ítem'),
});

export function QuoteForm({ quote, onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const isEditing = !!quote;

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(quoteSchema),
    defaultValues: quote
      ? {
          ...quote,
          company_id: quote.company_id?.toString() || '',
          opportunity_id: quote.opportunity_id?.toString() || '',
          valid_until: quote.valid_until?.split('T')[0] || '',
          tax_rate: Number(quote.tax_rate) || 19,
          items: quote.items?.length ? quote.items : [{ description: '', quantity: 1, unit_price: 0, discount: 0 }]
        }
      : {
          currency: 'COP', status: 'draft', tax_rate: 19,
          items: [{ description: '', quantity: 1, unit_price: 0, discount: 0 }]
        },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const { data: companies } = useQuery({
    queryKey: ['companies-select'],
    queryFn: async () => { const { data } = await api.get('/companies', { params: { limit: 100 } }); return data.data; },
  });

  const { data: opportunities } = useQuery({
    queryKey: ['opportunities-select'],
    queryFn: async () => { const { data } = await api.get('/opportunities', { params: { limit: 100 } }); return data.data; },
  });

  const { data: inventory } = useQuery({
    queryKey: ['inventory-select'],
    queryFn: async () => { const { data } = await api.get('/inventory', { params: { limit: 200, isActive: true } }); return data.data; },
  });

  // Calculate totals
  const items = watch('items');
  const taxRate = parseFloat(watch('tax_rate')) || 0;

  const subtotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    const disc = parseFloat(item.discount) || 0;
    return sum + (qty * price * (1 - disc / 100));
  }, 0);

  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const mutation = useMutation({
    mutationFn: async (values) => {
      const payload = { ...values, subtotal, tax_amount: taxAmount, total };
      if (!payload.company_id) payload.company_id = null;
      if (!payload.opportunity_id) payload.opportunity_id = null;
      if (!payload.valid_until) payload.valid_until = null;

      if (isEditing) {
        const { data } = await api.patch(`/quotes/${quote.id}`, payload);
        return data;
      } else {
        const { data } = await api.post('/quotes', payload);
        return data;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Cotización actualizada' : 'Cotización creada');
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Error al guardar');
    },
  });

  function formatCurrency(val) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);
  }

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col gap-4">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(400px, 1.5fr)', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* -- COLUMNA IZQUIERDA: Metadatos y Totales -- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="flex gap-4">
            <div className="input-group w-full">
              <label className="input-label">Empresa</label>
              <select {...register('company_id')} className="input">
                <option value="">— Sin empresa —</option>
                {companies?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="input-group w-full">
              <label className="input-label">Oportunidad vinculada</label>
              <select {...register('opportunity_id')} className="input">
                <option value="">— Ninguna —</option>
                {opportunities?.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="input-group w-full">
              <label className="input-label">Estado</label>
              <select {...register('status')} className="input">
                <option value="draft">Borrador</option>
                <option value="sent">Enviada</option>
                <option value="viewed">Vista</option>
                <option value="accepted">Aceptada</option>
                <option value="rejected">Rechazada</option>
                <option value="expired">Expirada</option>
              </select>
            </div>
            <div className="input-group w-full">
              <label className="input-label">Válida hasta</label>
              <input {...register('valid_until')} className="input" type="date" />
            </div>
          </div>

          <div className="input-group w-full">
            <label className="input-label">Notas</label>
            <textarea {...register('notes')} className="input" rows="3" placeholder="Condiciones, detalles..." />
          </div>

          <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                IVA <input {...register('tax_rate')} className="input" style={{ width: '60px', padding: '0.2rem 0.5rem', display: 'inline-block', marginLeft: '0.5rem', height: '1.75rem' }} type="number" step="0.1" /> %:
              </span>
              <span style={{ fontSize: 'var(--text-sm)' }}>{formatCurrency(taxAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', fontWeight: 700, fontSize: 'var(--text-lg)' }}>
              <span>Total:</span>
              <span style={{ color: 'var(--clr-primary-500)' }}>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* -- COLUMNA DERECHA: Artículos -- */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>Artículos</span>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => append({ description: '', quantity: 1, unit_price: 0, discount: 0 })}>
              <Plus size={14} /> Añadir
            </button>
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '55vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {fields.map((item, index) => (
              <div key={item.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                <div className="input-group" style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <select className="input" style={{ fontSize: '0.8rem', padding: '0.25rem' }} title="Buscar en inventario" onChange={(e) => {
                    if(!e.target.value) return;
                    const it = inventory?.find(i => i.id === e.target.value);
                    if(it) {
                      setValue(`items.${index}.description`, it.name);
                      setValue(`items.${index}.unit_price`, parseFloat(it.unit_price) || 0);
                    }
                    e.target.value = '';
                  }}>
                    <option value="">+ Seleccionar del catálogo...</option>
                    {inventory?.map(i => <option key={i.id} value={i.id}>{i.sku ? `[${i.sku}] ` : ''}{i.name}</option>)}
                  </select>
                  <input {...register(`items.${index}.description`)} className="input" placeholder="Descripción manual..." />
                  {errors.items?.[index]?.description && <span className="input-error" style={{ fontSize: '10px' }}>Req.</span>}
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <input {...register(`items.${index}.quantity`)} className="input" type="number" step="0.01" min="0.01" placeholder="Cant." title="Cantidad" />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <input {...register(`items.${index}.unit_price`)} className="input" type="number" step="100" min="0" placeholder="P. Unit." title="Precio Unitario" />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <input {...register(`items.${index}.discount`)} className="input" type="number" step="1" min="0" max="100" placeholder="% Dto" title="Descuento (%)" />
                </div>
                <button type="button" className="btn btn--ghost" style={{ padding: '0.5rem', color: 'var(--clr-danger)' }} onClick={() => remove(index)} disabled={fields.length === 1}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {errors.items && !Array.isArray(errors.items) && <span className="input-error">{errors.items.message}</span>}
          </div>
        </div>
      </div>

      <div className="modal__footer" style={{ padding: '1rem 0 0 0', border: 'none', marginTop: '1rem' }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : (isEditing ? 'Actualizar Cotización' : 'Generar Cotización')}
        </button>
      </div>
    </form>
  );
}
