import React, { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Users, DollarSign, CheckSquare, ArrowUpRight, ArrowDownRight, Wrench, ShieldCheck, Activity, Calendar, RotateCcw } from 'lucide-react';
import { Topbar } from '../../components/layout/Topbar';
import api from '../../lib/api';

function KpiCard({ label, value, delta, deltaType, icon: Icon, color }) {
  const isUp = deltaType === 'up';
  return (
    <div className="kpi-card">
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
          {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {delta}
        </div>
      )}
    </div>
  );
}

function ActivityItem({ item }) {
  const typeColors = {
    email: '#60a5fa', call: '#4ade80', whatsapp: '#86efac',
    meeting: '#a78bfa', note: '#94a3b8',
  };
  return (
    <div style={{
      display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
      padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)',
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
        background: typeColors[item.type] || 'var(--text-muted)',
      }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
          {item.subject || item.title || 'Actividad'}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
          {item.created_by_name} &middot; {new Date(item.date || item.created_at).toLocaleDateString('es-CO')}
        </div>
      </div>
    </div>
  );
}

const ESTADO_COLORS = {
  ABIERTA:    { bg: '#6366f1', label: 'Abiertas' },
  EN_PROCESO: { bg: '#f59e0b', label: 'En Proceso' },
  LIQUIDADA:  { bg: '#10b981', label: 'Liquidada' },
  CERRADA:    { bg: '#6b7280', label: 'Cerrada' },
};

const OPCIONES_PERIODO = [
  { value: 6,  label: '6M' },
  { value: 12, label: '12M' },
  { value: 24, label: '24M' },
];

function TendenciasMensualesChart({ data, periodo, onChangePeriodo }) {
  const maxVal = Math.max(...data.map(d => Math.max(d.creadas, d.liquidadas)), 1);
  const CHART_H = 160;
  const BAR_W = 12;
  const GAP = data.length <= 6 ? 20 : 12;
  const TOTAL_W = data.length * (BAR_W + GAP) - GAP + 40;
  const GRID_LINES = 4;

  const [tooltip, setTooltip] = useState(null);
  const chartRef = useRef(null);

  const showTooltip = useCallback((d, barType, e) => {
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect) return;
    const diff = d.creadas - d.liquidadas;
    setTooltip({
      x: e.clientX - rect.left + 12,
      y: e.clientY - rect.top - 8,
      label: d.label,
      creadas: d.creadas,
      liquidadas: d.liquidadas,
      diff,
      barType,
    });
  }, []);

  const hideTooltip = useCallback(() => setTooltip(null), []);

  return (
    <div className="tendencias-chart">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.75rem',
      }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Tendencias mensuales
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            display: 'flex',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: 2,
            gap: 2,
          }}>
            {OPCIONES_PERIODO.map(op => (
              <button
                key={op.value}
                onClick={() => onChangePeriodo(op.value)}
                style={{
                  padding: '3px 8px',
                  border: 'none',
                  borderRadius: 'calc(var(--radius-md) - 3px)',
                  background: periodo === op.value ? 'var(--clr-primary-500)' : 'transparent',
                  color: periodo === op.value ? '#fff' : 'var(--text-muted)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: periodo === op.value ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {op.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginLeft: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#6366f1' }} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Creadas</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981' }} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Liquidadas</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', overflowX: 'auto', paddingBottom: 4 }} ref={chartRef}>
        <svg
          width={Math.max(TOTAL_W, 280)}
          height={CHART_H + 36}
          viewBox={`0 0 ${Math.max(TOTAL_W, 280)} ${CHART_H + 36}`}
          style={{ display: 'block' }}
        >
          {Array.from({ length: GRID_LINES + 1 }).map((_, i) => {
            const y = CHART_H - (i / GRID_LINES) * (CHART_H - 20);
            const val = Math.round((i / GRID_LINES) * maxVal);
            return (
              <g key={i}>
                <line x1={20} y1={y} x2={Math.max(TOTAL_W, 280) - 10} y2={y} stroke="var(--border-color)" strokeWidth={1} opacity={0.4} />
                <text x={16} y={y + 4} textAnchor="end" fill="var(--text-muted)" fontSize={10}>{val}</text>
              </g>
            );
          })}

          {data.map((d, i) => {
            const x = 30 + i * (BAR_W + GAP);
            const hCreadas = d.creadas > 0 ? Math.max((d.creadas / maxVal) * (CHART_H - 20), 3) : 0;
            const hLiquidadas = d.liquidadas > 0 ? Math.max((d.liquidadas / maxVal) * (CHART_H - 20), 3) : 0;
            return (
              <g key={d.mes}>
                <rect
                  x={x}
                  y={CHART_H - 10 - hCreadas}
                  width={BAR_W}
                  height={hCreadas}
                  rx={3} ry={3}
                  fill="#6366f1"
                  opacity={0.85}
                  style={{ cursor: 'pointer', transition: 'opacity 0.15s ease' }}
                  onMouseEnter={(e) => showTooltip(d, 'creadas', e)}
                  onMouseMove={(e) => showTooltip(d, 'creadas', e)}
                  onMouseLeave={hideTooltip}
                />
                <rect
                  x={x + BAR_W + 3}
                  y={CHART_H - 10 - hLiquidadas}
                  width={BAR_W}
                  height={hLiquidadas}
                  rx={3} ry={3}
                  fill="#10b981"
                  opacity={0.85}
                  style={{ cursor: 'pointer', transition: 'opacity 0.15s ease' }}
                  onMouseEnter={(e) => showTooltip(d, 'liquidadas', e)}
                  onMouseMove={(e) => showTooltip(d, 'liquidadas', e)}
                  onMouseLeave={hideTooltip}
                />
                <text
                  x={x + BAR_W + 1.5}
                  y={CHART_H + 14}
                  textAnchor="end"
                  transform={`rotate(-35, ${x + BAR_W + 1.5}, ${CHART_H + 14})`}
                  fill="var(--text-muted)"
                  fontSize={9}
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>

        {tooltip && (
          <div
            className="chart-tooltip"
            style={{
              position: 'absolute',
              left: Math.min(tooltip.x, Math.max(TOTAL_W, 280) - 180),
              top: Math.max(tooltip.y, 4),
              pointerEvents: 'none',
            }}
          >
            <div className="chart-tooltip__header">{tooltip.label}</div>
            <div className="chart-tooltip__row">
              <span className="chart-tooltip__dot" style={{ background: '#6366f1' }} />
              Creadas: <strong>{tooltip.creadas}</strong>
            </div>
            <div className="chart-tooltip__row">
              <span className="chart-tooltip__dot" style={{ background: '#10b981' }} />
              Liquidadas: <strong>{tooltip.liquidadas}</strong>
            </div>
            <div className="chart-tooltip__divider" />
            <div className="chart-tooltip__row" style={{ color: tooltip.diff >= 0 ? 'var(--clr-danger)' : 'var(--clr-success)' }}>
              {tooltip.diff >= 0 ? '\u2197 Pendientes' : '\u2198 Completadas'}: <strong>{Math.abs(tooltip.diff)}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MantenimientoKpiCard({ kpis, isLoading, isError, periodo, onChangePeriodo, fechaDesde, fechaHasta, onChangeFechaDesde, onChangeFechaHasta }) {
  if (isError) {
    return (
      <div className="card">
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
          No se pudieron cargar los KPIs de mantenimiento
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '2rem', justifyContent: 'center' }}>
          <div className="spinner" />
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Cargando KPIs de mantenimiento&hellip;</span>
        </div>
      </div>
    );
  }

  if (!kpis) return null;

  const estadoCount = {};
  (kpis.por_estado || []).forEach(e => { estadoCount[e.estado] = e.count; });
  const totalEstados = Object.values(estadoCount).reduce((a, b) => a + b, 0) || 1;

  const tipoCount = {};
  (kpis.por_tipo || []).forEach(t => { tipoCount[t.tipo_mantenimiento] = t.count; });

  const formatCurrency = (val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return '$0';
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
  };

  return (
    <div className="card mantenimiento-kpi">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'rgba(99,102,241,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Wrench size={20} color="#6366f1" />
          </div>
          <div>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, lineHeight: 1.2 }}>
              Mantenimiento
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Ordenes de Trabajo &middot; Tiempo real
            </p>
          </div>
        </div>
        <a href="/mantenimiento" style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-primary-400)', fontWeight: 600 }}>
          Ver todas &rarr;
        </a>
      </div>

      {/* ─── Filtro de rango de fechas ──────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1rem',
        padding: '0.625rem 0.875rem',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        flexWrap: 'wrap',
      }}>
        <Calendar size={14} color="var(--text-muted)" />
        <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          Desde
        </label>
        <input
          type="date"
          className="date-input-kpi"
          value={fechaDesde}
          onChange={(e) => onChangeFechaDesde(e.target.value)}
        />
        <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          Hasta
        </label>
        <input
          type="date"
          className="date-input-kpi"
          value={fechaHasta}
          onChange={(e) => onChangeFechaHasta(e.target.value)}
        />
        {(fechaDesde || fechaHasta) && (
          <button
            onClick={() => { onChangeFechaDesde(''); onChangeFechaHasta(''); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '3px 8px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239,68,68,0.12)',
              color: 'var(--clr-danger)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              marginLeft: 'auto',
            }}
          >
            <RotateCcw size={12} />
            Limpiar
          </button>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1.25rem',
      }}>
        <div className="mant-kpi-metric">
          <span className="mant-kpi-value">{kpis.total}</span>
          <span className="mant-kpi-label">Total OT</span>
        </div>
        <div className="mant-kpi-metric">
          <span className="mant-kpi-value">{kpis.este_mes}</span>
          <span className="mant-kpi-label">Este mes</span>
        </div>
        <div className="mant-kpi-metric">
          <span className="mant-kpi-value">{tipoCount['PREVENTIVO'] || 0}</span>
          <span className="mant-kpi-label">Preventivos</span>
        </div>
        <div className="mant-kpi-metric">
          <span className="mant-kpi-value" style={{ color: '#f59e0b' }}>{tipoCount['CORRECTIVO'] || 0}</span>
          <span className="mant-kpi-label">Correctivos</span>
        </div>
        <div className="mant-kpi-metric">
          <span className="mant-kpi-value">{kpis.equipos_con_ot}</span>
          <span className="mant-kpi-label">Equipos atendidos</span>
        </div>
        <div className="mant-kpi-metric">
          <span className="mant-kpi-value" style={{ color: 'var(--clr-success)' }}>{formatCurrency(kpis.liquidado_total)}</span>
          <span className="mant-kpi-label">Liquidado total</span>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Distribucion por estado
          </span>
        </div>
        <div style={{ display: 'flex', height: 8, borderRadius: 'var(--radius-full)', overflow: 'hidden', gap: 2 }}>
          {Object.entries(ESTADO_COLORS).map(([estado, cfg]) => {
            const count = estadoCount[estado] || 0;
            const pct = (count / totalEstados) * 100;
            if (pct < 0.5) return null;
            return (
              <div key={estado} style={{
                flex: `${pct} 1 0`,
                background: cfg.bg,
                borderRadius: 4,
                minWidth: 4,
                transition: 'flex 0.6s ease',
                position: 'relative',
              }} title={`${cfg.label}: ${count} (${pct.toFixed(0)}%)`} />
            );
          })}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
          {Object.entries(ESTADO_COLORS).map(([estado, cfg]) => {
            const count = estadoCount[estado] || 0;
            return (
              <div key={estado} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.bg }} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  {cfg.label}: <strong style={{ color: 'var(--text-primary)' }}>{count}</strong>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {(kpis.tendencias || []).length > 0 && (
        <TendenciasMensualesChart
          data={kpis.tendencias}
          periodo={periodo}
          onChangePeriodo={onChangePeriodo}
        />
      )}

      <div style={{
        paddingTop: '1rem',
        borderTop: '1px solid var(--border-color)',
      }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Activity size={14} color="#f59e0b" />
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>En campo</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>{kpis.tecnicos_activos}</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginLeft: 4 }}>Tecnicos</span>
            </div>
            <div>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>{kpis.preventivos_pendientes}</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginLeft: 4 }}>Prev. pend.</span>
            </div>
          </div>
        </div>
      </div>
  );
}

export function DashboardPage() {
  const [periodo, setPeriodo] = useState(12);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const kpiParams = new URLSearchParams({ meses: periodo });
  if (fechaDesde) kpiParams.set('fecha_desde', fechaDesde);
  if (fechaHasta) kpiParams.set('fecha_hasta', fechaHasta);

  const { data: mantKpis, isLoading: mantLoading, isError: mantError } = useQuery({
    queryKey: ['mantenimiento-kpis', periodo, fechaDesde, fechaHasta],
    queryFn: () => api.get(`/mantenimiento/kpis?${kpiParams.toString()}`).then(r => r.data.data),
    refetchInterval: 60_000,
  });

  const kpis = [
    { label: 'Oportunidades activas', value: '24', delta: '+3 esta semana', deltaType: 'up',   icon: TrendingUp,  color: '#6366f1' },
    { label: 'Empresas registradas',  value: '187', delta: '+12 este mes',  deltaType: 'up',   icon: Users,       color: '#22c55e' },
    { label: 'Pipeline total',        value: '$48.2M', delta: '+8.4%',      deltaType: 'up',   icon: DollarSign,  color: '#f59e0b' },
    { label: 'Tareas vencidas',       value: '7',   delta: '-2 vs ayer',    deltaType: 'down', icon: CheckSquare, color: '#ef4444' },
  ];

  return (
    <div className="app-layout">

      <Topbar
        title="Dashboard"
        subtitle={new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      />

      <main className="main-content">
        <div className="kpi-grid mb-6">
          {kpis.map(k => <KpiCard key={k.label} {...k} />)}
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <MantenimientoKpiCard
            kpis={mantKpis}
            isLoading={mantLoading}
            isError={mantError}
            periodo={periodo}
            onChangePeriodo={setPeriodo}
            fechaDesde={fechaDesde}
            fechaHasta={fechaHasta}
            onChangeFechaDesde={setFechaDesde}
            onChangeFechaHasta={setFechaHasta}
          />
        </div>

        <div className="page-grid-2cols" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem' }}>
          <div className="card">
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1.25rem' }}>
              Pipeline por etapa
            </h2>
            {[
              { name: 'Prospecto',   count: 8, value: '$12.4M', color: '#94a3b8', pct: 30 },
              { name: 'Calificado',  count: 6, value: '$15.8M', color: '#60a5fa', pct: 45 },
              { name: 'Propuesta',   count: 5, value: '$9.2M',  color: '#a78bfa', pct: 38 },
              { name: 'Negociacion', count: 3, value: '$8.6M',  color: '#fb923c', pct: 25 },
              { name: 'Ganado',      count: 2, value: '$2.2M',  color: '#4ade80', pct: 12 },
            ].map(stage => (
              <div key={stage.name} style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{stage.name}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {stage.count} oport. &middot; {stage.value}
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${stage.pct}%`, background: stage.color,
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '0.75rem' }}>
              Actividad reciente
            </h2>
            {[
              { type: 'call',     subject: 'Llamada con LOGITRANS S.A.S', created_by_name: 'Carlos M.', date: new Date() },
              { type: 'email',    subject: 'Cotizacion #0042 enviada',     created_by_name: 'Ana P.',    date: new Date(Date.now() - 3600000) },
              { type: 'whatsapp', subject: 'Mensaje de seguimiento',        created_by_name: 'Carlos M.', date: new Date(Date.now() - 7200000) },
              { type: 'meeting',  subject: 'Reunion de cierre Q2',          created_by_name: 'Ana P.',    date: new Date(Date.now() - 86400000) },
              { type: 'note',     subject: 'Nota interna: revisar flete',   created_by_name: 'Tu',        date: new Date(Date.now() - 172800000) },
            ].map((item, i) => <ActivityItem key={i} item={item} />)}
          </div>
        </div>
      </main>
    </div>
  );
}
