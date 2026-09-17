import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar, Filter, Clock, DollarSign, AlertTriangle, Users,
  ChevronDown, ChevronRight, RefreshCw, Moon, Settings, FileSpreadsheet
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Layout } from '../../components/Layout';
import api from '../../lib/api';
import * as XLSX from 'xlsx';

// ─── Utilidades ─────────────────────────────────────────────────────
const formatCOP = (v) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', minimumFractionDigits: 0
}).format(v || 0);

const formatDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`;
};

const fmtH = (v) => `${(parseFloat(v) || 0).toFixed(2)}h`;

const fmtMin = (min) => {
  if (!min) return '0h 0min';
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

const getLocalDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const TIPO_LABELS = {
  ORDINARIA_DIURNA: 'Ord. Diurna',
  ORDINARIA_NOCTURNA: 'Ord. Nocturna',
  EXTRA_DIURNA: 'Extra Diurna',
  EXTRA_NOCTURNA: 'Extra Nocturna',
  DOMINICAL_FESTIVA_DIURNA: 'Dom/Fest. Diurna',
  DOMINICAL_FESTIVA_NOCTURNA: 'Dom/Fest. Nocturna',
  EXTRA_DOMINICAL_FESTIVA_DIURNA: 'Extra Dom/Fest. Diurna',
  EXTRA_DOMINICAL_FESTIVA_NOCTURNA: 'Extra Dom/Fest. Nocturna',
};

const TIPO_COLORS = {
  ORDINARIA_DIURNA: '#94a3b8',
  ORDINARIA_NOCTURNA: '#6366f1',
  EXTRA_DIURNA: '#f59e0b',
  EXTRA_NOCTURNA: '#ef4444',
  DOMINICAL_FESTIVA_DIURNA: '#10b981',
  DOMINICAL_FESTIVA_NOCTURNA: '#8b5cf6',
  EXTRA_DOMINICAL_FESTIVA_DIURNA: '#ec4899',
  EXTRA_DOMINICAL_FESTIVA_NOCTURNA: '#f43f5e',
};

// ─── KPI Card ───────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, color = '#6366f1', subtext }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-color)',
      borderRadius: 12,
      padding: '1.25rem 1.5rem',
      display: 'flex', alignItems: 'center', gap: '1rem',
    }}>
      <div style={{
        background: `${color}20`,
        borderRadius: '50%',
        padding: '0.75rem',
      }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
        {subtext && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{subtext}</div>}
      </div>
    </div>
  );
}

// ─── Desglose de segmentos ──────────────────────────────────────────
function DesgloseSegmentos({ horasLaboralesId }) {
  const { data: detalle = [], isLoading } = useQuery({
    queryKey: ['he-detalle', horasLaboralesId],
    queryFn: async () => {
      const res = await api.get(`/horas-extras/detalle/${horasLaboralesId}`);
      return res.data || [];
    },
    enabled: !!horasLaboralesId,
  });

  if (isLoading) return <div style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Cargando detalle...</div>;
  if (!detalle.length) return <div style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Sin detalle disponible</div>;

  return (
    <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
          <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)' }}>Tipo</th>
          <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-muted)' }}>%</th>
          <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-muted)' }}>Minutos</th>
          <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-muted)' }}>Horas</th>
          <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-muted)' }}>Vlr/Hora</th>
          <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-muted)' }}>Subtotal</th>
          <th style={{ textAlign: 'center', padding: '4px 8px', color: 'var(--text-muted)' }}>Liquida</th>
        </tr>
      </thead>
      <tbody>
        {detalle.map((seg, idx) => (
          <tr key={idx} style={{
            borderBottom: '1px solid var(--border-color)',
            opacity: seg.es_liquidable ? 1 : 0.5,
          }}>
            <td style={{ padding: '4px 8px' }}>
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                backgroundColor: TIPO_COLORS[seg.tipo_hora] || '#94a3b8', marginRight: 6,
              }} />
              {TIPO_LABELS[seg.tipo_hora] || seg.tipo_hora}
            </td>
            <td style={{ textAlign: 'right', padding: '4px 8px' }}>{seg.porcentaje}%</td>
            <td style={{ textAlign: 'right', padding: '4px 8px' }}>{seg.minutos}</td>
            <td style={{ textAlign: 'right', padding: '4px 8px' }}>{parseFloat(seg.horas_decimal).toFixed(2)}</td>
            <td style={{ textAlign: 'right', padding: '4px 8px' }}>{formatCOP(seg.valor_hora)}</td>
            <td style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 600 }}>
              {seg.es_liquidable ? formatCOP(seg.subtotal) : '—'}
            </td>
            <td style={{ textAlign: 'center', padding: '4px 8px' }}>
              {seg.es_liquidable ? '✓' : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Componente Principal ───────────────────────────────────────────
export function HorasExtrasServiciosV2Page() {
  const qc = useQueryClient();
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const [fechaInicio, setFechaInicio] = useState(getLocalDateStr(firstDay));
  const [fechaFin, setFechaFin] = useState(getLocalDateStr(today));
  const [operarioId, setOperarioId] = useState('');
  const [expandedRows, setExpandedRows] = useState({});

  const [appliedFilters, setAppliedFilters] = useState({
    desde: getLocalDateStr(firstDay),
    hasta: getLocalDateStr(today),
    operario: '',
  });

  // ─── Queries ────────────────────────────────────────────────
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['he-kpis', appliedFilters],
    queryFn: async () => {
      const params = {};
      if (appliedFilters.desde) params.fecha_inicio = appliedFilters.desde;
      if (appliedFilters.hasta) params.fecha_fin = appliedFilters.hasta;
      const res = await api.get('/horas-extras/kpis', { params });
      return res.data;
    },
  });

  const { data: resumen, isLoading } = useQuery({
    queryKey: ['he-resumen', appliedFilters],
    queryFn: async () => {
      const params = { limit: 500 };
      if (appliedFilters.desde) params.fecha_inicio = appliedFilters.desde;
      if (appliedFilters.hasta) params.fecha_fin = appliedFilters.hasta;
      if (appliedFilters.operario) params.operario_id = appliedFilters.operario;
      const res = await api.get('/horas-extras/resumen', { params });
      return res.data;
    },
  });

  const { data: operarios = [] } = useQuery({
    queryKey: ['he-operarios'],
    queryFn: async () => {
      const res = await api.get('/horas-extras/operarios');
      return res.data || [];
    },
  });

  // ─── Mutación: Recalcular ────────────────────────────────────
  const recalcularMutation = useMutation({
    mutationFn: async (remisionId) => {
      const res = await api.post(`/horas-extras/calcular/${remisionId}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Horas extras recalculadas correctamente');
      qc.invalidateQueries({ queryKey: ['he-resumen'] });
      qc.invalidateQueries({ queryKey: ['he-kpis'] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al recalcular'),
  });

  const rows = resumen?.data || [];

  const handleFilter = () => {
    setAppliedFilters({ desde: fechaInicio, hasta: fechaFin, operario: operarioId });
  };

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ─── Exportar Excel ──────────────────────────────────────────
  const handleExportExcel = () => {
    if (!rows.length) return;
    const data = rows.map(r => ({
      Remisión: r.numero_remision,
      Operario: r.operario_nombre,
      Fecha: formatDate(r.fecha_trabajo),
      Día: DIAS[parseInt(r.dia_semana)],
      'H. Remisión': r.horas_remision,
      'H. Calculadas': r.horas_calculadas,
      'H. Base': r.horas_base_liquidacion,
      'H. Extras': r.total_horas_extras,
      'Ord. Nocturna (min)': r.min_ord_nocturna,
      'Extra Diurna (min)': r.min_extra_diurna,
      'Extra Nocturna (min)': r.min_extra_nocturna,
      'Dom/Fest (min)': (r.min_dom_diurna || 0) + (r.min_dom_nocturna || 0),
      'Total Liquidado': r.total_liquidado,
      'GH (horas)': r.total_horas_gestion_humana,
      Cliente: r.cliente_nombre,
      Estado: r.estado_liquidacion,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'HorasExtras');
    XLSX.writeFile(wb, `HorasExtras_${appliedFilters.desde}_${appliedFilters.hasta}.xlsx`);
    toast.success('Excel exportado');
  };

  return (
    <Layout
      title="Horas Extras — Servicios"
      subtitle="Motor de cálculo configurable · Liquidación por operario y remisión"
    >
      {/* KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <KpiCard icon={Users} label="Operarios" value={kpis?.total_operarios || 0} color="#6366f1" />
        <KpiCard icon={Clock} label="Total H. Extras" value={fmtH(kpis?.total_horas_extras)} color="#f59e0b" />
        <KpiCard icon={Moon} label="Minutos Nocturnos" value={fmtMin(kpis?.total_minutos_nocturnos)} color="#8b5cf6" />
        <KpiCard icon={DollarSign} label="Total Liquidado" value={formatCOP(kpis?.total_liquidado)} color="#10b981" />
      </div>

      {/* Filtros */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end',
        marginBottom: '1.5rem', background: 'var(--bg-elevated)',
        padding: '1rem 1.25rem', borderRadius: 12,
        border: '1px solid var(--border-color)',
      }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            <Calendar size={12} style={{ marginRight: 4 }} />Desde
          </label>
          <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
            className="input" style={{ padding: '6px 10px', fontSize: '0.85rem' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            <Calendar size={12} style={{ marginRight: 4 }} />Hasta
          </label>
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
            className="input" style={{ padding: '6px 10px', fontSize: '0.85rem' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            <Users size={12} style={{ marginRight: 4 }} />Operario
          </label>
          <select value={operarioId} onChange={e => setOperarioId(e.target.value)}
            className="input" style={{ padding: '6px 10px', fontSize: '0.85rem', minWidth: 180 }}>
            <option value="">Todos</option>
            {operarios.map(op => (
              <option key={op.id} value={op.id}>{op.full_name}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={handleFilter}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px' }}>
          <Filter size={15} /> Filtrar
        </button>
        <button className="btn btn-secondary" onClick={handleExportExcel}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px' }}
          disabled={!rows.length}>
          <FileSpreadsheet size={15} /> Excel
        </button>
      </div>

      {/* Tabla */}
      <div style={{
        background: 'var(--bg-elevated)', borderRadius: 12,
        border: '1px solid var(--border-color)', overflow: 'auto',
      }}>
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Cargando...
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Sin resultados para los filtros seleccionados
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', background: 'var(--bg-main)' }}>
                <th style={thStyle}></th>
                <th style={thStyle}>Remisión</th>
                <th style={thStyle}>Operario</th>
                <th style={thStyle}>Fecha</th>
                <th style={thStyle}>Día</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>H. Rem.</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>H. Calc.</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>H. Base</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>H. Extras</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Total $</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <React.Fragment key={row.id}>
                  <tr style={{
                    borderBottom: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={tdStyle} onClick={() => toggleRow(row.id)}>
                      {expandedRows[row.id]
                        ? <ChevronDown size={16} color="var(--text-muted)" />
                        : <ChevronRight size={16} color="var(--text-muted)" />}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, color: '#6366f1' }}>{row.numero_remision}</span>
                    </td>
                    <td style={tdStyle}>{row.operario_nombre}</td>
                    <td style={tdStyle}>{formatDate(row.fecha_trabajo)}</td>
                    <td style={tdStyle}>
                      <span style={{
                        background: parseInt(row.dia_semana) === 0 || row.es_festivo
                          ? '#fef2f2' : 'transparent',
                        color: parseInt(row.dia_semana) === 0 || row.es_festivo
                          ? '#dc2626' : 'var(--text-primary)',
                        padding: '2px 6px', borderRadius: 4, fontSize: '0.8rem',
                      }}>
                        {DIAS[parseInt(row.dia_semana)] || '?'}
                        {row.es_festivo && ' 🎉'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtH(row.horas_remision)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtH(row.horas_calculadas)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                      {fmtH(row.horas_base_liquidacion)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>
                      {fmtH(row.total_horas_extras)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                      {formatCOP(row.total_liquidado)}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
                        background: row.estado_liquidacion === 'LIQUIDADO' ? '#dcfce7' :
                                    row.estado_liquidacion === 'ALERTA' ? '#fef9c3' : '#f1f5f9',
                        color: row.estado_liquidacion === 'LIQUIDADO' ? '#16a34a' :
                               row.estado_liquidacion === 'ALERTA' ? '#ca8a04' : '#64748b',
                      }}>
                        {row.estado_liquidacion === 'ALERTA' && <AlertTriangle size={12} />}
                        {row.estado_liquidacion || 'PENDIENTE'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <button
                        className="btn btn-sm"
                        onClick={() => recalcularMutation.mutate(row.remision_id)}
                        disabled={recalcularMutation.isPending}
                        title="Recalcular"
                        style={{
                          padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: '0.75rem',
                        }}
                      >
                        <RefreshCw size={13} className={recalcularMutation.isPending ? 'spin' : ''} />
                      </button>
                    </td>
                  </tr>
                  {/* Fila expandida: desglose */}
                  {expandedRows[row.id] && (
                    <tr>
                      <td colSpan={12} style={{
                        padding: '0.75rem 1.5rem',
                        background: 'rgba(99,102,241,0.02)',
                        borderBottom: '2px solid var(--border-color)',
                      }}>
                        <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <strong>Desglose de segmentos</strong>
                            <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: '0.8rem' }}>
                              Salario: {formatCOP(row.salario_mensual)} · VHB: {formatCOP(row.valor_hora_base)}/h
                            </span>
                          </div>
                          {row.alerta && (
                            <span style={{
                              color: '#ca8a04', fontSize: '0.8rem',
                              display: 'flex', alignItems: 'center', gap: 4,
                            }}>
                              <AlertTriangle size={14} /> {row.alerta}
                            </span>
                          )}
                        </div>
                        <DesgloseSegmentos horasLaboralesId={row.id} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Info pie */}
      <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {rows.length} registros · Divisor: salario/210 · Fuente: BD configurable (no hardcodeado)
      </div>
    </Layout>
  );
}

const thStyle = { textAlign: 'left', padding: '10px 12px', fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' };
const tdStyle = { padding: '8px 12px', whiteSpace: 'nowrap' };
