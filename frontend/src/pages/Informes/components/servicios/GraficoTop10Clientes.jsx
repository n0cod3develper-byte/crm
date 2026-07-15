import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList
} from 'recharts';
import api from '../../../../lib/api';
import { AlertCircle, Building2 } from 'lucide-react';

const COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa',
  '#10b981', '#34d399', '#6ee7b7',
  '#f59e0b', '#fbbf24', '#ec4899', '#14b8a6',
];

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(v || 0);
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    const item = payload[0].payload;
    return (
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '0.7rem 1rem',
        fontSize: '13px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
        minWidth: 200,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Building2 size={14} style={{ color: payload[0].fill }} />
          <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{label}</strong>
        </div>
        <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>
          💰 {formatCOP(item.total_ventas)}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
          📋 {item.total_remisiones} remisión{item.total_remisiones !== 1 ? 'es' : ''}
        </div>
      </div>
    );
  }
  return null;
};

export default function GraficoTop10Clientes({ appliedFilters }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['grafico-top10-clientes', appliedFilters?.desde, appliedFilters?.hasta],
    queryFn: async () => {
      const res = await api.get('/informes/servicios/top-clientes', {
        params: { fecha_inicio: appliedFilters?.desde, fecha_fin: appliedFilters?.hasta }
      });
      return res.data;
    },
    enabled: !!appliedFilters?.desde && !!appliedFilters?.hasta,
  });

  if (isLoading) return (
    <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
      <div className="spinner" />
    </div>
  );

  if (error) return (
    <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--clr-danger-500)' }}>
      <AlertCircle size={20} style={{ marginBottom: '0.5rem' }} />
      <p style={{ margin: 0, fontSize: '0.85rem' }}>Error al cargar datos</p>
    </div>
  );

  const chartData = data?.data || [];
  const totalGlobal = chartData.reduce((s, r) => s + r.total_ventas, 0);

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            borderRadius: '8px', padding: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Building2 size={16} color="#fff" />
          </div>
          <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            Top 10 Clientes por Ventas
          </h4>
        </div>
        {totalGlobal > 0 && (
          <span style={{
            fontSize: '12px', color: 'var(--text-muted)',
            background: 'var(--bg-muted)', borderRadius: '20px',
            padding: '2px 10px', fontWeight: 500,
          }}>
            Total: {formatCOP(totalGlobal)}
          </span>
        )}
      </div>

      {chartData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          Sin datos disponibles para el período seleccionado
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={360}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 70, left: 140, bottom: 4 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-color)"
              opacity={0.35}
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickFormatter={v => `$${(v / 1000000).toFixed(0)}M`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              dataKey="nombre"
              type="category"
              tick={{ fontSize: 11, fill: 'var(--text-secondary)', fontWeight: 500 }}
              width={130}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-muted)', opacity: 0.5 }} />
            <Bar dataKey="total_ventas" radius={[0, 8, 8, 0]} maxBarSize={28} animationDuration={600}>
              {chartData.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
              <LabelList
                dataKey="total_ventas"
                position="right"
                style={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}
                formatter={v => `$${(v / 1000000).toFixed(1)}M`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
