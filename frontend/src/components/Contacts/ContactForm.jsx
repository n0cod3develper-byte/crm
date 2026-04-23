import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

const contactSchema = z.object({
  first_name: z.string().min(2, 'El nombre es obligatorio (mín 2 caracteres)'),
  last_name: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  position: z.string().optional(),
  company_id: z.string().optional(),
  notes: z.string().optional(),
  is_primary: z.boolean().default(false),
});

export function ContactForm({ contact, defaultCompanyId, onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const isEditing = !!contact;

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: contact
      ? { ...contact, company_id: contact.company_id?.toString() }
      : { is_primary: false, company_id: defaultCompanyId?.toString() || '' },
  });

  const { data: companiesData } = useQuery({
    queryKey: ['companies-select'],
    queryFn: async () => {
      const { data } = await api.get('/companies', { params: { limit: 100 } });
      return data.data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (values) => {
      const payload = { ...values, company_id: values.company_id || null };
      if (isEditing) {
        const { data } = await api.patch(`/contacts/${contact.id}`, payload);
        return data;
      } else {
        const { data } = await api.post('/contacts', payload);
        return data;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Contacto actualizado' : 'Contacto creado');
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['company-contacts'] });
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Error al guardar el contacto');
    },
  });

  const onSubmit = (data) => mutation.mutate(data);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Nombre *</label>
          <input {...register('first_name')} className="input" placeholder="Nombre" autoFocus />
          {errors.first_name && <span className="input-error">{errors.first_name.message}</span>}
        </div>
        <div className="input-group w-full">
          <label className="input-label">Apellidos</label>
          <input {...register('last_name')} className="input" placeholder="Apellidos" />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Correo electrónico</label>
          <input {...register('email')} className="input" placeholder="correo@empresa.com" type="email" />
          {errors.email && <span className="input-error">{errors.email.message}</span>}
        </div>
        <div className="input-group w-full">
          <label className="input-label">Cargo / Posición</label>
          <input {...register('position')} className="input" placeholder="Ej: Gerente Logístico" />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Teléfono</label>
          <input {...register('phone')} className="input" placeholder="+57 300..." />
        </div>
        <div className="input-group w-full">
          <label className="input-label">WhatsApp</label>
          <input {...register('whatsapp')} className="input" placeholder="+57 300..." />
        </div>
      </div>

      <div className="input-group">
        <label className="input-label">Empresa</label>
        <select {...register('company_id')} className="input">
          <option value="">— Sin empresa —</option>
          {companiesData?.map(c => (
            <option key={c.id} value={c.id.toString()}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="input-group">
        <label className="input-label">Notas</label>
        <textarea {...register('notes')} className="input" rows="3" placeholder="Información adicional..." />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <input type="checkbox" id="is_primary" {...register('is_primary')} style={{ width: 16, height: 16, cursor: 'pointer' }} />
        <label htmlFor="is_primary" className="input-label" style={{ margin: 0, cursor: 'pointer' }}>
          Contacto principal de la empresa
        </label>
      </div>

      <div className="modal__footer" style={{ padding: '1rem 0 0 0', border: 'none' }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear Contacto')}
        </button>
      </div>
    </form>
  );
}
