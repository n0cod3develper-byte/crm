import React from 'react';

export function TasksListView({ tasks, isLoading, onComplete, onEdit, onDelete, onSelect }) {
  if (isLoading) return <p>Cargando tareas...</p>;
  return (
    <div style={{ padding: '1rem', border: '1px solid #ccc' }}>
      <h3>Vista de Lista (Mock)</h3>
      <p>Mostrando {tasks?.length || 0} tareas</p>
    </div>
  );
}
