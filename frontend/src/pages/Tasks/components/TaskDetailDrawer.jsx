import React from 'react';

export function TaskDetailDrawer({ isOpen, onClose, taskId }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: '300px', background: '#fff', borderLeft: '1px solid #ccc', zIndex: 9999, padding: '1rem' }}>
      <h2>Detalle de Tarea (Mock)</h2>
      <button onClick={onClose}>Cerrar</button>
    </div>
  );
}
