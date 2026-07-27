import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, CheckCircle2, Clock, AlertCircle, Tag, User, Building2, Edit2, Trash2, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';

const PRIORITY_META = {
  critical: { label: 'Crítica',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  high:     { label: 'Alta',     color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  medium:   { label: 'Media',    color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  low:      { label: 'Baja',     color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

const STATUS_META = {
  pending:     { label: 'Pendiente',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  in_progress: { label: 'En Progreso',  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  waiting:     { label: 'En Espera',    color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  deferred:    { label: 'Diferida',     color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  completed:   { label: 'Completada',   color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  cancelled:   { label: 'Cancelada',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

const TYPE_LABELS = {
  task:      'Tarea',
  call:      'Llamada',
  meeting:   'Reunión',
  email:     'Email',
  follow_up: 'Seguimiento',
};

function MetaBadge({ meta, value }) {
  const m = meta[value] || { label: value, color: '#6b7280', bg: 'rgba(107,114,128,0.12)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 10px', borderRadius: '999px', fontSize: '0.75rem',
      fontWeight: 600, color: m.color, background: m.bg,
    }}>
      {m.label}
    </span>
  );
}

function DetailRow({ icon: Icon, label, children }) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <Icon size={15} style={{ color: 'var(--text-muted)', marginTop: '2px', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>{children || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin asignar</span>}</div>
      </div>
    </div>
  );
}

export function TaskDetailDrawer({ taskId, onClose }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const res = await api.get(`/tasks/${taskId}`);
      return res.data?.data;
    },
    enabled: !!taskId,
  });

  const task = data;
  const isAdmin = user?.role === 'admin' || user?.role === 'administrador';
  const canEdit = isAdmin || (task && (task.assigned_to === user?.id || task.created_by === user?.id || task.supervisor_id === user?.id));

  const completeMutation = useMutation({
    mutationFn: () => api.patch(`/tasks/${taskId}/complete`),
    onSuccess: () => {
      toast.success('¡Tarea completada!');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/tasks/${taskId}`),
    onSuccess: () => {
      toast.success('Tarea eliminada');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al eliminar'),
  });

  const handleDelete = () => {
    if (window.confirm('¿Seguro que deseas eliminar esta tarea?')) {
      deleteMutation.mutate();
    }
  };

  const formatDate = (d) => {
    if (!d) return null;
    return new Date(d).toLocaleString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const isOverdue = task?.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

  return (
    <div className="task-drawer" role="dialog" aria-modal="true" aria-label="Detalle de tarea">
      {/* Header */}
      <div className="task-drawer__header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 600 }}>
            Detalle de tarea
          </span>
          {isLoading ? (
            <div className="task-drawer__skeleton-title" />
          ) : (
            <h2 className="task-drawer__title">{task?.title}</h2>
          )}
        </div>
        <button className="task-drawer__close" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="task-drawer__body">
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="task-drawer__skeleton-row" style={{ width: `${70 + (i % 3) * 10}%` }} />
            ))}
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--clr-danger)' }}>
            <AlertCircle size={32} style={{ marginBottom: '8px' }} />
            <p>No se pudo cargar la tarea</p>
          </div>
        )}

        {task && !isLoading && (
          <>
            {/* Estado + Prioridad */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <MetaBadge meta={STATUS_META} value={task.status} />
              <MetaBadge meta={PRIORITY_META} value={task.priority} />
              {task.type && (
                <span style={{
                  padding: '3px 10px', borderRadius: '999px', fontSize: '0.75rem',
                  fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-secondary)',
                }}>
                  {TYPE_LABELS[task.type] || task.type}
                </span>
              )}
            </div>

            {/* Descripción */}
            {task.description && (
              <div style={{
                padding: '12px', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-secondary)', marginBottom: '16px',
                fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
              }}>
                {task.description}
              </div>
            )}

            {/* Detalles */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <DetailRow icon={User} label="Asignado a">
                {task.assigned_to_name}
              </DetailRow>
              <DetailRow icon={User} label="Creado por">
                {task.created_by_name}
              </DetailRow>
              {task.supervisor_name && (
                <DetailRow icon={User} label="Supervisor">
                  {task.supervisor_name}
                </DetailRow>
              )}
              <DetailRow icon={Calendar} label="Fecha límite">
                {task.due_date ? (
                  <span style={{ color: isOverdue ? 'var(--clr-danger)' : 'inherit' }}>
                    {formatDate(task.due_date)}
                    {isOverdue && ' ⚠ Vencida'}
                  </span>
                ) : null}
              </DetailRow>
              {task.categoria && (
                <DetailRow icon={Tag} label="Categoría">
                  {task.categoria}
                </DetailRow>
              )}
              {task.estimated_minutes && (
                <DetailRow icon={Clock} label="Tiempo estimado">
                  {task.estimated_minutes >= 60
                    ? `${Math.floor(task.estimated_minutes / 60)}h ${task.estimated_minutes % 60}min`
                    : `${task.estimated_minutes} min`}
                </DetailRow>
              )}
              {task.related_type && task.related_id && (
                <DetailRow icon={Building2} label="Vinculado a">
                  {task.related_type} #{task.related_id}
                </DetailRow>
              )}
              <DetailRow icon={Clock} label="Creada">
                {formatDate(task.created_at)}
              </DetailRow>
            </div>
          </>
        )}
      </div>

      {/* Footer acciones */}
      {task && !isLoading && (
        <div className="task-drawer__footer">
          {task.status !== 'completed' && (
            <button
              className="btn btn--primary btn--sm"
              onClick={() => canEdit && completeMutation.mutate()}
              disabled={!canEdit || completeMutation.isPending}
              style={{ flex: 1, opacity: !canEdit ? 0.5 : 1, cursor: !canEdit ? 'not-allowed' : 'pointer' }}
              title={!canEdit ? 'Solo el asignado o administrador puede completar la tarea' : 'Completar tarea'}
            >
              <CheckCircle2 size={14} />
              {completeMutation.isPending ? 'Completando...' : 'Completar'}
            </button>
          )}
          <button
            className="btn btn--danger btn--sm"
            onClick={handleDelete}
            disabled={!canEdit || deleteMutation.isPending}
            style={{ opacity: !canEdit ? 0.5 : 1, cursor: !canEdit ? 'not-allowed' : 'pointer' }}
            title={!canEdit ? 'Sin permisos para eliminar' : 'Eliminar tarea'}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
