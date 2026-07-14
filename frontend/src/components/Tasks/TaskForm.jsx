import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

const taskSchema = z.object({
  title: z.string().min(3, 'Título obligatorio'),
  description: z.string().optional(),
  type: z.enum(['task', 'call', 'meeting', 'email', 'follow_up']).default('task'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  due_date: z.string().optional(),
  assigned_to: z.string().optional(),
  categoria: z.string().optional(),
  estimated_minutes: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'waiting', 'deferred', 'completed', 'cancelled']).default('pending'),
  related_type: z.string().optional().nullable(),
  related_id: z.string().optional().nullable(),
});

export function TaskForm({ task, onSuccess, onCancel, defaultRelatedType, defaultRelatedId }) {
  const queryClient = useQueryClient();
  const isEditing = !!task;

  const [companySearch, setCompanySearch] = useState('');
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsCompanyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: task
      ? { 
          ...task, 
          due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0,16) : '',
          estimated_minutes: task.estimated_minutes?.toString() || ''
        }
      : { type: 'task', priority: 'medium', status: 'pending', related_type: defaultRelatedType || '', related_id: defaultRelatedId || '' },
  });

  // Watch related_type para saber si necesitamos renderizar selectores adicionales
  const relatedType = register('related_type').value;

  const { data: usersData } = useQuery({
    queryKey: ['users_assignable'],
    queryFn: async () => {
      const { data } = await api.get('/tasks/users/assignable');
      return data.data;
    }
  });

  const { data: companiesData } = useQuery({
    queryKey: ['companies-all'],
    queryFn: async () => {
      const { data } = await api.get('/companies');
      return data.data;
    }
  });

  const selectedCompanyId = watch('related_id');
  const selectedCompany = companiesData?.find(c => c.id === selectedCompanyId);

  const filteredCompanies = companiesData?.filter(c => 
    c.name.toLowerCase().includes(companySearch.toLowerCase()) || 
    (c.nit && c.nit.includes(companySearch))
  ) || [];

  const mutation = useMutation({
    mutationFn: async (values) => {
      const payload = { 
        ...values, 
        due_date: values.due_date || null,
        assigned_to: values.assigned_to || null,
        estimated_minutes: values.estimated_minutes ? parseInt(values.estimated_minutes, 10) : null,
        related_type: values.related_id ? 'company' : null, // Simplificado, ya que solo conectaremos empresas por ahora.
        related_id: values.related_id || null,
      };
      if (isEditing) {
        const { data } = await api.patch(`/tasks/${task.id}`, payload);
        return data;
      } else {
        const { data } = await api.post('/tasks', payload);
        return data;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Tarea actualizada' : 'Tarea creada');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onSuccess?.();
    },
    onError: (err) => toast.error(err.response?.data?.error?.message || 'Error al guardar'),
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col gap-4">
      <div className="input-group">
        <label className="input-label">Título *</label>
        <input {...register('title')} className="input" placeholder="Ej: Llamar a cliente" autoFocus />
        {errors.title && <span className="input-error">{errors.title.message}</span>}
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Tipo</label>
          <select {...register('type')} className="input">
            <option value="task">Tarea</option>
            <option value="call">Llamada</option>
            <option value="meeting">Reunión</option>
            <option value="email">Email</option>
            <option value="follow_up">Seguimiento</option>
          </select>
        </div>
        <div className="input-group w-full">
          <label className="input-label">Prioridad</label>
          <select {...register('priority')} className="input">
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Estado</label>
          <select {...register('status')} className="input">
            <option value="pending">Pendiente</option>
            <option value="in_progress">En Progreso</option>
            <option value="waiting">Esperando</option>
            <option value="completed">Completada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>
        <div className="input-group w-full">
          <label className="input-label">Categoría</label>
          <input {...register('categoria')} className="input" placeholder="Ej: Ventas, Soporte" />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Minutos Estimados</label>
          <input {...register('estimated_minutes')} type="number" className="input" placeholder="Ej: 30" />
        </div>
        <div className="input-group w-full">
          <label className="input-label">Asignar a</label>
          <select {...register('assigned_to')} className="input">
            <option value="">Sin asignar</option>
            {usersData?.map(u => (
              <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="input-group w-full" ref={dropdownRef} style={{ position: 'relative' }}>
        <label className="input-label">Relacionar con Empresa (Opcional)</label>
        
        <div 
          className="input" 
          style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
        >
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedCompany ? `${selectedCompany.name} ${selectedCompany.nit ? `(${selectedCompany.nit})` : ''}` : 'Sin relación'}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>▼</span>
        </div>
        
        {isCompanyDropdownOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
            background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', 
            zIndex: 50, padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem'
          }}>
            <input 
              type="text" 
              className="input" 
              style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
              placeholder="Buscar por nombre o NIT..." 
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
              <div 
                style={{ padding: '0.5rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)', transition: 'background 0.15s' }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                onClick={() => { setValue('related_id', null); setIsCompanyDropdownOpen(false); setCompanySearch(''); }}
              >
                Sin relación
              </div>
              {filteredCompanies.map(c => (
                <div 
                  key={c.id} 
                  style={{ padding: '0.5rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)', transition: 'background 0.15s', display: 'flex', justifyContent: 'space-between' }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  onClick={() => { setValue('related_id', c.id); setIsCompanyDropdownOpen(false); setCompanySearch(''); }}
                >
                  <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  {c.nit && <span style={{ color: 'var(--text-muted)', fontSize: '0.85em', flexShrink: 0, marginLeft: '0.5rem' }}>{c.nit}</span>}
                </div>
              ))}
              {filteredCompanies.length === 0 && (
                <div style={{ padding: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.85rem' }}>
                  No se encontraron empresas
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="input-group">
        <label className="input-label">Fecha límite</label>
        <input {...register('due_date')} className="input" type="datetime-local" />
      </div>

      <div className="input-group">
        <label className="input-label">Descripción</label>
        <textarea {...register('description')} className="input" rows="3" placeholder="Detalle de la tarea..." />
      </div>

      <div className="modal__footer" style={{ padding: '1rem 0 0 0', border: 'none' }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear Tarea')}
        </button>
      </div>
    </form>
  );
}
