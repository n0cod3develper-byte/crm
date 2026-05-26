import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, Search, Filter, Download, FileText, Table2,
  X, ChevronDown, ChevronUp, Printer, ArrowLeft,
  TrendingUp, DollarSign, Clock, Percent, Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import { useTotalizadoFinal, useFilterOptions, useTotalizadoExports, useComparativa } from '../../hooks/useInformes';

const formatCOP = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
const formatDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`;
};
const num = (v, d = 1) => parseFloat(v || 0).toFixed(d);

const ESTADO_COLOR = {
  BORRADOR: '#64748b', PENDIENTE: '#f59e0b',
  REALIZADA: '#6366f1', LIQUIDADA: '#22c55e', ANULADO: '#ef4444',
};
const ESTADO_BADGE = {
  BORRADOR: 'gray', PENDIENTE: 'warning',
  REALIZADA: 'primary', LIQUIDADA: 'green', ANULADO: 'danger',
};

// ─── KPI Card ──────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color, delta }) {
  const up = delta >= 0;
  return (
    <div className="kpi-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="kpi-label">{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </div>
      </div>
      <div className="kpi-value" style={{ fontSize: 'var(--text-xl)', marginTop: 4 }}>{value}</div>
      {delta !== undefined && delta !== null && (
        <span className={`kpi-delta kpi-delta--${up ? 'up' : 'down'}`}>
          {up ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}% vs anterior
        </span>
      )}
    </div>
  );
}

// ─── Toggle columnas ───────────────────────────────────────────
const ALL_COLUMNS = [
  { key: 'tipo',            label: 'Tipo',            default: true },
  { key: 'toneladas',       label: 'Toneladas',       default: true },
  { key: 'numero_remision', label: 'No. Remisión',    default: true },
  { key: 'servicio',        label: 'Servicio',        default: true },
  { key: 'forma_pago',      label: 'Forma Pago',      default: true },
  { key: 'fecha_servicio',  label: 'Fecha Servicio',  default: true },
  { key: 'fecha_factura',   label: 'Fecha Factura',   default: false },
  { key: 'numero_factura',  label: 'No. Factura',     default: false },
  { key: 'estado',          label: 'Estado',          default: true },
  { key: 'empresa_nombre',  label: 'Empresa',         default: true },
  { key: 'nit',             label: 'NIT',             default: true },
  { key: 'operario_nombre', label: 'Operario',        default: true },
  { key: 'maquina',         label: 'Máquina',         default: true },
  { key: 'cantidad_horas',  label: 'Horas',           default: true },
  { key: 'valor_hora',      label: 'Valor/Hora',      default: true },
  { key: 'importe',         label: 'Importe',         default: false },
  { key: 'ciudad_envio',    label: 'Ciudad',          default: true },
  { key: 'horometro_salida',label: 'Horóm. Sal.',     default: false },
  { key: 'horometro_regreso',label:'Horóm. Reg.',     default: false },
  { key: 'direccion',       label: 'Dirección',       default: false },
  { key: 'email',           label: 'Email',           default: false },
  { key: 'telefono',        label: 'Teléfono',        default: false },
  { key: 'descuentos',      label: 'Descuento',       default: false },
  { key: 'total_neto',      label: 'Total Neto',      default: true },
];

export function TotalizadoFinalPage() {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = React.useState(true);
  const [showColPicker, setShowColPicker] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const LIMIT = 50;

  const [filters, setFilters] = React.useState({
    fecha_desde: '', fecha_hasta: '', company_id: '', operario_id: '',
    equipo_id: '', estado: 'all', tipo_servicio: 'all', ciudad: '',
    horas_min: '', horas_max: '', facturacion_min: '', facturacion_max: '',
    search: '', limit: LIMIT, offset: 0,
  });

  // Columnas visibles
  const [visibleCols, setVisibleCols] = React.useState(
    () => Object.fromEntries(ALL_COLUMNS.map(c => [c.key, c.default]))
  );
  const activeCols = ALL_COLUMNS.filter(c => visibleCols[c.key]);

  const activeFilters = { ...filters, offset: page * LIMIT };

  const { data, isLoading, isFetching } = useTotalizadoFinal(activeFilters);
  const { data: filterOpts } = useFilterOptions();
  const { data: comparativa } = useComparativa('TOTALIZADO');
  const { handleDownload, downloading } = useTotalizadoExports(activeFilters);

  const rows = data?.data || [];
  const kpis = data?.kpis || {};
  const pagination = data?.pagination || {};

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters({
      fecha_desde: '', fecha_hasta: '', company_id: '', operario_id: '',
      equipo_id: '', estado: 'all', tipo_servicio: 'all', ciudad: '',
      horas_min: '', horas_max: '', facturacion_min: '', facturacion_max: '',
      search: '', limit: LIMIT, offset: 0,
    });
    setPage(0);
  };

  const renderCell = (col, row) => {
    switch (col.key) {
      case 'tipo':
        return <span className="badge badge--gray" style={{ fontSize: 10 }}>{row.tipo || '—'}</span>;
      case 'numero_remision':
        return <code style={{ fontWeight: 800, fontSize: 12, color: 'var(--clr-primary-400)' }}>{row.numero_remision}</code>;
      case 'servicio':
        return (
          <div>
            <div style={{ fontWeight: 600, fontSize: 12 }}>{row.servicio_codigo}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{row.servicio_nombre}</div>
          </div>
        );
      case 'fecha_servicio': return <span style={{ fontSize: 12 }}>{formatDate(row.fecha_servicio)}</span>;
      case 'fecha_factura':  return <span style={{ fontSize: 12 }}>{formatDate(row.fecha_factura)}</span>;
      case 'estado':
        return <span className={`badge badge--${ESTADO_BADGE[row.estado] || 'gray'}`} style={{ fontSize: 10 }}>{row.estado}</span>;
      case 'empresa_nombre':
        return (
          <div>
            <div style={{ fontWeight: 600, fontSize: 12 }}>{row.empresa_nombre}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{row.ciudad_envio}</div>
          </div>
        );
      case 'valor_hora':    return <span style={{ fontSize: 12 }}>{formatCOP(row.valor_hora)}</span>;
      case 'importe':       return <span style={{ fontSize: 12, fontWeight: 600 }}>{formatCOP(row.importe)}</span>;
      case 'descuentos':    return <span style={{ fontSize: 12, color: 'var(--clr-danger)' }}>{formatCOP(row.descuentos)}</span>;
      case 'total_neto':
        return <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--clr-primary-500)' }}>{formatCOP(row.total_neto)}</span>;
      case 'toneladas':     return <span style={{ fontWeight: 600, fontSize: 12 }}>{num(row.toneladas)} T</span>;
      case 'cantidad_horas':return <span style={{ fontWeight: 600, fontSize: 12 }}>{num(row.cantidad_horas)}h</span>;
      case 'horometro_salida': return <span style={{ fontSize: 12 }}>{row.horometro_salida ?? '—'}</span>;
      case 'horometro_regreso':return <span style={{ fontSize: 12 }}>{row.horometro_regreso ?? '—'}</span>;
      default:
        return <span style={{ fontSize: 12 }}>{row[col.key] || '—'}</span>;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <Topbar
        title="Informe Totalizado Final"
        subtitle={`${pagination.total ?? 0} registros${isFetching ? ' · actualizando...' : ''}`}
        rightContent={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn--ghost btn--sm" onClick={() => window.print()} title="Imprimir">
              <Printer size={14} /> Imprimir
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
          <KpiCard label="Total Servicios"  value={kpis.total_servicios ?? 0}       icon={BarChart3}    color="#2563EB" delta={comparativa?.delta?.total_neto} />
          <KpiCard label="Total Facturado"  value={formatCOP(kpis.total_facturado)} icon={DollarSign}   color="#10B981" />
          <KpiCard label="Total Horas"      value={`${num(kpis.total_horas)}h`}     icon={Clock}        color="#8B5CF6" />
          <KpiCard label="Total Descuentos" value={formatCOP(kpis.total_descuentos)}icon={Percent}      color="#F59E0B" />
          <KpiCard label="Total Neto"       value={formatCOP(kpis.total_neto)}      icon={TrendingUp}   color="#06B6D4" delta={comparativa?.delta?.total_neto} />
        </div>

        {/* ── Filtros ──────────────────────────────────────── */}
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setShowFilters(v => !v)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={15} color="var(--clr-primary-500)" />
              <span style={{ fontWeight: 600, fontSize: 13 }}>Filtros Avanzados</span>
              {Object.values(filters).some(v => v && v !== 'all' && v !== LIMIT && v !== 0) && (
                <span className="badge badge--primary" style={{ fontSize: 10 }}>Activos</span>
              )}
            </div>
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>

          {showFilters && (
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Búsqueda + Fechas */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input name="search" className="input" style={{ paddingLeft: '2.25rem' }}
                    placeholder="Buscar por No. remisión, empresa o NIT..."
                    value={filters.search} onChange={handleFilterChange} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Desde</label>
                  <input type="date" name="fecha_desde" className="input" value={filters.fecha_desde} onChange={handleFilterChange} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Hasta</label>
                  <input type="date" name="fecha_hasta" className="input" value={filters.fecha_hasta} onChange={handleFilterChange} />
                </div>
              </div>

              {/* Selectores */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                <select name="estado" className="input" value={filters.estado} onChange={handleFilterChange}>
                  <option value="all">Todos los estados</option>
                  {['BORRADOR', 'PENDIENTE', 'REALIZADA', 'LIQUIDADA', 'ANULADO'].map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
                <select name="tipo_servicio" className="input" value={filters.tipo_servicio} onChange={handleFilterChange}>
                  <option value="all">Todos los tipos</option>
                  {(filterOpts?.tipos || []).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select name="operario_id" className="input" value={filters.operario_id} onChange={handleFilterChange}>
                  <option value="">Todos los operarios</option>
                  {(filterOpts?.operarios || []).map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
                </select>
                <select name="equipo_id" className="input" value={filters.equipo_id} onChange={handleFilterChange}>
                  <option value="">Todos los equipos</option>
                  {(filterOpts?.equipos || []).map(e => <option key={e.id} value={e.id}>{e.numero_equipo || `${e.marca} ${e.modelo}`}</option>)}
                </select>
              </div>

              {/* Rangos */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
                <input name="ciudad" className="input" placeholder="Ciudad..." value={filters.ciudad} onChange={handleFilterChange} />
                <input type="number" name="horas_min" className="input" placeholder="Horas mín." value={filters.horas_min} onChange={handleFilterChange} />
                <input type="number" name="horas_max" className="input" placeholder="Horas máx." value={filters.horas_max} onChange={handleFilterChange} />
                <input type="number" name="facturacion_min" className="input" placeholder="Facturación mín." value={filters.facturacion_min} onChange={handleFilterChange} />
                <input type="number" name="facturacion_max" className="input" placeholder="Facturación máx." value={filters.facturacion_max} onChange={handleFilterChange} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn--ghost btn--sm" onClick={clearFilters}>
                  <X size={13} /> Limpiar filtros
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Toolbar tabla ─────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Mostrando <strong>{rows.length}</strong> de <strong>{pagination.total ?? 0}</strong> registros
          </span>
          <div style={{ position: 'relative' }}>
            <button className="btn btn--ghost btn--sm" onClick={() => setShowColPicker(v => !v)}>
              {showColPicker ? <EyeOff size={13} /> : <Eye size={13} />} Columnas
            </button>
            {showColPicker && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', zIndex: 50, marginTop: 4,
                background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)', padding: '0.75rem', minWidth: 220,
                boxShadow: 'var(--shadow-lg)', maxHeight: 360, overflowY: 'auto',
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Columnas visibles
                </p>
                {ALL_COLUMNS.map(col => (
                  <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={!!visibleCols[col.key]}
                      onChange={e => setVisibleCols(prev => ({ ...prev, [col.key]: e.target.checked }))} />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Tabla ────────────────────────────────────────── */}
        {isLoading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <BarChart3 size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Sin datos</h2>
            <p className="empty-state__desc">No hay remisiones con los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {activeCols.map(col => (
                    <th key={col.key} style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={row.id || ri}>
                    {activeCols.map(col => (
                      <td key={col.key} style={{ verticalAlign: 'middle' }}>
                        {renderCell(col, row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {/* Fila de totales */}
              <tfoot>
                <tr style={{ background: 'var(--bg-elevated)', borderTop: '2px solid var(--border-color)' }}>
                  {activeCols.map((col, ci) => (
                    <td key={col.key} style={{ fontWeight: 700, fontSize: 12, padding: '0.6rem 1rem' }}>
                      {col.key === 'tipo' ? `TOTAL (${rows.length})` :
                        col.key === 'cantidad_horas' ? `${num(rows.reduce((s, r) => s + parseFloat(r.cantidad_horas || 0), 0))}h` :
                        col.key === 'total_neto' ? formatCOP(rows.reduce((s, r) => s + parseFloat(r.total_neto || 0), 0)) :
                        col.key === 'descuentos' ? formatCOP(rows.reduce((s, r) => s + parseFloat(r.descuentos || 0), 0)) :
                        col.key === 'importe' ? formatCOP(rows.reduce((s, r) => s + parseFloat(r.importe || 0), 0)) :
                        ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* ── Paginación ────────────────────────────────────── */}
        {!isLoading && pagination.total > LIMIT && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
            <button className="btn btn--ghost btn--sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
              ← Anterior
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Página {page + 1} de {Math.ceil(pagination.total / LIMIT)}
            </span>
            <button className="btn btn--ghost btn--sm" onClick={() => setPage(p => p + 1)} disabled={!pagination.hasMore}>
              Siguiente →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
