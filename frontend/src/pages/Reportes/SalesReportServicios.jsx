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
  // Rango de fechas inicial: Primer día del mes actual al día de hoy
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const [fechaInicio, setFechaInicio] = useState(getLocalDateString(firstDay));
  const [fechaFin, setFechaFin] = useState(getLocalDateString(today));

  // Estado local para los filtros aplicados en la consulta
  const [appliedFilters, setAppliedFilters] = useState({
    desde: getLocalDateString(firstDay),
    hasta: getLocalDateString(today)
  });

  // Query con React Query para obtener datos filtrados
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

  // Validar fechas y aplicar filtro
  const handleApplyFilter = () => {
    if (fechaInicio && fechaFin && new Date(fechaInicio) > new Date(fechaFin)) {
      toast.error('La fecha de inicio no puede ser posterior a la fecha de fin');
      return;
    }
    setAppliedFilters({
      desde: fechaInicio,
      hasta: fechaFin
    });
  };

  // Recalcular cuando cambian los filtros aplicados
  useEffect(() => {
    refetch();
  }, [appliedFilters, refetch]);

  // Lista ordenada por fecha
  const items = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => new Date(b.fecha_servicio) - new Date(a.fecha_servicio));
  }, [data]);

  // Cálculo de totales al pie de la tabla
  const totals = useMemo(() => {
    const sum = {
      bruto: 0,
      iva: 0,
      descuentos: 0,
      neto: 0,
      count: items.length
    };
    items.forEach(item => {
      const bruto = parseFloat(item.total_bruto || 0);
      const iva = parseFloat(item.iva_valor || 0);
      const descuentos = parseFloat(item.descuentos || 0);
      const neto = bruto + iva - descuentos; // Calculado en frontend

      sum.bruto += bruto;
      sum.iva += iva;
      sum.descuentos += descuentos;
      sum.neto += neto;
    });
    return sum;
  }, [items]);

  // Exportar a PDF con jsPDF y jsPDF-AutoTable
  const handleExportPDF = () => {
    if (items.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }
    try {
      const doc = new jsPDF('l', 'mm', 'a4'); // Horizontal (Landscape)
      
      // Header Corporativo
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('REPORTE DE VENTAS - SERVICIOS', 14, 20);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Rango de fechas: ${formatDate(appliedFilters.desde)} al ${formatDate(appliedFilters.hasta)}`, 14, 27);
      doc.text(`Generado el: ${new Date().toLocaleString('es-CO')}`, 14, 32);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Empresa:', 220, 20);
      doc.setFont('helvetica', 'normal');
      doc.text('CARGAR SAS', 220, 26);
      doc.text('NIT: 900.xxx.xxx-x', 220, 31);

      doc.line(14, 38, 282, 38);

      const tableBody = items.map(item => {
        const bruto = parseFloat(item.total_bruto || 0);
        const iva = parseFloat(item.iva_valor || 0);
        const descuentos = parseFloat(item.descuentos || 0);
        const neto = bruto + iva - descuentos;

        return [
          item.numero_remision,
          formatDate(item.fecha_servicio),
          item.empresa_nombre,
          item.servicio_nombre,
          item.tipo_servicio || '—',
          `${item.equipo_marca} ${item.equipo_modelo}`,
          formatCOP(bruto),
          formatCOP(iva),
          formatCOP(descuentos),
          formatCOP(neto),
          item.estado
        ];
      });

      // Añadir fila de totales
      tableBody.push([
        'TOTALES',
        '',
        '',
        '',
        '',
        `${totals.count} Remisiones`,
        formatCOP(totals.bruto),
        formatCOP(totals.iva),
        formatCOP(totals.descuentos),
        formatCOP(totals.neto),
        ''
      ]);

      autoTable(doc, {
        startY: 44,
        head: [['No. Rem', 'Fecha', 'Cliente', 'Servicio', 'Tipo', 'Equipo', 'Bruto', 'IVA', 'Descuento', 'Neto', 'Estado']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 20 },
          1: { halign: 'center', cellWidth: 20 },
          2: { cellWidth: 42 },
          3: { cellWidth: 42 },
          4: { halign: 'center', cellWidth: 16 },
          5: { cellWidth: 35 },
          6: { halign: 'right', cellWidth: 22 },
          7: { halign: 'right', cellWidth: 22 },
          8: { halign: 'right', cellWidth: 20 },
          9: { halign: 'right', fontStyle: 'bold', cellWidth: 22 },
          10: { halign: 'center', cellWidth: 17 }
        },
        didParseCell: function (data) {
          // Destacar fila de totales
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

  // Exportar a Excel con xlsx (SheetJS)
  const handleExportExcel = () => {
    if (items.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }
    try {
      const excelRows = items.map(item => {
        const bruto = parseFloat(item.total_bruto || 0);
        const iva = parseFloat(item.iva_valor || 0);
        const descuentos = parseFloat(item.descuentos || 0);
        const neto = bruto + iva - descuentos;

        return {
          'No. Remisión': item.numero_remision,
          'Fecha Servicio': formatDate(item.fecha_servicio),
          'Cliente': item.empresa_nombre,
          'Servicio': item.servicio_nombre,
          'Tipo': item.tipo_servicio || '—',
          'Equipo': `${item.equipo_marca} ${item.equipo_modelo} (S/N: ${item.equipo_serial})`,
          'Valor Bruto': bruto,
          'Valor IVA': iva,
          'Descuentos': descuentos,
          'Valor Neto': neto,
          'Estado': item.estado
        };
      });

      // Añadir fila de totales
      excelRows.push({
        'No. Remisión': 'TOTALES',
        'Fecha Servicio': '',
        'Cliente': '',
        'Servicio': '',
        'Tipo': '',
        'Equipo': `${totals.count} Remisiones`,
        'Valor Bruto': totals.bruto,
        'Valor IVA': totals.iva,
        'Descuentos': totals.descuentos,
        'Valor Neto': totals.neto,
        'Estado': ''
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
      subtitle={`Consulta analítica de facturación para el período seleccionado (${items.length} registros)`}
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
            <input
              type="date"
              className="input"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          
          <div style={{ flex: '1 1 200px' }}>
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.35rem' }}>
              <Calendar size={14} className="text-muted" /> Fecha Fin
            </label>
            <input
              type="date"
              className="input"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
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
            {error.response?.data?.message || error.message || 'No se pudieron recuperar las remisiones de ventas.'}
          </p>
          <button className="btn btn--secondary" onClick={() => refetch()} style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state" style={{ minHeight: '300px' }}>
          <ClipboardList size={48} className="empty-state__icon" />
          <h2 className="empty-state__title">Sin resultados</h2>
          <p className="empty-state__desc">No se encontraron ventas de servicios para el rango de fechas seleccionado.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: 100 }}>Nro. Remisión</th>
                <th style={{ width: 100 }}><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} />Fecha</span></th>
                <th><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={12} />Cliente</span></th>
                <th>Servicio</th>
                <th style={{ width: 80, textAlign: 'center' }}>Tipo</th>
                <th><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Truck size={12} />Equipo</span></th>
                <th style={{ width: 120, textAlign: 'right' }}><span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}><DollarSign size={12} />Total Bruto</span></th>
                <th style={{ width: 100, textAlign: 'right' }}>IVA</th>
                <th style={{ width: 100, textAlign: 'right' }}>Descuentos</th>
                <th style={{ width: 120, textAlign: 'right', fontWeight: 'bold' }}><span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}><DollarSign size={12} />Total Neto</span></th>
                <th style={{ width: 100, textAlign: 'center' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const bruto = parseFloat(item.total_bruto || 0);
                const iva = parseFloat(item.iva_valor || 0);
                const descuentos = parseFloat(item.descuentos || 0);
                const neto = bruto + iva - descuentos; // Calculado en frontend
                
                return (
                  <tr key={item.id}>
                    <td>
                      <code style={{ fontWeight: 800, fontSize: '13px', color: 'var(--clr-primary-400)' }}>
                        {item.numero_remision}
                      </code>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{formatDate(item.fecha_servicio)}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '13px', display: 'block' }}>{item.empresa_nombre}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{item.servicio_nombre}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge badge--${item.tipo_servicio === 'Fijo' ? 'primary' : 'warning'}`} style={{ fontSize: '10px' }}>
                        {item.tipo_servicio || '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', display: 'block', fontWeight: 500 }}>
                        {item.equipo_marca} {item.equipo_modelo}
                      </span>
                      {item.equipo_serial && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>S/N: {item.equipo_serial}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '13px' }}>{formatCOP(bruto)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{formatCOP(iva)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '13px', color: 'var(--clr-danger-400)' }}>{formatCOP(descuentos)}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <span style={{ fontSize: '14px', color: 'var(--clr-success-500)' }}>{formatCOP(neto)}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge badge--${
                        item.estado === 'LIQUIDADA' ? 'green' : 
                        item.estado === 'REALIZADA' ? 'primary' : 
                        item.estado === 'PENDIENTE' ? 'warning' : 'gray'
                      }`} style={{ fontSize: '10px' }}>
                        {item.estado}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* ── Fila de Totales/Resumen ── */}
            <tfoot style={{ borderTop: '2px solid var(--border-color)', background: 'var(--bg-subtle)' }}>
              <tr style={{ fontWeight: 'bold', borderBottom: 'none' }}>
                <td colSpan={5}>TOTALES</td>
                <td>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{totals.count} registros</span>
                </td>
                <td style={{ textAlign: 'right', fontSize: '13px' }}>{formatCOP(totals.bruto)}</td>
                <td style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text-muted)' }}>{formatCOP(totals.iva)}</td>
                <td style={{ textAlign: 'right', fontSize: '13px', color: 'var(--clr-danger-400)' }}>{formatCOP(totals.descuentos)}</td>
                <td style={{ textAlign: 'right', fontSize: '14px', color: 'var(--clr-success-500)' }}>{formatCOP(totals.neto)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Layout>
  );
}
