import React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users, Clock, AlertTriangle, Award,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import api from '../../../../lib/api';

/* ─── Helpers ─────────────────────────────────────────────── */
const fmt = (n) => {
  const num = parseFloat(n);
  if (isNaN(num)) return '$0';
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${Math.round(num).toLocaleString('es-CO')}`;
  return `$${num.toLocaleString('es-CO')}`;
};

/* ─── KPI Card ────────────────────────────────────────────── */
function KpiCard({ label, value, delta, deltaType, icon: Icon, color, href }) {
  const navigate = useNavigate();
  const Comp = href ? 'a' : 'div';
  return (
    <Comp
      className="kpi-card"
      {...(href ? { href, onClick: (e) => { e.preventDefault(); navigate(href); }, style: { cursor: 'pointer', textDecoration: 'none', display: 'block' } } : {})}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="kpi-label">{label}</span>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={color} />
        </div>
      </div>
      <div className="kpi-value">{value}</div>
      {delta && (
        <div className={`kpi-delta kpi-delta--${deltaType}`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {deltaType === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {delta}
        </div>
      )}
    </Comp>
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB GESTIÓN HUMANA
   ═══════════════════════════════════════════════════════════ */
export default function TabGestionHumana({ fechaDesde, fechaHasta }) {
  const navigate = useNavigate();

  const fechaParams = {};
  if (fechaDesde) fechaParams.fecha_desde = fechaDesde;
  if (fechaHasta) fechaParams.fecha_hasta = fechaHasta;
  const fechaQuery = new URLSearchParams(fechaParams).toString();
  const apiUrl = `/dashboard/gerencia/gestion-humana${fechaQuery ? `?${fechaQuery}` : ''}`;

  const { data: kpis, isLoading, isError } = useQuery({
    queryKey: ['dashboard-gerencia-gh', fechaDesde, fechaHasta],
    queryFn: () => api.get(apiUrl).then(r => r.data.data),
    placeholderData: keepPreviousData,
    refetchInterval: 120_000,
    enabled: true,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="kpi-card" style={{ minHeight: 120 }}>
            <div className="spinner" style={{ margin: '2rem auto' }} />
          </div>
        ))}
      </div>
    );
  }

  if (isError || !kpis) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Error al cargar datos de Gestión Humana</div>;
  }

  const { llamados_felicitaciones, horas_extra, empleados_activos } = kpis;
  const { llamados_atencion, felicitaciones, ratio } = llamados_felicitaciones;

  // Determinar si el ratio es positivo o preocupante
  const ratioEsPositivo = ratio <= 1;

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard
          label="Llamados de atención"
          value={String(llamados_atencion)}
          delta={`${felicitaciones} felicitaciones registradas`}
          deltaType={llamados_atencion <= felicitaciones ? 'up' : 'down'}
          icon={AlertTriangle} color="#f59e0b"
          href="/employees"
        />

        <KpiCard
          label="Felicitaciones"
          value={String(felicitaciones)}
          delta={ratio !== Infinity ? `Ratio llamados/felicitaciones: ${ratio}` : 'Sin felicitaciones'}
          deltaType="up"
          icon={Award} color="#22c55e"
          href="/employees"
        />

        <KpiCard
          label="Horas extra liquidadas"
          value={fmt(horas_extra.total_liquidado)}
          delta={`${horas_extra.total_horas}h · ${horas_extra.empleados_con_he} empleados`}
          deltaType="up"
          icon={Clock} color="#6366f1"
          href="/horas-extras/configuracion"
        />

        <KpiCard
          label="Empleados activos"
          value={String(empleados_activos)}
          delta="Total en nómina"
          deltaType="up"
          icon={Users} color="#ec4899"
          href="/employees"
        />
      </div>

      {/* Detalle */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {/* Llamados vs Felicitaciones */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '1rem' }}>
            Llamados de atención vs Felicitaciones
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', justifyContent: 'center', padding: '1rem 0' }}>
            {/* Llamados */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'rgba(245,158,11,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 0.5rem',
              }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>{llamados_atencion}</span>
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Llamados</div>
            </div>

            {/* Divider */}
            <div style={{
              width: 1, height: 60, background: 'var(--border-color)',
            }} />

            {/* Felicitaciones */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'rgba(34,197,94,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 0.5rem',
              }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#22c55e' }}>{felicitaciones}</span>
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Felicitaciones</div>
            </div>
          </div>

          {/* Indicador */}
          <div style={{
            textAlign: 'center', padding: '0.75rem',
            background: ratioEsPositivo ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            borderRadius: 'var(--radius-md)',
            marginTop: '0.5rem',
          }}>
            <span style={{
              fontSize: 'var(--text-xs)', fontWeight: 600,
              color: ratioEsPositivo ? '#22c55e' : '#ef4444',
            }}>
              {ratioEsPositivo ? '✓ Más felicitaciones que llamados' : '⚠ Más llamados que felicitaciones'}
            </span>
          </div>
        </div>

        {/* Top operarios con horas extra */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '1rem' }}>
            Top operarios con horas extra
          </h3>
          {horas_extra.top_operarios.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: '1rem 0' }}>
              No hay horas extra registradas en el período
            </p>
          ) : (
            <div>
              {horas_extra.top_operarios.map((op, i) => {
                const maxHoras = horas_extra.top_operarios[0]?.horas || 1;
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.5rem 0',
                    borderBottom: i < horas_extra.top_operarios.length - 1 ? '1px solid var(--border-color)' : 'none',
                  }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#cd7f32' : 'var(--bg-elevated)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 'var(--text-xs)', fontWeight: 700, color: i < 3 ? '#fff' : 'var(--text-muted)',
                      flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {op.nombre}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 2 }}>
                        <div style={{ flex: 1, height: 4, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', width: `${Math.max((op.horas / maxHoras) * 100, 2)}%`,
                            background: '#6366f1', borderRadius: 'var(--radius-full)',
                          }} />
                        </div>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>
                          {op.horas}h
                        </span>
                      </div>
                    </div>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {fmt(op.liquidado)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
