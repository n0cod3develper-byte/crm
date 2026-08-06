import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download, RefreshCw, AlertTriangle, TrendingDown, Target, BarChart3 } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Topbar } from '../../components/layout/Topbar';

const fmt = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

const CAUSAS_COLORS = ['#ef4444', '#f59e0b', '#8b5cf6', '#6366f1', '#ec4899', '#f97316', '#6b7280'];

const CAUSAS = [
  'Falta de maquina disponible', 'Maquina no disponible', 'Operario no disponible',
  'Falta de tecnicos disponibles', 'Incompatibilidad de horario', 'Precio fuera de presupuesto', 'Otro'
];

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
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Causa</label>
          <select value={filters.causa} onChange={e => setFilters(f => ({...f, causa: e.target.value}))}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }}>
            <option value="">Todas</option>
            {CAUSAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
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
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

export function InformeServiciosNegadosPage() {
  const [filters, setFilters] = useState({ fecha_inicio: '', fecha_fin: '', empresa_id: '', causa: '' });

  const { data: empresas } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => { const { data } = await api.get('/companies?limit=500'); return data.data || []; }
  });

  const hasParams = Boolean(filters.fecha_inicio && filters.fecha_fin);

  const { data: informe, isLoading, refetch } = useQuery({
    queryKey: ['informeServiciosNegados', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('fecha_inicio', filters.fecha_inicio);
      params.set('fecha_fin', filters.fecha_fin);
      if (filters.empresa_id) params.set('empresa_id', filters.empresa_id);
      if (filters.causa) params.set('causa', filters.causa);
      const { data } = await api.get('/servicios-negados/informe?' + params.toString());
      return data.data;
    },
    enabled: hasParams
  });

  const handleExport = () => {
    if (!informe) return;
    try {
      toast.loading('Exportando...', { id: 'export-sn' });
      const rows = informe.por_causa.map(c => ({
        Causa: c.causa,
        'Tipo(s) Equipo': c.tipos_equipo || '-',
        Cantidad: c.cantidad,
        'Valor Estimado': parseFloat(c.valor)
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Negaciones por Causa');
      if (informe.por_empresa.length) {
        const ws2 = XLSX.utils.json_to_sheet(informe.por_empresa.map(e => ({ Empresa: e.empresa, Cantidad: e.cantidad })));
        XLSX.utils.book_append_sheet(wb, ws2, 'Por Empresa');
      }
      if (informe.por_mes.length) {
        const ws3 = XLSX.utils.json_to_sheet(informe.por_mes.map(m => ({ Mes: m.mes, Cantidad: m.cantidad })));
        XLSX.utils.book_append_sheet(wb, ws3, 'Por Mes');
      }
      if (informe.por_tipo_equipo && informe.por_tipo_equipo.length) {
        const ws4 = XLSX.utils.json_to_sheet(informe.por_tipo_equipo.map(t => ({
          'Tipo Equipo': t.tipo_equipo,
          Cantidad: t.cantidad,
          'Valor Estimado': parseFloat(t.valor)
        })));
        XLSX.utils.book_append_sheet(wb, ws4, 'Por Tipo Equipo');
      }
      XLSX.writeFile(wb, `Informe_Servicios_Negados_${filters.fecha_inicio}_${filters.fecha_fin}.xlsx`);
      toast.success('Exportado correctamente', { id: 'export-sn' });
    } catch { toast.error('Error exportando', { id: 'export-sn' }); }
  };

  return (
    <div className="app-layout">
      <Topbar title="Informe Servicios Negados" subtitle="Analisis de solicitudes rechazadas por causa, empresa y periodo"
        rightContent={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn--secondary" onClick={() => refetch()} title="Actualizar"><RefreshCw size={16} /></button>
            <button className="btn btn--primary" onClick={handleExport} disabled={!informe}><Download size={16} /><span>Exportar Excel</span></button>
          </div>
        } />
      <main className="main-content">
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
              <KpiCard icon={AlertTriangle} label="Total Negaciones" value={informe.resumen.total_negaciones} color="#ef4444" />
              <KpiCard icon={TrendingDown} label="Valor Perdido Est." value={fmt(informe.resumen.total_valor)} color="#f59e0b" />
              <KpiCard icon={Target} label="Causa Mas Frecuente" value={informe.por_causa[0]?.causa || '-'} color="#8b5cf6" />
              <KpiCard icon={BarChart3} label="Causas Diferentes" value={informe.por_causa.length} color="#6366f1" />
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {/* Pie Chart - Distribucion por Causa */}
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '1rem' }}>Distribucion por Causa</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={informe.por_causa.map(c => ({ name: c.causa, value: parseInt(c.cantidad) }))}
                      cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name.split(' ').slice(0,2).join(' ')} ${(percent*100).toFixed(0)}%`}>
                      {informe.por_causa.map((_, idx) => <Cell key={idx} fill={CAUSAS_COLORS[idx % CAUSAS_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} negaciones`, 'Cantidad']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Bar Chart - Top Empresas */}
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '1rem' }}>Top Empresas con Mas Negaciones</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={informe.por_empresa} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis type="number" stroke="var(--text-muted)" />
                    <YAxis type="category" dataKey="empresa" width={120} stroke="var(--text-muted)" style={{ fontSize: '11px' }} />
                    <Tooltip />
                    <Bar dataKey="cantidad" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart - Tendencia Mensual */}
            {informe.por_mes.length > 0 && (
              <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '1rem' }}>Tendencia Mensual</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={informe.por_mes} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="mes" stroke="var(--text-muted)" />
                    <YAxis stroke="var(--text-muted)" />
                    <Tooltip />
                    <Bar dataKey="cantidad" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Table - Detalle por Causa */}
            <div className="card">
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Detalle por Causa</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                      {['Causa', 'Tipo(s) Equipo', 'Cantidad', 'Valor Estimado', '% del Total'].map(h => (
                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {informe.por_causa.map((c, idx) => {
                      const total = informe.por_causa.reduce((sum, x) => sum + parseInt(x.cantidad), 0);
                      const pct = total > 0 ? ((parseInt(c.cantidad) / total) * 100).toFixed(1) : 0;
                      return (
                        <tr key={c.causa} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ width: 10, height: 10, borderRadius: '50%', background: CAUSAS_COLORS[idx % CAUSAS_COLORS.length], flexShrink: 0 }} />
                              {c.causa}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '12px', color: 'var(--text-secondary)' }}>{c.tipos_equipo || '-'}</td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{c.cantidad}</td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{fmt(c.valor)}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>{pct}%</td>
                        </tr>
                      );
                    })}
                    {informe.por_causa.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay datos en el rango seleccionado</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
