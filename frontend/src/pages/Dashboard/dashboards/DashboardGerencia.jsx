import React, { useState, useCallback, useRef, lazy, Suspense } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, Clock, Truck, FileText, Wrench, Users,
  ArrowUpRight, ArrowDownRight, AlertTriangle,
  RotateCcw, X, Calendar, BarChart3, Shield, Heart, Briefcase,
} from 'lucide-react';
import api from '../../../lib/api';

// Lazy-loaded tab components
const TabServicios = lazy(() => import('./gerencia/TabServicios'));
const TabMantenimiento = lazy(() => import('./gerencia/TabMantenimiento'));
const TabGestionHumana = lazy(() => import('./gerencia/TabGestionHumana'));
const TabBienestar = lazy(() => import('./gerencia/TabBienestar'));

/* ─── Helpers ─────────────────────────────────────────────── */
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

/* ─── KPI Card (reuse dashboard pattern) ──────────────────── */
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

/* ─── Tendencia Ingresos Mensuales Chart (SVG) ────────────── */
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
        {/* Grid lines + Y-axis labels */}
        {Array.from({ length: GRID_LINES + 1 }).map((_, i) => {
          const y = CHART_H - (i / GRID_LINES) * (CHART_H - 20);
          const val = Math.round((i / GRID_LINES) * maxVal);
          return (
            <g key={i}>
              <line
                x1={PADDING_LEFT - 5}
                y1={y}
                x2={Math.max(TOTAL_W, 300) - PADDING_RIGHT}
                y2={y}
                stroke="var(--border-color)"
                strokeWidth={1}
                opacity={0.3}
              />
              <text
                x={PADDING_LEFT - 10}
                y={y + 4}
                textAnchor="end"
                fill="var(--text-muted)"
                fontSize={9}
              >
                {val >= 1_000_000 ? `${(val / 1_000_000).toFixed(1)}M` : val >= 1_000 ? `${(val / 1_000).toFixed(0)}K` : val}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = PADDING_LEFT + i * (BAR_W + GAP);
          const h = d.total_ingresos > 0
            ? Math.max((d.total_ingresos / maxVal) * (CHART_H - 20), 3)
            : 0;
          const isCurrentMonth = i === data.length - 1;
          return (
            <g key={d.mes}>
              <rect
                x={x}
                y={CHART_H - 10 - h}
                width={BAR_W}
                height={h}
                rx={3}
                ry={3}
                fill={isCurrentMonth ? '#22c55e' : '#6366f1'}
                opacity={isCurrentMonth ? 1 : 0.7}
                style={{ cursor: 'pointer', transition: 'opacity 0.15s ease' }}
                onMouseEnter={(e) => showTooltip(d, e)}
                onMouseMove={(e) => showTooltip(d, e)}
                onMouseLeave={hideTooltip}
              />
              {/* Month label */}
              <text
                x={x + BAR_W / 2}
                y={CHART_H + 14}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize={8}
                transform={`rotate(-40, ${x + BAR_W / 2}, ${CHART_H + 14})`}
              >
                {d.mes_label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(tooltip.x, Math.max(TOTAL_W, 300) - 200),
            top: Math.max(tooltip.y, 4),
            pointerEvents: 'none',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '0.5rem 0.75rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: 'var(--text-xs)',
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{tooltip.mes_label}</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Ingresos: <strong style={{ color: 'var(--text-primary)' }}>{fmt(tooltip.total_ingresos)}</strong>
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Facturas: <strong style={{ color: 'var(--text-primary)' }}>{tooltip.cantidad_facturas}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Bar Chart simple ────────────────────────────────────── */
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
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => { if (onBarClick) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', width: 70, textAlign: 'right', flexShrink: 0 }}>
            {d[labelKey]}
          </span>
          <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.max((d[valueKey] / maxVal) * 100, 2)}%`,
              background: color,
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.6s ease',
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

/* ─── Skeleton Loader ─────────────────────────────────────── */
function Skeleton() {
  return (
    <div style={{ width: '100%', maxWidth: 1400, margin: '0 auto' }}>
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="kpi-card" style={{ minHeight: 120 }}>
            <div className="spinner" style={{ margin: '2rem auto' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Modal Detalle ──────────────────────────────────────── */
function DetalleModal({ title, onClose, isLoading, children }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          width: '90%', maxWidth: 900, maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)',
        }}>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
            padding: 4, borderRadius: 'var(--radius-sm)',
          }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '0.75rem' }}>
              <div className="spinner" />
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Cargando detalle…</span>
            </div>
          ) : children}
        </div>
      </div>
    </div>
  );
}

/* ─── Tab definitions ───────────────────────────────────── */
const TABS = [
  { id: 'resumen', label: 'Resumen', icon: BarChart3 },
  { id: 'servicios', label: 'Servicios', icon: Briefcase },
  { id: 'mantenimiento', label: 'Mantenimiento', icon: Wrench },
  { id: 'gestion_humana', label: 'Gestión Humana', icon: Users },
  { id: 'bienestar', label: 'Bienestar', icon: Heart },
];

function TabSkeleton() {
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

/* ─── Main Component ──────────────────────────────────────── */
export default function DashboardGerencia({ nombreModulo }) {
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [activeTab, setActiveTab] = useState('resumen');

  // Modal state
  const [carteraModal, setCarteraModal] = useState(null); // null | { rango_min, rango_max, label }
  const [pendientesModal, setPendientesModal] = useState(false);

  const fechaParams = {};
  if (fechaDesde) fechaParams.fecha_desde = fechaDesde;
  if (fechaHasta) fechaParams.fecha_hasta = fechaHasta;
  const fechaQuery = new URLSearchParams(fechaParams).toString();
  const apiUrl = `/dashboard/gerencia${fechaQuery ? `?${fechaQuery}` : ''}`;

  const { data: kpis, isLoading, isError, isFetching } = useQuery({
    queryKey: ['dashboard-gerencia-kpis', fechaDesde, fechaHasta],
    queryFn: () => api.get(apiUrl).then(r => r.data.data),
    placeholderData: keepPreviousData,
    refetchInterval: 120_000, // 2 min
  });

  // Fetch cartera detail
  const { data: carteraDetalle, isLoading: carteraLoading } = useQuery({
    queryKey: ['gerencia-cartera-detalle', carteraModal?.rango_min, carteraModal?.rango_max],
    queryFn: () => {
      const params = new URLSearchParams({ rango_min: carteraModal.rango_min });
      if (carteraModal.rango_max != null) params.set('rango_max', carteraModal.rango_max);
      return api.get(`/dashboard/gerencia/cartera-detalle?${params.toString()}`).then(r => r.data.data);
    },
    enabled: !!carteraModal,
  });

  // Fetch pendientes detail
  const { data: pendientesDetalle, isLoading: pendientesLoading } = useQuery({
    queryKey: ['gerencia-pendientes-detalle', fechaDesde, fechaHasta],
    queryFn: () => {
      const params = new URLSearchParams(fechaParams);
      return api.get(`/dashboard/gerencia/pendientes-detalle?${params.toString()}`).then(r => r.data.data);
    },
    placeholderData: keepPreviousData,
    enabled: pendientesModal,
  });

  const handleCarteraClick = (rango_min, rango_max, label) => {
    setCarteraModal({ rango_min, rango_max, label });
  };

  if (isLoading) return <Skeleton />;

  if (isError) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Error al cargar el dashboard gerencial
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
          No se pudieron obtener los indicadores. Verifica la conexión con el servidor.
        </p>
      </div>
    );
  }

  if (!kpis) return null;

  const { ingresos_mes, cartera_por_antiguedad, utilizacion_flota, remisiones_pendientes, costo_mantenimiento, top_clientes, tendencia_ingresos } = kpis;

  // Render the active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'servicios':
        return <TabServicios fechaDesde={fechaDesde} fechaHasta={fechaHasta} />;
      case 'mantenimiento':
        return <TabMantenimiento fechaDesde={fechaDesde} fechaHasta={fechaHasta} />;
      case 'gestion_humana':
        return <TabGestionHumana fechaDesde={fechaDesde} fechaHasta={fechaHasta} />;
      case 'bienestar':
        return <TabBienestar fechaDesde={fechaDesde} fechaHasta={fechaHasta} />;
      case 'resumen':
      default:
        return (
          <>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <KpiCard label="Ingresos del mes" value={fmt(ingresos_mes.mes_actual)}
                delta={ingresos_mes.variacion_vs_anterior_pct != null ? `${Math.abs(ingresos_mes.variacion_vs_anterior_pct).toFixed(1)}% vs mes anterior` : null}
                deltaType={ingresos_mes.variacion_vs_anterior_pct != null ? (ingresos_mes.variacion_vs_anterior_pct >= 0 ? 'up' : 'down') : 'up'}
                icon={DollarSign} color="#22c55e" href="/facturacion/facturas">
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span>{ingresos_mes.cantidad_facturas} facturas emitidas</span>
                  {ingresos_mes.variacion_vs_anio_anterior_pct != null && (
                    <><span style={{ opacity: 0.4 }}>·</span><Delta value={ingresos_mes.variacion_vs_anio_anterior_pct} suffix="% vs año ant." /></>
                  )}
                </div>
              </KpiCard>
              <KpiCard label="Cartera vencida" value={fmt(cartera_por_antiguedad.total_valor)}
                delta={`${cartera_por_antiguedad.total_cantidad} facturas — clic para ver detalle`} deltaType="down"
                icon={Clock} color="#f59e0b" onClick={() => handleCarteraClick(0, null, 'Toda la cartera vencida')} />
              <KpiCard label="Utilización de flota" value={`${utilizacion_flota.porcentaje_global}%`}
                delta={`${utilizacion_flota.total_en_servicio} / ${utilizacion_flota.total_equipos} equipos`}
                deltaType={utilizacion_flota.porcentaje_global >= 50 ? 'up' : 'down'}
                icon={Truck} color="#6366f1" href="/equipos" />
              <KpiCard label="Pendientes de facturar" value={fmt(remisiones_pendientes.total_valor)}
                delta={`${remisiones_pendientes.total_cantidad} OTs/Remisiones — clic para ver detalle`} deltaType="down"
                icon={FileText} color="#ef4444" onClick={() => setPendientesModal(true)} />
              <KpiCard label="Costo mantenimiento mes" value={fmt(costo_mantenimiento.total_general)}
                delta={`${costo_mantenimiento.cantidad_total} OTs liquidadas`} deltaType="up"
                icon={Wrench} color="#8b5cf6" href="/mantenimiento" />
              <KpiCard label="Top clientes (facturación)"
                value={top_clientes.length > 0 ? top_clientes[0]?.nombre || '—' : '—'}
                delta={top_clientes.length > 0 ? `${fmt(top_clientes[0]?.total_facturado)}` : null}
                deltaType="up" icon={Users} color="#ec4899" href="/companies" />
            </div>
            {/* Tendencia de Ingresos */}
            {tendencia_ingresos && tendencia_ingresos.length > 0 && (
              <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '0.25rem' }}>Tendencia de Ingresos Mensuales</h3>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Últimos 12 meses &middot; <span style={{ color: '#22c55e', fontWeight: 600 }}>■</span> Mes actual</p>
                  </div>
                  <button onClick={() => navigate('/facturacion/facturas')} style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-primary-400)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Ver facturas &rarr;</button>
                </div>
                <TendenciaIngresosChart data={tendencia_ingresos} />
              </div>
            )}
            {/* Charts row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '1rem' }}>Cartera por antigüedad</h3>
                <MiniBarChart data={cartera_por_antiguedad.rangos} labelKey="rango" valueKey="valor" color="#f59e0b"
                  onBarClick={(d, i) => {
                    const ranges = [{ min: 0, max: 30 }, { min: 31, max: 60 }, { min: 61, max: 90 }, { min: 91, max: null }];
                    const r = ranges[i];
                    if (d.valor > 0) handleCarteraClick(r.min, r.max, `Cartera ${d.rango}`);
                  }} />
              </div>
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '1rem' }}>Flota por tipo de equipo</h3>
                {utilizacion_flota.tipos.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: '1rem 0' }}>No hay equipos registrados</p>
                ) : (
                  <div>{utilizacion_flota.tipos.map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', width: 80, textAlign: 'right', flexShrink: 0 }}>{t.tipo}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{t.en_servicio}/{t.total_equipos}</span>
                          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{t.porcentaje}%</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.max(t.porcentaje, 2)}%`, background: t.porcentaje >= 70 ? '#22c55e' : t.porcentaje >= 40 ? '#f59e0b' : '#ef4444', borderRadius: 'var(--radius-full)' }} />
                        </div>
                      </div>
                    </div>
                  ))}</div>
                )}
              </div>
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '1rem' }}>Mantenimiento este mes</h3>
                {Object.keys(costo_mantenimiento.tipos).length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: '1rem 0' }}>Sin OTs liquidadas este mes</p>
                ) : (
                  <div>{Object.entries(costo_mantenimiento.tipos).map(([tipo, datos]) => (
                    <div key={tipo} style={{ padding: '0.75rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'capitalize' }}>{tipo}</span>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{datos.cantidad} OTs</span>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: 'var(--text-xs)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Mano de obra: <strong>{fmt(datos.mano_obra)}</strong></span>
                        <span style={{ color: 'var(--text-muted)' }}>Repuestos: <strong>{fmt(datos.repuestos)}</strong></span>
                      </div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginTop: '0.25rem' }}>Total: {fmt(datos.total)}</div>
                    </div>
                  ))}</div>
                )}
              </div>
            </div>
            {/* Top Clientes */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>Top 10 Clientes por Facturación</h3>
                <button onClick={() => navigate('/companies')} style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-primary-400)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Ver todas &rarr;</button>
              </div>
              {top_clientes.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: '1rem 0' }}>No hay datos de facturación disponibles</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                    <thead><tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>#</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>Cliente</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>Facturas</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>Total facturado</th>
                    </tr></thead>
                    <tbody>{top_clientes.map((c, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>{c.nombre}</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>{c.cantidad_facturas}</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{fmt(c.total_facturado)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        );
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: 1400, margin: '0 auto', padding: '0 0.5rem 2rem' }}>
      {/* Header + Date Filter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              Dashboard Gerencial
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              Indicadores clave de gestión — Actualizado automáticamente
            </p>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.5rem 0.875rem',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
          }}>
            <Calendar size={14} color="var(--text-muted)" />
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Desde</label>
            <input type="date" className="date-input-kpi" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Hasta</label>
            <input type="date" className="date-input-kpi" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
            {isFetching && !isLoading && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
              </span>
            )}
            {(fechaDesde || fechaHasta) && (
              <button
                type="button"
                onClick={() => { setFechaDesde(''); setFechaHasta(''); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  padding: '3px 8px', border: 'none', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(239,68,68,0.12)', color: 'var(--clr-danger)',
                  fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer',
                }}
              >
                <RotateCcw size={12} /> Limpiar
              </button>
            )}
          </div>
        </div>

        {/* ─── Tab Navigation ──────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 0,
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '1.5rem',
          overflowX: 'auto',
        }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.75rem 1.25rem',
                  border: 'none',
                  borderBottom: `2px solid ${isActive ? 'var(--clr-primary-500)' : 'transparent'}`,
                  background: 'transparent',
                  color: isActive ? 'var(--clr-primary-500)' : 'var(--text-muted)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ─── Tab Content ──────────────────────────────────── */}
        <Suspense fallback={<TabSkeleton />}>
          {renderTabContent()}
        </Suspense>

        {/* ─── Modals (only for resumen tab) ──────────────────── */}
        {activeTab === 'resumen' && (
          <>
            {/* ─── Modal: Cartera Detalle ──────────────────────── */}
            {carteraModal && (
              <DetalleModal title={carteraModal.label} onClose={() => setCarteraModal(null)} isLoading={carteraLoading}>
                {!carteraLoading && carteraDetalle && (
                  carteraDetalle.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0', fontSize: 'var(--text-sm)' }}>No hay facturas vencidas en este rango</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                        <thead><tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>Consecutivo</th>
                          <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>N° Factura</th>
                          <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>Empresa</th>
                          <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>F. Vencimiento</th>
                          <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>Días vencido</th>
                          <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>Subtotal</th>
                          <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>IVA</th>
                          <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>Total</th>
                        </tr></thead>
                        <tbody>{carteraDetalle.map((f, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>{f.consecutivo}</td>
                            <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>{f.numero_factura || '—'}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{f.empresa}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{f.fecha_vencimiento ? new Date(f.fecha_vencimiento).toLocaleDateString('es-CO') : '—'}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: f.dias_vencido > 90 ? '#ef4444' : f.dias_vencido > 60 ? '#f59e0b' : 'var(--text-muted)', fontWeight: 600 }}>{f.dias_vencido}d</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{fmt(f.subtotal)}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>{fmt(f.iva)}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{fmt(f.total)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )
                )}
              </DetalleModal>
            )}
            {/* ─── Modal: Pendientes de Facturar Detalle ────────── */}
            {pendientesModal && (
              <DetalleModal title="Pendientes de Facturar" onClose={() => setPendientesModal(false)} isLoading={pendientesLoading}>
                {!pendientesLoading && pendientesDetalle && (
                  pendientesDetalle.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0', fontSize: 'var(--text-sm)' }}>No hay OTs o remisiones pendientes de facturar</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                        <thead><tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>Tipo</th>
                          <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>N°</th>
                          <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>Empresa</th>
                          <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>Detalle</th>
                          <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>Fecha</th>
                          <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)' }}>Total</th>
                        </tr></thead>
                        <tbody>{pendientesDetalle.map((item, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', fontWeight: 600, background: item.tipo === 'OT' ? 'rgba(99,102,241,0.12)' : 'rgba(34,197,94,0.12)', color: item.tipo === 'OT' ? '#6366f1' : '#22c55e' }}>{item.tipo}</span>
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>{item.numero}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{item.empresa}</td>
                            <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>{item.detalle || '—'}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>{item.fecha ? new Date(item.fecha).toLocaleDateString('es-CO') : '—'}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>{fmt(item.total)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )
                )}
              </DetalleModal>
            )}
          </>
        )}
    </div>
  );
}
