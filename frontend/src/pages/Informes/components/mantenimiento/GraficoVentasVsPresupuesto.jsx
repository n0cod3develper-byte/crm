import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLOR_REAL        = '#38bdf8';
const COLOR_PRESUPUESTO = '#f472b6';

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

export default function GraficoVentasVsPresupuesto({ appliedFilters }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['mantenimiento-ventas-vs-presupuesto', appliedFilters],
    queryFn: async () => {
      const params = {};
      if (appliedFilters.desde) params.fecha_inicio = appliedFilters.desde;
      if (appliedFilters.hasta) params.fecha_fin = appliedFilters.hasta;
      const res = await api.get('/informes/mantenimiento/ventas-vs-presupuesto', { params });
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

  const chartData = data.map(item => ({
    name: item.linea_negocio,
    Real: item.real,
    Presupuesto: item.presupuesto,
    cumplimiento_pct: item.cumplimiento_pct
  }));

  // Totales consolidados del período
  const totalReal        = data.reduce((s, i) => s + i.real, 0);
  const totalPresupuesto = data.reduce((s, i) => s + i.presupuesto, 0);
  const cumplimientoTotal = totalPresupuesto > 0
    ? parseFloat(((totalReal / totalPresupuesto) * 100).toFixed(1))
    : null;

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        Ventas Reales vs. Presupuesto
      </h3>

      {/* ── Tarjetas de totales ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {/* Presupuesto Total */}
        <div style={{
          padding: '0.85rem 1rem',
          background: 'rgba(244,114,182,0.08)',
          border: '1px solid rgba(244,114,182,0.25)',
          borderRadius: '10px'
        }}>
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.7rem', fontWeight: 600, color: '#f472b6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Presupuesto
          </p>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#fce7f3', lineHeight: 1.2 }}>
            {formatCOPFull(totalPresupuesto)}
          </p>
        </div>

        {/* Real Total */}
        <div style={{
          padding: '0.85rem 1rem',
          background: 'rgba(56,189,248,0.08)',
          border: '1px solid rgba(56,189,248,0.25)',
          borderRadius: '10px'
        }}>
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.7rem', fontWeight: 600, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Ventas Reales
          </p>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#e0f2fe', lineHeight: 1.2 }}>
            {formatCOPFull(totalReal)}
          </p>
        </div>

        {/* % Cumplimiento */}
        <div style={{
          padding: '0.85rem 1rem',
          background: cumplimientoTotal == null
            ? 'rgba(100,116,139,0.08)'
            : cumplimientoTotal >= 100
              ? 'rgba(74,222,128,0.08)'
              : 'rgba(251,146,60,0.08)',
          border: `1px solid ${
            cumplimientoTotal == null
              ? 'rgba(100,116,139,0.25)'
              : cumplimientoTotal >= 100
                ? 'rgba(74,222,128,0.25)'
                : 'rgba(251,146,60,0.25)'
          }`,
          borderRadius: '10px'
        }}>
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.7rem', fontWeight: 600,
            color: cumplimientoTotal == null ? '#64748b' : cumplimientoTotal >= 100 ? '#4ade80' : '#fb923c',
            textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Cumplimiento
          </p>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, lineHeight: 1.2,
            color: cumplimientoTotal == null ? '#64748b' : cumplimientoTotal >= 100 ? '#bbf7d0' : '#fed7aa' }}>
            {cumplimientoTotal != null ? `${cumplimientoTotal}%` : '—'}
          </p>
        </div>
      </div>

      {/* ── Gráfico ── */}
      {chartData.length === 0 ? (
        <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
          Sin órdenes liquidadas en el período
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 16, right: 20, left: 10, bottom: 5 }} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.6} />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
            <YAxis tickFormatter={formatCOP} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '13px', color: '#cbd5e1' }} />
            <Bar dataKey="Presupuesto" fill={COLOR_PRESUPUESTO} radius={[4, 4, 0, 0]} maxBarSize={55} />
            <Bar dataKey="Real"        fill={COLOR_REAL}        radius={[4, 4, 0, 0]} maxBarSize={55} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
