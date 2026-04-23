import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

const leadSchema = z.object({
  first_name: z.string().min(2, 'Nombre obligatorio'),
  last_name: z.string().optional(),
  email: z.union([z.string().email('Email inválido'), z.string().length(0)]).optional(),
  phone: z.string().optional(),
  company_name: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'dead']).default('new'),
  score: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
});

export function LeadForm({ lead, onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const isEditing = !!lead;

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(leadSchema),
    defaultValues: lead || { status: 'new', score: 0 },
  });

  const mutation = useMutation({
    mutationFn: async (values) => {
      const payload = { ...values };
      // Normalizar campos vacíos a null temporalmente
      ['email', 'phone', 'company_name', 'source', 'notes'].forEach(k => {
        if (!payload[k]) payload[k] = '';
      });

      if (isEditing) {
        const { data } = await api.patch(`/leads/${lead.id}`, payload);
        return data;
      } else {
        const { data } = await api.post('/leads', payload);
        return data;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Lead actualizado' : 'Lead creado');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Error al guardar');
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col gap-4">
      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Nombres *</label>
          <input {...register('first_name')} className="input" placeholder="Ej: Carlos" autoFocus />
          {errors.first_name && <span className="input-error">{errors.first_name.message}</span>}
        </div>
        <div className="input-group w-full">
          <label className="input-label">Apellidos</label>
          <input {...register('last_name')} className="input" placeholder="Ej: Gómez" />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Email</label>
          <input {...register('email')} className="input" type="email" placeholder="carlos@ejemplo.com" />
          {errors.email && <span className="input-error">{errors.email.message}</span>}
        </div>
        <div className="input-group w-full">
          <label className="input-label">Teléfono</label>
          <input {...register('phone')} className="input" placeholder="+57 300..." />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Empresa (Opcional)</label>
          <input {...register('company_name')} className="input" placeholder="Nombre de la empresa potencial" />
        </div>
        <div className="input-group w-full">
          <label className="input-label">Fuente (Source)</label>
          <input {...register('source')} className="input" placeholder="Ej: Web, Facebook, Referido" />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Estado</label>
          <select {...register('status')} className="input">
            <option value="new">Nuevo</option>
            <option value="contacted">Contactado</option>
            <option value="qualified">Calificado</option>
            {isEditing && <option value="converted" disabled>Convertido (Use acción rápida)</option>}
            <option value="dead">Descartado</option>
          </select>
        </div>
        <div className="input-group w-full">
          <label className="input-label">Scoring (0-100)</label>
          <input {...register('score')} className="input" type="number" min="0" max="100" />
        </div>
      </div>

      <div className="input-group">
        <label className="input-label">Notas</label>
        <textarea {...register('notes')} className="input" rows="3" placeholder="Información adicional sobre el prospecto..." />
      </div>

      <div className="modal__footer" style={{ padding: '1rem 0 0 0', border: 'none' }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear Lead')}
        </button>
      </div>
    </form>
  );
}
