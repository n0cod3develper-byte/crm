import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

const oppSchema = z.object({
  title: z.string().min(3, 'Título obligatorio (mín 3 car.)'),
  company_id: z.string().optional(),
  contact_id: z.string().optional(),
  stage_id: z.string().min(1, 'Selecciona una etapa'),
  value: z.coerce.number().min(0).default(0),
  currency: z.string().default('COP'),
  expected_close: z.string().optional(),
  probability: z.coerce.number().min(0).max(100).default(0),
  source: z.string().optional(),
  notes: z.string().optional(),
});

export function OpportunityForm({ opportunity, defaultStageId, onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const isEditing = !!opportunity;

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(oppSchema),
    defaultValues: opportunity
      ? {
          ...opportunity,
          company_id: opportunity.company_id?.toString() || '',
          contact_id: opportunity.contact_id?.toString() || '',
          stage_id: opportunity.stage_id?.toString() || '',
          expected_close: opportunity.expected_close?.split('T')[0] || '',
        }
      : { stage_id: defaultStageId || '', currency: 'COP', value: 0, probability: 0 },
  });

  const { data: stages } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: async () => { const { data } = await api.get('/pipeline/stages'); return data.data; },
  });

  const { data: companies } = useQuery({
    queryKey: ['companies-select'],
    queryFn: async () => { const { data } = await api.get('/companies', { params: { limit: 100 } }); return data.data; },
  });

  const mutation = useMutation({
    mutationFn: async (values) => {
      const payload = {
        ...values,
        company_id: values.company_id || null,
        contact_id: values.contact_id || null,
        expected_close: values.expected_close || null,
      };
      if (isEditing) {
        const { data } = await api.patch(`/opportunities/${opportunity.id}`, payload);
        return data;
      } else {
        const { data } = await api.post('/opportunities', payload);
        return data;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Oportunidad actualizada' : 'Oportunidad creada');
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-summary'] });
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Error al guardar');
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col gap-4">
      <div className="input-group">
        <label className="input-label">Título *</label>
        <input {...register('title')} className="input" placeholder="Ej: Transporte Medellín-Bogotá" autoFocus />
        {errors.title && <span className="input-error">{errors.title.message}</span>}
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Etapa *</label>
          <select {...register('stage_id')} className="input">
            <option value="">Seleccionar…</option>
            {stages?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {errors.stage_id && <span className="input-error">{errors.stage_id.message}</span>}
        </div>
        <div className="input-group w-full">
          <label className="input-label">Empresa</label>
          <select {...register('company_id')} className="input">
            <option value="">— Sin empresa —</option>
            {companies?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Valor</label>
          <input {...register('value')} className="input" type="number" min="0" step="1000" />
        </div>
        <div className="input-group w-full">
          <label className="input-label">Probabilidad (%)</label>
          <input {...register('probability')} className="input" type="number" min="0" max="100" />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Cierre esperado</label>
          <input {...register('expected_close')} className="input" type="date" />
        </div>
        <div className="input-group w-full">
          <label className="input-label">Fuente</label>
          <input {...register('source')} className="input" placeholder="Ej: Referido, Web" />
        </div>
      </div>

      <div className="input-group">
        <label className="input-label">Notas</label>
        <textarea {...register('notes')} className="input" rows="2" placeholder="Detalles adicionales…" />
      </div>

      <div className="modal__footer" style={{ padding: '1rem 0 0 0', border: 'none' }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear Oportunidad')}
        </button>
      </div>
    </form>
  );
}
