import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';
import api from '../../../../lib/api';

function StatRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

export default function KpiMTTR({ appliedFilters }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['kpi-mttr', appliedFilters?.desde, appliedFilters?.hasta],
    queryFn: async () => {
      const res = await api.get('/informes/mantenimiento/mttr', {
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
      <p style={{ margin: 0, fontSize: '0.85rem' }}>Error al cargar MTTR</p>
    </div>
  );

  const mttr = data?.mttr_horas;
  const sinDatos = mttr === null || mttr === undefined;

  // Clasificación del MTTR: verde < 8h, amarillo 8-24h, rojo > 24h
  const mttrColor = sinDatos ? 'var(--text-muted)' : mttr < 8 ? '#10b981' : mttr < 24 ? '#f59e0b' : '#ef4444';
  const mttrLabel = sinDatos ? '—' : `${mttr}h`;

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h4 style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            MTTR — Tiempo Medio de Reparación
          </h4>
          <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Horas promedio desde apertura hasta liquidación (OTs correctivas)
          </p>
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${mttrColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Clock size={18} color={mttrColor} />
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        <span style={{ fontSize: '2.8rem', fontWeight: 800, color: mttrColor, lineHeight: 1 }}>
          {mttrLabel}
        </span>
        {!sinDatos && (
          <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {mttr < 8 ? '✅ Excelente (< 8h)' : mttr < 24 ? '⚠️ Aceptable (8–24h)' : '🔴 Crítico (> 24h)'}
          </p>
        )}
        {sinDatos && <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sin órdenes correctivas en el periodo</p>}
      </div>

      {!sinDatos && (
        <div style={{ marginTop: '0.75rem' }}>
          <StatRow label="OTs correctivas analizadas" value={data?.total_ots || 0} />
          <StatRow label="Tiempo mínimo" value={`${data?.min_horas}h`} color="#10b981" />
          <StatRow label="Tiempo máximo" value={`${data?.max_horas}h`} color="#ef4444" />
        </div>
      )}
    </div>
  );
}
