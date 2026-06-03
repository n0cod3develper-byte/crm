import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, FileSpreadsheet, TrendingUp, Users, ArrowRight, Clock } from 'lucide-react';
import { Topbar } from '../../components/layout/Topbar';
import { useComparativa } from '../../hooks/useInformes';

const formatCOP = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

function DeltaBadge({ delta }) {
  if (delta === null || delta === undefined) return null;
  const up = delta >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 11, fontWeight: 700,
      color: up ? 'var(--clr-success)' : 'var(--clr-danger)',
      background: up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
      padding: '2px 8px', borderRadius: 'var(--radius-full)',
    }}>
      {up ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

export function InformesIndexPage() {
  const navigate = useNavigate();
  const { data: compTotalizado } = useComparativa('TOTALIZADO');
  const { data: compLiquidacion } = useComparativa('LIQUIDACION');

  const modules = [
    {
      id: 'totalizado',
      title: 'Totalizado Final',
      description: 'Consolida todos los servicios, equipos y operarios. Incluye filtros avanzados, KPIs, exportación PDF y Excel.',
      icon: BarChart3,
      color: '#2563EB',
      bg: 'rgba(37,99,235,0.08)',
      route: '/informes/totalizado',
      stats: compTotalizado?.actual?.resumen ? [
        { label: 'Último Total Neto', value: formatCOP(compTotalizado.actual.resumen.total_neto) },
        { label: 'Variación', delta: compTotalizado?.delta?.total_neto },
      ] : null,
    },
    {
      id: 'liquidacion',
      title: 'Liquidación GH',
      description: 'Bonificación y comisiones de operarios por horas liquidadas. Incluye plantilla descargable con productividad.',
      icon: FileSpreadsheet,
      color: '#10B981',
      bg: 'rgba(16,185,129,0.08)',
      route: '/informes/liquidacion',
      stats: compLiquidacion?.actual?.resumen ? [
        { label: 'Última Comisión', value: formatCOP(compLiquidacion.actual.resumen.total_comision) },
        { label: 'Productividad', value: `${parseFloat(compLiquidacion.actual.resumen.productividad_promedio || 0).toFixed(1)}%` },
        { label: 'Variación', delta: compLiquidacion?.delta?.total_comision },
      ] : null,
    },
  ];

  return (
    <div className="app-layout">
      <Topbar
        title="Módulo de Informes"
        subtitle="Reportes consolidados de Servicios, Equipos y Gestión Humana"
      />

      <main className="main-content">
        {/* Hero */}
        <div style={{
          background: 'linear-gradient(135deg, var(--clr-primary-500) 0%, var(--clr-primary-700) 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem 2.5rem',
          marginBottom: '2rem',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ position: 'absolute', bottom: -60, right: 80, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <BarChart3 size={28} color="rgba(255,255,255,0.9)" />
              <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'white', margin: 0 }}>
                Centro de Informes
              </h1>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 'var(--text-sm)', maxWidth: 560, margin: 0 }}>
              Genera reportes detallados de servicios prestados, liquidaciones de horas y comisiones de operarios.
              Exporta en PDF o Excel con un solo clic.
            </p>
          </div>
        </div>

        {/* Cards de módulos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.id}
                className="card"
                style={{ cursor: 'pointer', transition: 'all 0.2s', padding: '1.75rem' }}
                onClick={() => navigate(mod.route)}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; e.currentTarget.style.borderColor = mod.color; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = ''; }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 'var(--radius-lg)',
                    background: mod.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={22} color={mod.color} />
                  </div>
                  <ArrowRight size={18} color="var(--text-muted)" />
                </div>

                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  {mod.title}
                </h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                  {mod.description}
                </p>

                {/* Stats del último reporte */}
                {mod.stats && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {mod.stats.map((s, i) => (
                      <div key={i}>
                        {s.delta !== undefined ? (
                          <DeltaBadge delta={s.delta} />
                        ) : (
                          <>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>{s.label}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: mod.color }}>{s.value}</div>
                          </>
                        )}
                      </div>
                    ))}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} color="var(--text-muted)" />
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Último generado</span>
                    </div>
                  </div>
                )}

                {!mod.stats && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sin reportes generados aún</span>
                  </div>
                )}

                <button
                  className="btn btn--primary"
                  style={{ width: '100%', marginTop: '1.25rem', background: mod.color }}
                  onClick={(e) => { e.stopPropagation(); navigate(mod.route); }}
                >
                  <Icon size={15} />
                  Abrir {mod.title}
                </button>
              </div>
            );
          })}
        </div>

        {/* Info de características */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
            Características del Módulo
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {[
              { icon: BarChart3,     label: 'KPIs en tiempo real',       desc: 'Totales consolidados al instante' },
              { icon: FileSpreadsheet,label: 'Exportación PDF y Excel',   desc: 'Con formato corporativo CARGAR SAS' },
              { icon: TrendingUp,    label: 'Comparativas automáticas',   desc: 'Verde/rojo vs. reporte anterior' },
              { icon: Users,         label: 'Filtros avanzados',          desc: 'Por fecha, cliente, operario, máquina y más' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={15} color="var(--clr-primary-500)" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
