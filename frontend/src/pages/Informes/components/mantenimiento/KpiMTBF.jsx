import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Zap, AlertCircle } from 'lucide-react';
import api from '../../../../lib/api';

function StatRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

export default function KpiMTBF({ appliedFilters }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['kpi-mtbf', appliedFilters?.desde, appliedFilters?.hasta],
    queryFn: async () => {
      const res = await api.get('/informes/mantenimiento/mtbf', {
        params: { fecha_inicio: appliedFilters?.desde, fecha_fin: appliedFilters?.hasta }
      });
      return res.data?.data;
    },
    enabled: !!appliedFilters?.desde && !!appliedFilters?.hasta,
  });

  if (isLoading) return <div className="card" style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" /></div>;
  if (error) return (
    <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--clr-danger-500)' }}>
      <AlertCircle size={20} style={{ marginBottom: '0.5rem' }} />
      <p style={{ margin: 0, fontSize: '0.85rem' }}>Error al cargar MTBF</p>
    </div>
  );

  const mtbf = data?.mtbf_dias_promedio;
  const sinDatos = mtbf === null || mtbf === undefined;

  // Cuanto más alto el MTBF, más tiempo pasa entre fallas = mejor
  const mtbfColor = sinDatos ? 'var(--text-muted)' : mtbf >= 30 ? '#10b981' : mtbf >= 14 ? '#f59e0b' : '#ef4444';
  const mtbfLabel = sinDatos ? '—' : `${mtbf} días`;

  const porEquipo = Array.isArray(data?.por_equipo) ? data.por_equipo.slice(0, 5) : [];

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h4 style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            MTBF — Tiempo Medio Entre Fallas
          </h4>
          <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Días promedio entre fallas correctivas por equipo
          </p>
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${mtbfColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={18} color={mtbfColor} />
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        <span style={{ fontSize: '2.8rem', fontWeight: 800, color: mtbfColor, lineHeight: 1 }}>
          {mtbfLabel}
        </span>
        {!sinDatos && (
          <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {mtbf >= 30 ? '✅ Confiabilidad alta (≥ 30 días)' : mtbf >= 14 ? '⚠️ Confiabilidad media (14–30 días)' : '🔴 Confiabilidad baja (< 14 días)'}
          </p>
        )}
        {sinDatos && <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Insuficientes fallas consecutivas para calcular</p>}
      </div>

      {!sinDatos && (
        <div style={{ marginTop: '0.75rem' }}>
          <StatRow label="Equipos con fallas recurrentes" value={data?.equipos_con_fallas || 0} />
          <StatRow label="MTBF mínimo (peor equipo)" value={`${data?.mtbf_min} días`} color="#ef4444" />
          <StatRow label="MTBF máximo (mejor equipo)" value={`${data?.mtbf_max} días`} color="#10b981" />
        </div>
      )}

      {porEquipo.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <p style={{ margin: '0 0 6px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Peor MTBF por equipo
          </p>
          {porEquipo.map((eq, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {eq.equipo}
              </span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: eq.mtbf_dias < 14 ? '#ef4444' : eq.mtbf_dias < 30 ? '#f59e0b' : '#10b981' }}>
                {eq.mtbf_dias}d
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
