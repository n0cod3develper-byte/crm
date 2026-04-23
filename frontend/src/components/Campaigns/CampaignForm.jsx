import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

const campaignSchema = z.object({
  name: z.string().min(2, 'Nombre obligatorio'),
  type: z.string().optional(),
  status: z.enum(['planned', 'active', 'paused', 'completed', 'cancelled']).default('planned'),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  budget: z.coerce.number().min(0).default(0),
  expected_revenue: z.coerce.number().min(0).default(0),
  actual_revenue: z.coerce.number().min(0).default(0),
  actual_cost: z.coerce.number().min(0).default(0),
  description: z.string().optional().nullable(),
});

export function CampaignForm({ campaign, onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const isEditing = !!campaign;

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(campaignSchema),
    defaultValues: campaign ? {
      ...campaign,
      start_date: campaign.start_date ? campaign.start_date.split('T')[0] : '',
      end_date: campaign.end_date ? campaign.end_date.split('T')[0] : '',
    } : {
      status: 'planned',
      budget: 0,
      expected_revenue: 0,
      actual_revenue: 0,
      actual_cost: 0,
    },
  });

  const mutation = useMutation({
    mutationFn: async (values) => {
      const payload = {
        ...values,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
      };
      if (isEditing) {
        const { data } = await api.patch(`/campaigns/${campaign.id}`, payload);
        return data;
      } else {
        const { data } = await api.post('/campaigns', payload);
        return data;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Campaña actualizada' : 'Campaña creada');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Error al guardar');
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col gap-4">
      <div className="input-group">
        <label className="input-label">Nombre de campaña *</label>
        <input {...register('name')} className="input" placeholder="Ej: Black Friday 2026" autoFocus />
        {errors.name && <span className="input-error">{errors.name.message}</span>}
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Tipo</label>
          <select {...register('type')} className="input">
            <option value="">Selecciona tipo...</option>
            <option value="email">Email Marketing</option>
            <option value="social">Redes Sociales</option>
            <option value="event">Evento</option>
            <option value="telemarketing">Telemarketing</option>
            <option value="ads">Publicidad Paga (Ads)</option>
            <option value="other">Otro</option>
          </select>
        </div>
        <div className="input-group w-full">
          <label className="input-label">Estado</label>
          <select {...register('status')} className="input">
            <option value="planned">Planeada</option>
            <option value="active">Activa</option>
            <option value="paused">Pausada</option>
            <option value="completed">Completada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Fecha de Inicio</label>
          <input {...register('start_date')} type="date" className="input" />
        </div>
        <div className="input-group w-full">
          <label className="input-label">Fecha de Fin</label>
          <input {...register('end_date')} type="date" className="input" />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Presupuesto (Meta)</label>
          <input {...register('budget')} type="number" step="1000" min="0" className="input" />
        </div>
        <div className="input-group w-full">
          <label className="input-label">Costo Real Gastado</label>
          <input {...register('actual_cost')} type="number" step="1000" min="0" className="input" />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Ingresos Esperados (Proyectado)</label>
          <input {...register('expected_revenue')} type="number" step="1000" min="0" className="input" />
        </div>
        <div className="input-group w-full">
          <label className="input-label">Ingreso Real Obtenido</label>
          <input {...register('actual_revenue')} type="number" step="1000" min="0" className="input" />
        </div>
      </div>

      <div className="input-group">
        <label className="input-label">Descripción / Objetivo</label>
        <textarea {...register('description')} className="input" rows="3" placeholder="Detalles de la campaña..." />
      </div>

      <div className="modal__footer" style={{ padding: '1rem 0 0 0', border: 'none', marginTop: '0.5rem' }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear Campaña')}
        </button>
      </div>
    </form>
  );
}
