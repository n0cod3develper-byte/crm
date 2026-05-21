import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

const companySchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio (mín 2 caracteres)'),
  nit: z.string().optional(),
  industry: z.string().default('logistics'),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  phone: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  modelo_captacion: z.string().optional(),
  regimen: z.string().optional(),
  responsable_captacion_id: z.string().optional(),
});

const MODELOS_CAPTACION = [
  'Recomendación / Referido',
  'Redes Sociales',
  'Google / Buscador',
  'Correo Electrónico',
  'WhatsApp',
  'Visita Asesor Comercial',
  'Página Web / Sitio Oficial',
  'Mail Marketing',
];

export function CompanyForm({ company, onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const isEditing = !!company;

  const { data: empleados, isLoading: loadingEmpleados } = useQuery({
    queryKey: ['empleados-lista'],
    queryFn: async () => {
      const { data } = await api.get('/employees', { params: { limit: 200 } });
      return data.data || [];
    },
  });

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
      const msg = err.response?.data?.error?.message;
      if (msg && msg.toLowerCase().includes('nit')) {
        toast.error('Este NIT ya está registrado');
      } else {
        toast.error(msg || 'Error al guardar empresa');
      }
    },
  });

  const onSubmit = (data) => mutation.mutate(data);

  return (
    <form id="company-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
          {errors.nit && <span className="input-error">{errors.nit.message}</span>}
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
          <label className="input-label">Teléfono</label>
          <input {...register('phone')} className="input" placeholder="+57 ..." />
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
          rows="3"
        />
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />
      <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Información Comercial</p>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Modelo de captación</label>
          <select {...register('modelo_captacion')} className="input">
            <option value="">Seleccionar...</option>
            {MODELOS_CAPTACION.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="input-group w-full">
          <label className="input-label">Régimen</label>
          <select {...register('regimen')} className="input">
            <option value="">Seleccionar...</option>
            <option value="RC">RC</option>
            <option value="NI">NI</option>
          </select>
        </div>
      </div>

      <div className="input-group">
        <label className="input-label">Responsable de captación</label>
        <select {...register('responsable_captacion_id')} className="input">
          <option value="">Seleccionar...</option>
          {loadingEmpleados ? (
            <option disabled>Cargando empleados...</option>
          ) : !empleados || empleados.length === 0 ? (
            <option disabled>No hay empleados registrados</option>
          ) : (
            empleados.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name || `${emp.user_nombre || ''} ${emp.user_apellido || ''}`.trim() || emp.email}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="modal__footer" style={{ padding: '1rem 0 0 0', border: 'none' }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary" disabled={isSubmitting || mutation.isPending}>
          {isSubmitting ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear Empresa')}
        </button>
      </div>
    </form>
  );
}
