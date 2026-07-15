import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import api from '../../../../lib/api';
import { AlertCircle } from 'lucide-react';

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#10b981', '#34d399', '#6ee7b7', '#f59e0b', '#fbbf24'];

export default function GraficoEquiposMasMantenimientos({ appliedFilters }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['grafico-equipos-mantenimientos', appliedFilters?.desde, appliedFilters?.hasta],
    queryFn: async () => {
      const res = await api.get('/informes/mantenimiento/equipos-mas-mantenimientos', {
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

  const chartData = data?.data?.slice(0, 10) || [];

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <h4 style={{ margin: '0 0 1rem', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
        Top 10 Equipos con Más Mantenimientos
      </h4>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 40, left: 120, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.4} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
          <YAxis dataKey="nombre" type="category" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={110} />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: '13px'
            }}
            formatter={(value, name) => [value, name === 'total_ordenes' ? 'Órdenes' : value]}
          />
          <Bar dataKey="total_ordenes" radius={[0, 6, 6, 0]} maxBarSize={30}>
            {chartData.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
            <LabelList dataKey="total_ordenes" position="right" fill="var(--text-muted)" fontSize={11} fontWeight={600} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
