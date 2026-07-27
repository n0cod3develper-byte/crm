import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, AlertTriangle, ArrowRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../../lib/api';

export default function AlertaStockBajo() {
  const navigate = useNavigate();

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['stock-bajo-activo'],
    queryFn: async () => {
      const res = await api.get('/informes/mantenimiento/stock-bajo-activo');
      return res.data?.data || [];
    },
    staleTime: 3 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const hayCriticos = data.some(item => parseInt(item.deficit) > 5);

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: hayCriticos ? '#ef444422' : '#f59e0b22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={18} color={hayCriticos ? '#ef4444' : '#f59e0b'} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Stock Bajo en OTs Activas
              {hayCriticos && <AlertTriangle size={14} color="#ef4444" />}
            </h4>
            <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {data.length} repuesto{data.length !== 1 ? 's' : ''} con stock ≤ mínimo en órdenes abiertas
            </p>
          </div>
        </div>
      </div>

      {/* Contenido */}
      {isLoading && <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" /></div>}
      {error && (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--clr-danger-500)' }}>
          <AlertCircle size={18} /> <span style={{ fontSize: '0.85rem' }}>Error al cargar</span>
        </div>
      )}
      {!isLoading && !error && data.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          <Package size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
          <p style={{ margin: 0, fontSize: '0.85rem' }}>✅ Stock suficiente en todas las OTs activas</p>
        </div>
      )}

      {!isLoading && !error && data.length > 0 && (
        <>
          {/* Tabla de ítems */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 4px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>Ítem</th>
                  <th style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>Stock</th>
                  <th style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>Mín</th>
                  <th style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>Déficit</th>
                  <th style={{ textAlign: 'left', padding: '6px 4px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>OTs</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => {
                  const deficit = parseFloat(item.deficit);
                  const esCritico = deficit > 5;
                  return (
                    <tr key={item.item_id} style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: esCritico ? '#ef444408' : 'transparent',
                    }}>
                      <td style={{ padding: '8px 4px' }}>
                        <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                          {item.nombre}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)' }}>{item.codigo_interno}</p>
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: '#ef4444' }}>
                        {item.stock_actual}
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {item.stock_minimo}
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                          background: esCritico ? '#ef444422' : '#f59e0b22',
                          color: esCritico ? '#ef4444' : '#f59e0b',
                          fontWeight: 700, fontSize: '0.75rem',
                        }}>
                          -{deficit}
                        </span>
                      </td>
                      <td style={{ padding: '8px 4px', fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.ots_consecutivos}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            onClick={() => navigate('/inventario')}
            style={{
              marginTop: '1rem', width: '100%', padding: '8px', borderRadius: 8,
              border: '1.5px solid var(--border)', background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600,
            }}
          >
            Ir a Inventario <ArrowRight size={14} />
          </button>
        </>
      )}
    </div>
  );
}
