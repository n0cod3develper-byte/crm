import React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Heart, AlertTriangle, Calendar, Users,
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
   TAB BIENESTAR
   Fórmula de ausentismo:
   tasa = (días incapacidad) / (empleados activos × días hábiles) × 100
   ═══════════════════════════════════════════════════════════ */
export default function TabBienestar({ fechaDesde, fechaHasta }) {
  const navigate = useNavigate();

  const fechaParams = {};
  if (fechaDesde) fechaParams.fecha_desde = fechaDesde;
  if (fechaHasta) fechaParams.fecha_hasta = fechaHasta;
  const fechaQuery = new URLSearchParams(fechaParams).toString();
  const apiUrl = `/dashboard/gerencia/bienestar${fechaQuery ? `?${fechaQuery}` : ''}`;

  const { data: kpis, isLoading, isError } = useQuery({
    queryKey: ['dashboard-gerencia-bienestar', fechaDesde, fechaHasta],
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
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Error al cargar datos de Bienestar</div>;
  }

  const { ausentismo, accidentalidad, empleados_activos } = kpis;

  // Determinar severidad del ausentismo
  const ausentismoColor = ausentismo.tasa_ausentismo_pct <= 2 ? '#22c55e'
    : ausentismo.tasa_ausentismo_pct <= 5 ? '#f59e0b' : '#ef4444';

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard
          label="Tasa de ausentismo"
          value={`${ausentismo.tasa_ausentismo_pct}%`}
          delta={`${ausentismo.dias_incapacidad} días de incapacidad`}
          deltaType={ausentismo.tasa_ausentismo_pct <= 2 ? 'up' : 'down'}
          icon={Heart} color={ausentismoColor}
        />

        <KpiCard
          label="Accidentes laborales"
          value={String(accidentalidad.total_accidentes)}
          delta={`${accidentalidad.con_incapacidad} con incapacidad · ${accidentalidad.sin_incapacidad} sin incapacidad`}
          deltaType={accidentalidad.total_accidentes === 0 ? 'up' : 'down'}
          icon={AlertTriangle} color="#ef4444"
        />

        <KpiCard
          label="Días perdidos"
          value={String(accidentalidad.dias_perdidos_total)}
          delta={`Por incapacidad/accidente`}
          deltaType={accidentalidad.dias_perdidos_total === 0 ? 'up' : 'down'}
          icon={Calendar} color="#f59e0b"
        />

        <KpiCard
          label="Empleados activos"
          value={String(empleados_activos)}
          delta={`${ausentismo.dias_habiles_periodo} días hábiles en período`}
          deltaType="up"
          icon={Users} color="#6366f1"
          href="/employees"
        />
      </div>

      {/* Detalle de ausentismo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {/* Desglose de ausentismo */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '1rem' }}>
            Desglose del cálculo de ausentismo
          </h3>
          <div style={{
            padding: '1rem',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Días de incapacidad (accidentes)</span>
              <span style={{ fontWeight: 700 }}>{ausentismo.dias_incapacidad} días</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Empleados activos</span>
              <span style={{ fontWeight: 700 }}>{ausentismo.empleados_activos}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Días hábiles del período</span>
              <span style={{ fontWeight: 700 }}>{ausentismo.dias_habiles_periodo} días</span>
            </div>
            <div style={{
              borderTop: '1px solid var(--border-color)',
              paddingTop: '0.75rem',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span style={{ fontWeight: 700 }}>Tasa de ausentismo</span>
              <span style={{ fontWeight: 700, color: ausentismoColor }}>
                {ausentismo.tasa_ausentismo_pct}%
              </span>
            </div>
            <div style={{
              fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.5rem',
              fontStyle: 'italic',
            }}>
              Fórmula: {ausentismo.dias_incapacidad} / ({ausentismo.empleados_activos} × {ausentismo.dias_habiles_periodo}) × 100
            </div>
          </div>

          {/* Indicador visual */}
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: ausentismo.tasa_ausentismo_pct <= 2 ? 'rgba(34,197,94,0.1)' : ausentismo.tasa_ausentismo_pct <= 5 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
          }}>
            <span style={{
              fontSize: 'var(--text-xs)', fontWeight: 600,
              color: ausentismoColor,
            }}>
              {ausentismo.tasa_ausentismo_pct <= 2
                ? '✓ Tasa de ausentismo dentro del rango aceptable'
                : ausentismo.tasa_ausentismo_pct <= 5
                  ? '⚠ Tasa de ausentismo moderada — monitorear'
                  : '🔴 Tasa de ausentismo alta — requiere atención'}
            </span>
          </div>
        </div>

        {/* Detalle de accidentalidad */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '1rem' }}>
            Detalle de accidentalidad
          </h3>

          {accidentalidad.total_accidentes === 0 ? (
            <div style={{
              textAlign: 'center', padding: '2rem',
              background: 'rgba(34,197,94,0.1)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#22c55e' }}>
                Sin accidentes registrados en el período
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                ¡Excelente nivel de seguridad!
              </div>
            </div>
          ) : (
            <div>
              {/* Barras de progreso */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Con incapacidad</span>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{accidentalidad.con_incapacidad}</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${accidentalidad.total_accidentes > 0 ? (accidentalidad.con_incapacidad / accidentalidad.total_accidentes) * 100 : 0}%`,
                    background: '#ef4444',
                    borderRadius: 'var(--radius-full)',
                  }} />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Sin incapacidad</span>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{accidentalidad.sin_incapacidad}</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${accidentalidad.total_accidentes > 0 ? (accidentalidad.sin_incapacidad / accidentalidad.total_accidentes) * 100 : 0}%`,
                    background: '#f59e0b',
                    borderRadius: 'var(--radius-full)',
                  }} />
                </div>
              </div>

              {/* Resumen */}
              <div style={{
                padding: '0.75rem',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-xs)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total accidentes</span>
                  <span style={{ fontWeight: 700 }}>{accidentalidad.total_accidentes}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Días perdidos totales</span>
                  <span style={{ fontWeight: 700, color: '#ef4444' }}>{accidentalidad.dias_perdidos_total} días</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Índice de accidentalidad</span>
                  <span style={{ fontWeight: 700 }}>
                    {empleados_activos > 0 ? ((accidentalidad.total_accidentes / empleados_activos) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Nota sobre limitaciones */}
          <div style={{
            marginTop: '1rem', padding: '0.75rem',
            background: 'rgba(99,102,241,0.08)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Nota:</strong> El cálculo de ausentismo se basa únicamente en días de incapacidad por accidentes laborales registrados en el CRM. No incluye ausencias por enfermedad general o permisos médicos, los cuales no se registran actualmente en el sistema.
          </div>
        </div>
      </div>
    </div>
  );
}
