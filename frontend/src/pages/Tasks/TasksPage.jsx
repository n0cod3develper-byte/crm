import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, CheckCircle2, Circle, Clock, AlertTriangle, Phone, Mail, Users, RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import { TaskForm } from '../../components/Tasks/TaskForm';
import api from '../../lib/api';

const TYPE_ICONS = { task: Circle, call: Phone, meeting: Users, email: Mail, follow_up: RotateCcw };
const PRIORITY_COLORS = { urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#94a3b8' };
const PRIORITY_LABELS = { urgent: 'Urgente', high: 'Alta', medium: 'Media', low: 'Baja' };
const STATUS_LABELS = { pending: 'Pendiente', in_progress: 'En progreso', completed: 'Completada', cancelled: 'Cancelada' };

export function TasksPage() {
  const [search, setSearch] = React.useState('');
  const [filterStatus, setFilterStatus] = React.useState('pending');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', search, filterStatus],
    queryFn: async () => {
      const params = { limit: 50 };
      if (search) params.search = search;
      if (filterStatus && filterStatus !== 'all') params.status = filterStatus;
      const { data } = await api.get('/tasks', { params });
      return data;
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id) => api.patch(`/tasks/${id}/complete`),
    onSuccess: () => {
      toast.success('¡Tarea completada!');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      toast.success('Tarea eliminada');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const tasks = data?.data || [];

  const handleCreate = () => { setEditingTask(null); setIsModalOpen(true); };
  const handleEdit = (t) => { setEditingTask(t); setIsModalOpen(true); };
  const handleClose = () => { setIsModalOpen(false); setEditingTask(null); };

  function formatDate(d) {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diff = date - now;
    if (diff < 0 && date.toDateString() !== now.toDateString()) return `Vencida (${date.toLocaleDateString('es-CO')})`;
    if (date.toDateString() === now.toDateString()) return 'Hoy';
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) return 'Mañana';
    return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  }

  return (
    <div className="app-layout">

      <Topbar 
        title="Tareas" 
        subtitle={`${tasks.length} tareas`} 
        rightContent={
          <button className="btn btn--primary" onClick={handleCreate}>
            <Plus size={16} /> Nueva tarea
          </button>
        } 
      />

      <main className="main-content">
        {/* Search + Filters */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 420 }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="input" style={{ paddingLeft: '2.5rem' }} placeholder="Buscar tareas…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {[
              { val: 'all', label: 'Todas' },
              { val: 'pending', label: 'Pendientes' },
              { val: 'in_progress', label: 'En progreso' },
              { val: 'completed', label: 'Completadas' },
            ].map(f => (
              <button
                key={f.val}
                className={`btn btn--sm ${filterStatus === f.val ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => setFilterStatus(f.val)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <CheckCircle2 size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Sin tareas</h2>
            <p className="empty-state__desc">Crea tu primera tarea para organizar tu trabajo.</p>
            <button className="btn btn--primary" onClick={handleCreate}><Plus size={16} /> Crear tarea</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {tasks.map(task => {
              const Icon = TYPE_ICONS[task.type] || Circle;
              const isCompleted = task.status === 'completed';
              const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isCompleted;

              return (
                <div
                  key={task.id}
                  className="card"
                  style={{
                    padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.875rem',
                    opacity: isCompleted ? 0.6 : 1, transition: 'all 0.2s',
                    borderLeft: `3px solid ${PRIORITY_COLORS[task.priority]}`,
                  }}
                >
                  {/* Complete button */}
                  <button
                    onClick={() => !isCompleted && completeMutation.mutate(task.id)}
                    style={{
                      background: 'none', border: 'none', cursor: isCompleted ? 'default' : 'pointer',
                      color: isCompleted ? '#4ade80' : 'var(--text-muted)', flexShrink: 0,
                    }}
                    title={isCompleted ? 'Completada' : 'Marcar completada'}
                  >
                    {isCompleted ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                  </button>

                  {/* Task info */}
                  <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => handleEdit(task)}>
                    <div style={{
                      fontWeight: 600, fontSize: 'var(--text-sm)',
                      textDecoration: isCompleted ? 'line-through' : 'none',
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                    }}>
                      <Icon size={14} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                      {task.title}
                    </div>
                    {task.description && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.description}
                      </div>
                    )}
                  </div>

                  {/* Due date */}
                  {task.due_date && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.25rem',
                      fontSize: 'var(--text-xs)', flexShrink: 0,
                      color: isOverdue ? '#ef4444' : 'var(--text-muted)',
                      fontWeight: isOverdue ? 700 : 400,
                    }}>
                      {isOverdue ? <AlertTriangle size={12} /> : <Clock size={12} />}
                      {formatDate(task.due_date)}
                    </div>
                  )}

                  {/* Priority badge */}
                  <span style={{
                    fontSize: '10px', padding: '2px 8px', borderRadius: '9999px', flexShrink: 0,
                    background: `${PRIORITY_COLORS[task.priority]}20`,
                    color: PRIORITY_COLORS[task.priority],
                    fontWeight: 600,
                  }}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>

                  {/* Delete */}
                  <button
                    className="btn btn--ghost btn--sm"
                    style={{ color: 'var(--clr-danger)', padding: '0.25rem', flexShrink: 0 }}
                    onClick={() => deleteMutation.mutate(task.id)}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {isModalOpen && (
        <Modal title={editingTask ? 'Editar Tarea' : 'Nueva Tarea'} onClose={handleClose}>
          <TaskForm task={editingTask} onSuccess={handleClose} onCancel={handleClose} />
        </Modal>
      )}
    </div>
  );
}
