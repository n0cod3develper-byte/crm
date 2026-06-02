import { useNavigate } from 'react-router-dom';
import { PrioridadBadge } from '../../../components/MantenimientosProgramados/PrioridadBadge';

const COLUMNAS = [
  { estado: 'PROGRAMADO', label: 'Programado', color: 'var(--clr-primary-500)' },
  { estado: 'EN_EJECUCION', label: 'En Ejecución', color: '#f59e0b' },
  { estado: 'COMPLETADO', label: 'Completado', color: '#22c55e' },
  { estado: 'VERIFICADO', label: 'Verificado', color: '#10b981' },
  { estado: 'POSPUESTO', label: 'Pospuesto', color: '#f97316' },
  { estado: 'CANCELADO', label: 'Cancelado', color: '#ef4444' },
];

export default function OrdenKanban({ ordenes = [], loading }) {
  const navigate = useNavigate();

  const agrupadas = {};
  COLUMNAS.forEach(col => { agrupadas[col.estado] = []; });
  ordenes.forEach(o => { if (agrupadas[o.estado]) agrupadas[o.estado].push(o); });

  return (
    <div className="kanban-board">
      {COLUMNAS.map(col => {
        const items = agrupadas[col.estado] || [];
        return (
          <div key={col.estado} className="kanban-column" style={{ minWidth: '250px', maxWidth: '250px' }}>
            <div className="kanban-column__header">
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: col.color, display: 'inline-block' }} />
              <span>{col.label}</span>
              <span className="badge badge--gray" style={{ marginLeft: 'auto', fontSize: '10px' }}>{items.length}</span>
            </div>
            <div className="kanban-column__body">
              {loading ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', padding: '1rem 0' }}><div className="spinner" /></p>
              ) : items.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', padding: '1rem 0' }}>Sin órdenes</p>
              ) : items.map(o => (
                <div key={o.id} className="kanban-card"
                  onClick={() => navigate(`${o.id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <code style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-primary-400)', fontWeight: 700 }}>{o.codigo}</code>
                    <PrioridadBadge prioridad={o.prioridad} />
                  </div>
                  <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.titulo}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{o.tipo_mantenimiento}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{new Date(o.fecha_programada).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
