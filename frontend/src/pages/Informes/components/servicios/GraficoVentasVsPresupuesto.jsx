import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import api from '../../../../lib/api';
import { AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const MESES_ES = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(v || 0);
}

function formatMes(mesStr) {
  // mesStr = "2026-07"
  const [year, month] = mesStr.split('-');
  return `${MESES_ES[month] || month} ${year}`;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    const dataPoint = payload[0]?.payload || {};
    const real        = dataPoint.real        || 0;
    const presupuesto = dataPoint.presupuesto || 0;
    const pct         = dataPoint.cumplimiento_pct;
    const diff        = real - presupuesto;
    const overBudget  = diff >= 0;

    return (
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '0.85rem 1.1rem',
        fontSize: '13px',
        boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
        minWidth: 220,
      }}>
        <p style={{ margin: '0 0 8px', fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px' }}>
          {formatMes(label)}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <span style={{ color: '#6366f1', fontWeight: 600 }}>● Ventas Reales</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{formatCOP(real)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <span style={{ color: '#94a3b8', fontWeight: 600 }}>● Presupuesto</span>
            <span style={{ color: 'var(--text-secondary)' }}>{formatCOP(presupuesto)}</span>
          </div>
          {presupuesto > 0 && (
            <>
              <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <span style={{ color: 'var(--text-muted)' }}>Diferencia</span>
                <span style={{
                  fontWeight: 700,
                  color: overBudget ? '#10b981' : '#ef4444',
                }}>
                  {overBudget ? '+' : ''}{formatCOP(diff)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <span style={{ color: 'var(--text-muted)' }}>Cumplimiento</span>
                <span style={{
                  fontWeight: 800,
                  fontSize: '14px',
                  color: pct >= 100 ? '#10b981' : pct >= 80 ? '#f59e0b' : '#ef4444',
                }}>
                  {pct}%
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
  return null;
};

function KpiCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div style={{
      background: 'var(--bg-muted)',
      borderRadius: '10px',
      padding: '0.75rem 1rem',
      flex: '1 1 150px',
      minWidth: 140,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {Icon && <Icon size={14} style={{ color }} />}
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: '17px', fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
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

  // El backend devuelve { data: [...] } con { mes, real, presupuesto, cumplimiento_pct }
  const chartData = (data?.data || []).map(r => ({ ...r, mes_label: formatMes(r.mes) }));

  // KPIs consolidados
  const totalReal        = chartData.reduce((s, r) => s + r.real, 0);
  const totalPresupuesto = chartData.reduce((s, r) => s + r.presupuesto, 0);
  const cumplimientoGlobal = totalPresupuesto > 0
    ? Math.round((totalReal / totalPresupuesto) * 100)
    : null;
  const diferencia = totalReal - totalPresupuesto;

  const KpiIcon = cumplimientoGlobal === null
    ? Minus
    : cumplimientoGlobal >= 100
    ? TrendingUp
    : TrendingDown;

  const kpiColor = cumplimientoGlobal === null
    ? 'var(--text-muted)'
    : cumplimientoGlobal >= 100
    ? '#10b981'
    : cumplimientoGlobal >= 80
    ? '#f59e0b'
    : '#ef4444';

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
          Ventas Reales vs Presupuesto — Área Servicios
        </h4>
        {totalPresupuesto > 0 && (
          <span style={{
            fontSize: '11px', color: 'var(--text-muted)',
            background: 'var(--bg-muted)', borderRadius: '20px',
            padding: '2px 10px', fontWeight: 500,
          }}>
            Presupuesto área Servicios
          </span>
        )}
      </div>

      {/* KPIs */}
      {chartData.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <KpiCard
            label="Ventas Reales"
            value={formatCOP(totalReal)}
            color="#6366f1"
            icon={TrendingUp}
          />
          <KpiCard
            label="Presupuesto"
            value={formatCOP(totalPresupuesto)}
            sub={totalPresupuesto === 0 ? 'Sin presupuesto registrado' : undefined}
            color="#94a3b8"
            icon={Minus}
          />
          {cumplimientoGlobal !== null && (
            <KpiCard
              label="Cumplimiento"
              value={`${cumplimientoGlobal}%`}
              sub={diferencia >= 0 ? `+${formatCOP(diferencia)} sobre meta` : `${formatCOP(diferencia)} bajo meta`}
              color={kpiColor}
              icon={KpiIcon}
            />
          )}
        </div>
      )}

      {chartData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
          Sin datos disponibles para el período seleccionado
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.35} />
            <XAxis
              dataKey="mes"
              tickFormatter={v => formatMes(v)}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickFormatter={v => `$${(v / 1000000).toFixed(0)}M`}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-muted)', opacity: 0.4 }} />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              formatter={value => (
                <span style={{
                  color: value === 'real' ? '#6366f1' : '#94a3b8',
                  fontWeight: 600,
                }}>
                  {value === 'real' ? 'Ventas Reales' : 'Presupuesto'}
                </span>
              )}
            />
            {/* Presupuesto como barra de fondo (gris) */}
            <Bar
              dataKey="presupuesto"
              name="presupuesto"
              fill="#e2e8f0"
              radius={[5, 5, 0, 0]}
              maxBarSize={48}
            />
            {/* Ventas reales como barra superpuesta */}
            <Bar
              dataKey="real"
              name="real"
              fill="#6366f1"
              radius={[5, 5, 0, 0]}
              maxBarSize={48}
            />
            {/* Línea de referencia en 100% (cuando presupuesto coincide con real) */}
            {totalPresupuesto > 0 && (
              <Line
                type="monotone"
                dataKey="presupuesto"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                name="__hidden__"
                legendType="none"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
