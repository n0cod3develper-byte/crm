import React from 'react';
import { CheckCircle2, Circle, Trash2, Edit2, Clock, AlertTriangle, ClipboardList, Plus } from 'lucide-react';

const PRIORITY_META = {
  critical: { label: 'Crítica',  dot: '#ef4444', bar: '#ef4444' },
  high:     { label: 'Alta',     dot: '#f97316', bar: '#f97316' },
  medium:   { label: 'Media',    dot: '#3b82f6', bar: '#3b82f6' },
  low:      { label: 'Baja',     dot: '#9ca3af', bar: '#9ca3af' },
};

const STATUS_META = {
  pending:     { label: 'Pendiente',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  in_progress: { label: 'En Progreso', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  waiting:     { label: 'En Espera',   color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  deferred:    { label: 'Diferida',    color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  completed:   { label: 'Completada',  color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  cancelled:   { label: 'Cancelada',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

const TYPE_ICONS = {
  call:      '📞',
  meeting:   '🤝',
  email:     '✉️',
  follow_up: '🔁',
  task:      '📋',
};

function PriorityBar({ priority }) {
  const meta = PRIORITY_META[priority] || PRIORITY_META.medium;
  return (
    <span style={{
      display: 'inline-block', width: '3px', height: '36px',
      borderRadius: '3px', background: meta.bar, flexShrink: 0,
    }} title={meta.label} />
  );
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem',
      fontWeight: 700, color: meta.color, background: meta.bg,
      whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  );
}

function formatDate(d) {
  if (!d) return null;
  const date = new Date(d);
  const now = new Date();
  const isOverdue = date < now;
  const diff = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

  const formatted = date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

  return { formatted, isOverdue, diff };
}

function TaskRow({ task, onEdit, onComplete, onDelete }) {
  const dueMeta = task.due_date ? formatDate(task.due_date) : null;
  const isCompleted = task.status === 'completed';

  return (
    <div className="task-list-row" data-completed={isCompleted}>
      {/* Priority bar */}
      <PriorityBar priority={task.priority} />

      {/* Complete toggle */}
      <button
        className="task-list-row__check"
        onClick={() => !isCompleted && onComplete(task.id)}
        title={isCompleted ? 'Completada' : 'Marcar como completada'}
        aria-label={isCompleted ? 'Completada' : 'Marcar como completada'}
      >
        {isCompleted
          ? <CheckCircle2 size={18} style={{ color: 'var(--clr-success)' }} />
          : <Circle size={18} style={{ color: 'var(--text-muted)' }} />
        }
      </button>

      {/* Main content */}
      <div className="task-list-row__content" onClick={() => onEdit(task)}>
        <div className="task-list-row__title-line">
          <span className="task-list-row__type-icon">{TYPE_ICONS[task.type] || '📋'}</span>
          <span className="task-list-row__title" data-completed={isCompleted}>
            {task.title}
          </span>
        </div>
        {task.description && (
          <p className="task-list-row__description">{task.description}</p>
        )}
        {/* Tags row */}
        <div className="task-list-row__tags">
          <StatusBadge status={task.status} />
          {task.categoria && (
            <span className="task-list-row__tag">{task.categoria}</span>
          )}
        </div>
      </div>

      {/* Meta info */}
      <div className="task-list-row__meta">
        {task.assigned_to_name && (
          <div className="task-list-row__avatar" title={task.assigned_to_name}>
            {task.assigned_to_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
        )}
        {dueMeta && (
          <div
            className="task-list-row__due"
            style={{ color: dueMeta.isOverdue && !isCompleted ? 'var(--clr-danger)' : 'var(--text-muted)' }}
            title={`Vence: ${dueMeta.formatted}`}
          >
            {dueMeta.isOverdue && !isCompleted && <AlertTriangle size={11} />}
            <Clock size={11} />
            <span>{dueMeta.formatted}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="task-list-row__actions">
        <button
          className="task-list-row__action-btn"
          onClick={() => onEdit(task)}
          title="Ver detalle"
          aria-label="Ver detalle"
        >
          <Edit2 size={13} />
        </button>
        <button
          className="task-list-row__action-btn task-list-row__action-btn--danger"
          onClick={() => onDelete(task.id)}
          title="Eliminar"
          aria-label="Eliminar tarea"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="task-list-empty">
      <ClipboardList size={48} strokeWidth={1} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
      <h3 className="task-list-empty__title">Sin tareas</h3>
      <p className="task-list-empty__subtitle">
        No hay tareas que coincidan con los filtros actuales.
      </p>
      {onCreate && (
        <button className="btn btn--primary" onClick={onCreate} style={{ marginTop: '16px' }}>
          <Plus size={15} /> Nueva tarea
        </button>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="task-list-row task-list-row--skeleton">
      <div style={{ width: '3px', height: '36px', borderRadius: '3px', background: 'var(--bg-secondary)' }} />
      <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--bg-secondary)', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ height: '14px', borderRadius: '4px', background: 'var(--bg-secondary)', width: '60%' }} />
        <div style={{ height: '11px', borderRadius: '4px', background: 'var(--bg-secondary)', width: '35%' }} />
      </div>
    </div>
  );
}

export function TasksListView({ tasks, isLoading, onEdit, onComplete, onDelete, onCreate }) {
  if (isLoading) {
    return (
      <div className="task-list-container">
        {[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return <EmptyState onCreate={onCreate} />;
  }

  // Agrupar por estado para mostrar pendientes/en progreso primero
  const active = tasks.filter(t => !['completed', 'cancelled'].includes(t.status));
  const done   = tasks.filter(t => ['completed', 'cancelled'].includes(t.status));

  return (
    <div className="task-list-container">
      {/* Tareas activas */}
      {active.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          onEdit={onEdit}
          onComplete={onComplete}
          onDelete={onDelete}
        />
      ))}

      {/* Separador si hay completadas */}
      {active.length > 0 && done.length > 0 && (
        <div className="task-list-section-divider">
          <span>Completadas / Canceladas ({done.length})</span>
        </div>
      )}

      {/* Tareas completadas/canceladas */}
      {done.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          onEdit={onEdit}
          onComplete={onComplete}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
