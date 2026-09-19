import React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Wrench, AlertTriangle, CheckCircle, TrendingUp,
  ArrowUpRight, ArrowDownRight, BarChart3,
} from 'lucide-react';
import api from '../../../../lib/api';
import GaugeCard from './GaugeCard';

/* ─── Helpers ─────────────────────────────────────────────── */
const getCumplimientoColor = (pct) => {
  if (pct == null) return 'var(--text-muted)';
  if (pct >= 95) return '#22c55e';
  if (pct >= 80) return '#f59e0b';
  return '#ef4444';
};

const fmt = (n) => {
  const num = parseFloat(n);
  if (isNaN(num)) return '$0';
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${Math.round(num).toLocaleString('es-CO')}`;
  return `$${num.toLocaleString('es-CO')}`;
};

const ESTADO_COLORS = {
  ABIERTA:    { bg: '#6366f1', label: 'Abiertas' },
  EN_PROCESO: { bg: '#f59e0b', label: 'En Proceso' },
  CERRADA:    { bg: '#6b7280', label: 'Cerradas' },
  LIQUIDADA:  { bg: '#10b981', label: 'Liquidadas' },
  ANULADA:    { bg: '#ef4444', label: 'Anuladas' },
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
   TAB MANTENIMIENTO
   ═══════════════════════════════════════════════════════════ */
export default function TabMantenimiento({ fechaDesde, fechaHasta }) {
  const navigate = useNavigate();

  const fechaParams = {};
  if (fechaDesde) fechaParams.fecha_desde = fechaDesde;
  if (fechaHasta) fechaParams.fecha_hasta = fechaHasta;
  const fechaQuery = new URLSearchParams(fechaParams).toString();
  const apiUrl = `/dashboard/gerencia/mantenimiento${fechaQuery ? `?${fechaQuery}` : ''}`;

  const { data: kpis, isLoading, isError } = useQuery({
    queryKey: ['dashboard-gerencia-mantenimiento', fechaDesde, fechaHasta],
    queryFn: () => api.get(apiUrl).then(r => r.data.data),
    placeholderData: keepPreviousData,
    refetchInterval: 120_000,
    enabled: true,
  });

  // Presupuesto vs Real (Mantenimiento)
  const presParams = {};
  if (fechaDesde) presParams.fecha_desde = fechaDesde;
  if (fechaHasta) presParams.fecha_hasta = fechaHasta;
  const presQuery = new URLSearchParams(presParams).toString();
  const { data: presupuesto } = useQuery({
    queryKey: ['gerencia-presupuesto-mant', fechaDesde, fechaHasta],
    queryFn: () => api.get(`/dashboard/gerencia/mantenimiento/presupuesto${presQuery ? `?${presQuery}` : ''}`).then(r => r.data.data),
    placeholderData: keepPreviousData,
    refetchInterval: 120_000,
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
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Error al cargar datos de Mantenimiento</div>;
  }

  const { costo_mes, ots_por_estado, preventivos_programados } = kpis;

  // Calcular totales de OTs
  const totalOts = ots_por_estado.reduce((s, e) => s + e.cantidad, 0);
  const otsAbiertas = ots_por_estado.find(e => e.estado === 'ABIERTA')?.cantidad || 0;
  const otsEnProceso = ots_por_estado.find(e => e.estado === 'EN_PROCESO')?.cantidad || 0;
  const otsCerradas = ots_por_estado.find(e => e.estado === 'CERRADA')?.cantidad || 0;
  const otsLiquidadas = ots_por_estado.find(e => e.estado === 'LIQUIDADA')?.cantidad || 0;

  // Costo por tipo
  const costoCorrectivo = costo_mes.por_tipo['CORRECTIVO']?.total || 0;
  const costoPreventivo = costo_mes.por_tipo['PREVENTIVO']?.total || 0;

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard
          label="Costo mantenimiento"
          value={fmt(costo_mes.total_general)}
          delta={`${costo_mes.cantidad_total} OTs liquidadas`}
          deltaType="up"
          icon={Wrench} color="#8b5cf6"
          href="/mantenimiento"
        />

        <KpiCard
          label="OTs abiertas"
          value={String(otsAbiertas + otsEnProceso)}
          delta={`${otsAbiertas} abiertas · ${otsEnProceso} en proceso`}
          deltaType={otsAbiertas > 0 ? 'down' : 'up'}
          icon={AlertTriangle} color="#f59e0b"
          href="/mantenimiento"
        />

        <KpiCard
          label="OTs cerradas / liquidadas"
          value={String(otsCerradas + otsLiquidadas)}
          delta={`${otsCerradas} cerradas · ${otsLiquidadas} liquidadas`}
          deltaType="up"
          icon={CheckCircle} color="#22c55e"
          href="/mantenimiento"
        />

        <KpiCard
          label="Preventivos cumplidos"
          value={`${preventivos_programados.porcentaje_cumplimiento}%`}
          delta={`${preventivos_programados.ot_cerradas} / ${preventivos_programados.ot_creadas} OTs preventivas`}
          deltaType={preventivos_programados.porcentaje_cumplimiento >= 80 ? 'up' : 'down'}
          icon={TrendingUp} color="#6366f1"
          href="/informes/mantenimiento"
        />

        {/* Presupuesto Mensual — Gauge */}
        {presupuesto && (
          <GaugeCard
            label={`Costo vs Presupuesto (${presupuesto.mensual.mes_label})`}
            cumplimientoPct={presupuesto.mensual.cumplimiento_pct}
            real={presupuesto.mensual.real}
            presupuesto={presupuesto.mensual.presupuesto}
            sinPresupuesto={presupuesto.mensual.sin_presupuesto}
            fmt={fmt}
            icon={TrendingUp}
            color="#8b5cf6"
          />
        )}

        {/* Presupuesto Acumulado Anual — Gauge */}
        {presupuesto && (
          <GaugeCard
            label="Acumulado vs Presupuesto Anual"
            cumplimientoPct={presupuesto.acumulado.cumplimiento_pct}
            real={presupuesto.acumulado.real}
            presupuesto={presupuesto.acumulado.presupuesto}
            sinPresupuesto={presupuesto.acumulado.sin_presupuesto}
            fmt={fmt}
            icon={BarChart3}
            color="#8b5cf6"
          />
        )}
      </div>

      {/* Detalle por tipo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {/* Costo por tipo de mantenimiento */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '1rem' }}>
            Costo por tipo de mantenimiento
          </h3>
          {Object.keys(costo_mes.por_tipo).length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: '1rem 0' }}>
              Sin OTs liquidadas en el período
            </p>
          ) : (
            <div>
              {Object.entries(costo_mes.por_tipo).map(([tipo, datos]) => (
                <div key={tipo} style={{
                  padding: '0.75rem',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '0.5rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'capitalize' }}>{tipo}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{datos.cantidad} OTs</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: 'var(--text-xs)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Mano de obra: <strong>{fmt(datos.mano_obra)}</strong></span>
                    <span style={{ color: 'var(--text-muted)' }}>Repuestos: <strong>{fmt(datos.repuestos)}</strong></span>
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginTop: '0.25rem' }}>
                    Total: {fmt(datos.total)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Distribución por estado */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '1rem' }}>
            Distribución por estado
          </h3>
          {ots_por_estado.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: '1rem 0' }}>
              Sin OTs en el período
            </p>
          ) : (
            <div>
              {/* Barra de progreso */}
              <div style={{ display: 'flex', height: 8, borderRadius: 'var(--radius-full)', overflow: 'hidden', gap: 2, marginBottom: '1rem' }}>
                {ots_por_estado.map((e) => {
                  const cfg = ESTADO_COLORS[e.estado] || { bg: '#9ca3af' };
                  const pct = totalOts > 0 ? (e.cantidad / totalOts) * 100 : 0;
                  if (pct < 0.5) return null;
                  return (
                    <div key={e.estado} style={{
                      flex: `${pct} 1 0`, background: cfg.bg, borderRadius: 4, minWidth: 4,
                    }} title={`${cfg.label}: ${e.cantidad} (${pct.toFixed(0)}%)`} />
                  );
                })}
              </div>
              {/* Leyenda */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {ots_por_estado.map((e) => {
                  const cfg = ESTADO_COLORS[e.estado] || { bg: '#9ca3af', label: e.estado };
                  return (
                    <div key={e.estado} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.bg }} />
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                        {cfg.label}: <strong style={{ color: 'var(--text-primary)' }}>{e.cantidad}</strong>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
