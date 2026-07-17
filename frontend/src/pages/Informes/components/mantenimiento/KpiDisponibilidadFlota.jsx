import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLOR_DISPONIBLE = '#4ade80'; // verde brillante ≥ 90%
const COLOR_ADVERTENCIA = '#facc15'; // amarillo 70–89%
const COLOR_DOWNTIME   = '#f87171'; // rojo < 70%

export default function KpiDisponibilidadFlota({ appliedFilters }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['mantenimiento-disponibilidad', appliedFilters],
    queryFn: async () => {
      const params = {};
      if (appliedFilters.desde) params.fecha_inicio = appliedFilters.desde;
      if (appliedFilters.hasta) params.fecha_fin = appliedFilters.hasta;
      const res = await api.get('/informes/mantenimiento/disponibilidad-flota', { params });
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
      Error al cargar métricas de disponibilidad.
    </div>
  );

  const { disponibilidad_porcentaje, top_equipos_downtime } = data;
  const downtime_pct = parseFloat((100 - disponibilidad_porcentaje).toFixed(2));

  const gaugeColor = disponibilidad_porcentaje >= 90
    ? COLOR_DISPONIBLE
    : disponibilidad_porcentaje >= 70
      ? COLOR_ADVERTENCIA
      : COLOR_DOWNTIME;

  const chartData = [
    { name: 'Disponible', value: disponibilidad_porcentaje },
    { name: 'Downtime',   value: downtime_pct }
  ];

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        Disponibilidad de Flota (Downtime)
      </h3>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
        {/* Gauge circular */}
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ height: '170px', width: '170px', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%" cy="50%"
                  innerRadius={58} outerRadius={76}
                  startAngle={90} endAngle={-270}
                  dataKey="value"
                  stroke="none"
                  paddingAngle={2}
                >
                  <Cell fill={gaugeColor} />
                  <Cell fill="#1e293b" />
                </Pie>
                <Tooltip
                  formatter={v => `${v.toFixed(1)}%`}
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Porcentaje central */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none'
            }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: gaugeColor, lineHeight: 1 }}>
                {disponibilidad_porcentaje}%
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>Global</div>
            </div>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>
            *Base 24h × flota
          </p>
        </div>

        {/* Top equipos con downtime */}
        <div style={{ flex: 1, minWidth: '180px' }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Top Equipos en Taller
          </p>
          {top_equipos_downtime.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '0.85rem' }}>Sin downtime registrado en el período.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {top_equipos_downtime.map((eq, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.45rem 0.75rem',
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.18)',
                  borderRadius: '8px'
                }}>
                  <span style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 500 }}>
                    {eq.equipo_nombre}
                  </span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: COLOR_DOWNTIME }}>
                    {eq.downtime_horas}h
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
