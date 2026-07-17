import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { SearchableSelect } from '../../../../components/ui/SearchableSelect';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = [
  '#38bdf8', '#818cf8', '#fb923c', '#4ade80', '#f472b6',
  '#facc15', '#34d399', '#f87171', '#a78bfa', '#60a5fa',
];

function formatCOP(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}
function formatCOPFull(v) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0
  }).format(v || 0);
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{
      background: '#1e293b', border: '1px solid #334155',
      padding: '0.85rem 1rem', borderRadius: '10px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)', minWidth: '210px'
    }}>
      <p style={{ margin: '0 0 0.35rem', fontWeight: 700, color: '#e2e8f0', fontSize: '0.85rem' }}>{label}</p>
      <p style={{ margin: '0.2rem 0', color: '#94a3b8', fontSize: '0.78rem' }}>{d?.empresa_nombre}</p>
      <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #334155' }}>
        <p style={{ margin: '0.15rem 0', color: '#38bdf8', fontSize: '0.82rem' }}>
          Mano de Obra: <strong>{formatCOPFull(d?.total_mano_obra)}</strong>
        </p>
        <p style={{ margin: '0.15rem 0', color: '#fb923c', fontSize: '0.82rem' }}>
          Repuestos: <strong>{formatCOPFull(d?.total_repuestos)}</strong>
        </p>
        <p style={{ margin: '0.3rem 0 0', color: '#4ade80', fontWeight: 700, fontSize: '0.88rem' }}>
          Total: {formatCOPFull(d?.costo_total)}
        </p>
      </div>
    </div>
  );
};

export default function KpiCostoPorEquipo({ appliedFilters }) {
  const [empresaFiltro, setEmpresaFiltro] = useState('');

  const searchCompanies = React.useCallback(async (searchTerm) => {
    const { data } = await api.get('/companies', {
      params: { search: searchTerm || undefined, limit: 20 }
    });
    return data.data || [];
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['mantenimiento-costo-equipo', appliedFilters, empresaFiltro],
    queryFn: async () => {
      const params = {};
      if (appliedFilters.desde) params.fecha_inicio = appliedFilters.desde;
      if (appliedFilters.hasta) params.fecha_fin = appliedFilters.hasta;
      if (empresaFiltro) params.empresa_id = empresaFiltro;
      const res = await api.get('/informes/mantenimiento/costo-por-equipo', { params });
      return res.data.data;
    }
  });

  const chartData = (data || []).map(d => ({
    ...d,
    label: `${d.marca} ${d.modelo}`.trim()
  }));

  const totalCosto = chartData.reduce((s, d) => s + d.costo_total, 0);

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Costo por Equipo
        </h3>
        <div style={{ width: '250px' }}>
          <SearchableSelect
            fetchFn={searchCompanies}
            value={empresaFiltro}
            onChange={val => setEmpresaFiltro(val || '')}
            placeholder="Todas las empresas..."
            noOptionsMessage="No se encontraron empresas"
            name="empresa_id"
          />
        </div>
      </div>

      {/* Resumen */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(56,189,248,0.12), rgba(129,140,248,0.08))',
        border: '1px solid rgba(56,189,248,0.25)',
        borderRadius: '10px', padding: '0.85rem 1.25rem',
        marginBottom: '1.25rem',
        display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Costo Total Período</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>{formatCOP(totalCosto)}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equipos con Costo</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#818cf8' }}>{chartData.length}</div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      ) : chartData.length === 0 ? (
        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
          Sin datos en el período
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.5} />
            <XAxis type="number" tickFormatter={formatCOP} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="costo_total" radius={[0, 4, 4, 0]} maxBarSize={26}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
