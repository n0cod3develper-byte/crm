import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet, Search, Filter, FileText, Table2,
  X, ChevronDown, ChevronUp, Printer, ArrowLeft,
  Users, Clock, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import {
  useLiquidacion, useFilterOptions,
  useLiquidacionExports, useComparativa,
} from '../../hooks/useInformes';

const formatCOP = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
const formatDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`;
};
const num = (v, d = 1) => parseFloat(v || 0).toFixed(d);

// ─── KPI Card ──────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color, delta, subtitle }) {
  const up = delta === undefined ? null : delta >= 0;
  return (
    <div className="kpi-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="kpi-label">{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </div>
      </div>
      <div className="kpi-value" style={{ fontSize: 'var(--text-xl)', marginTop: 4 }}>{value}</div>
      {subtitle && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
      {up !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          {up
            ? <ArrowUpRight size={12} color="var(--clr-success)" />
            : <ArrowDownRight size={12} color="var(--clr-danger)" />}
          <span style={{ fontSize: 11, fontWeight: 700, color: up ? 'var(--clr-success)' : 'var(--clr-danger)' }}>
            {Math.abs(delta).toFixed(1)}% vs anterior
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Barra de productividad ────────────────────────────────────
function ProductividadBar({ pct }) {
  const p = Math.min(100, Math.max(0, parseFloat(pct || 0)));
  const color = p >= 80 ? '#10B981' : p >= 60 ? '#F59E0B' : '#EF4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--border-color)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${p}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 38, textAlign: 'right' }}>{num(p)}%</span>
    </div>
  );
}

export function LiquidacionGHPage() {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = React.useState(true);
  const [expandedOp, setExpandedOp] = React.useState(null);

  const [filters, setFilters] = React.useState({
    fecha_desde: '', fecha_hasta: '', operario_id: '', equipo_id: '',
  });

  const activeFilters = filters;

  const { data, isLoading, isFetching } = useLiquidacion(activeFilters);
  const { data: filterOpts }  = useFilterOptions();
  const { data: comparativa } = useComparativa('LIQUIDACION');
  const { handleDownload, downloading } = useLiquidacionExports(
    activeFilters,
    data?.totales
  );

  const rows        = data?.data || [];
  const subtotales  = data?.subtotalesPorOperario || [];
  const totales     = data?.totales || {};

  // Agrupar filas por operario
  const rowsByOp = React.useMemo(() => {
    const map = {};
    rows.forEach(r => {
      const key = r.empleado_id;
      if (!map[key]) map[key] = { operario: r.operario, identification: r.identification, empleado_id: key, rows: [] };
      map[key].rows.push(r);
    });
    return Object.values(map);
  }, [rows]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => setFilters({ fecha_desde: '', fecha_hasta: '', operario_id: '', equipo_id: '' });

  // Delta comparativa
  const delta = comparativa?.delta || {};

  return (
    <div className="app-layout">
      <Sidebar />
      <Topbar
        title="Liquidación Horas — Gestión Humana"
        subtitle={`${totales.total_operarios ?? 0} operarios${isFetching ? ' · actualizando...' : ''}`}
        rightContent={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn--ghost btn--sm" onClick={() => window.print()} title="Imprimir">
              <Printer size={14} /> Imprimir
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => handleDownload('plantilla')} disabled={!!downloading}>
              <FileSpreadsheet size={14} /> {downloading === 'plantilla' ? '...' : 'Plantilla GH'}
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => handleDownload('excel')} disabled={!!downloading}>
              <Table2 size={14} /> {downloading === 'excel' ? '...' : 'Excel'}
            </button>
            <button className="btn btn--primary btn--sm" onClick={() => handleDownload('pdf')} disabled={!!downloading}>
              <FileText size={14} /> {downloading === 'pdf' ? '...' : 'PDF'}
            </button>
          </div>
        }
      />

      <main className="main-content">
        <button className="btn btn--ghost btn--sm" style={{ marginBottom: '1rem' }} onClick={() => navigate('/informes')}>
          <ArrowLeft size={14} /> Volver a Informes
        </button>

        {/* ── KPIs ──────────────────────────────────────────── */}
        <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
          <KpiCard
            label="Total Operarios"
            value={totales.total_operarios ?? 0}
            icon={Users} color="#2563EB"
          />
          <KpiCard
            label="Horas Liquidadas"
            value={`${num(totales.total_horas)}h`}
            icon={Clock} color="#8B5CF6"
            delta={delta.total_horas}
          />
          <KpiCard
            label="Comisión Total"
            value={formatCOP(totales.total_comision)}
            icon={DollarSign} color="#10B981"
            delta={delta.total_comision}
          />
          <KpiCard
            label="Productividad Media"
            value={`${num(totales.productividad_promedio)}%`}
            icon={TrendingUp} color="#F59E0B"
            delta={delta.productividad}
            subtitle="Base: 84h/período"
          />
        </div>

        {/* ── Comparativa visual ────────────────────────────── */}
        {comparativa?.anterior && (
          <div className="card" style={{ padding: '1rem', marginBottom: '1rem', borderLeft: '3px solid var(--clr-primary-500)' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              Comparativa vs. Reporte Anterior — {new Date(comparativa.anterior.fecha_generacion).toLocaleDateString('es-CO')}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              {[
                { label: 'Horas', delta: delta.total_horas,    actual: `${num(totales.total_horas)}h`,           ant: `${num(comparativa.anterior.resumen?.total_horas)}h` },
                { label: 'Comisión', delta: delta.total_comision, actual: formatCOP(totales.total_comision),       ant: formatCOP(comparativa.anterior.resumen?.total_comision) },
                { label: 'Productividad', delta: delta.productividad, actual: `${num(totales.productividad_promedio)}%`, ant: `${num(comparativa.anterior.resumen?.productividad_promedio)}%` },
              ].map(({ label, delta: d, actual, ant }) => {
                const up = d >= 0;
                return (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 16, color: up ? 'var(--clr-success)' : 'var(--clr-danger)' }}>{actual}</span>
                      {up ? <ArrowUpRight size={14} color="var(--clr-success)" /> : <ArrowDownRight size={14} color="var(--clr-danger)" />}
                      <span style={{ fontSize: 11, fontWeight: 700, color: up ? 'var(--clr-success)' : 'var(--clr-danger)' }}>
                        {up ? '+' : ''}{num(d)}%
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Anterior: {ant}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Filtros ──────────────────────────────────────── */}
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setShowFilters(v => !v)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={15} color="var(--clr-primary-500)" />
              <span style={{ fontWeight: 600, fontSize: 13 }}>Filtros</span>
            </div>
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>

          {showFilters && (
            <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Desde</label>
                <input type="date" name="fecha_desde" className="input" value={filters.fecha_desde} onChange={handleFilterChange} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Hasta</label>
                <input type="date" name="fecha_hasta" className="input" value={filters.fecha_hasta} onChange={handleFilterChange} />
              </div>
              <select name="operario_id" className="input" value={filters.operario_id} onChange={handleFilterChange}>
                <option value="">Todos los operarios</option>
                {(filterOpts?.operarios || []).map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
              </select>
              <select name="equipo_id" className="input" value={filters.equipo_id} onChange={handleFilterChange}>
                <option value="">Todos los equipos</option>
                {(filterOpts?.equipos || []).map(e => <option key={e.id} value={e.id}>{e.numero_equipo || `${e.marca} ${e.modelo}`}</option>)}
              </select>
              <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn--ghost btn--sm" onClick={clearFilters}>
                  <X size={13} /> Limpiar filtros
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Tabla agrupada por operario ───────────────────── */}
        {isLoading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : rowsByOp.length === 0 ? (
          <div className="empty-state">
            <FileSpreadsheet size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Sin liquidaciones</h2>
            <p className="empty-state__desc">No hay registros de horas liquidadas con los filtros seleccionados.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {rowsByOp.map((opGroup) => {
              const sub = subtotales.find(s => s.empleado_id === opGroup.empleado_id) || {};
              const prod = parseFloat(sub.productividad_pct || 0);
              const isExpanded = expandedOp === opGroup.empleado_id || rowsByOp.length <= 3;

              return (
                <div key={opGroup.empleado_id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {/* Cabecera del operario */}
                  <div
                    style={{
                      background: 'linear-gradient(135deg, var(--clr-primary-700), var(--clr-primary-500))',
                      padding: '0.875rem 1.25rem',
                      cursor: rowsByOp.length > 3 ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', gap: '1rem',
                    }}
                    onClick={() => rowsByOp.length > 3 && setExpandedOp(v => v === opGroup.empleado_id ? null : opGroup.empleado_id)}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 15, color: 'white', flexShrink: 0,
                    }}>
                      {opGroup.operario?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'white', fontSize: 14 }}>{opGroup.operario}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>ID: {opGroup.identification} · {opGroup.rows.length} remisión(es)</div>
                    </div>
                    {/* Stats en cabecera */}
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>Horas</div>
                        <div style={{ fontWeight: 700, color: 'white', fontSize: 13 }}>{num(sub.total_horas_operario)}h</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>Comisión</div>
                        <div style={{ fontWeight: 800, color: '#86efac', fontSize: 13 }}>{formatCOP(sub.total_comision_operario)}</div>
                      </div>
                      <div style={{ width: 100 }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>Productividad</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.2)', borderRadius: 99 }}>
                            <div style={{
                              width: `${Math.min(100, prod)}%`, height: '100%', borderRadius: 99,
                              background: prod >= 80 ? '#4ade80' : prod >= 60 ? '#fbbf24' : '#f87171',
                            }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>{num(prod)}%</span>
                        </div>
                      </div>
                      {rowsByOp.length > 3 && (
                        isExpanded
                          ? <ChevronUp size={16} color="rgba(255,255,255,0.7)" />
                          : <ChevronDown size={16} color="rgba(255,255,255,0.7)" />
                      )}
                    </div>
                  </div>

                  {/* Tabla del operario */}
                  {isExpanded && (
                    <div className="table-wrapper" style={{ borderRadius: 0, border: 'none' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>No. Remisión</th>
                            <th>Máquina</th>
                            <th>Fecha Servicio</th>
                            <th style={{ textAlign: 'right' }}>Bonif/Hora</th>
                            <th style={{ textAlign: 'right' }}>Horas Liquidadas</th>
                            <th style={{ textAlign: 'right' }}>Comisión</th>
                          </tr>
                        </thead>
                        <tbody>
                          {opGroup.rows.map((row, ri) => (
                            <tr key={row.liquidacion_id || ri}>
                              <td>
                                <code style={{ fontWeight: 700, fontSize: 12, color: 'var(--clr-primary-400)' }}>
                                  {row.numero_remision}
                                </code>
                              </td>
                              <td style={{ fontSize: 12 }}>{row.maquina || '—'}</td>
                              <td style={{ fontSize: 12 }}>{formatDate(row.fecha_servicio)}</td>
                              <td style={{ textAlign: 'right', fontSize: 12 }}>{formatCOP(row.bonificacion_por_hora)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 12 }}>
                                {num(row.horas_liquidadas)}h
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--clr-success)' }}>
                                {formatCOP(row.comision_horas_liquidadas)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: '2px solid var(--border-color)', background: 'rgba(37,99,235,0.06)' }}>
                            <td colSpan={4} style={{ fontWeight: 700, fontSize: 12, padding: '0.6rem 1rem', color: 'var(--clr-primary-500)' }}>
                              SUBTOTAL — {opGroup.operario}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 12, padding: '0.6rem 1rem' }}>
                              {num(sub.total_horas_operario)}h
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 13, color: 'var(--clr-success)', padding: '0.6rem 1rem' }}>
                              {formatCOP(sub.total_comision_operario)}
                            </td>
                          </tr>
                          {/* Productividad */}
                          <tr style={{ background: 'var(--bg-elevated)' }}>
                            <td colSpan={6} style={{ padding: '0.5rem 1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, minWidth: 90 }}>
                                  Productividad (÷84h):
                                </span>
                                <div style={{ flex: 1, maxWidth: 300 }}>
                                  <ProductividadBar pct={prod} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            {/* TOTAL GENERAL */}
            <div style={{
              background: 'linear-gradient(135deg, var(--clr-primary-700), var(--clr-primary-600))',
              borderRadius: 'var(--radius-lg)',
              padding: '1rem 1.5rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', fontWeight: 700 }}>
                  TOTAL GENERAL — {rowsByOp.length} operario(s)
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                  {rows.length} registros de liquidación
                </div>
              </div>
              <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>Total Horas</div>
                  <div style={{ fontWeight: 800, color: 'white', fontSize: 18 }}>{num(totales.total_horas)}h</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>Total Comisión</div>
                  <div style={{ fontWeight: 800, color: '#86efac', fontSize: 18 }}>{formatCOP(totales.total_comision)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
