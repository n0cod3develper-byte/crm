import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api from '../../../../lib/api';
import { AlertCircle } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#ef4444'];

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    const { name, value, payload: item } = payload[0];
    const total = item.total;
    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
    return (
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '0.65rem 0.9rem',
        fontSize: '13px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, color: 'var(--text-primary)' }}>{name}</p>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{formatCOP(value)}</p>
        <p style={{ margin: '2px 0 0', color: payload[0].fill, fontWeight: 600 }}>{pct}% del total</p>
      </div>
    );
  }
  return null;
};

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null; // no mostrar etiqueta si es menor al 5%
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
      fontSize={12} fontWeight={700} style={{ pointerEvents: 'none' }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function GraficoVentasPorLinea({ appliedFilters }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['grafico-ventas-linea', appliedFilters?.desde, appliedFilters?.hasta],
    queryFn: async () => {
      const res = await api.get('/informes/servicios/ventas-por-linea', {
        params: { fecha_inicio: appliedFilters?.desde, fecha_fin: appliedFilters?.hasta }
      });
      return res.data;
    },
    enabled: !!appliedFilters?.desde && !!appliedFilters?.hasta,
  });

  if (isLoading) return <div className="card" style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" /></div>;
  if (error) return (
    <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--clr-danger-500)' }}>
      <AlertCircle size={20} style={{ marginBottom: '0.5rem' }} />
      <p style={{ margin: 0, fontSize: '0.85rem' }}>Error al cargar datos</p>
    </div>
  );

  const rawData = data?.data || [];
  const total = rawData.reduce((s, r) => s + r.total_ventas, 0);
  // Añadimos total a cada entry para usarlo en el tooltip
  const chartData = rawData.map(r => ({ ...r, name: r.nombre, value: r.total_ventas, total }));

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
          Ventas por Línea de Servicio
        </h4>
        {total > 0 && (
          <span style={{
            fontSize: '12px', color: 'var(--text-muted)',
            background: 'var(--bg-muted)', borderRadius: '20px',
            padding: '2px 10px', fontWeight: 600,
          }}>
            Total: {formatCOP(total)}
          </span>
        )}
      </div>

      {chartData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin datos disponibles</div>
      ) : (
        <>
          <div style={{ position: 'relative' }}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                  dataKey="value"
                  labelLine={false}
                  label={renderCustomLabel}
                  animationBegin={0}
                  animationDuration={700}
                >
                  {chartData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Total central en el donut */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none'
            }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: 500 }}>
                Total
              </span>
              <strong style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 700 }}>
                {formatCOP(total)}
              </strong>
            </div>
          </div>

          {/* Desglose de valores y porcentajes por línea */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
            {chartData.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '8px',
                  background: 'var(--bg-muted, rgba(0,0,0,0.03))',
                  fontSize: '12.5px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: COLORS[idx % COLORS.length],
                    flexShrink: 0, display: 'inline-block'
                  }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.nombre}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCOP(item.value)}
                  </strong>
                  <span style={{
                    color: 'var(--text-muted)',
                    fontSize: '11px',
                    background: 'var(--bg-elevated)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontWeight: 600
                  }}>
                    {total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
