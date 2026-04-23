import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

const taskSchema = z.object({
  title: z.string().min(3, 'Título obligatorio'),
  description: z.string().optional(),
  type: z.enum(['task', 'call', 'meeting', 'email', 'follow_up']).default('task'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  due_date: z.string().optional(),
});

export function TaskForm({ task, onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const isEditing = !!task;

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: task
      ? { ...task, due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0,16) : '' }
      : { type: 'task', priority: 'medium' },
  });

  const mutation = useMutation({
    mutationFn: async (values) => {
      const payload = { ...values, due_date: values.due_date || null };
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
