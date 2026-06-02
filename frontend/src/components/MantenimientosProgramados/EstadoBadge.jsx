const CONFIG = {
  PROGRAMADO:   { label: 'Programado',   cls: 'badge--primary' },
  EN_EJECUCION: { label: 'En Ejecución', cls: 'badge--warning' },
  COMPLETADO:   { label: 'Completado',   cls: 'badge--success' },
  VERIFICADO:   { label: 'Verificado',   cls: 'badge--success' },
  POSPUESTO:    { label: 'Pospuesto',    cls: 'badge--warning' },
  CANCELADO:    { label: 'Cancelado',    cls: 'badge--danger' },
};

export function EstadoBadge({ estado, className = '' }) {
  const cfg = CONFIG[estado] ?? { label: estado, cls: 'badge--gray' };
  return (
    <span className={`badge ${cfg.cls} ${className}`}>
      {cfg.label}
    </span>
  );
}
