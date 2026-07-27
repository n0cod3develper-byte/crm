import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

const PRIORITY_COLOR = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#3b82f6',
  low:      '#9ca3af',
};

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function buildCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay(); // 0=Dom

  const days = [];

  // Días del mes anterior para rellenar
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, isCurrentMonth: false });
  }

  // Días del mes actual
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }

  // Rellenar hasta completar 6 filas (42 celdas)
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push({ date: new Date(year, month + 1, d), isCurrentMonth: false });
  }

  return days;
}

function CalendarCell({ day, tasks, onEdit, isToday }) {
  const hasTasks = tasks.length > 0;
  const hasOverdue = tasks.some(t => t.status !== 'completed' && new Date(t.due_date) < new Date());

  return (
    <div
      className={[
        'cal-cell',
        !day.isCurrentMonth && 'cal-cell--other-month',
        isToday && 'cal-cell--today',
        hasTasks && 'cal-cell--has-tasks',
      ].filter(Boolean).join(' ')}
    >
      <div className="cal-cell__day">
        <span className={`cal-cell__day-num${isToday ? ' cal-cell__day-num--today' : ''}`}>
          {day.date.getDate()}
        </span>
        {hasOverdue && (
          <AlertTriangle size={10} style={{ color: '#ef4444', flexShrink: 0 }} />
        )}
      </div>

      <div className="cal-cell__tasks">
        {tasks.slice(0, 3).map(task => (
          <button
            key={task.id}
            className="cal-task-chip"
            style={{ borderLeftColor: PRIORITY_COLOR[task.priority] || '#9ca3af' }}
            onClick={(e) => { e.stopPropagation(); onEdit(task); }}
            title={task.title}
          >
            <span className={`cal-task-chip__label${task.status === 'completed' ? ' cal-task-chip__label--done' : ''}`}>
              {task.title}
            </span>
          </button>
        ))}
        {tasks.length > 3 && (
          <span className="cal-task-chip cal-task-chip--more">
            +{tasks.length - 3} más
          </span>
        )}
      </div>
    </div>
  );
}

export function TasksCalendarView({ tasks, isLoading, onEdit }) {
  const today = new Date();
  const [currentYear,  setCurrentYear]  = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  const grid = buildCalendarGrid(currentYear, currentMonth);

  // Mapear tareas a fechas
  const tasksByDate = {};
  (tasks || []).forEach(task => {
    if (!task.due_date) return;
    const d = new Date(task.due_date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!tasksByDate[key]) tasksByDate[key] = [];
    tasksByDate[key].push(task);
  });

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentYear(y => y - 1); setCurrentMonth(11); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentYear(y => y + 1); setCurrentMonth(0); }
    else setCurrentMonth(m => m + 1);
  };
  const goToday = () => { setCurrentYear(today.getFullYear()); setCurrentMonth(today.getMonth()); };

  const tasksWithDates = (tasks || []).filter(t => t.due_date).length;
  const tasksWithoutDates = (tasks || []).length - tasksWithDates;

  return (
    <div className="cal-wrapper">
      {/* Nav */}
      <div className="cal-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="cal-nav__btn" onClick={prevMonth} aria-label="Mes anterior">
            <ChevronLeft size={18} />
          </button>
          <h2 className="cal-nav__title">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>
          <button className="cal-nav__btn" onClick={nextMonth} aria-label="Mes siguiente">
            <ChevronRight size={18} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {tasksWithoutDates > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {tasksWithoutDates} tarea{tasksWithoutDates !== 1 ? 's' : ''} sin fecha
            </span>
          )}
          <button className="btn btn--secondary btn--sm" onClick={goToday}>
            Hoy
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="cal-grid cal-grid--header">
        {DAY_NAMES.map(d => (
          <div key={d} className="cal-header-cell">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      {isLoading ? (
        <div className="cal-grid">
          {[...Array(42)].map((_, i) => (
            <div key={i} className="cal-cell cal-cell--skeleton" />
          ))}
        </div>
      ) : (
        <div className="cal-grid">
          {grid.map((day, i) => {
            const key = `${day.date.getFullYear()}-${day.date.getMonth()}-${day.date.getDate()}`;
            const dayTasks = tasksByDate[key] || [];
            const isToday = isSameDay(day.date, today);
            return (
              <CalendarCell
                key={i}
                day={day}
                tasks={dayTasks}
                onEdit={onEdit}
                isToday={isToday}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
