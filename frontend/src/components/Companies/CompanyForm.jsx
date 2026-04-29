import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

const companySchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio (mín 2 caracteres)'),
  nit: z.string().optional(),
  industry: z.string().default('logistics'),
  department: z.string().optional(),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  phone: z.string().optional(),
  phone_2: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

const sectionTitle = { fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0.5rem 0 0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' };

export function CompanyForm({ company, onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const isEditing = !!company;

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(companySchema),
    defaultValues: company || {
      industry: 'logistics',
    },
  });

  const mutation = useMutation({
    mutationFn: async (values) => {
      if (isEditing) {
        const { data } = await api.patch(`/companies/${company.id}`, values);
        return data;
      } else {
        const { data } = await api.post('/companies', values);
        return data;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Empresa actualizada' : 'Empresa creada');
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Error al guardar empresa');
    },
  });

  const onSubmit = (data) => mutation.mutate(data);

  return (
    <form id="company-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      
      <p style={sectionTitle}>Información General</p>
      <div className="input-group">
        <label className="input-label">Nombre de la empresa *</label>
        <input 
          {...register('name')} 
          className="input" 
          placeholder="Ej: Logística CARGAR SAS"
          autoFocus 
        />
        {errors.name && <span className="input-error">{errors.name.message}</span>}
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">NIT</label>
          <input {...register('nit')} className="input" placeholder="900.123.456-1" />
        </div>
        <div className="input-group w-full">
          <label className="input-label">Sector</label>
          <select {...register('industry')} className="input">
            <option value="logistics">Logística / Transporte</option>
            <option value="manufacturing">Manufactura</option>
            <option value="retail">Retail / Comercio</option>
            <option value="technology">Tecnología</option>
            <option value="other">Otro</option>
          </select>
        </div>
      </div>
      
      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Sitio Web</label>
          <input {...register('website')} className="input" placeholder="https://..." />
          {errors.website && <span className="input-error">{errors.website.message}</span>}
        </div>
        <div className="input-group w-full">
          <label className="input-label">Departamento</label>
          <input {...register('department')} className="input" placeholder="Ej: Cundinamarca" />
        </div>
      </div>

      <p style={sectionTitle}>Contacto y Ubicación</p>
      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Teléfono Principal</label>
          <input {...register('phone')} className="input" placeholder="+57 ..." />
        </div>
        <div className="input-group w-full">
          <label className="input-label">Teléfono 2</label>
          <input {...register('phone_2')} className="input" placeholder="+57 ..." />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Ciudad</label>
          <input {...register('city')} className="input" placeholder="Bogotá, Colombia" />
        </div>
        <div className="input-group w-full">
          <label className="input-label">Dirección</label>
          <input {...register('address')} className="input" />
        </div>
      </div>

      <div className="input-group">
        <label className="input-label">Notas internas</label>
        <textarea 
          {...register('notes')} 
          className="input" 
          placeholder="Información adicional sobre la empresa..."
          rows="2"
        />
      </div>

      {isEditing && (
        <>
          <p style={sectionTitle}>Auditoría</p>
          <div className="flex gap-4">
            <div className="input-group w-full">
              <label className="input-label">Fecha de Creación</label>
              <input className="input" style={{ color: 'var(--text-muted)' }} readOnly
                value={company.created_at ? new Date(company.created_at).toLocaleString('es-CO') : '—'} />
            </div>
            <div className="input-group w-full">
              <label className="input-label">Última Modificación</label>
              <input className="input" style={{ color: 'var(--text-muted)' }} readOnly
                value={company.updated_at ? new Date(company.updated_at).toLocaleString('es-CO') : '—'} />
            </div>
          </div>
        </>
      )}

      <div className="modal__footer" style={{ padding: '1rem 0 0 0', border: 'none' }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear Empresa')}
        </button>
      </div>
    </form>
  );
}
