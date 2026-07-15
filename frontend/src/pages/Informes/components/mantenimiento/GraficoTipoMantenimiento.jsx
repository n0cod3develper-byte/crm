import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../../../../lib/api';
import { AlertCircle } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function GraficoTipoMantenimiento({ appliedFilters }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['grafico-tipo-mantenimiento', appliedFilters?.desde, appliedFilters?.hasta],
    queryFn: async () => {
      const res = await api.get('/informes/mantenimiento/tipo-mantenimiento', {
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

  const chartData = data?.data || [];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload?.length) {
      const d = payload[0].payload;
      const total = chartData.reduce((s, i) => s + i.cantidad, 0);
      const pct = total > 0 ? ((d.cantidad / total) * 100).toFixed(1) : 0;
      return (
        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
          borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '13px'
        }}>
          <strong>{d.tipo}</strong>
          <div style={{ marginTop: 4 }}>{d.cantidad} órdenes ({pct}%)</div>
        </div>
      );
    }
    return null;
  };

  const renderLegend = ({ payload }) => (
    <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
      {payload.map((entry, idx) => (
        <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--text-secondary)' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color, display: 'inline-block' }} />
          {entry.value}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <h4 style={{ margin: '0 0 1rem', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
        Distribución por Tipo de Mantenimiento
      </h4>
      {chartData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin datos</div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={chartData} dataKey="cantidad" nameKey="tipo" cx="50%" cy="50%" outerRadius={90} innerRadius={40}
              paddingAngle={3} label={({ tipo, cantidad }) => `${tipo}: ${cantidad}`}
              labelLine={{ stroke: 'var(--text-muted)', strokeWidth: 1 }}
            >
              {chartData.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={renderLegend} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
