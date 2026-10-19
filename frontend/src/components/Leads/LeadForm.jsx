import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { FUENTES } from '../../constants/leads';

const leadSchema = z.object({
  first_name: z.string().min(2, 'Nombre obligatorio'),
  last_name: z.string().optional(),
  email: z.union([z.string().email('Email inválido'), z.string().length(0)]).optional(),
  phone: z.string().optional(),
  company_name: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'dead']).default('new'),
  score: z.coerce.number().min(0).max(100).default(0),
  // Opcional: se permite guardar leads sin asignar. '' viene del select vacío.
  assigned_employee_id: z
    .union([z.string().uuid('Empleado asignado inválido'), z.literal(''), z.null()])
    .optional(),
  notes: z.string().optional(),
});

export function LeadForm({ lead, onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const isEditing = !!lead;

  // Si el lead tiene una fuente libre anterior al catálogo (p. ej. 'FB', 'pagina web'),
  // se añade a la lista para que el <select> la muestre y no se pierda al guardar.
  const fuentes = React.useMemo(() => {
    const lista = [...FUENTES];
    const actual = lead?.source?.trim();
    if (isEditing && actual && !lista.includes(actual)) lista.unshift(actual);
    return lista;
  }, [isEditing, lead?.source]);

  // Empleados activos para el desplegable "Asignado a"
  const {
    data: empleados = [],
    isLoading: cargandoEmpleados,
    isError: falloEmpleados,
  } = useQuery({
    queryKey: ['leads-asignables'],
    queryFn: async () => {
      const { data } = await api.get('/leads/asignables');
      return data?.data || [];
    },
    staleTime: 60 * 1000,
    retry: 1,
  });

  // Si el responsable quedó INACTIVO después de asignarse, no aparece en la lista.
  // Se añade igualmente para conservar la asignación histórica en lugar de vaciarla.
  const opcionesEmpleados = React.useMemo(() => {
    const lista = [...empleados];
    const idActual = lead?.assigned_employee_id;
    if (isEditing && idActual && !lista.some((e) => e.id === idActual)) {
      lista.unshift({ id: idActual, full_name: `${lead.assigned_employee_name || 'Empleado asignado'} (inactivo)` });
    }
    return lista;
  }, [empleados, isEditing, lead?.assigned_employee_id, lead?.assigned_employee_name]);

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
      // El id de empleado vacío debe ir como null: '' rompería la validación de UUID
      if (!payload.assigned_employee_id) payload.assigned_employee_id = null;

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
          <select {...register('source')} className="input">
            <option value="">— Sin fuente —</option>
            {fuentes.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
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
        <label className="input-label">Asignado a (Opcional)</label>
        <select {...register('assigned_employee_id')} className="input" disabled={cargandoEmpleados}>
          <option value="">{cargandoEmpleados ? 'Cargando empleados…' : '— Sin asignar —'}</option>
          {opcionesEmpleados.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name}</option>
          ))}
        </select>
        {cargandoEmpleados && (
          <span className="input-hint" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
            Cargando empleados activos…
          </span>
        )}
        {falloEmpleados && (
          <span className="input-error">No fue posible cargar la lista de empleados. Intente de nuevo.</span>
        )}
        {!cargandoEmpleados && !falloEmpleados && opcionesEmpleados.length === 0 && (
          <span className="input-hint" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
            No hay empleados activos disponibles.
          </span>
        )}
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
