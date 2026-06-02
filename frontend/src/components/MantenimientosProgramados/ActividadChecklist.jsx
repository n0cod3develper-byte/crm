import { CheckCircle, Circle, AlertCircle } from 'lucide-react';

export function ActividadChecklist({ actividades, onToggle, readOnly = false }) {
  if (!actividades?.length) {
    return (
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
        No hay actividades registradas
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {actividades.map((act) => (
        <div
          key={act.id}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
            padding: '0.75rem', borderRadius: 'var(--radius-md)',
            border: '1px solid',
            borderColor: act.completada ? 'rgba(34,197,94,0.3)' : 'var(--border-color)',
            background: act.completada ? 'rgba(34,197,94,0.05)' : 'var(--bg-surface)',
          }}
        >
          <button
            type="button"
            onClick={() => !readOnly && onToggle?.(act)}
            disabled={readOnly}
            style={{
              marginTop: '2px', flexShrink: 0, background: 'none', border: 'none', cursor: readOnly ? 'default' : 'pointer',
              padding: 0, transition: 'transform 150ms ease',
            }}
            title={act.completada ? 'Marcar como pendiente' : 'Marcar como completada'}
          >
            {act.completada ? (
              <CheckCircle size={20} color="#22c55e" />
            ) : (
              <Circle size={20} color="var(--text-muted)" />
            )}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                fontSize: 'var(--text-sm)', fontWeight: 500,
                textDecoration: act.completada ? 'line-through' : 'none',
                color: act.completada ? 'var(--text-muted)' : 'var(--text-primary)',
              }}>
                {act.descripcion}
              </span>
              {act.obligatoria && !act.completada && (
                <AlertCircle size={14} color="#f87171" style={{ flexShrink: 0 }} title="Obligatoria" />
              )}
              {act.obligatoria && (
                <span style={{ fontSize: 'var(--text-xs)', color: '#ef4444', fontWeight: 600 }}>*</span>
              )}
            </div>
            {act.observacion && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                {act.observacion}
              </p>
            )}
            {act.completada_por && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Completada por #{act.completada_por}
                {act.completada_at && ` - ${new Date(act.completada_at).toLocaleString()}`}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
