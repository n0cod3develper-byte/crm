import React from 'react';
import { CheckCircle2, Circle, MoreVertical, Trash2, ArrowRight, Plus } from 'lucide-react';

const COLUMNS = [
  { id: 'pending',     label: 'Pendiente',   color: '#f59e0b', icon: '🕐' },
  { id: 'in_progress', label: 'En Progreso',  color: '#3b82f6', icon: '⚡' },
  { id: 'waiting',     label: 'En Espera',    color: '#8b5cf6', icon: '⏳' },
  { id: 'completed',   label: 'Completada',   color: '#10b981', icon: '✅' },
];

const PRIORITY_META = {
  critical: { label: 'Crítica',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  high:     { label: 'Alta',     color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  medium:   { label: 'Media',    color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  low:      { label: 'Baja',     color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' },
};

const TYPE_ICONS = {
  call:      '📞', meeting: '🤝', email: '✉️', follow_up: '🔁', task: '📋',
};

const NEXT_STATUS = {
  pending:     'in_progress',
  in_progress: 'waiting',
  waiting:     'completed',
};

function formatDueDate(d) {
  if (!d) return null;
  const date = new Date(d);
  const now = new Date();
  const isOverdue = date < now;
  const diff = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
  const label = isOverdue
    ? `Venció hace ${Math.abs(diff)}d`
    : diff === 0 ? 'Hoy'
    : diff === 1 ? 'Mañana'
    : `En ${diff}d`;
  return { label, isOverdue };
}

function KanbanCard({ task, onEdit, onComplete, onDelete, onStatusChange }) {
  const priority = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const due = task.due_date ? formatDueDate(task.due_date) : null;
  const isCompleted = task.status === 'completed';
  const nextStatus = NEXT_STATUS[task.status];

  return (
    <div
      className="kanban-card"
      onClick={() => onEdit(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onEdit(task)}
    >
      {/* Priority strip */}
      <div style={{ height: '3px', background: priority.color, borderRadius: '4px 4px 0 0', margin: '-12px -12px 10px -12px' }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>{TYPE_ICONS[task.type] || '📋'}</span>
          <span className="kanban-card__title" data-completed={isCompleted}>{task.title}</span>
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {nextStatus && (
            <button
              className="kanban-card__action"
              onClick={() => onStatusChange(task.id, nextStatus)}
              title={`Mover a ${COLUMNS.find(c => c.id === nextStatus)?.label}`}
            >
              <ArrowRight size={12} />
            </button>
          )}
          {!isCompleted && (
            <button
              className="kanban-card__action kanban-card__action--complete"
              onClick={() => onComplete(task.id)}
              title="Completar"
            >
              <CheckCircle2 size={12} />
            </button>
          )}
          <button
            className="kanban-card__action kanban-card__action--danger"
            onClick={() => onDelete(task.id)}
            title="Eliminar"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <p className="kanban-card__description">{task.description}</p>
      )}

      {/* Footer */}
      <div className="kanban-card__footer">
        <span style={{
          padding: '2px 7px', borderRadius: '999px', fontSize: '0.68rem',
          fontWeight: 700, color: priority.color, background: priority.bg,
        }}>
          {priority.label}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
          {due && (
            <span style={{
              fontSize: '0.7rem', fontWeight: 500,
              color: due.isOverdue && !isCompleted ? '#ef4444' : 'var(--text-muted)',
            }}>
              {due.label}
            </span>
          )}
          {task.assigned_to_name && (
            <div className="kanban-card__avatar" title={task.assigned_to_name}>
              {task.assigned_to_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ column, tasks, onEdit, onComplete, onDelete, onStatusChange }) {
  return (
    <div className="kanban-column">
      {/* Column header */}
      <div className="kanban-column__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>{column.icon}</span>
          <span className="kanban-column__title" style={{ color: column.color }}>
            {column.label}
          </span>
        </div>
        <span className="kanban-column__count">{tasks.length}</span>
      </div>

      {/* Cards */}
      <div className="kanban-column__cards">
        {tasks.map(task => (
          <KanbanCard
            key={task.id}
            task={task}
            onEdit={onEdit}
            onComplete={onComplete}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
          />
        ))}
        {tasks.length === 0 && (
          <div className="kanban-column__empty">Sin tareas</div>
        )}
      </div>
    </div>
  );
}

function SkeletonColumn() {
  return (
    <div className="kanban-column">
      <div className="kanban-column__header">
        <div style={{ height: '16px', width: '80px', borderRadius: '4px', background: 'var(--bg-secondary)' }} />
        <div style={{ height: '20px', width: '24px', borderRadius: '12px', background: 'var(--bg-secondary)' }} />
      </div>
      <div className="kanban-column__cards">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="kanban-card" style={{ opacity: 0.5 }}>
            <div style={{ height: '3px', background: 'var(--bg-secondary)', borderRadius: '4px 4px 0 0', margin: '-12px -12px 10px -12px' }} />
            <div style={{ height: '14px', borderRadius: '4px', background: 'var(--bg-secondary)', width: '80%', marginBottom: '8px' }} />
            <div style={{ height: '11px', borderRadius: '4px', background: 'var(--bg-secondary)', width: '55%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TasksKanbanView({ tasks, isLoading, onEdit, onComplete, onDelete, onStatusChange }) {
  if (isLoading) {
    return (
      <div className="kanban-board">
        {COLUMNS.map(col => <SkeletonColumn key={col.id} />)}
      </div>
    );
  }

  // Agrupar tareas por columna
  const byStatus = COLUMNS.reduce((acc, col) => {
    acc[col.id] = tasks.filter(t => t.status === col.id);
    return acc;
  }, {});

  // Las tareas con estados no contemplados van a 'pending'
  const uncategorized = tasks.filter(t => !COLUMNS.find(c => c.id === t.status));
  if (uncategorized.length > 0) {
    byStatus.pending = [...byStatus.pending, ...uncategorized];
  }

  return (
    <div className="kanban-board">
      {COLUMNS.map(col => (
        <KanbanColumn
          key={col.id}
          column={col}
          tasks={byStatus[col.id] || []}
          onEdit={onEdit}
          onComplete={onComplete}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
        />
      ))}
    </div>
  );
}
