import { Clock, ArrowRight } from 'lucide-react';
import { EstadoBadge } from './EstadoBadge';

export function BitacoraTimeline({ entries = [] }) {
  if (!entries.length) {
    return (
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
        Sin registros en la bitácora
      </p>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Línea vertical */}
      <div style={{ position: 'absolute', left: '16px', top: 0, bottom: 0, width: '2px', background: 'var(--border-color)' }} />

      <ul style={{ display: 'flex', flexDirection: 'column', gap: '1rem', listStyle: 'none', padding: 0 }}>
        {entries.map((entry, idx) => (
          <li key={entry.id || idx} style={{ position: 'relative', paddingLeft: '2.5rem' }}>
            {/* Punto en la línea */}
            <div style={{
              position: 'absolute', left: '10px', top: '4px',
              width: '12px', height: '12px', borderRadius: '50%',
              background: 'var(--clr-primary-500)',
              border: '2px solid var(--bg-surface)',
            }} />

            <div className="card" style={{ padding: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {entry.estado_anterior && <EstadoBadge estado={entry.estado_anterior} />}
                {entry.estado_anterior && entry.estado_nuevo && (
                  <ArrowRight size={14} color="var(--text-muted)" />
                )}
                {entry.estado_nuevo && <EstadoBadge estado={entry.estado_nuevo} />}
              </div>
              {entry.comentario && (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  {entry.comentario}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                <Clock size={12} />
                <span>{new Date(entry.created_at).toLocaleString()}</span>
                {entry.usuario_id && <span>• Usuario #{entry.usuario_id}</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
