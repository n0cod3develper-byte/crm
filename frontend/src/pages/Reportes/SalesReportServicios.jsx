import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, FileText, FileSpreadsheet, AlertCircle, RefreshCw, Filter, Building2, Truck, ClipboardList, DollarSign } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Layout } from '../../components/Layout';
import api from '../../lib/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

const ESTADO_BADGE = {
  BORRADOR: 'gray',
  PENDIENTE: 'warning',
  REALIZADA: 'primary',
  LIQUIDADA: 'green',
  ANULADO: 'danger',
  ANULADA: 'danger'
};

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
    return [...data].sort((a, b) => {
      const diff = new Date(b.fecha_servicio) - new Date(a.fecha_servicio);
      if (diff !== 0) return diff;
      const remDiff = String(b.numero_remision || '').localeCompare(String(a.numero_remision || ''), undefined, { numeric: true });
      if (remDiff !== 0) return remDiff;
      return (a.orden || 0) - (b.orden || 0);
    });
  }, [data]);

  // Cálculo de totales al pie de la tabla
  const totals = useMemo(() => {
    const sum = {
      descuentos: 0,
      neto: 0,
      count: items.length,
      remisionesCount: new Set(items.map(it => it.id || it.numero_remision)).size
    };
    items.forEach(item => {
      const isAnulada = item.estado === 'ANULADO' || item.estado === 'ANULADA';
      const descuentos = parseFloat(item.descuentos || 0);
      const neto = isAnulada ? 0 : parseFloat(item.total_neto || 0);

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
        const isAnulada = item.estado === 'ANULADO' || item.estado === 'ANULADA';
        const descuentos = parseFloat(item.descuentos || 0);
        const neto = isAnulada ? 0 : parseFloat(item.total_neto || 0);
        const horas = parseFloat(item.cantidad_horas || 0);
        const hmSalida = item.horometro_salida != null ? parseFloat(item.horometro_salida).toFixed(1) : '—';
        const hmLlegada = item.horometro_regreso != null ? parseFloat(item.horometro_regreso).toFixed(1) : '—';
        const motivo = item.motivo_anulacion || (isAnulada ? 'Sin motivo' : '—');
        const estadoLabel = item.estado === 'ANULADO' ? 'ANULADA' : (item.estado || '—');

        return [
          item.numero_remision,
          formatDate(item.fecha_servicio),
          estadoLabel,
          item.empresa_nombre,
          item.operario_nombre || '—',
          item.servicio_codigo ? `[${item.servicio_codigo}] ${item.servicio_nombre}` : item.servicio_nombre,
          item.capacidad_nominal ? `${item.capacidad_nominal} Ton` : '—',
          item.tipo_servicio || '—',
          item.equipo_serie || '—',
          hmSalida,
          hmLlegada,
          horas > 0 ? horas.toFixed(2) : '—',
          formatCOP(descuentos),
          formatCOP(neto),
          item.numero_factura || '—',
          motivo
        ];
      });

      // Añadir fila de totales
      tableBody.push([
        'TOTALES',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        `${totals.count} Ítems (${totals.remisionesCount} Rem.)`,
        '',
        '',
        '',
        formatCOP(totals.descuentos),
        formatCOP(totals.neto),
        '',
        ''
      ]);

      autoTable(doc, {
        startY: 44,
        head: [['No. Rem', 'Fecha', 'Estado', 'Cliente', 'Operario', 'Servicio', 'Asunto', 'Tipo', 'Equipo', 'Hm. Sal', 'Hm. Lleg', 'Horas', 'Descuento', 'Neto', 'N° Factura', 'Motivo Anulación']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 14 },
          1: { halign: 'center', cellWidth: 15 },
          2: { halign: 'center', cellWidth: 16 },
          3: { cellWidth: 25 },
          4: { cellWidth: 23 },
          5: { cellWidth: 24 },
          6: { halign: 'center', cellWidth: 13 },
          7: { halign: 'center', cellWidth: 11 },
          8: { cellWidth: 16 },
          9: { halign: 'center', cellWidth: 13 },
          10: { halign: 'center', cellWidth: 13 },
          11: { halign: 'center', cellWidth: 10 },
          12: { halign: 'right', cellWidth: 16 },
          13: { halign: 'right', fontStyle: 'bold', cellWidth: 17 },
          14: { halign: 'center', cellWidth: 15 },
          15: { cellWidth: 26 }
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

  // Sanitizador contra inyección de fórmulas en Excel
  const sanitizeExcelText = (val) => {
    if (val == null) return '';
    const str = String(val).trim();
    if (/^[=+\-@]/.test(str)) {
      return `'${str}`;
    }
    return str;
  };

  // Exportar a Excel con ExcelJS con formato corporativo completo
  const handleExportExcel = async () => {
    if (items.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'CARGAR SAS CRM';
      wb.created = new Date();

      const ws = wb.addWorksheet('Reporte Ventas Servicios', {
        pageSetup: {
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          paperSize: 9,
          printTitlesRow: '5:5'
        }
      });

      // ── Encabezado superior ──
      // Fila 1: Título institucional
      const titleRow = ws.addRow(['TOTALIZADO FINAL']);
      titleRow.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E293B' } };
      titleRow.height = 22;

      // Fila 2: Línea de generación con fecha y hora
      const now = new Date();
      const fechaGen = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
      const genRow = ws.addRow([`Generado por ${fechaGen} en Mercadeo Cargar`]);
      genRow.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
      genRow.height = 18;

      // Fila 3: Cantidad de registros exportados
      const countRow = ws.addRow([`Cantidad de registros : ${items.length}`]);
      countRow.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
      countRow.height = 18;

      // Fila 4: Fila en blanco
      const blankRow = ws.addRow([]);
      blankRow.height = 10;

      // ── Fila 5: Títulos de columnas ──
      const headers = [
        'No. Remisión',
        'Fecha Servicio',
        'Estado',
        'Cliente',
        'Operario',
        'Código Servicio',
        'Servicio',
        'Asunto',
        'Tipo',
        'Código Equipo',
        'Horómetro Salida',
        'Horómetro Llegada',
        'Cant. Horas',
        'Descuentos',
        'Valor Neto',
        'N° Factura',
        'Motivo Anulación'
      ];
      const headerRow = ws.addRow(headers);
      headerRow.height = 26;
      headerRow.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF334155' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

      const thinBorder = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };

      headerRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF1E293B' } },
          left: { style: 'thin', color: { argb: 'FF475569' } },
          bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
          right: { style: 'thin', color: { argb: 'FF475569' } }
        };
      });

      // ── Filas de datos ──
      items.forEach((item) => {
        const isAnulada = item.estado === 'ANULADO' || item.estado === 'ANULADA';
        const descuentos = parseFloat(item.descuentos || 0);
        const neto = isAnulada ? 0 : parseFloat(item.total_neto || 0);
        const horas = parseFloat(item.cantidad_horas || 0);
        const hmSalida = item.horometro_salida != null ? parseFloat(item.horometro_salida) : null;
        const hmLlegada = item.horometro_regreso != null ? parseFloat(item.horometro_regreso) : null;
        const motivo = item.motivo_anulacion || (isAnulada ? 'Sin motivo' : '');
        const estadoLabel = item.estado === 'ANULADO' ? 'ANULADA' : (item.estado || '');

        let fechaServicioVal = null;
        if (item.fecha_servicio) {
          const dt = new Date(item.fecha_servicio);
          if (!isNaN(dt.getTime())) {
            fechaServicioVal = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
          }
        }

        const row = ws.addRow([
          sanitizeExcelText(item.numero_remision),
          fechaServicioVal,
          sanitizeExcelText(estadoLabel),
          sanitizeExcelText(item.empresa_nombre),
          sanitizeExcelText(item.operario_nombre || '—'),
          sanitizeExcelText(item.servicio_codigo || '—'),
          sanitizeExcelText(item.servicio_nombre),
          sanitizeExcelText(item.capacidad_nominal ? `${item.capacidad_nominal} Ton` : '—'),
          sanitizeExcelText(item.tipo_servicio || '—'),
          sanitizeExcelText(item.equipo_serie || '—'),
          hmSalida,
          hmLlegada,
          horas,
          descuentos,
          neto,
          sanitizeExcelText(item.numero_factura || '—'),
          sanitizeExcelText(motivo)
        ]);

        row.height = 20;

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.border = thinBorder;
          cell.font = { name: 'Calibri', size: 10 };

          switch (colNumber) {
            case 1:
            case 3:
            case 6:
            case 8:
            case 9:
            case 10:
            case 16:
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
              break;

            case 2:
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
              cell.numFmt = 'DD/MM/YYYY';
              break;

            case 4:
            case 5:
            case 7:
            case 17:
              cell.alignment = { vertical: 'middle', horizontal: 'left' };
              break;

            case 11:
            case 12:
              cell.alignment = { vertical: 'middle', horizontal: 'right' };
              cell.numFmt = '#,##0.0';
              break;

            case 13:
              cell.alignment = { vertical: 'middle', horizontal: 'right' };
              cell.numFmt = '#,##0.00';
              break;

            case 14:
            case 15:
              cell.alignment = { vertical: 'middle', horizontal: 'right' };
              cell.numFmt = '"$"#,##0';
              break;

            default:
              cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }
        });
      });

      // ── Fila de totales ──
      const totalRow = ws.addRow([
        'TOTALES',
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        `${totals.count} Ítems (${totals.remisionesCount} Remisiones)`,
        null,
        null,
        null,
        totals.descuentos,
        totals.neto,
        null,
        null
      ]);

      totalRow.height = 22;
      totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10, bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' }
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'double', color: { argb: 'FF475569' } },
          left: thinBorder.left,
          right: thinBorder.right
        };

        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else if (colNumber === 10) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNumber === 14 || colNumber === 15) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '"$"#,##0';
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      });

      // ── Inmovilizar paneles (Freeze Panes) y AutoFiltro ──
      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }];
      ws.autoFilter = {
        from: { row: 5, column: 1 },
        to: { row: 5, column: 17 }
      };

      // ── Auto-ajuste de ancho de columnas ──
      const minColWidths = {
        1: 15,
        2: 15,
        3: 13,
        4: 28,
        5: 24,
        6: 16,
        7: 32,
        8: 14,
        9: 15,
        10: 16,
        11: 16,
        12: 16,
        13: 14,
        14: 17,
        15: 19,
        16: 14,
        17: 28
      };

      ws.columns.forEach((column, index) => {
        const colNum = index + 1;
        let maxLength = 0;
        column.eachCell({ includeEmpty: false }, (cell) => {
          if (cell.row < 5) return;
          const val = cell.value;
          if (val instanceof Date) {
            maxLength = Math.max(maxLength, 10);
          } else if (typeof val === 'number') {
            maxLength = Math.max(maxLength, String(val).length + 4);
          } else if (val != null) {
            maxLength = Math.max(maxLength, String(val).length);
          }
        });
        const minWidth = minColWidths[colNum] || 12;
        column.width = Math.max(minWidth, maxLength + 3);
      });

      // ── Generar y descargar archivo en navegador ──
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Reporte_Ventas_Servicios_${appliedFilters.desde}_a_${appliedFilters.hasta}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

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
                <th style={{ width: 95 }}>Nro. Remisión</th>
                <th style={{ width: 95 }}><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} />Fecha</span></th>
                <th style={{ width: 95, textAlign: 'center' }}>Estado</th>
                <th><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={12} />Cliente</span></th>
                <th>Operario</th>
                <th>Servicio</th>
                <th style={{ width: 130, textAlign: 'center' }}>Asunto</th>
                <th style={{ width: 75, textAlign: 'center' }}>Tipo</th>
                <th style={{ width: 90, textAlign: 'center' }}><span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}><Truck size={12} />Código</span></th>
                <th style={{ width: 85, textAlign: 'center' }}>Hm. Salida</th>
                <th style={{ width: 85, textAlign: 'center' }}>Hm. Llegada</th>
                <th style={{ width: 65, textAlign: 'center' }}>Horas</th>
                <th style={{ width: 90, textAlign: 'right' }}>Descuentos</th>
                <th style={{ width: 110, textAlign: 'right', fontWeight: 'bold' }}><span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}><DollarSign size={12} />Total Neto</span></th>
                <th style={{ width: 100, textAlign: 'center' }}>N° Factura</th>
                <th style={{ minWidth: 150 }}>Motivo Anulación</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const isAnulada = item.estado === 'ANULADO' || item.estado === 'ANULADA';
                const descuentos = parseFloat(item.descuentos || 0);
                const neto = isAnulada ? 0 : parseFloat(item.total_neto || 0);
                const hmSalida = item.horometro_salida != null ? parseFloat(item.horometro_salida).toFixed(1) : '—';
                const hmLlegada = item.horometro_regreso != null ? parseFloat(item.horometro_regreso).toFixed(1) : '—';
                
                return (
                  <tr key={item.item_id || `${item.id}-${index}`}>
                    <td>
                      <code style={{ fontWeight: 800, fontSize: '13px', color: 'var(--clr-primary-400)' }}>
                        {item.numero_remision}
                      </code>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{formatDate(item.fecha_servicio)}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge badge--${ESTADO_BADGE[item.estado] || 'gray'}`} style={{ fontSize: '10px' }}>
                        {item.estado === 'ANULADO' ? 'ANULADA' : (item.estado || '—')}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '13px', display: 'block' }}>{item.empresa_nombre}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{item.operario_nombre || '—'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {item.servicio_codigo && (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--clr-primary-400)', fontFamily: 'monospace' }}>
                            {item.servicio_codigo}
                          </span>
                        )}
                        <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{item.servicio_nombre}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{item.capacidad_nominal ? `${item.capacidad_nominal} Ton` : '—'}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge badge--${item.tipo_servicio === 'Fijo' ? 'primary' : item.tipo_servicio === 'Esporádico' ? 'warning' : 'gray'}`} style={{ fontSize: '10px' }}>
                        {item.tipo_servicio || '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>
                        {item.equipo_serie || '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{hmSalida}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{hmLlegada}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {parseFloat(item.cantidad_horas || 0) > 0 ? parseFloat(item.cantidad_horas).toFixed(2) : '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '13px', color: 'var(--clr-danger-400)' }}>{formatCOP(descuentos)}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      <span style={{ fontSize: '14px', color: isAnulada ? 'var(--text-muted)' : 'var(--clr-success-500)' }}>{formatCOP(neto)}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: item.numero_factura ? 'var(--clr-success-500)' : 'var(--text-muted)' }}>
                        {item.numero_factura || '—'}
                      </span>
                    </td>
                    <td>
                      {item.motivo_anulacion ? (
                        <span style={{ fontSize: '12px', color: 'var(--clr-danger-500)', display: 'block' }}>
                          {item.motivo_anulacion}
                        </span>
                      ) : isAnulada ? (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Sin motivo
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* ── Fila de Totales/Resumen ── */}
            <tfoot style={{ borderTop: '2px solid var(--border-color)', background: 'var(--bg-subtle)' }}>
              <tr style={{ fontWeight: 'bold', borderBottom: 'none' }}>
                <td colSpan={8}>TOTALES</td>
                <td>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{totals.count} ítems ({totals.remisionesCount} remisiones)</span>
                </td>
                <td colSpan={3}></td>
                <td style={{ textAlign: 'right', fontSize: '13px', color: 'var(--clr-danger-400)' }}>{formatCOP(totals.descuentos)}</td>
                <td style={{ textAlign: 'right', fontSize: '14px', color: 'var(--clr-success-500)' }}>{formatCOP(totals.neto)}</td>
                <td></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Layout>
  );
}
