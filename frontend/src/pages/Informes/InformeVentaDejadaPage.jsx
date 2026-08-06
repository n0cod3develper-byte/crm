import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download, RefreshCw, TrendingDown, Wrench, AlertTriangle, DollarSign, BarChart3, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Topbar } from '../../components/layout/Topbar';

const fmt = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

const COLORS = ['#ef4444', '#f59e0b', '#8b5cf6', '#6366f1', '#ec4899', '#f97316', '#14b8a6', '#06b6d4'];

function EquipoSearch({ value, onChange }) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data: equipos } = useQuery({
    queryKey: ['equiposSearch', search],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      const { data } = await api.get(`/equipos?search=${encodeURIComponent(search)}&limit=15`);
      return data.data || data || [];
    },
    enabled: search.length >= 2,
    staleTime: 30000
  });

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Search size={14} style={{ color: 'var(--text-muted)', position: 'absolute', left: '0.5rem', zIndex: 1 }} />
        <input
          type="text"
          placeholder="Buscar por marca, serie o modelo..."
          value={search}
          onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
          onFocus={() => search.length >= 2 && setShowDropdown(true)}
          style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 1.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }}
        />
        {value && (
          <button onClick={() => { onChange(''); setSearch(''); }} style={{ position: 'absolute', right: '0.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }} title="Limpiar">&times;</button>
        )}
      </div>
      {showDropdown && equipos && equipos.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 50, maxHeight: '200px', overflow: 'auto' }}>
          {equipos.map(eq => (
            <div key={eq.id} onClick={() => { onChange(eq.id); setSearch(`${eq.marca || ''} ${eq.serie || eq.modelo || ''}`); setShowDropdown(false); }}
              style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border-color)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-app)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ fontWeight: 600 }}>{eq.marca} {eq.modelo || eq.serie}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Serie: {eq.serie || eq.serial || 'N/A'}</div>
            </div>
          ))}
        </div>
      )}
      {showDropdown && search.length >= 2 && equipos && equipos.length === 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.75rem', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', zIndex: 50 }}>
          No se encontraron equipos
        </div>
      )}
    </div>
  );
}

function Filtros({ filters, setFilters, empresas }) {
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Fecha Inicio *</label>
          <input type="date" value={filters.fecha_inicio} onChange={e => setFilters(f => ({...f, fecha_inicio: e.target.value}))}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }} />
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Fecha Fin *</label>
          <input type="date" value={filters.fecha_fin} onChange={e => setFilters(f => ({...f, fecha_fin: e.target.value}))}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }} />
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Empresa</label>
          <select value={filters.empresa_id} onChange={e => setFilters(f => ({...f, empresa_id: e.target.value}))}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }}>
            <option value="">Todas</option>
            {(empresas || []).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Tipo Mantenimiento</label>
          <select value={filters.tipo_mantenimiento} onChange={e => setFilters(f => ({...f, tipo_mantenimiento: e.target.value}))}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }}>
            <option value="">Todos</option>
            <option value="CORRECTIVO">Correctivo</option>
            <option value="PREVENTIVO">Preventivo</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Equipo</label>
          <EquipoSearch value={filters.equipo_id} onChange={id => setFilters(f => ({...f, equipo_id: id}))} />
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '15', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
        <Icon size={20} color={color} />
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

export function InformeVentaDejadaPage() {
  const [filters, setFilters] = useState({ fecha_inicio: '', fecha_fin: '', empresa_id: '', tipo_mantenimiento: '', equipo_id: '' });

  const { data: empresas } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => { const { data } = await api.get('/companies?limit=500'); return data.data || []; }
  });

  const hasParams = Boolean(filters.fecha_inicio && filters.fecha_fin);

  const { data: informe, isLoading, refetch } = useQuery({
    queryKey: ['informeVentaDejada', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('fecha_inicio', filters.fecha_inicio);
      params.set('fecha_fin', filters.fecha_fin);
      if (filters.empresa_id) params.set('empresa_id', filters.empresa_id);
      if (filters.tipo_mantenimiento) params.set('tipo_mantenimiento', filters.tipo_mantenimiento);
      if (filters.equipo_id) params.set('equipo_id', filters.equipo_id);
      const { data } = await api.get('/informes/mantenimiento/venta-dejada-percibir?' + params.toString());
      return data.data;
    },
    enabled: hasParams
  });

  const handleExport = () => {
    if (!informe) return;
    try {
      toast.loading('Exportando...', { id: 'export-vdp' });
      const wb = XLSX.utils.book_new();

      // Hoja 1: Detalle por Equipo/Mes
      const wsDetalle = XLSX.utils.json_to_sheet(informe.detalle.map(d => ({
        Consecutivo: d.consecutivo,
        Tipo: d.tipo_mantenimiento,
        Equipo: d.equipo,
        Empresa: d.empresa,
        'Fecha Apertura': d.fecha_apertura ? new Date(d.fecha_apertura).toLocaleDateString('es-CO') : '',
        'Fecha Cierre': d.fecha_cierre ? new Date(d.fecha_cierre).toLocaleDateString('es-CO') : 'Abierta',
        'Dias Calendario': d.dias_calendario,
        'Dias Habiles': d.dias_habiles,
        'Valor Perdido': d.valor_perdido,
        Estado: d.estado
      })));
      XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle OTs');

      // Hoja 2: Por Equipo (Ranking)
      if (informe.por_equipo.length) {
        const wsEq = XLSX.utils.json_to_sheet(informe.por_equipo.map(e => ({
          Equipo: e.equipo,
          'Venta Perdida': e.total
        })));
        XLSX.utils.book_append_sheet(wb, wsEq, 'Por Equipo');
      }

      // Hoja 3: Por Tipo Mantenimiento
      if (informe.por_tipo.length) {
        const wsTipo = XLSX.utils.json_to_sheet(informe.por_tipo.map(t => ({
          'Tipo Mantenimiento': t.tipo,
          'Venta Perdida': t.total
        })));
        XLSX.utils.book_append_sheet(wb, wsTipo, 'Por Tipo');
      }

      // Hoja 4: Por Mes
      if (informe.por_mes.length) {
        const wsMes = XLSX.utils.json_to_sheet(informe.por_mes.map(m => ({
          Mes: m.mes,
          'Venta Perdida': m.total
        })));
        XLSX.utils.book_append_sheet(wb, wsMes, 'Por Mes');
      }

      XLSX.writeFile(wb, `Venta_Dejada_Percibir_${filters.fecha_inicio}_${filters.fecha_fin}.xlsx`);
      toast.success('Exportado correctamente', { id: 'export-vdp' });
    } catch { toast.error('Error exportando', { id: 'export-vdp' }); }
  };

  return (
    <div className="app-layout">
      <Topbar title="Venta Dejada de Percibir" subtitle="Estimacion de ingresos perdidos por indisponibilidad de equipos en mantenimiento"
        rightContent={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn--secondary" onClick={() => refetch()} title="Actualizar"><RefreshCw size={16} /></button>
            <button className="btn btn--primary" onClick={handleExport} disabled={!informe}><Download size={16} /><span>Exportar Excel</span></button>
          </div>
        } />
      <main className="main-content">
        {/* Nota de advertencia */}
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '12px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={14} />
          <span><strong>Nota:</strong> Este informe es una <strong>estimacion</strong>. El valor real depende de la disponibilidad efectiva del equipo y las condiciones comerciales del momento.</span>
        </div>

        <Filtros filters={filters} setFilters={setFilters} empresas={empresas} />

        {!hasParams ? (
          <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            <BarChart3 size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>Selecciona un rango de fechas para generar el informe.</p>
          </div>
        ) : isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <RefreshCw className="spinner" size={32} style={{ color: 'var(--primary-500)' }} />
          </div>
        ) : informe ? (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <KpiCard icon={DollarSign} label="Total Venta Perdida (Est.)" value={fmt(informe.total_perdido)} color="#ef4444" />
              <KpiCard icon={Wrench} label="OTs en Periodo" value={informe.total_ots} color="#6366f1" />
              <KpiCard icon={TrendingDown} label="OTs con Presupuesto" value={informe.total_ots_con_presupuesto} color="#f59e0b" />
              <KpiCard icon={BarChart3} label="Equipo Mayor Perdida" value={informe.por_equipo[0]?.equipo?.substring(0, 20) || '-'} color="#8b5cf6" />
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {/* Ranking Top Equipos */}
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '1rem' }}>Top Equipos - Mayor Venta Perdida</h3>
                {informe.por_equipo.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={informe.por_equipo.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 30, left: 140, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis type="number" stroke="var(--text-muted)" tickFormatter={(v) => `$${(v/1000000).toFixed(1)}M`} />
                      <YAxis type="category" dataKey="equipo" width={140} stroke="var(--text-muted)" style={{ fontSize: '11px' }} />
                      <Tooltip formatter={(value) => [fmt(value), 'Venta Perdida']} />
                      <Bar dataKey="total" fill="#ef4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Sin datos de presupuesto para este rango</div>
                )}
              </div>

              {/* Por Tipo de Mantenimiento */}
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '1rem' }}>Distribucion por Tipo de Mantenimiento</h3>
                {informe.por_tipo.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={informe.por_tipo.map(t => ({ name: t.tipo, value: t.total }))}
                        cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                        {informe.por_tipo.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value) => [fmt(value), 'Venta Perdida']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Sin datos</div>
                )}
              </div>
            </div>

            {/* Tendencia Mensual */}
            {informe.por_mes.length > 0 && (
              <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '1rem' }}>Tendencia Mensual - Venta Perdida Estimada</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={informe.por_mes} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="mes" stroke="var(--text-muted)" />
                    <YAxis stroke="var(--text-muted)" tickFormatter={(v) => `$${(v/1000000).toFixed(1)}M`} />
                    <Tooltip formatter={(value) => [fmt(value), 'Venta Perdida']} />
                    <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Table - Detalle */}
            <div className="card">
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Detalle de OTs con Venta Perdida</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{informe.detalle.length} registros</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                      {['Consecutivo', 'Tipo', 'Equipo', 'Empresa', 'Fecha Apertura', 'Fecha Cierre', 'Dias Cal.', 'Dias Habiles', 'Valor Perdido', 'Estado'].map(h => (
                        <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {informe.detalle.map((d, idx) => (
                      <tr key={d.ot_id || idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>{d.consecutivo}</td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          <span style={{ fontSize: '11px', padding: '0.15rem 0.5rem', borderRadius: '4px', background: d.tipo_mantenimiento === 'CORRECTIVO' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: d.tipo_mantenimiento === 'CORRECTIVO' ? '#ef4444' : '#22c55e' }}>
                            {d.tipo_mantenimiento}
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>{d.equipo}</td>
                        <td style={{ padding: '0.6rem 0.75rem', fontSize: '12px' }}>{d.empresa}</td>
                        <td style={{ padding: '0.6rem 0.75rem', fontSize: '12px', whiteSpace: 'nowrap' }}>{d.fecha_apertura ? new Date(d.fecha_apertura).toLocaleDateString('es-CO') : '-'}</td>
                        <td style={{ padding: '0.6rem 0.75rem', fontSize: '12px', whiteSpace: 'nowrap' }}>{d.fecha_cierre ? new Date(d.fecha_cierre).toLocaleDateString('es-CO') : <span style={{ color: '#f59e0b', fontStyle: 'italic' }}>Abierta</span>}</td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>{d.dias_calendario}</td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 600 }}>{d.dias_habiles}</td>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#ef4444' }}>{fmt(d.valor_perdido)}</td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          <span className="badge" style={{ fontSize: '11px', padding: '0.15rem 0.4rem', borderRadius: '4px', background: d.estado === 'LIQUIDADA' ? 'rgba(34,197,94,0.1)' : d.estado === 'EN_PROCESO' ? 'rgba(245,158,11,0.1)' : 'rgba(100,116,139,0.1)', color: d.estado === 'LIQUIDADA' ? '#22c55e' : d.estado === 'EN_PROCESO' ? '#f59e0b' : '#94a3b8' }}>
                            {d.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {informe.detalle.length === 0 && (
                      <tr><td colSpan={10} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay OTs con presupuesto asignado en el rango seleccionado</td></tr>
                    )}
                  </tbody>
                  {informe.detalle.length > 0 && (
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 700 }}>
                        <td colSpan={6} style={{ padding: '0.75rem', textAlign: 'right' }}>TOTAL</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>{informe.detalle.reduce((s, d) => s + d.dias_calendario, 0)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>{informe.detalle.reduce((s, d) => s + d.dias_habiles, 0)}</td>
                        <td style={{ padding: '0.75rem', color: '#ef4444' }}>{fmt(informe.total_perdido)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
