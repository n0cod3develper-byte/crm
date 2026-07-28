import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, FileText, FileSpreadsheet, Filter, Clock, DollarSign, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Layout } from '../../components/Layout';
import api from '../../lib/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// ─── Utilidades ─────────────────────────────────────────────────────
function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0
  }).format(v || 0);
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`;
}

function formatHoras(horas) {
  const h = parseFloat(horas) || 0;
  return `${h.toFixed(2)}h`;
}

function formatEquipo(row) {
  const marca = row.equipo_marca || '';
  const modelo = row.equipo_modelo || '';
  const serie = row.equipo_serie || '';
  if (!marca && !modelo) return '—';
  let label = `${marca} ${modelo}`.trim();
  if (serie) label += `\nS/N: ${serie}`;
  return label;
}

const getLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ─── Componente Principal ───────────────────────────────────────────
export function HorasExtrasServiciosPage() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const [fechaInicio, setFechaInicio] = useState(getLocalDateString(firstDay));
  const [fechaFin, setFechaFin] = useState(getLocalDateString(today));

  const [appliedFilters, setAppliedFilters] = useState({
    desde: getLocalDateString(firstDay),
    hasta: getLocalDateString(today)
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['horas-extras-servicios', appliedFilters.desde, appliedFilters.hasta],
    queryFn: async () => {
      const params = {};
      if (appliedFilters.desde) params.fecha_inicio = appliedFilters.desde;
      if (appliedFilters.hasta) params.fecha_fin = appliedFilters.hasta;
      const res = await api.get('/informes/horas-extras/servicios', { params });
      return res.data?.data || [];
    },
    enabled: true
  });

  const handleApplyFilter = () => {
    if (fechaInicio && fechaFin && new Date(fechaInicio) > new Date(fechaFin)) {
      toast.error('La fecha de inicio no puede ser posterior a la fecha de fin');
      return;
    }
    setAppliedFilters({ desde: fechaInicio, hasta: fechaFin });
  };

  const items = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => new Date(b.fecha_servicio) - new Date(a.fecha_servicio));
  }, [data]);

  const totals = useMemo(() => {
    let totalHoras = 0;
    let totalNeto = 0;
    items.forEach(item => {
      totalHoras += parseFloat(item.horas_extras || 0);
      totalNeto += parseFloat(item.total_neto || 0);
    });
    return { totalHoras, totalNeto, count: items.length };
  }, [items]);

  // ─── Exportar Excel ───
  const handleExportExcel = () => {
    if (!items.length) return toast.error('No hay datos para exportar');
    const wsData = [
      ['INFORME DE HORAS EXTRAS — SERVICIOS'],
      [`Período: ${formatDate(appliedFilters.desde)} al ${formatDate(appliedFilters.hasta)}`],
      [],
      ['No. Remisión', 'Operario', 'Equipo', 'Fecha Servicio', 'Cliente', 'Horas Extras', 'Total Neto'],
      ...items.map(r => [
        r.numero_remision,
        r.operario_nombre || '—',
        formatEquipo(r).replace('\n', ' '),
        formatDate(r.fecha_servicio),
        r.cliente_nombre,
        parseFloat(r.horas_extras || 0),
        parseFloat(r.total_neto || 0),
      ]),
      [],
      ['', '', '', '', 'TOTALES', totals.totalHoras, totals.totalNeto],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 16 }, { wch: 28 }, { wch: 30 }, { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 16 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Horas Extras Servicios');
    XLSX.writeFile(wb, `Horas_Extras_Servicios_${appliedFilters.desde}_${appliedFilters.hasta}.xlsx`);
    toast.success('Excel exportado correctamente');
  };

  // ─── Exportar PDF ───
  const handleExportPDF = () => {
    if (!items.length) return toast.error('No hay datos para exportar');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text('Informe de Horas Extras — Servicios', 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Período: ${formatDate(appliedFilters.desde)} al ${formatDate(appliedFilters.hasta)}  |  ${items.length} registros`, 14, 26);

    autoTable(doc, {
      startY: 32,
      head: [['No. Remisión', 'Operario', 'Equipo', 'Fecha Servicio', 'Cliente', 'Horas Extras', 'Total Neto']],
      body: items.map(r => [
        r.numero_remision,
        r.operario_nombre || '—',
        formatEquipo(r).replace('\n', ' '),
        formatDate(r.fecha_servicio),
        r.cliente_nombre,
        formatHoras(r.horas_extras),
        formatCOP(r.total_neto),
      ]),
      foot: [['', '', '', '', 'TOTALES', formatHoras(totals.totalHoras), formatCOP(totals.totalNeto)]],
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [99, 102, 241] },
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`Horas_Extras_Servicios_${appliedFilters.desde}_${appliedFilters.hasta}.pdf`);
    toast.success('PDF exportado correctamente');
  };

  // ─── Render ───
  return (
    <Layout
      title="Horas Extras — Servicios"
      subtitle={`Reporte de horas extras en remisiones de servicio (${items.length} registros)`}
    >
      {/* ── Filtros ── */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.35rem' }}>
              <Calendar size={14} className="text-muted" /> Fecha Inicio
            </label>
            <input type="date" className="input" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.35rem' }}>
              <Calendar size={14} className="text-muted" /> Fecha Fin
            </label>
            <input type="date" className="input" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
          </div>
          <button className="btn btn--primary" onClick={handleApplyFilter} style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '120px' }}>
            <Filter size={15} /> Consultar
          </button>
          <button className="btn btn--outline" onClick={handleExportExcel} disabled={!items.length}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileSpreadsheet size={15} /> Excel
          </button>
          <button className="btn btn--outline" onClick={handleExportPDF} disabled={!items.length}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={15} /> PDF
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      {items.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0.05) 100%)',
              borderRadius: '12px', padding: '0.75rem'
            }}>
              <Clock size={22} style={{ color: '#6366f1' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Registros</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totals.count}</div>
            </div>
          </div>
          <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)',
              borderRadius: '12px', padding: '0.75rem'
            }}>
              <Clock size={22} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Horas Extras</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatHoras(totals.totalHoras)}</div>
            </div>
          </div>
          <div className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)',
              borderRadius: '12px', padding: '0.75rem'
            }}>
              <DollarSign size={22} style={{ color: '#10b981' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Neto Remisiones</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatCOP(totals.totalNeto)}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Estado ── */}
      {isLoading && (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-muted)' }}>Cargando datos...</p>
        </div>
      )}

      {error && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
          <AlertCircle size={32} style={{ marginBottom: '0.5rem', margin: '0 auto' }} />
          <p>Error al cargar los datos: {error.response?.data?.error || error.response?.data?.message || error.message}</p>
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <Clock size={40} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: '0.5rem' }}>Sin resultados</h3>
          <p style={{ color: 'var(--text-muted)' }}>No se encontraron horas extras para el período seleccionado.</p>
        </div>
      )}

      {/* ── Tabla ── */}
      {!isLoading && items.length > 0 && (
        <div className="card" style={{ overflow: 'auto' }}>
          <table className="table" style={{ width: '100%', minWidth: '850px' }}>
            <thead>
              <tr>
                <th>No. Remisión</th>
                <th>Operario</th>
                <th>Equipo</th>
                <th>Fecha Servicio</th>
                <th>Cliente</th>
                <th style={{ textAlign: 'right' }}>Horas Extras</th>
                <th style={{ textAlign: 'right' }}>Total Neto</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, i) => (
                <tr key={row.remision_id || i}>
                  <td style={{ fontWeight: 600, color: '#6366f1' }}>{row.numero_remision}</td>
                  <td>{row.operario_nombre || '—'}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {row.equipo_marca || ''} {row.equipo_modelo || ''}
                    </div>
                    {row.equipo_serie && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        S/N: {row.equipo_serie}
                      </div>
                    )}
                    {!row.equipo_marca && !row.equipo_modelo && '—'}
                  </td>
                  <td>{formatDate(row.fecha_servicio)}</td>
                  <td>{row.cliente_nombre}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#f59e0b' }}>
                    {formatHoras(row.horas_extras)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                    {formatCOP(row.total_neto)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 800, background: 'var(--bg-elevated)' }}>
                <td colSpan={5} style={{ textAlign: 'right', paddingRight: '1rem' }}>TOTALES</td>
                <td style={{ textAlign: 'right', color: '#f59e0b' }}>{formatHoras(totals.totalHoras)}</td>
                <td style={{ textAlign: 'right', color: '#10b981' }}>{formatCOP(totals.totalNeto)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Layout>
  );
}
