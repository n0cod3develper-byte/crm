import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { Clock, ChevronDown, ChevronUp, Award, AlertCircle, Users, Truck, X } from 'lucide-react';

function formatCOP(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value || 0);
}

const MEDAL_COLORS = ['#f59e0b', '#94a3b8', '#cd7f32'];
const BAR_COLORS = { high: '#10b981', mid: '#f59e0b', low: '#94a3b8' };

function getBarColor(value, max) {
  const ratio = max > 0 ? value / max : 0;
  if (ratio >= 0.66) return BAR_COLORS.high;
  if (ratio >= 0.33) return BAR_COLORS.mid;
  return BAR_COLORS.low;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  if (typeof timeStr === 'string' && timeStr.length <= 8) return timeStr;
  const d = new Date(timeStr);
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ── Detail Modal ──
function DetailModal({ title, data, columns, onClose }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)'
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-elevated, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '16px', padding: '2rem', maxWidth: '850px', width: '95%',
          maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'var(--bg-subtle, rgba(0,0,0,0.05))', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)',
            padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-subtle, rgba(0,0,0,0.05))'}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {data && data.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col.key} style={{
                      textAlign: col.align || 'left', padding: '12px',
                      borderBottom: '2px solid var(--border-color, #e2e8f0)', color: 'var(--text-muted, #64748b)',
                      fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px',
                      position: 'sticky', top: 0, background: 'var(--bg-elevated, #ffffff)', zIndex: 1
                    }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={idx} style={{
                    borderBottom: '1px solid var(--border-color, #e2e8f0)',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {columns.map(col => (
                      <td key={col.key} style={{
                        padding: '12px', textAlign: col.align || 'left',
                        color: 'var(--text-primary, #0f172a)', fontWeight: col.bold ? 600 : 400
                      }}>
                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted, #64748b)' }}>
              No se encontraron órdenes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── KPI By Equipment ──
function KpiHoursByEquipment({ dateFrom, dateTo }) {
  const [expandedId, setExpandedId] = useState(null);

  const { data: kpiData, isLoading, error } = useQuery({
    queryKey: ['kpi-hours-equipment', dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get('/informes/kpi/hours-by-equipment', {
        params: { date_from: dateFrom, date_to: dateTo }
      });
      return res.data;
    },
    enabled: !!dateFrom && !!dateTo
  });

  const { data: detailData, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['kpi-hours-equipment-detail', expandedId, dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get(`/informes/kpi/hours-by-equipment/${expandedId}`, {
        params: { date_from: dateFrom, date_to: dateTo }
      });
      return res.data;
    },
    enabled: !!expandedId
  });

  const maxHours = kpiData?.data?.length > 0 ? Math.max(...kpiData.data.map(d => d.total_hours)) : 0;

  const detailColumns = [
    { key: 'numero_remision', label: 'Remisión', bold: true },
    { key: 'fecha_servicio', label: 'Fecha', render: v => formatDate(v) },
    { key: 'hora_salida', label: 'Salida', align: 'center', render: v => formatTime(v) },
    { key: 'hora_llegada', label: 'Llegada', align: 'center', render: v => formatTime(v) },
    { key: 'hours_formatted', label: 'Horas', align: 'right', bold: true }
  ];

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--clr-danger-500)', padding: '1rem' }}>
        <AlertCircle size={18} /> Error al cargar datos de horas por equipo.
      </div>
    );
  }

  if (!kpiData?.data?.length) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
        No se encontraron órdenes liquidadas en el período seleccionado.
      </div>
    );
  }

  return (
    <div>
      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr>
              <th style={thStyle}>Equipo</th>
              <th style={{ ...thStyle, textAlign: 'center', width: '100px' }}>Órdenes</th>
              <th style={{ ...thStyle, textAlign: 'right', width: '120px' }}>Total Horas</th>
              <th style={{ ...thStyle, textAlign: 'right', width: '100px' }}>Prom/Orden</th>
              <th style={{ ...thStyle, width: '200px' }}>Progreso</th>
              <th style={{ ...thStyle, width: '40px' }}></th>
            </tr>
          </thead>
          <tbody>
            {kpiData.data.map((item) => {
              const avgPerOrder = item.total_orders > 0 ? (item.total_hours / item.total_orders) : 0;
              const barWidth = maxHours > 0 ? (item.total_hours / maxHours) * 100 : 0;
              const barColor = getBarColor(item.total_hours, maxHours);
              return (
                <tr
                  key={item.equipment_id}
                  onClick={() => setExpandedId(expandedId === item.equipment_id ? null : item.equipment_id)}
                  style={{
                    cursor: 'pointer', borderBottom: '1px solid var(--border-color)',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Clock size={14} color="#6366f1" />
                      {item.equipment_name}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{item.total_orders}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                    {item.total_hours_formatted}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-muted)' }}>
                    {avgPerOrder.toFixed(1)}h
                  </td>
                  <td style={tdStyle}>
                    <div style={{ background: 'var(--bg-subtle, rgba(255,255,255,0.05))', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${barWidth}%`, height: '100%', borderRadius: '6px',
                        background: barColor, transition: 'width 0.8s ease-out'
                      }} />
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {expandedId === item.equipment_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem 0', borderTop: '2px solid var(--border-color)', marginTop: '0.5rem'
      }}>
        <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Total del Área en el Período
        </span>
        <span style={{ fontWeight: 700, fontSize: '1.2rem', color: '#6366f1' }}>
          {kpiData.grand_total_hours.toFixed(1)}h
        </span>
      </div>

      {kpiData.excluded_orders > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 0',
          fontSize: '0.8rem', color: 'var(--text-muted)'
        }}>
          <AlertCircle size={14} />
          {kpiData.excluded_orders} orden(es) excluida(s) por falta de datos de hora.
        </div>
      )}

      {/* Detail Modal */}
      {expandedId && (
        <DetailModal
          title={`Detalle de Horas — ${kpiData.data.find(d => d.equipment_id === expandedId)?.equipment_name || ''}`}
          data={detailData}
          columns={detailColumns}
          onClose={() => setExpandedId(null)}
        />
      )}
    </div>
  );
}

// ── KPI By Operator ──
function KpiHoursByOperator({ dateFrom, dateTo }) {
  const [expandedId, setExpandedId] = useState(null);

  const { data: kpiData, isLoading, error } = useQuery({
    queryKey: ['kpi-hours-operator', dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get('/informes/kpi/hours-by-operator', {
        params: { date_from: dateFrom, date_to: dateTo }
      });
      return res.data;
    },
    enabled: !!dateFrom && !!dateTo
  });

  const { data: detailData } = useQuery({
    queryKey: ['kpi-hours-operator-detail', expandedId, dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get(`/informes/kpi/hours-by-operator/${expandedId}`, {
        params: { date_from: dateFrom, date_to: dateTo }
      });
      return res.data;
    },
    enabled: !!expandedId
  });

  const grandTotal = kpiData?.grand_total_hours || 0;
  const avgGeneral = kpiData?.data?.length > 0
    ? kpiData.data.reduce((s, d) => s + d.average_hours_per_order, 0) / kpiData.data.length
    : 0;

  const detailColumns = [
    { key: 'numero_remision', label: 'Remisión', bold: true },
    { key: 'fecha_servicio', label: 'Fecha', render: v => formatDate(v) },
    { key: 'equipo_nombre', label: 'Equipo' },
    { key: 'hora_salida', label: 'Salida', align: 'center', render: v => formatTime(v) },
    { key: 'hora_llegada', label: 'Llegada', align: 'center', render: v => formatTime(v) },
    { key: 'hours_formatted', label: 'Horas', align: 'right', bold: true }
  ];

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--clr-danger-500)', padding: '1rem' }}>
        <AlertCircle size={18} /> Error al cargar datos de horas por operario.
      </div>
    );
  }

  if (!kpiData?.data?.length) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
        No se encontraron órdenes liquidadas con operarios asignados.
      </div>
    );
  }

  return (
    <div>
      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '40px' }}>#</th>
              <th style={thStyle}>Operario</th>
              <th style={{ ...thStyle, textAlign: 'center', width: '100px' }}>Órdenes</th>
              <th style={{ ...thStyle, textAlign: 'right', width: '120px' }}>Total Horas</th>
              <th style={{ ...thStyle, textAlign: 'right', width: '100px' }}>Prom/Orden</th>
              <th style={{ ...thStyle, width: '40px' }}></th>
            </tr>
          </thead>
          <tbody>
            {kpiData.data.map((item, idx) => {
              const isTop3 = idx < 3;
              return (
                <tr
                  key={item.operator_id}
                  onClick={() => setExpandedId(expandedId === item.operator_id ? null : item.operator_id)}
                  style={{
                    cursor: 'pointer', borderBottom: '1px solid var(--border-color)',
                    transition: 'background 0.15s ease',
                    background: isTop3 ? `${MEDAL_COLORS[idx]}08` : 'transparent'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = isTop3 ? `${MEDAL_COLORS[idx]}12` : 'rgba(99,102,241,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = isTop3 ? `${MEDAL_COLORS[idx]}08` : 'transparent'}
                >
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {isTop3 ? (
                      <Award size={18} color={MEDAL_COLORS[idx]} />
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{idx + 1}</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{item.operator_name}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{item.total_orders}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                    {item.total_hours_formatted}
                  </td>
                  <td style={{
                    ...tdStyle, textAlign: 'right',
                    color: item.average_hours_per_order >= avgGeneral ? '#10b981' : 'var(--text-muted)'
                  }}>
                    {item.average_hours_per_order.toFixed(1)}h
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {expandedId === item.operator_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals & Average */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem',
        padding: '1rem 0', borderTop: '2px solid var(--border-color)', marginTop: '0.5rem'
      }}>
        <div style={{ display: 'flex', gap: '2rem' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Total Horas</span>
            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#6366f1' }}>
              {grandTotal.toFixed(1)}h
            </span>
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Promedio General</span>
            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#10b981' }}>
              {avgGeneral.toFixed(1)}h / orden
            </span>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {expandedId && (
        <DetailModal
          title={`Detalle de Horas — ${kpiData.data.find(d => d.operator_id === expandedId)?.operator_name || ''}`}
          data={detailData}
          columns={detailColumns}
          onClose={() => setExpandedId(null)}
        />
      )}
    </div>
  );
}

// ── Shared Styles ──
const thStyle = {
  textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid var(--border-color)',
  color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem',
  textTransform: 'uppercase', letterSpacing: '0.5px'
};

const tdStyle = {
  padding: '12px', color: 'var(--text-primary)'
};

// ── Main Exported Component ──
export function KpiHorasOperativas({ appliedFilters }) {
  const dateFrom = appliedFilters?.desde;
  const dateTo = appliedFilters?.hasta;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem' }}>
      {/* KPI Horas por Equipo */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem',
          borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem'
        }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '8px', borderRadius: '8px' }}>
            <Truck size={20} color="#6366f1" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              Horas Trabajadas por Equipo
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Órdenes liquidadas — Hora salida/llegada cargue
            </p>
          </div>
        </div>
        <KpiHoursByEquipment dateFrom={dateFrom} dateTo={dateTo} />
      </div>

      {/* KPI Horas por Operario */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem',
          borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem'
        }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '8px', borderRadius: '8px' }}>
            <Users size={20} color="#10b981" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              Horas Laboradas por Operario
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Ranking por total de horas — Top 3 destacados
            </p>
          </div>
        </div>
        <KpiHoursByOperator dateFrom={dateFrom} dateTo={dateTo} />
      </div>
    </div>
  );
}
