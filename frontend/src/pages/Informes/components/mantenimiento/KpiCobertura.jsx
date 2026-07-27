import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layers, Building2, Truck, AlertCircle } from 'lucide-react';
import api from '../../../../lib/api';

function MiniCard({ icon: Icon, iconColor, bgColor, label, value, sub }) {
  return (
    <div style={{
      flex: '1 1 0', minWidth: 0, padding: '1.2rem 1rem',
      background: 'var(--surface-2)', borderRadius: 12,
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.4rem',
      border: '1.5px solid var(--border-subtle)',
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} color={iconColor} />
      </div>
      <p style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
        {value ?? '—'}
      </p>
      <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</p>
      {sub && <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}

// Barra de progreso circular simple
function Gauge({ pct }) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={70} height={70} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={35} cy={35} r={radius} fill="none" stroke="var(--border)" strokeWidth={7} />
      <circle
        cx={35} cy={35} r={radius} fill="none"
        stroke={color} strokeWidth={7}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text x={35} y={39} textAnchor="middle" fill={color} fontSize={12} fontWeight={800}
        style={{ transform: 'rotate(90deg)', transformOrigin: '35px 35px' }}>
        {pct}%
      </text>
    </svg>
  );
}

export default function KpiCobertura({ appliedFilters }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['kpi-cobertura', appliedFilters?.desde, appliedFilters?.hasta],
    queryFn: async () => {
      const res = await api.get('/informes/mantenimiento/cobertura', {
        params: { fecha_inicio: appliedFilters?.desde, fecha_fin: appliedFilters?.hasta }
      });
      return res.data?.data;
    },
    enabled: !!appliedFilters?.desde && !!appliedFilters?.hasta,
  });

  if (isLoading) return <div className="card" style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" /></div>;
  if (error) return (
    <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--clr-danger-500)' }}>
      <AlertCircle size={20} /> <p style={{ margin: 0, fontSize: '0.85rem' }}>Error al cargar Cobertura</p>
    </div>
  );

  const pct = parseFloat(data?.cobertura_equipos_pct || 0);

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.2rem' }}>
        <h4 style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          Indicadores de Cobertura
        </h4>
        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Alcance del servicio en el periodo seleccionado
        </p>
      </div>

      {/* Gauge + stats principales */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Gauge pct={pct} />
          <p style={{ margin: '6px 0 0', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Equipos atendidos<br />
            <strong style={{ color: 'var(--text-primary)' }}>{data?.equipos_atendidos || 0} / {data?.equipos_total || 0}</strong>
          </p>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--surface-2)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Empresas atendidas</span>
            <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{data?.empresas_activas || 0} / {data?.empresas_total || 0}</strong>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--surface-2)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Proveedores activos</span>
            <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{data?.proveedores_activos || 0}</strong>
          </div>
        </div>
      </div>

      {/* Mini-cards */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <MiniCard
          icon={Layers}
          iconColor="#6366f1"
          bgColor="#6366f122"
          label="Equipos en flota"
          value={data?.equipos_total || 0}
          sub="Registrados activos"
        />
        <MiniCard
          icon={Building2}
          iconColor="#0ea5e9"
          bgColor="#0ea5e922"
          label="Clientes activos"
          value={data?.empresas_activas || 0}
          sub={`de ${data?.empresas_total || 0} registradas`}
        />
        <MiniCard
          icon={Truck}
          iconColor="#10b981"
          bgColor="#10b98122"
          label="Proveedores"
          value={data?.proveedores_activos || 0}
          sub="En estado activo"
        />
      </div>
    </div>
  );
}
