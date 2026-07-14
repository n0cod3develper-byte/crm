import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import { TaskForm } from '../../components/Tasks/TaskForm';
import { TaskFiltersBar } from './components/TaskFiltersBar';
import { TaskDetailDrawer } from './components/TaskDetailDrawer';
import { TasksListView } from './views/TasksListView';
import { TasksKanbanView } from './views/TasksKanbanView';
import { TasksCalendarView } from './views/TasksCalendarView';
import api from '../../lib/api';

export function TasksPage() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentView, setCurrentView] = useState('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Para Drawer y Edición
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', search, filterStatus],
    queryFn: async () => {
      const params = { limit: 200 }; // Incrementar límite para Kanban/Calendar
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
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Error al eliminar');
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => api.patch(`/tasks/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });

  const tasks = data?.data || [];

  const handleCreate = () => { setEditingTask(null); setIsModalOpen(true); };
  
  // Abre el drawer de detalle
  const handleEdit = (t) => { setSelectedTaskId(t.id); };
  
  const handleCloseModal = () => { setIsModalOpen(false); setEditingTask(null); };
  const handleCloseDrawer = () => { setSelectedTaskId(null); };

  const handleComplete = (id) => completeMutation.mutate(id);
  const handleDelete = (id) => {
    if (window.confirm('¿Seguro que deseas eliminar esta tarea?')) {
      deleteMutation.mutate(id);
    }
  };
  const handleStatusChange = (id, newStatus) => updateStatusMutation.mutate({ id, status: newStatus });

  return (
    <div className="app-layout">
      <Topbar 
        title="Tareas Enterprise" 
        subtitle={`${tasks.length} tareas`} 
        rightContent={
          <button className="btn btn--primary" onClick={handleCreate}>
            <Plus size={16} /> Nueva tarea
          </button>
        } 
      />

      <main className="main-content">
        <TaskFiltersBar 
          search={search}
          setSearch={setSearch}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          currentView={currentView}
          setCurrentView={setCurrentView}
        />

        {currentView === 'list' && (
          <TasksListView 
            tasks={tasks} 
            isLoading={isLoading} 
            onEdit={handleEdit} 
            onComplete={handleComplete}
            onDelete={handleDelete}
            onCreate={handleCreate}
          />
        )}

        {currentView === 'kanban' && (
          <TasksKanbanView 
            tasks={tasks} 
            isLoading={isLoading} 
            onEdit={handleEdit}
            onComplete={handleComplete}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
          />
        )}

        {currentView === 'calendar' && (
          <TasksCalendarView 
            tasks={tasks} 
            isLoading={isLoading} 
            onEdit={handleEdit}
          />
        )}
      </main>

      {/* Formulario (Crear/Editar) */}
      {isModalOpen && (
        <Modal title={editingTask ? 'Editar Tarea' : 'Nueva Tarea'} onClose={handleCloseModal}>
          <TaskForm task={editingTask} onSuccess={handleCloseModal} onCancel={handleCloseModal} />
        </Modal>
      )}

      {/* Drawer de Detalle Completo */}
      {selectedTaskId && (
        <>
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }} 
            onClick={handleCloseDrawer}
          />
          <TaskDetailDrawer taskId={selectedTaskId} onClose={handleCloseDrawer} />
        </>
      )}
    </div>
  );
}
