import PDFDocument from 'pdfkit';

const COP = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
const FMT_DATE = (d) => { if (!d) return '—'; const dt = new Date(d); return `${String(dt.getUTCDate()).padStart(2,'0')}/${String(dt.getUTCMonth()+1).padStart(2,'0')}/${dt.getUTCFullYear()}`; };
const NUM = (v, dec = 2) => parseFloat(v || 0).toFixed(dec);

// Brand colors
const CLR = { primary: '#1E3A8A', accent: '#2563EB', success: '#10B981', muted: '#6B7280', light: '#F5F7FA', white: '#FFFFFF', border: '#BCCCDC', danger: '#EF4444' };

function drawHeader(doc, titulo, generadoPor, filtros = {}) {
  // Background bar
  doc.rect(0, 0, doc.page.width, 70).fill(CLR.primary);

  // Logo area
  doc.fontSize(18).fillColor(CLR.white).font('Helvetica-Bold')
    .text('CARGAR SAS', 40, 18);
  doc.fontSize(8).fillColor('rgba(255,255,255,0.75)').font('Helvetica')
    .text('CRM & ERP Logístico', 40, 40);

  // Title right
  doc.fontSize(14).fillColor(CLR.white).font('Helvetica-Bold')
    .text(titulo, 200, 20, { width: doc.page.width - 260, align: 'right' });
  doc.fontSize(7).fillColor('rgba(255,255,255,0.75)').font('Helvetica')
    .text(`Generado por: ${generadoPor} • ${new Date().toLocaleString('es-CO')}`, 200, 42, { width: doc.page.width - 260, align: 'right' });

  doc.y = 85;
  doc.fillColor(CLR.primary);
}

function drawKpiBar(doc, kpis) {
  const cols = kpis.length;
  const colW = (doc.page.width - 80) / cols;
  const startX = 40;
  const startY = doc.y;
  const boxH = 48;

  kpis.forEach((kpi, idx) => {
    const x = startX + idx * colW;
    // box
    doc.roundedRect(x, startY, colW - 6, boxH, 4).fillAndStroke(CLR.light, CLR.border);
    // label
    doc.fontSize(7).fillColor(CLR.muted).font('Helvetica')
      .text(kpi.label.toUpperCase(), x + 8, startY + 8, { width: colW - 20 });
    // value
    doc.fontSize(12).fillColor(CLR.primary).font('Helvetica-Bold')
      .text(kpi.value, x + 8, startY + 20, { width: colW - 20 });
  });
  doc.y = startY + boxH + 14;
}

function drawTableHeader(doc, columns, y) {
  doc.rect(40, y, doc.page.width - 80, 18).fill(CLR.primary);
  let x = 44;
  columns.forEach(col => {
    doc.fontSize(6).fillColor(CLR.white).font('Helvetica-Bold')
      .text(col.label, x, y + 5, { width: col.width - 4, align: col.align || 'left' });
    x += col.width;
  });
  return y + 18;
}

function drawTableRow(doc, columns, row, y, isEven, isSubtotal = false) {
  const h = isSubtotal ? 16 : 14;
  if (isSubtotal) {
    doc.rect(40, y, doc.page.width - 80, h).fill('rgba(37,99,235,0.08)');
  } else if (isEven) {
    doc.rect(40, y, doc.page.width - 80, h).fill(CLR.light);
  }
  let x = 44;
  columns.forEach(col => {
    const val = typeof col.render === 'function' ? col.render(row) : (row[col.key] ?? '—');
    doc.fontSize(isSubtotal ? 7 : 6.5)
      .fillColor(isSubtotal ? CLR.accent : CLR.primary)
      .font(isSubtotal ? 'Helvetica-Bold' : 'Helvetica')
      .text(String(val), x, y + 3, { width: col.width - 4, align: col.align || 'left', lineBreak: false });
    x += col.width;
  });
  return y + h;
}

function drawTotalRow(doc, label, values, columns, y) {
  doc.rect(40, y, doc.page.width - 80, 18).fill(CLR.primary);
  doc.fontSize(7).fillColor(CLR.white).font('Helvetica-Bold')
    .text(label, 44, y + 5, { width: 120 });
  let x = 44 + 120;
  values.forEach((val, i) => {
    doc.text(String(val), x, y + 5, { width: (columns[i]?.width || 60) - 4, align: 'right' });
    x += (columns[i]?.width || 60);
  });
  return y + 18;
}

// ============================================================
// INFORME TOTALIZADO FINAL
// ============================================================
async function buildTotalizadoPdf({ data, kpis, generadoPor, filtros }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc, 'Informe Totalizado Final', generadoPor, filtros);

    // KPIs
    drawKpiBar(doc, [
      { label: 'Total Servicios',  value: kpis.total_servicios.toString() },
      { label: 'Total Horas',      value: `${NUM(kpis.total_horas, 1)}h` },
      { label: 'Total Facturado',  value: COP(kpis.total_facturado) },
      { label: 'Total Descuentos', value: COP(kpis.total_descuentos) },
      { label: 'Total Neto',       value: COP(kpis.total_neto) },
    ]);

    // Metadatos
    doc.fontSize(7).fillColor(CLR.muted).font('Helvetica')
      .text(`Registros: ${data.length}  |  Período: ${filtros.fecha_desde || 'N/A'} → ${filtros.fecha_hasta || 'N/A'}`, 40, doc.y, { align: 'left' })
      .moveDown(0.5);

    // Tabla
    const columns = [
      { key: 'tipo',           label: 'Tipo',        width: 52 },
      { key: 'numero_remision',label: 'Remisión',    width: 54 },
      { key: 'fecha_servicio', label: 'Fecha Serv.', width: 54, render: r => FMT_DATE(r.fecha_servicio) },
      { key: 'fecha_factura',  label: 'Fecha Fact.', width: 54, render: r => FMT_DATE(r.fecha_factura) },
      { key: 'empresa_nombre', label: 'Empresa',     width: 90 },
      { key: 'nit',            label: 'NIT',         width: 60 },
      { key: 'operario_nombre',label: 'Operario',    width: 80 },
      { key: 'maquina',        label: 'Máquina',     width: 45 },
      { key: 'toneladas',      label: 'Ton.',        width: 30, align: 'right' },
      { key: 'cantidad_horas', label: 'Horas',       width: 36, align: 'right' },
      { key: 'valor_hora',     label: 'Vlr/Hora',    width: 58, align: 'right', render: r => COP(r.valor_hora) },
      { key: 'total_neto',     label: 'Total Neto',  width: 68, align: 'right', render: r => COP(r.total_neto) },
      { key: 'estado',         label: 'Estado',      width: 55 },
    ];

    let y = doc.y;
    const maxW = doc.page.width - 80;
    const startX = 40;

    // Reducir columnas al ancho disponible
    const totalW = columns.reduce((s, c) => s + c.width, 0);
    if (totalW > maxW) {
      const factor = maxW / totalW;
      columns.forEach(c => { c.width = Math.floor(c.width * factor); });
    }

    y = drawTableHeader(doc, columns, y);

    data.forEach((row, idx) => {
      if (y > doc.page.height - 60) {
        doc.addPage({ margin: 0, size: 'A4', layout: 'landscape' });
        y = 20;
        y = drawTableHeader(doc, columns, y);
      }
      y = drawTableRow(doc, columns, row, y, idx % 2 === 0);
      // Separador
      doc.rect(startX, y, maxW, 0.3).fill(CLR.border);
    });

    // Totales finales
    y += 4;
    drawTotalRow(doc, `TOTAL (${data.length} registros)`,
      [`${NUM(kpis.total_horas, 1)}h`, '', COP(kpis.total_neto), ''],
      [{ width: 58 }, { width: 68 }, { width: 68 }, { width: 55 }], y);

    doc.end();
  });
}

// ============================================================
// INFORME LIQUIDACIÓN GESTIÓN HUMANA
// ============================================================
async function buildLiquidacionPdf({ data, subtotales, totales, generadoPor, filtros }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4', layout: 'portrait' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc, 'Liquidación Horas — Gestión Humana', generadoPor, filtros);

    drawKpiBar(doc, [
      { label: 'Total Operarios',  value: totales.total_operarios.toString() },
      { label: 'Horas Liquidadas', value: `${NUM(totales.total_horas, 1)}h` },
      { label: 'Comisión Total',   value: COP(totales.total_comision) },
      { label: 'Productividad',    value: `${NUM(totales.productividad_promedio, 1)}%` },
    ]);

    doc.fontSize(7).fillColor(CLR.muted).font('Helvetica')
      .text(`Registros: ${data.length}  |  Período: ${filtros.fecha_desde || 'N/A'} → ${filtros.fecha_hasta || 'N/A'}`, 40, doc.y)
      .moveDown(0.4);

    const columns = [
      { key: 'identification',           label: 'Identificación',  width: 72 },
      { key: 'operario',                 label: 'Operario',        width: 100 },
      { key: 'numero_remision',          label: 'Remisión',        width: 55 },
      { key: 'maquina',                  label: 'Máquina',         width: 48 },
      { key: 'fecha_servicio',           label: 'Fecha',           width: 52, render: r => FMT_DATE(r.fecha_servicio) },
      { key: 'bonificacion_por_hora',    label: 'Bonif/Hora',      width: 58, align: 'right', render: r => COP(r.bonificacion_por_hora) },
      { key: 'horas_liquidadas',         label: 'Horas',           width: 36, align: 'right', render: r => NUM(r.horas_liquidadas, 1) },
      { key: 'comision_horas_liquidadas',label: 'Comisión',        width: 65, align: 'right', render: r => COP(r.comision_horas_liquidadas) },
    ];

    let y = doc.y;
    const maxW = doc.page.width - 80;
    const totalW = columns.reduce((s, c) => s + c.width, 0);
    if (totalW > maxW) {
      const factor = maxW / totalW;
      columns.forEach(c => { c.width = Math.floor(c.width * factor); });
    }

    y = drawTableHeader(doc, columns, y);

    let currentOperario = null;

    data.forEach((row, idx) => {
      if (y > doc.page.height - 80) {
        doc.addPage({ margin: 0, size: 'A4', layout: 'portrait' });
        y = 20;
        y = drawTableHeader(doc, columns, y);
      }

      // Subtotal al cambiar de operario
      if (currentOperario && currentOperario !== row.operario) {
        const sub = subtotales.find(s => s.full_name === currentOperario);
        if (sub) {
          y = drawTableRow(doc, columns, {
            identification: '', operario: `Subtotal — ${currentOperario}`, numero_remision: '',
            maquina: '', fecha_servicio: null, bonificacion_por_hora: 0,
            horas_liquidadas: sub.total_horas_operario,
            comision_horas_liquidadas: sub.total_comision_operario,
          }, y, false, true);
          y += 3;
        }
      }
      currentOperario = row.operario;
      y = drawTableRow(doc, columns, row, y, idx % 2 === 0);
      doc.rect(40, y, maxW, 0.3).fill(CLR.border);
    });

    // Último subtotal
    if (currentOperario) {
      const sub = subtotales.find(s => s.full_name === currentOperario);
      if (sub) {
        y = drawTableRow(doc, columns, {
          identification: '', operario: `Subtotal — ${currentOperario}`, numero_remision: '',
          maquina: '', fecha_servicio: null, bonificacion_por_hora: 0,
          horas_liquidadas: sub.total_horas_operario,
          comision_horas_liquidadas: sub.total_comision_operario,
        }, y, false, true);
        y += 3;
      }
    }

    y += 4;
    drawTotalRow(doc, `TOTAL GENERAL`, [
      `${NUM(totales.total_horas, 1)}h`,
      COP(totales.total_comision),
    ], [{ width: 36 }, { width: 65 }], y);

    doc.end();
  });
}

// ============================================================
// PLANTILLA GESTIÓN HUMANA (diseño premium)
// ============================================================
async function buildPlantillaGH({ data, subtotales, totales, generadoPor, filtros }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4', layout: 'portrait' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;

    // Header premium
    doc.rect(0, 0, W, 90).fill(CLR.primary);
    doc.rect(0, 90, W, 4).fill(CLR.accent);

    doc.fontSize(22).fillColor(CLR.white).font('Helvetica-Bold').text('CARGAR SAS', 40, 20);
    doc.fontSize(9).fillColor('rgba(255,255,255,0.7)').font('Helvetica').text('Plantilla Gestión Humana — Liquidación de Operarios', 40, 50);
    doc.fontSize(7).fillColor('rgba(255,255,255,0.6)').text(`Generado por: ${generadoPor}  •  ${new Date().toLocaleString('es-CO')}`, 40, 68);

    // Período
    doc.fontSize(10).fillColor(CLR.white).font('Helvetica-Bold')
      .text(`Período: ${filtros.fecha_desde || '—'} → ${filtros.fecha_hasta || '—'}`, 300, 35, { width: W - 340, align: 'right' });

    doc.y = 110;

    // Metadatos del reporte
    const remisiones = [...new Set(data.map(d => d.numero_remision))];
    const metaY = doc.y;
    doc.rect(40, metaY, W - 80, 54).fillAndStroke(CLR.light, CLR.border);
    doc.fontSize(7).fillColor(CLR.muted).font('Helvetica')
      .text('RESUMEN DEL REPORTE', 48, metaY + 8)
      .font('Helvetica-Bold').fillColor(CLR.primary);

    const metaCols = [
      ['Registros', data.length],
      ['Operarios', totales.total_operarios],
      ['Horas Totales', `${NUM(totales.total_horas, 1)}h`],
      ['Comisión Total', COP(totales.total_comision)],
      ['Productividad', `${NUM(totales.productividad_promedio, 1)}%`],
    ];
    const colW = (W - 96) / metaCols.length;
    metaCols.forEach(([label, value], i) => {
      const mx = 48 + i * colW;
      doc.fontSize(7).fillColor(CLR.muted).font('Helvetica').text(label.toUpperCase(), mx, metaY + 22, { width: colW });
      doc.fontSize(11).fillColor(CLR.primary).font('Helvetica-Bold').text(String(value), mx, metaY + 32, { width: colW });
    });

    // Remisiones incluidas
    doc.fontSize(6).fillColor(CLR.muted).font('Helvetica')
      .text(`Remisiones incluidas: ${remisiones.slice(0, 10).join(', ')}${remisiones.length > 10 ? ` ...y ${remisiones.length - 10} más` : ''}`,
        48, metaY + 50, { width: W - 100 });

    doc.y = metaY + 70;

    // Tabla por operario con productividad visual
    subtotales.forEach((op, opIdx) => {
      const opData = data.filter(d => d.operario === op.full_name);
      const prod = parseFloat(op.productividad_pct || 0);
      const prodColor = prod >= 80 ? CLR.success : prod >= 60 ? '#F59E0B' : CLR.danger;

      if (doc.y > doc.page.height - 180) {
        doc.addPage({ margin: 0, size: 'A4', layout: 'portrait' });
        doc.y = 30;
      }

      const opY = doc.y;
      // Cabecera del operario
      doc.rect(40, opY, W - 80, 28).fill(CLR.accent);
      doc.fontSize(9).fillColor(CLR.white).font('Helvetica-Bold')
        .text(`${op.full_name}`, 48, opY + 5, { width: W - 200 });
      doc.fontSize(7).fillColor('rgba(255,255,255,0.85)').font('Helvetica')
        .text(`${COP(op.total_comision_operario)}  |  ${NUM(op.total_horas_operario, 1)}h`, 48, opY + 17, { width: W - 200 });

      // Badge de productividad
      const badgeX = W - 130;
      doc.rect(badgeX, opY + 5, 82, 18).fill(prodColor).stroke(prodColor);
      doc.fontSize(8).fillColor(CLR.white).font('Helvetica-Bold')
        .text(`Productividad: ${NUM(prod, 1)}%`, badgeX + 4, opY + 9, { width: 74, align: 'center' });

      // Barra de progreso
      const barY = opY + 25;
      const barW = W - 80;
      doc.rect(40, barY, barW, 5).fill('#E5E7EB');
      doc.rect(40, barY, Math.min(barW * prod / 100, barW), 5).fill(prodColor);

      doc.y = barY + 10;

      // Sub-tabla del operario
      const subCols = [
        { key: 'numero_remision', label: 'Remisión', width: 60 },
        { key: 'maquina', label: 'Máquina', width: 55 },
        { key: 'fecha_servicio', label: 'Fecha', width: 58, render: r => FMT_DATE(r.fecha_servicio) },
        { key: 'horas_liquidadas', label: 'Horas Liq.', width: 52, align: 'right', render: r => `${NUM(r.horas_liquidadas, 1)}h` },
        { key: 'bonificacion_por_hora', label: 'Bonif/Hora', width: 62, align: 'right', render: r => COP(r.bonificacion_por_hora) },
        { key: 'comision_horas_liquidadas', label: 'Comisión', width: 68, align: 'right', render: r => COP(r.comision_horas_liquidadas) },
      ];
      const subTotalW = subCols.reduce((s, c) => s + c.width, 0);
      const factor = (W - 80) / subTotalW;
      subCols.forEach(c => { c.width = Math.floor(c.width * factor); });

      let tY = doc.y;
      tY = drawTableHeader(doc, subCols, tY);
      opData.forEach((row, ri) => {
        if (tY > doc.page.height - 60) {
          doc.addPage({ margin: 0, size: 'A4', layout: 'portrait' });
          tY = 20;
          tY = drawTableHeader(doc, subCols, tY);
        }
        tY = drawTableRow(doc, subCols, row, tY, ri % 2 === 0);
        doc.rect(40, tY, W - 80, 0.3).fill(CLR.border);
      });

      // Subtotal del operario
      tY += 2;
      doc.rect(40, tY, W - 80, 16).fill('rgba(37,99,235,0.1)');
      const lastColX = 40 + subCols.slice(0, -1).reduce((s, c) => s + c.width, 0);
      doc.fontSize(7).fillColor(CLR.accent).font('Helvetica-Bold')
        .text('SUBTOTAL', 44, tY + 4, { width: 100 });
      doc.text(COP(op.total_comision_operario), lastColX, tY + 4,
        { width: subCols[subCols.length - 1].width - 4, align: 'right' });
      doc.y = tY + 24;
    });

    // Total general al final
    if (doc.y > doc.page.height - 60) doc.addPage({ margin: 0, size: 'A4', layout: 'portrait' });
    const totalY = doc.y + 4;
    doc.rect(40, totalY, doc.page.width - 80, 22).fill(CLR.primary);
    doc.fontSize(9).fillColor(CLR.white).font('Helvetica-Bold')
      .text('TOTAL GENERAL', 48, totalY + 6, { width: 160 });
    doc.text(`${NUM(totales.total_horas, 1)}h  |  ${COP(totales.total_comision)}`,
      48 + 160, totalY + 6, { width: doc.page.width - 240, align: 'right' });

    // Footer
    doc.fontSize(6).fillColor(CLR.muted).font('Helvetica')
      .text('CARGAR SAS — CRM & ERP Logístico — Confidencial', 40, doc.page.height - 20, {
        width: doc.page.width - 80, align: 'center',
      });

    doc.end();
  });
}

// ============================================================
// EXPORT UNIFICADO
// ============================================================
export async function generateInformePdf({ tipo, titulo, data, kpis, subtotales, totales, generadoPor, filtros }) {
  if (tipo === 'TOTALIZADO') {
    return buildTotalizadoPdf({ data, kpis, generadoPor, filtros });
  }
  return buildLiquidacionPdf({ data, subtotales, totales, generadoPor, filtros });
}

export async function generatePlantillaGH({ data, subtotales, totales, generadoPor, filtros }) {
  return buildPlantillaGH({ data, subtotales, totales, generadoPor, filtros });
}
