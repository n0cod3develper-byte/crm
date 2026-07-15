import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import api from '../../../../lib/api';
import { AlertCircle } from 'lucide-react';

const STATUS_COLORS = {
  'PENDIENTE': '#f59e0b',
  'EN_PROCESO': '#3b82f6',
  'COMPLETADA': '#10b981',
  'CANCELADA': '#ef4444',
  'FACTURADA': '#8b5cf6',
  'LIQUIDADA': '#6366f1',
};

export default function GraficoOrdenesPorEstado({ appliedFilters }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['grafico-ordenes-estado', appliedFilters?.desde, appliedFilters?.hasta],
    queryFn: async () => {
      const res = await api.get('/informes/mantenimiento/ordenes-por-estado', {
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

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <h4 style={{ margin: '0 0 1rem', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
        Órdenes por Estado
      </h4>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.4} />
          <XAxis dataKey="estado" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
          <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: '13px'
            }}
            formatter={(value, name) => [value, 'Cantidad']}
          />
          <Bar dataKey="cantidad" radius={[6, 6, 0, 0]} maxBarSize={60}>
            {chartData.map((entry, idx) => (
              <Cell key={idx} fill={STATUS_COLORS[entry.estado] || '#94a3b8'} />
            ))}
            <LabelList dataKey="cantidad" position="top" fill="var(--text-muted)" fontSize={12} fontWeight={600} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
