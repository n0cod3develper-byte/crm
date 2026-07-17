import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList
} from 'recharts';

// Un color vibrante distinto para cada técnico
const BAR_COLORS = [
  '#a78bfa', '#38bdf8', '#34d399', '#facc15',
  '#fb923c', '#f472b6', '#60a5fa', '#4ade80',
  '#e879f9', '#818cf8'
];

export default function GraficoHorasTecnicos({ appliedFilters }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['mantenimiento-horas-tecnicos', appliedFilters],
    queryFn: async () => {
      const params = {};
      if (appliedFilters.desde) params.fecha_inicio = appliedFilters.desde;
      if (appliedFilters.hasta) params.fecha_fin = appliedFilters.hasta;
      const res = await api.get('/informes/mantenimiento/horas-tecnicos', { params });
      return res.data.data;
    }
  });

  if (isLoading) return (
    <div className="card" style={{ padding: '1.5rem', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  );

  if (isError || !data) return (
    <div className="card" style={{ padding: '1.5rem', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
      No hay registros de tiempo en el período.
    </div>
  );

  const chartData = data.map(item => ({
    name: item.tecnico.split(' ').slice(0, 2).join(' '),
    Horas: item.total_horas,
    ordenes: item.total_ordenes
  }));

  if (chartData.length === 0) return (
    <div className="card" style={{ padding: '1.5rem', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
      Sin técnicos con tiempo registrado en el período
    </div>
  );

  const barHeight = Math.max(chartData.length * 52, 220);

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        Técnicos (Horas Laboradas)
      </h3>
      <ResponsiveContainer width="100%" height={barHeight}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 5, right: 65, left: 10, bottom: 5 }}
          barCategoryGap="30%"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.5} />
          <XAxis
            type="number"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false} tickLine={false}
            tickFormatter={v => `${v}h`}
          />
          <YAxis
            dataKey="name" type="category"
            tick={{ fill: '#cbd5e1', fontSize: 12, fontWeight: 500 }}
            axisLine={false} tickLine={false}
            width={95}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            contentStyle={{
              background: '#1e293b', border: '1px solid #334155',
              borderRadius: '10px', fontSize: '13px', color: '#e2e8f0'
            }}
            formatter={(value, _name, props) => [`${value}h (${props.payload.ordenes} OT)`, 'Horas']}
          />
          <Bar dataKey="Horas" radius={[0, 6, 6, 0]} maxBarSize={32}>
            {chartData.map((_, idx) => (
              <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
            ))}
            <LabelList
              dataKey="Horas"
              position="right"
              formatter={v => `${v}h`}
              style={{ fill: '#e2e8f0', fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
