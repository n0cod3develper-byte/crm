import { Package } from 'lucide-react';

export function InsumosList({ insumos, showUsado = false }) {
  if (!insumos?.length) {
    return (
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
        No hay insumos registrados
      </p>
    );
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Insumo</th>
            <th style={{ textAlign: 'right' }}>Cant.</th>
            <th>Unidad</th>
            {showUsado && <th style={{ textAlign: 'right' }}>Usado</th>}
          </tr>
        </thead>
        <tbody>
          {insumos.map((ins) => (
            <tr key={ins.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Package size={14} color="var(--text-muted)" />
                  {ins.producto_id ? (
                    <span>Producto #{ins.producto_id}</span>
                  ) : (
                    <span style={{ fontStyle: 'italic' }}>{ins.descripcion_libre || '—'}</span>
                  )}
                </div>
              </td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                {ins.cantidad || ins.cantidad_planificada || '—'}
              </td>
              <td style={{ color: 'var(--text-secondary)' }}>
                {ins.unidad || '—'}
              </td>
              {showUsado && (
                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                  {ins.cantidad_usada ?? '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
