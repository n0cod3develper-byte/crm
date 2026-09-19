import React from 'react';

/**
 * GaugeCard — Tarjeta con gauge/velocímetro SVG para KPIs de presupuesto.
 *
 * Props:
 *   label            — título de la tarjeta
 *   cumplimientoPct  — porcentaje de cumplimiento (null si sin presupuesto)
 *   real             — valor real (number)
 *   presupuesto      — valor presupuestado (number)
 *   sinPresupuesto   — boolean
 *   fmt              — función de formato de moneda
 *   icon             — componente de icono (lucide-react)
 *   color            — color de fallback
 */
export default function GaugeCard({ label, cumplimientoPct, real, presupuesto, sinPresupuesto, fmt, icon: Icon, color }) {
  // Gauge config: 0% to 120% mapped to 180° arc
  const MIN_VAL = 0;
  const MAX_VAL = 120;
  const clampedPct = sinPresupuesto ? 0 : Math.min(Math.max(cumplimientoPct || 0, MIN_VAL), MAX_VAL);

  // SVG geometry
  const size = 160;
  const cx = size / 2;
  const cy = size / 2 + 10;
  const radius = 60;
  const strokeWidth = 14;
  const startAngle = Math.PI; // 180° (left)
  const endAngle = 0;         // 0° (right)

  // Arc path helper
  const describeArc = (x, y, r, startA, endA) => {
    const sx = x + r * Math.cos(startA);
    const sy = y - r * Math.sin(startA);
    const ex = x + r * Math.cos(endA);
    const ey = y - r * Math.sin(endA);
    const largeArc = (startA - endA) > Math.PI ? 1 : 0;
    return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`;
  };

  // Full background arc (0 to 120%)
  const fullArcPath = describeArc(cx, cy, radius, startAngle, endAngle);

  // Value arc (0 to clampedPct%)
  const valueAngle = startAngle - (clampedPct / MAX_VAL) * Math.PI;
  const valueArcPath = clampedPct > 0.5 ? describeArc(cx, cy, radius, startAngle, valueAngle) : '';

  // Needle endpoint
  const needleAngle = startAngle - (clampedPct / MAX_VAL) * Math.PI;
  const needleLength = radius - 8;
  const needleX = cx + needleLength * Math.cos(needleAngle);
  const needleY = cy - needleLength * Math.sin(needleAngle);

  // Color based on threshold
  const getColor = (pct) => {
    if (pct == null) return '#9ca3af';
    if (pct >= 95) return '#22c55e';
    if (pct >= 80) return '#f59e0b';
    return '#ef4444';
  };

  const gaugeColor = sinPresupuesto ? '#9ca3af' : getColor(cumplimientoPct);

  // Segment colors for the background (red → yellow → green)
  const segments = [
    { start: 0, end: 80, color: 'rgba(239,68,68,0.2)' },
    { start: 80, end: 95, color: 'rgba(245,158,11,0.2)' },
    { start: 95, end: 120, color: 'rgba(34,197,94,0.2)' },
  ];

  return (
    <div className="kpi-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.25rem' }}>
        <span className="kpi-label" style={{ fontSize: 'var(--text-xs)' }}>{label}</span>
        {Icon && (
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `${gaugeColor}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={14} color={gaugeColor} />
          </div>
        )}
      </div>

      {/* Gauge SVG */}
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.75}`} style={{ display: 'block' }}>
        {/* Background segments */}
        {segments.map((seg, i) => {
          const segStart = startAngle - (seg.start / MAX_VAL) * Math.PI;
          const segEnd = startAngle - (seg.end / MAX_VAL) * Math.PI;
          const d = describeArc(cx, cy, radius, segStart, segEnd);
          return (
            <path key={i} d={d} fill="none" stroke={seg.color} strokeWidth={strokeWidth} strokeLinecap="round" />
          );
        })}

        {/* Value arc */}
        {valueArcPath && (
          <path d={valueArcPath} fill="none" stroke={gaugeColor} strokeWidth={strokeWidth} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${gaugeColor}66)` }} />
        )}

        {/* Needle */}
        {!sinPresupuesto && clampedPct > 0 && (
          <>
            <line x1={cx} y1={cy} x2={needleX} y2={needleY}
              stroke="var(--text-primary)" strokeWidth={2.5} strokeLinecap="round" />
            <circle cx={cx} cy={cy} r={5} fill="var(--text-primary)" />
          </>
        )}

        {/* Center value */}
        <text x={cx} y={cy - 14} textAnchor="middle" fill={gaugeColor}
          fontSize={22} fontWeight={700} fontFamily="var(--font-sans)">
          {sinPresupuesto ? '—' : `${Math.round(cumplimientoPct || 0)}%`}
        </text>

        {/* Min/Max labels */}
        <text x={cx - radius - 8} y={cy + 16} textAnchor="middle" fill="var(--text-muted)" fontSize={9}>
          0%
        </text>
        <text x={cx + radius + 8} y={cy + 16} textAnchor="middle" fill="var(--text-muted)" fontSize={9}>
          120%
        </text>
      </svg>

      {/* Values below */}
      <div style={{ width: '100%', fontSize: 'var(--text-xs)', marginTop: '0.125rem' }}>
        {sinPresupuesto ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '0.25rem 0' }}>
            Sin presupuesto asignado
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Real</div>
              <div style={{ fontWeight: 700, color: gaugeColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {fmt(real)}
              </div>
            </div>
            <div style={{ width: 1, background: 'var(--border-color)', alignSelf: 'stretch' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Presupuesto</div>
              <div style={{ fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {fmt(presupuesto)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
