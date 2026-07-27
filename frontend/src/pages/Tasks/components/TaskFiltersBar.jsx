import React, { useCallback } from 'react';
import { Search, List, Columns, Calendar, X } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'all',         label: 'Todos' },
  { value: 'pending',     label: 'Pendiente' },
  { value: 'in_progress', label: 'En Progreso' },
  { value: 'waiting',     label: 'En Espera' },
  { value: 'completed',   label: 'Completada' },
  { value: 'cancelled',   label: 'Cancelada' },
];

const VIEWS = [
  { id: 'list',     icon: List,     label: 'Lista' },
  { id: 'kanban',   icon: Columns,  label: 'Kanban' },
  { id: 'calendar', icon: Calendar, label: 'Calendario' },
];

export function TaskFiltersBar({
  search, setSearch,
  filterStatus, setFilterStatus,
  currentView, setCurrentView,
}) {
  const handleSearchChange = useCallback(
    (e) => setSearch(e.target.value),
    [setSearch]
  );

  return (
    <div className="tasks-filters-bar">
      {/* Buscador */}
      <div className="tasks-filters-bar__search">
        <Search size={15} className="tasks-filters-bar__search-icon" />
        <input
          type="text"
          className="tasks-filters-bar__search-input"
          placeholder="Buscar tareas..."
          value={search}
          onChange={handleSearchChange}
        />
        {search && (
          <button
            className="tasks-filters-bar__clear"
            onClick={() => setSearch('')}
            aria-label="Limpiar búsqueda"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Filtro de estado */}
      <div className="tasks-filters-bar__status-group">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`tasks-filters-bar__status-btn${filterStatus === opt.value ? ' tasks-filters-bar__status-btn--active' : ''}`}
            onClick={() => setFilterStatus(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="tasks-filters-bar__spacer" />

      {/* Toggle de vista */}
      <div className="tasks-filters-bar__view-toggle">
        {VIEWS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            className={`tasks-filters-bar__view-btn${currentView === id ? ' tasks-filters-bar__view-btn--active' : ''}`}
            onClick={() => setCurrentView(id)}
            title={label}
            aria-label={`Vista ${label}`}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
