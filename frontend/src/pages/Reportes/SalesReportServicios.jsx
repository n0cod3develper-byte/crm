import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, FileText, FileSpreadsheet, AlertCircle, RefreshCw, Filter, Building2, Truck, ClipboardList, DollarSign } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Layout } from '../../components/Layout';
import api from '../../lib/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Formateador de moneda en pesos colombianos
function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(v || 0);
}

// Formateador de fecha simple
function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`;
}

// Obtener fecha en formato local YYYY-MM-DD
const getLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function SalesReportServicios() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const [fechaInicio, setFechaInicio] = useState(getLocalDateString(firstDay));
  const [fechaFin, setFechaFin] = useState(getLocalDateString(today));
  const [appliedFilters, setAppliedFilters] = useState({
    desde: getLocalDateString(firstDay),
    hasta: getLocalDateString(today)
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['salesReportServicios', appliedFilters.desde, appliedFilters.hasta],
    queryFn: async () => {
      const params = {};
      if (appliedFilters.desde) params.fecha_desde = appliedFilters.desde;
      if (appliedFilters.hasta) params.fecha_hasta = appliedFilters.hasta;
      const res = await api.get('/reports/servicios', { params });
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

  useEffect(() => { refetch(); }, [appliedFilters, refetch]);

  const items = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => new Date(b.fecha_servicio) - new Date(a.fecha_servicio));
  }, [data]);

  // Helper para calcular valores de cada item
  const calcItem = (item) => {
    const bruto = parseFloat(item.item_subtotal || 0);
    const ivaPct = parseFloat(item.iva_pct || 0);
    const iva = item.item_aplica_iva ? bruto * ivaPct / 100 : 0;
    const descuento = parseFloat(item.descuentos || 0);
    const neto = bruto + iva - descuento;
    const cant = parseFloat(item.item_cantidad || 0);
    const valorUnit = parseFloat(item.item_valor_unitario || 0);
    return { bruto, iva, descuento, neto, cant, valorUnit };
  };

  const totals = useMemo(() => {
    const sum = { bruto: 0, iva: 0, descuento: 0, neto: 0, count: items.length };
    items.forEach(item => {
      const v = calcItem(item);
      sum.bruto += v.bruto;
      sum.iva += v.iva;
      sum.descuento += v.descuento;
      sum.neto += v.neto;
    });
    return sum;
  }, [items]);

  // ── PDF Export ──
  const handleExportPDF = () => {
    if (items.length === 0) { toast.error('No hay datos para exportar'); return; }
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('REPORTE DE VENTAS - SERVICIOS (Por Ítems)', 14, 20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Rango: ${formatDate(appliedFilters.desde)} al ${formatDate(appliedFilters.hasta)}`, 14, 27);
      doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, 14, 32);
      doc.setFont('helvetica', 'bold');
      doc.text('Empresa:', 220, 20);
      doc.setFont('helvetica', 'normal');
      doc.text('CARGAR SAS', 220, 26);
      doc.line(14, 36, 282, 36);

      const tableBody = items.map(item => {
        const v = calcItem(item);
        return [
          item.item_nombre || '—',
          item.numero_remision,
          formatDate(item.fecha_servicio),
          item.empresa_nombre,
          item.item_tipo_servicio || '—',
          item.equipo_serie || '—',
          v.cant > 0 ? v.cant.toFixed(2) : '—',
          formatCOP(v.valorUnit),
          formatCOP(v.bruto),
          formatCOP(v.iva),
          formatCOP(v.descuento),
          formatCOP(v.neto),
          item.numero_factura || '—'
        ];
      });

      tableBody.push([
        'TOTALES', '', '', '', '', `${totals.count} Ítems`, '', '', 
        formatCOP(totals.bruto), formatCOP(totals.iva), formatCOP(totals.descuento), formatCOP(totals.neto), ''
      ]);

      autoTable(doc, {
        startY: 40,
        head: [['Ítem', 'Rem', 'Fecha', 'Cliente', 'Tipo', 'Cód.', 'Cant.', 'V. Unit.', 'Bruto', 'IVA', 'Desc.', 'Neto', 'Factura']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 6 },
        styles: { fontSize: 6, cellPadding: 1.5 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { fontStyle: 'bold', cellWidth: 14 },
          2: { halign: 'center', cellWidth: 16 },
          3: { cellWidth: 30 },
          4: { halign: 'center', cellWidth: 14 },
          5: { halign: 'center', cellWidth: 12 },
          6: { halign: 'center', cellWidth: 12 },
          7: { halign: 'right', cellWidth: 18 },
          8: { halign: 'right', cellWidth: 18 },
          9: { halign: 'right', cellWidth: 16 },
          10: { halign: 'right', cellWidth: 16 },
          11: { halign: 'right', fontStyle: 'bold', cellWidth: 18 },
          12: { halign: 'center', cellWidth: 16 }
        },
        didParseCell: function (data) {
          if (data.row.index === tableBody.length - 1) {
            data.cell.styles.fillColor = [243, 244, 246];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      doc.save(`Reporte_Ventas_Servicios_${appliedFilters.desde}_a_${appliedFilters.hasta}.pdf`);
      toast.success('PDF descargado con éxito');
    } catch (err) {
      console.error(err);
      toast.error('Error al generar el PDF');
    }
  };

  // ── Excel Export ──
  const handleExportExcel = () => {
    if (items.length === 0) { toast.error('No hay datos para exportar'); return; }
    try {
      const excelRows = items.map(item => {
        const v = calcItem(item);
        return {
          'Ítem / Servicio': item.item_nombre || '—',
          'No. Remisión': item.numero_remision,
          'Fecha Servicio': formatDate(item.fecha_servicio),
          'Cliente': item.empresa_nombre,
          'Tipo': item.item_tipo_servicio || '—',
          'Código Equipo': item.equipo_serie || '—',
          'Cantidad': v.cant,
          'Valor Unitario': v.valorUnit,
          'Valor Bruto': v.bruto,
          'Valor IVA': v.iva,
          'Descuento': v.descuento,
          'Valor Neto': v.neto,
          'N° Factura': item.numero_factura || '—'
        };
      });

      excelRows.push({
        'Ítem / Servicio': 'TOTALES',
        'No. Remisión': '', 'Fecha Servicio': '', 'Cliente': '', 'Tipo': '',
        'Código Equipo': `${totals.count} Ítems`,
        'Cantidad': '', 'Valor Unitario': '',
        'Valor Bruto': totals.bruto, 'Valor IVA': totals.iva,
        'Descuento': totals.descuento, 'Valor Neto': totals.neto, 'N° Factura': ''
      });

      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reporte Ventas Servicios");
      XLSX.writeFile(wb, `Reporte_Ventas_Servicios_${appliedFilters.desde}_a_${appliedFilters.hasta}.xlsx`);
      toast.success('Excel descargado con éxito');
    } catch (err) {
      console.error(err);
      toast.error('Error al generar el Excel');
    }
  };

  return (
    <Layout
      title="Reporte de Ventas - Servicios"
      subtitle={`Consulta analítica por ítems para el período seleccionado (${items.length} ítems)`}
      rightContent={
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn--secondary" onClick={handleExportPDF} disabled={isLoading || items.length === 0}>
            <FileText size={16} /> Exportar PDF
          </button>
          <button className="btn btn--secondary" onClick={handleExportExcel} disabled={isLoading || items.length === 0}>
            <FileSpreadsheet size={16} /> Exportar Excel
          </button>
        </div>
      }
    >
      {/* ── Filtros ── */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.35rem' }}>
              <Calendar size={14} className="text-muted" /> Fecha Inicio
            </label>
            <input type="date" className="input" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.35rem' }}>
              <Calendar size={14} className="text-muted" /> Fecha Fin
            </label>
            <input type="date" className="input" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
          </div>
          <button className="btn btn--primary" onClick={handleApplyFilter} style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '120px' }}>
            <Filter size={15} /> Aplicar Filtro
          </button>
        </div>
      </div>

      {/* ── Cuerpo del Reporte ── */}
      {isLoading ? (
        <div className="empty-state" style={{ minHeight: '300px' }}>
          <div className="spinner" />
          <p className="text-muted" style={{ marginTop: '1rem' }}>Consultando reportes de ventas...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ border: '1px solid var(--clr-danger-500)', background: 'var(--clr-danger-500)0b', padding: '2rem', textAlign: 'center' }}>
          <AlertCircle size={40} style={{ color: 'var(--clr-danger-500)', marginBottom: '1rem' }} />
          <h3 className="text-lg font-bold" style={{ color: 'var(--clr-danger-400)', marginBottom: '0.5rem' }}>Error en Consulta</h3>
          <p className="text-muted" style={{ maxWidth: '400px', margin: '0 auto' }}>
            {error.response?.data?.message || error.message || 'No se pudieron recuperar los ítems de ventas.'}
          </p>
          <button className="btn btn--secondary" onClick={() => refetch()} style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state" style={{ minHeight: '300px' }}>
          <ClipboardList size={48} className="empty-state__icon" />
          <h2 className="empty-state__title">Sin resultados</h2>
          <p className="empty-state__desc">No se encontraron ítems de ventas para el rango de fechas seleccionado.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Ítem / Servicio</th>
                <th style={{ width: 85 }}>Nro. Rem.</th>
                <th style={{ width: 95 }}><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} />Fecha</span></th>
                <th><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={12} />Cliente</span></th>
                <th style={{ width: 80, textAlign: 'center' }}>Tipo</th>
                <th style={{ width: 70, textAlign: 'center' }}><span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}><Truck size={12} />Código</span></th>
                <th style={{ width: 60, textAlign: 'center' }}>Cant.</th>
                <th style={{ width: 100, textAlign: 'right' }}>Valor Unit.</th>
                <th style={{ width: 110, textAlign: 'right' }}><span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}><DollarSign size={12} />Total Bruto</span></th>
                <th style={{ width: 90, textAlign: 'right' }}>IVA</th>
                <th style={{ width: 90, textAlign: 'right' }}>Descuento</th>
                <th style={{ width: 110, textAlign: 'right', fontWeight: 'bold' }}><span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}><DollarSign size={12} />Total Neto</span></th>
                <th style={{ width: 90, textAlign: 'center' }}>N° Factura</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const v = calcItem(item);
                return (
                  <tr key={item.item_id}>
                    <td>
                      <span style={{ fontSize: '12px', fontWeight: 500, display: 'block' }}>{item.item_nombre || '—'}</span>
                      {item.item_codigo && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.item_codigo}</span>
                      )}
                    </td>
                    <td>
                      <code style={{ fontWeight: 800, fontSize: '12px', color: 'var(--clr-primary-400)' }}>
                        {item.numero_remision}
                      </code>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '12px' }}>{formatDate(item.fecha_servicio)}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '12px' }}>{item.empresa_nombre}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge badge--${item.item_tipo_servicio === 'Fijo' ? 'primary' : 'warning'}`} style={{ fontSize: '10px' }}>
                        {item.item_tipo_servicio || '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>
                        {item.equipo_serie || '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 500 }}>
                        {v.cant > 0 ? v.cant.toFixed(2) : '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '12px' }}>{formatCOP(v.valorUnit)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '12px' }}>{formatCOP(v.bruto)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatCOP(v.iva)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '12px', color: 'var(--clr-danger-400)' }}>{formatCOP(v.descuento)}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <span style={{ fontSize: '13px', color: 'var(--clr-success-500)' }}>{formatCOP(v.neto)}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: item.numero_factura ? 'var(--clr-success-500)' : 'var(--text-muted)' }}>
                        {item.numero_factura || '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot style={{ borderTop: '2px solid var(--border-color)', background: 'var(--bg-subtle)' }}>
              <tr style={{ fontWeight: 'bold', borderBottom: 'none' }}>
                <td colSpan={5}>TOTALES</td>
                <td><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{totals.count} ítems</span></td>
                <td></td>
                <td></td>
                <td style={{ textAlign: 'right', fontSize: '12px' }}>{formatCOP(totals.bruto)}</td>
                <td style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>{formatCOP(totals.iva)}</td>
                <td style={{ textAlign: 'right', fontSize: '12px', color: 'var(--clr-danger-400)' }}>{formatCOP(totals.descuento)}</td>
                <td style={{ textAlign: 'right', fontSize: '13px', color: 'var(--clr-success-500)' }}>{formatCOP(totals.neto)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Layout>
  );
}
