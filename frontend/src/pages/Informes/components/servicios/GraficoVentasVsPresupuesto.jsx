import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../../../../lib/api';
import { AlertCircle } from 'lucide-react';

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
}

export default function GraficoVentasVsPresupuesto({ appliedFilters }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['grafico-ventas-vs-presupuesto', appliedFilters?.desde, appliedFilters?.hasta],
    queryFn: async () => {
      const res = await api.get('/informes/servicios/ventas-vs-presupuesto', {
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

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '13px' }}>
          <strong>{label}</strong>
          {payload.map((p, idx) => (
            <div key={idx} style={{ color: p.color, marginTop: 4 }}>
              {p.name}: {formatCOP(p.value)}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <h4 style={{ margin: '0 0 1rem', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
        Ventas Reales vs Presupuesto
      </h4>
      {chartData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin datos disponibles</div>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.4} />
            <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => `$${(v / 1000000).toFixed(0)}M`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              formatter={(value) => (
                <span style={{ color: value === 'real' ? '#6366f1' : '#94a3b8', fontWeight: 600 }}>
                  {value === 'real' ? 'Ventas Reales' : 'Presupuesto'}
                </span>
              )}
            />
            <Bar dataKey="presupuesto" name="presupuesto" fill="#e2e8f0" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="real" name="real" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
