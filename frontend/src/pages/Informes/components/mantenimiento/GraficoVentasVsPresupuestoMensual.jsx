import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../../lib/api';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLOR_REAL        = '#38bdf8'; // sky-400 (Línea de Ventas Reales)
const COLOR_PRESUPUESTO = '#f472b6'; // pink-400 (Barras de Presupuesto)

function formatCOP(value) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function formatCOPFull(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(value || 0);
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const cumplimiento = payload[0]?.payload?.cumplimiento_pct;
  return (
    <div style={{
      background: '#1e293b', border: '1px solid #334155',
      padding: '0.85rem 1rem', borderRadius: '10px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)', minWidth: '200px'
    }}>
      <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: '#e2e8f0' }}>{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ margin: '0.2rem 0', color: entry.color, fontWeight: 600, fontSize: '0.9rem' }}>
          {entry.name}: {formatCOPFull(entry.value)}
        </p>
      ))}
      {cumplimiento != null && (
        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #334155', fontSize: '0.82rem', color: '#94a3b8' }}>
          Cumplimiento: <strong style={{ color: cumplimiento >= 100 ? '#4ade80' : '#fb923c' }}>{cumplimiento}%</strong>
        </div>
      )}
    </div>
  );
};

export default function GraficoVentasVsPresupuestoMensual({ appliedFilters }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['mantenimiento-ventas-vs-presupuesto-mensual', appliedFilters],
    queryFn: async () => {
      const params = {};
      if (appliedFilters.desde) params.fecha_inicio = appliedFilters.desde;
      if (appliedFilters.hasta) params.fecha_fin = appliedFilters.hasta;
      const res = await api.get('/informes/mantenimiento/ventas-vs-presupuesto-mensual', { params });
      return res.data.data;
    }
  });

  if (isLoading) return (
    <div className="card" style={{ padding: '1.5rem', minHeight: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  );

  if (isError || !data) return (
    <div className="card" style={{ padding: '1.5rem', minHeight: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
      No hay datos disponibles para este período.
    </div>
  );

  // Formatear mes de YYYY-MM a "Ene 2026"
  const chartData = data.map(item => {
    const date = new Date(`${item.mes}-01T00:00:00`);
    const mesFormat = date.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
    return {
      mesLabel: mesFormat.charAt(0).toUpperCase() + mesFormat.slice(1),
      Real: item.real,
      Presupuesto: item.presupuesto,
      cumplimiento_pct: item.cumplimiento_pct
    };
  });

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        Evolución Mensual: Ventas vs Presupuesto
      </h3>
      {chartData.length === 0 ? (
        <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
          Sin datos en el período
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.6} />
            <XAxis dataKey="mesLabel" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
            <YAxis tickFormatter={formatCOP} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '13px', color: '#cbd5e1' }} />
            <Bar dataKey="Presupuesto" fill={COLOR_PRESUPUESTO} radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Line type="monotone" dataKey="Real" stroke={COLOR_REAL} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
