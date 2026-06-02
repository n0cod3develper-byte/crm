import { BarChart3, CheckCircle2, Clock, DollarSign, ListTodo } from 'lucide-react';

export function KpiCards({ kpis }) {
  if (!kpis) return null;

  const cards = [
    {
      label: 'Total Órdenes',
      value: kpis.totales?.total_ordenes ?? 0,
      icon: ListTodo,
      color: 'var(--clr-primary-500)',
    },
    {
      label: 'Cumplimiento',
      value: `${kpis.cumplimiento?.porcentaje ?? 0}%`,
      icon: CheckCircle2,
      color: '#22c55e',
      sub: `${kpis.cumplimiento?.completadas ?? 0}/${kpis.cumplimiento?.total ?? 0}`,
    },
    {
      label: 'Costo del Mes',
      value: `$${(kpis.costo_mes_actual ?? 0).toLocaleString()}`,
      icon: DollarSign,
      color: '#a855f7',
    },
    {
      label: 'En Ejecución',
      value: kpis.ordenes_por_estado?.find(e => e.estado === 'EN_EJECUCION')?.cantidad ?? 0,
      icon: Clock,
      color: '#f59e0b',
    },
  ];

  return (
    <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="kpi-label">{card.label}</span>
              <Icon size={18} color={card.color} />
            </div>
            <span className="kpi-value">{card.value}</span>
            {card.sub && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{card.sub}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
