import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { catalogApi } from '../../services/catalogApi';

const inventorySchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(2, 'Nombre obligatorio'),
  description: z.string().optional(),
  categoria_id: z.string().optional(),
  ubicacion_id: z.string().optional(),
  marca: z.string().optional(),
  unit: z.string().default('unidad'),
  unit_cost: z.coerce.number().min(0).default(0),
  unit_price: z.coerce.number().min(0).default(0),
  stock_current: z.coerce.number().min(0).default(0),
  stock_minimum: z.coerce.number().min(0).default(0),
  is_active: z.boolean().default(true),
});

export function InventoryForm({ item, onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const isEditing = !!item;

  const { data: familias } = useQuery({
    queryKey: ['catalog-categories'],
    queryFn: () => catalogApi.getCategorias()
  });

  const { data: ubicaciones } = useQuery({
    queryKey: ['ubicaciones'],
    queryFn: () => catalogApi.getUbicaciones()
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(inventorySchema),
    defaultValues: item || { unit: 'unidad', is_active: true, unit_cost: 0, unit_price: 0, stock_current: 0, stock_minimum: 0, marca: '' },
  });

  const mutation = useMutation({
    mutationFn: async (values) => {
      const payload = { ...values };
      if (isEditing) {
        const { data } = await api.patch(`/inventory/${item.id}`, payload);
        return data;
      } else {
        const { data } = await api.post('/inventory', payload);
        return data;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Item actualizado' : 'Item registrado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Error al guardar. Verifica SKU duplicado.');
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col gap-4">
      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">SKU (Cod. Referencia)</label>
          <input {...register('sku')} className="input" placeholder="Ej: PROD-001" autoFocus />
        </div>
        <div className="input-group w-full">
          <label className="input-label">Nombre *</label>
          <input {...register('name')} className="input" placeholder="Nombre completo" />
          {errors.name && <span className="input-error">{errors.name.message}</span>}
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <label className="input-label" style={{ margin: 0 }}>Familia</label>
            <a 
              href="/catalogo/familias"
              style={{ fontSize: '10px', color: 'var(--clr-primary-500)', textDecoration: 'none', fontWeight: 600 }}
              onClick={(e) => { e.preventDefault(); window.location.href='/catalogo/familias'; }}
            >
              + Gestionar
            </a>
          </div>
          <select {...register('categoria_id')} className="input">
            <option value="">Selecciona una familia</option>
            {familias?.data?.map(f => (
              <option key={f.id} value={f.id}>{f.nombre}</option>
            ))}
          </select>
        </div>
        <div className="input-group w-full">
          <label className="input-label">Unidad de Medida</label>
          <input {...register('unit')} className="input" placeholder="Ej: Unidad, Hora, Viaje, Km" />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Ubicación Física</label>
          <select {...register('ubicacion_id')} className="input">
            <option value="">Selecciona ubicación</option>
            {ubicaciones?.data?.map(u => (
              <option key={u.id} value={u.id}>{u.codigo_ubicacion} - {u.bodega} ({u.zona})</option>
            ))}
          </select>
        </div>
        <div className="input-group w-full" style={{ visibility: 'hidden' }}>
          {/* Spacer */}
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Marca</label>
          <input {...register('marca')} className="input" placeholder="Ej: CAT, Komatsu..." />
        </div>
        <div className="input-group w-full" style={{ visibility: 'hidden' }}>
          {/* Spacer */}
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Costo Unitario</label>
          <input {...register('unit_cost')} className="input" type="number" step="100" />
        </div>
        <div className="input-group w-full">
          <label className="input-label">Precio Unitario Promedio</label>
          <input {...register('unit_price')} className="input" type="number" step="100" />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Stock Actual</label>
          <input {...register('stock_current')} className="input" type="number" />
        </div>
        <div className="input-group w-full">
          <label className="input-label">Stock Mínimo</label>
          <input {...register('stock_minimum')} className="input" type="number" />
        </div>
      </div>

      <div className="input-group">
        <label className="input-label">Descripción</label>
        <textarea {...register('description')} className="input" rows="2" placeholder="Detalles de catálogo..." />
      </div>

      <div className="input-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
        <input {...register('is_active')} type="checkbox" id="is_active" />
        <label htmlFor="is_active" className="input-label" style={{ marginBottom: 0 }}>Ítem Activo en Catálogo</label>
      </div>

      <div className="modal__footer" style={{ padding: '1rem 0 0 0', border: 'none' }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear Ítem')}
        </button>
      </div>
    </form>
  );
}

