const PRIORIDAD = {
  CRITICA: { label: 'Crítica', cls: 'badge--danger' },
  ALTA:    { label: 'Alta',    cls: 'badge--warning' },
  MEDIA:   { label: 'Media',   cls: 'badge--primary' },
  BAJA:    { label: 'Baja',    cls: 'badge--gray' },
};

export function PrioridadBadge({ prioridad, className = '' }) {
  const cfg = PRIORIDAD[prioridad] ?? { label: prioridad, cls: 'badge--gray' };
  return (
    <span className={`badge ${cfg.cls} ${className}`}>
      {cfg.label}
    </span>
  );
}
