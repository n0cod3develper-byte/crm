import React, { useState, useCallback, useRef } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, Clock, Truck, FileText, Users,
  ArrowUpRight, ArrowDownRight, TrendingUp, BarChart3,
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

const Delta = ({ value, suffix = '%' }) => {
  if (value == null) return null;
  const num = parseFloat(value);
  if (isNaN(num) || num === 0) return null;
  const up = num > 0;
  return (
    <span className={`kpi-delta kpi-delta--${up ? 'up' : 'down'}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--text-xs)' }}>
      {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {Math.abs(num).toFixed(1)}{suffix}
    </span>
  );
};

/* ─── KPI Card ────────────────────────────────────────────── */
function KpiCard({ label, value, delta, deltaType, icon: Icon, color, href, onClick, children }) {
  const navigate = useNavigate();
  const isClickable = !!(href || onClick);
  const Comp = isClickable ? 'a' : 'div';
  return (
    <Comp
      className="kpi-card"
      {...(isClickable ? {
        href: href || '#',
        onClick: (e) => {
          e.preventDefault();
          if (onClick) onClick();
          else if (href) navigate(href);
        },
        style: { cursor: 'pointer', textDecoration: 'none', display: 'block' },
      } : {})}
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
      {children}
    </Comp>
  );
}

/* ─── Bar Chart ───────────────────────────────────────────── */
function MiniBarChart({ data, labelKey, valueKey, color, onBarClick, formatVal }) {
  const maxVal = Math.max(...data.map(d => d[valueKey]), 1);
  const format = formatVal || fmt;
  return (
    <div style={{ marginTop: '0.5rem' }}>
      {data.map((d, i) => (
        <div
          key={i}
          onClick={onBarClick ? () => onBarClick(d, i) : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem',
            cursor: onBarClick ? 'pointer' : 'default',
            padding: '2px 4px', borderRadius: 'var(--radius-sm)',
          }}
        >
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', width: 70, textAlign: 'right', flexShrink: 0 }}>
            {d[labelKey]}
          </span>
          <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${Math.max((d[valueKey] / maxVal) * 100, 2)}%`,
              background: color,
              borderRadius: 'var(--radius-full)',
            }} />
          </div>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, width: 70, flexShrink: 0 }}>
            {format(d[valueKey])}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Tendencia Ingresos Mensuales Chart ──────────────────── */
function TendenciaIngresosChart({ data }) {
  const [tooltip, setTooltip] = useState(null);
  const chartRef = useRef(null);

  const maxVal = Math.max(...data.map(d => d.total_ingresos), 1);
  const CHART_H = 180;
  const BAR_W = 18;
  const GAP = data.length <= 6 ? 24 : 14;
  const PADDING_LEFT = 50;
  const PADDING_RIGHT = 10;
  const TOTAL_W = PADDING_LEFT + data.length * (BAR_W + GAP) - GAP + PADDING_RIGHT;
  const GRID_LINES = 4;

  const showTooltip = useCallback((d, e) => {
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: e.clientX - rect.left + 12,
      y: e.clientY - rect.top - 8,
      mes_label: d.mes_label,
      total_ingresos: d.total_ingresos,
      cantidad_facturas: d.cantidad_facturas,
    });
  }, []);

  const hideTooltip = useCallback(() => setTooltip(null), []);

  if (!data || data.length === 0) return null;

  return (
    <div style={{ position: 'relative', overflowX: 'auto', paddingBottom: 4 }} ref={chartRef}>
      <svg
        width={Math.max(TOTAL_W, 300)}
        height={CHART_H + 36}
        viewBox={`0 0 ${Math.max(TOTAL_W, 300)} ${CHART_H + 36}`}
        style={{ display: 'block' }}
      >
        {Array.from({ length: GRID_LINES + 1 }).map((_, i) => {
          const y = CHART_H - (i / GRID_LINES) * (CHART_H - 20);
          const val = Math.round((i / GRID_LINES) * maxVal);
          return (
            <g key={i}>
              <line x1={PADDING_LEFT - 5} y1={y} x2={Math.max(TOTAL_W, 300) - PADDING_RIGHT} y2={y} stroke="var(--border-color)" strokeWidth={1} opacity={0.3} />
              <text x={PADDING_LEFT - 10} y={y + 4} textAnchor="end" fill="var(--text-muted)" fontSize={9}>
                {val >= 1_000_000 ? `${(val / 1_000_000).toFixed(1)}M` : val >= 1_000 ? `${(val / 1_000).toFixed(0)}K` : val}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = PADDING_LEFT + i * (BAR_W + GAP);
          const h = d.total_ingresos > 0 ? Math.max((d.total_ingresos / maxVal) * (CHART_H - 20), 3) : 0;
          const isCurrentMonth = i === data.length - 1;
          return (
            <g key={d.mes}>
              <rect x={x} y={CHART_H - 10 - h} width={BAR_W} height={h} rx={3} ry={3}
                fill={isCurrentMonth ? '#22c55e' : '#6366f1'} opacity={isCurrentMonth ? 1 : 0.7}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => showTooltip(d, e)} onMouseMove={(e) => showTooltip(d, e)} onMouseLeave={hideTooltip}
              />
              <text x={x + BAR_W / 2} y={CHART_H + 14} textAnchor="middle" fill="var(--text-muted)" fontSize={8}
                transform={`rotate(-40, ${x + BAR_W / 2}, ${CHART_H + 14})`}>
                {d.mes_label}
              </text>
            </g>
          );
        })}
      </svg>
      {tooltip && (
        <div style={{
          position: 'absolute', left: Math.min(tooltip.x, Math.max(TOTAL_W, 300) - 200), top: Math.max(tooltip.y, 4),
          pointerEvents: 'none', background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontSize: 'var(--text-xs)', zIndex: 10,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{tooltip.mes_label}</div>
          <div style={{ color: 'var(--text-secondary)' }}>Ingresos: <strong style={{ color: 'var(--text-primary)' }}>{fmt(tooltip.total_ingresos)}</strong></div>
          <div style={{ color: 'var(--text-secondary)' }}>Facturas: <strong style={{ color: 'var(--text-primary)' }}>{tooltip.cantidad_facturas}</strong></div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB SERVICIOS
   Reutiliza el endpoint principal del dashboard gerencial.
   ═══════════════════════════════════════════════════════════ */
export default function TabServicios({ fechaDesde, fechaHasta }) {
  const navigate = useNavigate();

  const fechaParams = {};
  if (fechaDesde) fechaParams.fecha_desde = fechaDesde;
  if (fechaHasta) fechaParams.fecha_hasta = fechaHasta;
  const fechaQuery = new URLSearchParams(fechaParams).toString();
  const apiUrl = `/dashboard/gerencia${fechaQuery ? `?${fechaQuery}` : ''}`;

  const { data: kpis, isLoading, isError } = useQuery({
    queryKey: ['dashboard-gerencia-kpis', fechaDesde, fechaHasta],
    queryFn: () => api.get(apiUrl).then(r => r.data.data),
    placeholderData: keepPreviousData,
    refetchInterval: 120_000,
  });

  // Ventas por línea de servicio (existe en informes)
  const lineaParams = {};
  if (fechaDesde) lineaParams.fecha_inicio = fechaDesde;
  if (fechaHasta) lineaParams.fecha_fin = fechaHasta;
  const lineaQuery = new URLSearchParams(lineaParams).toString();
  const { data: ventasLineaData } = useQuery({
    queryKey: ['gerencia-ventas-linea', fechaDesde, fechaHasta],
    queryFn: () => api.get(`/informes/servicios/ventas-por-linea${lineaQuery ? `?${lineaQuery}` : ''}`).then(r => r.data.data || r.data),
    placeholderData: keepPreviousData,
    refetchInterval: 120_000,
  });

  // Presupuesto vs Real (Servicios)
  const presParams = {};
  if (fechaDesde) presParams.fecha_desde = fechaDesde;
  if (fechaHasta) presParams.fecha_hasta = fechaHasta;
  const presQuery = new URLSearchParams(presParams).toString();
  const { data: presupuesto } = useQuery({
    queryKey: ['gerencia-presupuesto-serv', fechaDesde, fechaHasta],
    queryFn: () => api.get(`/dashboard/gerencia/servicios/presupuesto${presQuery ? `?${presQuery}` : ''}`).then(r => r.data.data),
    placeholderData: keepPreviousData,
    refetchInterval: 120_000,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="kpi-card" style={{ minHeight: 120 }}>
            <div className="spinner" style={{ margin: '2rem auto' }} />
          </div>
        ))}
      </div>
    );
  }

  if (isError || !kpis) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Error al cargar datos de Servicios</div>;
  }

  const { ingresos_mes, cartera_por_antiguedad, utilizacion_flota, remisiones_pendientes, top_clientes, tendencia_ingresos } = kpis;

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard
          label="Ingresos del mes"
          value={fmt(ingresos_mes.mes_actual)}
          delta={ingresos_mes.variacion_vs_anterior_pct != null ? `${Math.abs(ingresos_mes.variacion_vs_anterior_pct).toFixed(1)}% vs mes anterior` : null}
          deltaType={ingresos_mes.variacion_vs_anterior_pct != null ? (ingresos_mes.variacion_vs_anterior_pct >= 0 ? 'up' : 'down') : 'up'}
          icon={DollarSign} color="#22c55e"
          href="/facturacion/facturas"
        >
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {ingresos_mes.cantidad_facturas} facturas emitidas
          </div>
        </KpiCard>

        <KpiCard
          label="Cartera vencida"
          value={fmt(cartera_por_antiguedad.total_valor)}
          delta={`${cartera_por_antiguedad.total_cantidad} facturas`}
          deltaType="down"
          icon={Clock} color="#f59e0b"
          href="/facturacion/facturas"
        />

        <KpiCard
          label="Utilización de flota"
          value={`${utilizacion_flota.porcentaje_global}%`}
          delta={`${utilizacion_flota.total_en_servicio} / ${utilizacion_flota.total_equipos} equipos`}
          deltaType={utilizacion_flota.porcentaje_global >= 50 ? 'up' : 'down'}
          icon={Truck} color="#6366f1"
          href="/equipos"
        />

        <KpiCard
          label="Pendientes de facturar"
          value={fmt(remisiones_pendientes.total_valor)}
          delta={`${remisiones_pendientes.total_cantidad} OTs/Remisiones`}
          deltaType="down"
          icon={FileText} color="#ef4444"
          href="/facturacion/pendientes"
        />

        <KpiCard
          label="Top cliente"
          value={top_clientes.length > 0 ? top_clientes[0]?.nombre || '—' : '—'}
          delta={top_clientes.length > 0 ? `${fmt(top_clientes[0]?.total_facturado)}` : null}
          deltaType="up"
          icon={Users} color="#ec4899"
          href="/companies"
        />

        {/* Presupuesto Mensual — Gauge */}
        {presupuesto && (
          <GaugeCard
            label={`Ventas vs Presupuesto (${presupuesto.mensual.mes_label})`}
            cumplimientoPct={presupuesto.mensual.cumplimiento_pct}
            real={presupuesto.mensual.real}
            presupuesto={presupuesto.mensual.presupuesto}
            sinPresupuesto={presupuesto.mensual.sin_presupuesto}
            fmt={fmt}
            icon={TrendingUp}
            color="#6366f1"
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
            color="#6366f1"
          />
        )}
      </div>

      {/* Ventas por Línea de Servicio */}
      {ventasLineaData && ventasLineaData.length > 0 && (() => {
        const totalVentasLinea = ventasLineaData.reduce((s, v) => s + parseFloat(v.total_ventas || 0), 0);
        const maxVentas = Math.max(...ventasLineaData.map(v => parseFloat(v.total_ventas || 0)), 1);
        return (
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '0.25rem' }}>Ventas por Línea de Servicio</h3>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Total: <strong style={{ color: 'var(--text-primary)' }}>{fmt(totalVentasLinea)}</strong>
                </p>
              </div>
              <button
                onClick={() => navigate('/informes/servicios')}
                style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-primary-400)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Ver informe &rarr;
              </button>
            </div>
            <div>
              {ventasLineaData.map((v, i) => {
                const ventas = parseFloat(v.total_ventas || 0);
                const pct = totalVentasLinea > 0 ? (ventas / totalVentasLinea * 100) : 0;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', width: 140, textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {v.nombre || 'Sin línea'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          {pct.toFixed(1)}%
                        </span>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{fmt(ventas)}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${Math.max((ventas / maxVentas) * 100, 2)}%`,
                          background: i === 0 ? '#22c55e' : i === 1 ? '#6366f1' : i === 2 ? '#f59e0b' : '#9ca3af',
                          borderRadius: 'var(--radius-full)',
                          transition: 'width 0.6s ease',
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Tendencia de Ingresos */}
      {tendencia_ingresos && tendencia_ingresos.length > 0 && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '0.25rem' }}>Tendencia de Ingresos Mensuales</h3>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Últimos 12 meses</p>
            </div>
          </div>
          <TendenciaIngresosChart data={tendencia_ingresos} />
        </div>
      )}

      {/* Cartera por antigüedad */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '1rem' }}>Cartera por antigüedad</h3>
        <MiniBarChart
          data={cartera_por_antiguedad.rangos}
          labelKey="rango" valueKey="valor" color="#f59e0b"
        />
      </div>
    </div>
  );
}
