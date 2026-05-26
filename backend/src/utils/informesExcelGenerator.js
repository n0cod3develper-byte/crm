import ExcelJS from 'exceljs';

const COP = (v) => parseFloat(v || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const FMT_DATE = (d) => { if (!d) return ''; const dt = new Date(d); return `${String(dt.getUTCDate()).padStart(2,'0')}/${String(dt.getUTCMonth()+1).padStart(2,'0')}/${dt.getUTCFullYear()}`; };

const BRAND_BLUE   = { argb: 'FF1E3A8A' };
const ACCENT_BLUE  = { argb: 'FF2563EB' };
const SUCCESS      = { argb: 'FF10B981' };
const LIGHT_GRAY   = { argb: 'FFF5F7FA' };
const BORDER_GRAY  = { argb: 'FFBCCCDC' };
const WHITE        = { argb: 'FFFFFFFF' };
const TEXT_MUTED   = { argb: 'FF6B7280' };
const SUBTOTAL_BG  = { argb: 'FFE8F0FE' };
const DANGER       = { argb: 'FFEF4444' };
const WARNING      = { argb: 'FFF59E0B' };

function applyHeaderStyle(cell) {
  cell.font = { bold: true, color: WHITE, size: 9, name: 'Calibri' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: BRAND_BLUE };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = { bottom: { style: 'thin', color: BORDER_GRAY } };
}

function applyDataStyle(cell, isEven, align = 'left') {
  cell.font = { size: 8, name: 'Calibri', color: { argb: 'FF1A202C' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: isEven ? LIGHT_GRAY : WHITE };
  cell.alignment = { vertical: 'middle', horizontal: align };
  cell.border = { bottom: { style: 'hair', color: BORDER_GRAY } };
}

function applySubtotalStyle(cell, align = 'left') {
  cell.font = { bold: true, size: 9, name: 'Calibri', color: { argb: 'FF2563EB' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: SUBTOTAL_BG };
  cell.alignment = { vertical: 'middle', horizontal: align };
  cell.border = { top: { style: 'thin', color: BORDER_GRAY }, bottom: { style: 'thin', color: BORDER_GRAY } };
}

function applyTotalStyle(cell, align = 'left') {
  cell.font = { bold: true, size: 10, name: 'Calibri', color: WHITE };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: BRAND_BLUE };
  cell.alignment = { vertical: 'middle', horizontal: align };
}

function addMetaSheet(wb, titulo, generadoPor, filtros, kpisOrTotales) {
  const sheet = wb.addWorksheet('Metadatos');
  sheet.getColumn('A').width = 30;
  sheet.getColumn('B').width = 50;

  const addRow = (label, value) => {
    const row = sheet.addRow([label, value]);
    row.getCell(1).font = { bold: true, color: { argb: 'FF4A5568' }, name: 'Calibri' };
    row.getCell(2).font = { name: 'Calibri' };
  };

  const titleRow = sheet.addRow([titulo]);
  titleRow.getCell(1).font = { bold: true, size: 14, color: BRAND_BLUE, name: 'Calibri' };
  titleRow.height = 28;
  sheet.addRow([]);

  addRow('Generado por', generadoPor);
  addRow('Fecha de generación', new Date().toLocaleString('es-CO'));
  sheet.addRow([]);

  if (filtros) {
    addRow('Filtros aplicados', '');
    if (filtros.fecha_desde) addRow('  Desde', filtros.fecha_desde);
    if (filtros.fecha_hasta) addRow('  Hasta', filtros.fecha_hasta);
    sheet.addRow([]);
  }

  if (kpisOrTotales) {
    addRow('KPIs / Totales', '');
    Object.entries(kpisOrTotales).forEach(([k, v]) => addRow(`  ${k}`, String(v)));
  }
}

// ============================================================
// TOTALIZADO FINAL — EXCEL
// ============================================================
async function buildTotalizadoExcel({ data, kpis, generadoPor, filtros }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CARGAR SAS CRM';
  wb.created = new Date();

  addMetaSheet(wb, 'Informe Totalizado Final', generadoPor, filtros, {
    'Total Servicios':  kpis.total_servicios,
    'Total Horas':      `${parseFloat(kpis.total_horas).toFixed(1)}h`,
    'Total Facturado':  `$ ${COP(kpis.total_facturado)}`,
    'Total Descuentos': `$ ${COP(kpis.total_descuentos)}`,
    'Total Neto':       `$ ${COP(kpis.total_neto)}`,
  });

  const ws = wb.addWorksheet('Totalizado Final', {
    views: [{ state: 'frozen', ySplit: 2 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  // Columnas
  const cols = [
    { header: 'Tipo',          key: 'tipo',            width: 14 },
    { header: 'Remisión',      key: 'numero_remision', width: 12 },
    { header: 'Fecha Serv.',   key: 'fecha_servicio',  width: 12 },
    { header: 'Fecha Fact.',   key: 'fecha_factura',   width: 12 },
    { header: 'No. Factura',   key: 'numero_factura',  width: 14 },
    { header: 'Estado',        key: 'estado',          width: 12 },
    { header: 'Empresa',       key: 'empresa_nombre',  width: 28 },
    { header: 'NIT',           key: 'nit',             width: 14 },
    { header: 'Operario',      key: 'operario_nombre', width: 24 },
    { header: 'Máquina',       key: 'maquina',         width: 12 },
    { header: 'Ton.',          key: 'toneladas',        width: 8 },
    { header: 'Forma Pago',    key: 'forma_pago',      width: 12 },
    { header: 'Horas',         key: 'cantidad_horas',  width: 10 },
    { header: 'Vlr/Hora',      key: 'valor_hora',      width: 14 },
    { header: 'Importe',       key: 'importe',         width: 16 },
    { header: 'Descuentos',    key: 'descuentos',      width: 14 },
    { header: 'Total Neto',    key: 'total_neto',       width: 16 },
    { header: 'Ciudad',        key: 'ciudad_envio',    width: 16 },
    { header: 'Horóm. Sal.',   key: 'horometro_salida', width: 12 },
    { header: 'Horóm. Reg.',   key: 'horometro_regreso',width: 12 },
    { header: 'Dirección',     key: 'direccion',       width: 30 },
    { header: 'Email',         key: 'email',           width: 24 },
    { header: 'Teléfono',      key: 'telefono',        width: 14 },
  ];
  ws.columns = cols;

  // Título
  ws.mergeCells('A1:W1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'INFORME TOTALIZADO FINAL — CARGAR SAS';
  titleCell.font = { bold: true, size: 13, color: WHITE, name: 'Calibri' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: BRAND_BLUE };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 26;

  // Header
  const headerRow = ws.getRow(2);
  cols.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    applyHeaderStyle(cell);
  });
  headerRow.height = 22;

  // Data
  const numberCols = new Set(['cantidad_horas', 'valor_hora', 'importe', 'descuentos', 'total_neto', 'toneladas', 'horometro_salida', 'horometro_regreso']);
  data.forEach((row, ri) => {
    const wsRow = ws.addRow({
      tipo:              row.tipo || '—',
      numero_remision:   row.numero_remision,
      fecha_servicio:    FMT_DATE(row.fecha_servicio),
      fecha_factura:     FMT_DATE(row.fecha_factura),
      numero_factura:    row.numero_factura || '—',
      estado:            row.estado,
      empresa_nombre:    row.empresa_nombre,
      nit:               row.nit,
      operario_nombre:   row.operario_nombre || '—',
      maquina:           row.maquina || '—',
      toneladas:         parseFloat(row.toneladas || 0),
      forma_pago:        row.forma_pago || '—',
      cantidad_horas:    parseFloat(row.cantidad_horas || 0),
      valor_hora:        parseFloat(row.valor_hora || 0),
      importe:           parseFloat(row.importe || 0),
      descuentos:        parseFloat(row.descuentos || 0),
      total_neto:        parseFloat(row.total_neto || 0),
      ciudad_envio:      row.ciudad_envio || '—',
      horometro_salida:  parseFloat(row.horometro_salida || 0),
      horometro_regreso: parseFloat(row.horometro_regreso || 0),
      direccion:         row.direccion || '—',
      email:             row.email || '—',
      telefono:          row.telefono || '—',
    });
    wsRow.height = 16;
    cols.forEach((col, colIdx) => {
      const cell = wsRow.getCell(colIdx + 1);
      const align = numberCols.has(col.key) ? 'right' : 'left';
      applyDataStyle(cell, ri % 2 === 0, align);
      if (numberCols.has(col.key) && ['valor_hora','importe','descuentos','total_neto'].includes(col.key)) {
        cell.numFmt = '#,##0';
      }
    });
  });

  // Total row
  const totalRow = ws.addRow({
    tipo: `TOTAL (${data.length} registros)`,
    cantidad_horas: data.reduce((s, r) => s + parseFloat(r.cantidad_horas || 0), 0),
    importe:        data.reduce((s, r) => s + parseFloat(r.importe || 0), 0),
    descuentos:     data.reduce((s, r) => s + parseFloat(r.descuentos || 0), 0),
    total_neto:     data.reduce((s, r) => s + parseFloat(r.total_neto || 0), 0),
  });
  totalRow.height = 20;
  cols.forEach((_, colIdx) => {
    const cell = totalRow.getCell(colIdx + 1);
    applyTotalStyle(cell, numberCols.has(cols[colIdx].key) ? 'right' : 'left');
    if (['importe','descuentos','total_neto'].includes(cols[colIdx].key)) cell.numFmt = '#,##0';
  });

  return wb.xlsx.writeBuffer();
}

// ============================================================
// LIQUIDACIÓN GH — EXCEL
// ============================================================
async function buildLiquidacionExcel({ data, subtotales, totales, generadoPor, filtros }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CARGAR SAS CRM';
  wb.created = new Date();

  addMetaSheet(wb, 'Liquidación Horas — Gestión Humana', generadoPor, filtros, {
    'Total Operarios':     totales.total_operarios,
    'Horas Liquidadas':    `${parseFloat(totales.total_horas).toFixed(1)}h`,
    'Comisión Total':      `$ ${COP(totales.total_comision)}`,
    'Productividad Media': `${parseFloat(totales.productividad_promedio).toFixed(1)}%`,
  });

  const ws = wb.addWorksheet('Liquidación GH', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  const cols = [
    { header: 'Identificación',  key: 'identification',            width: 16 },
    { header: 'Operario',        key: 'operario',                  width: 28 },
    { header: 'No. Remisión',    key: 'numero_remision',           width: 14 },
    { header: 'Máquina',         key: 'maquina',                   width: 12 },
    { header: 'Fecha Servicio',  key: 'fecha_servicio',            width: 14 },
    { header: 'Bonif/Hora',      key: 'bonificacion_por_hora',     width: 14 },
    { header: 'Horas Liquidadas',key: 'horas_liquidadas',          width: 14 },
    { header: 'Comisión',        key: 'comision_horas_liquidadas', width: 16 },
  ];
  ws.columns = cols;

  // Título
  ws.mergeCells('A1:H1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'LIQUIDACIÓN HORAS — GESTIÓN HUMANA — CARGAR SAS';
  titleCell.font = { bold: true, size: 13, color: WHITE, name: 'Calibri' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: BRAND_BLUE };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 26;

  const headerRow = ws.getRow(2);
  cols.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    applyHeaderStyle(cell);
  });
  headerRow.height = 22;

  let currentOperario = null;
  let rowIndex = 0;

  data.forEach((row) => {
    // Subtotal al cambiar de operario
    if (currentOperario && currentOperario !== row.operario) {
      const sub = subtotales.find(s => s.full_name === currentOperario);
      if (sub) {
        const subRow = ws.addRow({
          identification: '', operario: `SUBTOTAL — ${currentOperario}`,
          numero_remision: '', maquina: '', fecha_servicio: '',
          bonificacion_por_hora: '',
          horas_liquidadas: parseFloat(sub.total_horas_operario || 0),
          comision_horas_liquidadas: parseFloat(sub.total_comision_operario || 0),
        });
        subRow.height = 18;
        cols.forEach((_, ci) => {
          const cell = subRow.getCell(ci + 1);
          applySubtotalStyle(cell, ci >= 6 ? 'right' : 'left');
          if (ci === 7) cell.numFmt = '#,##0';
        });
      }
    }
    currentOperario = row.operario;

    const wsRow = ws.addRow({
      identification:            row.identification,
      operario:                  row.operario,
      numero_remision:           row.numero_remision,
      maquina:                   row.maquina || '—',
      fecha_servicio:            FMT_DATE(row.fecha_servicio),
      bonificacion_por_hora:     parseFloat(row.bonificacion_por_hora || 0),
      horas_liquidadas:          parseFloat(row.horas_liquidadas || 0),
      comision_horas_liquidadas: parseFloat(row.comision_horas_liquidadas || 0),
    });
    wsRow.height = 16;
    cols.forEach((col, ci) => {
      const cell = wsRow.getCell(ci + 1);
      applyDataStyle(cell, rowIndex % 2 === 0, ci >= 5 ? 'right' : 'left');
      if (['bonificacion_por_hora','comision_horas_liquidadas'].includes(col.key)) cell.numFmt = '#,##0';
    });
    rowIndex++;
  });

  // Último subtotal
  if (currentOperario) {
    const sub = subtotales.find(s => s.full_name === currentOperario);
    if (sub) {
      const subRow = ws.addRow({
        identification: '', operario: `SUBTOTAL — ${currentOperario}`,
        numero_remision: '', maquina: '', fecha_servicio: '',
        bonificacion_por_hora: '',
        horas_liquidadas: parseFloat(sub.total_horas_operario || 0),
        comision_horas_liquidadas: parseFloat(sub.total_comision_operario || 0),
      });
      subRow.height = 18;
      cols.forEach((_, ci) => {
        applySubtotalStyle(subRow.getCell(ci + 1), ci >= 6 ? 'right' : 'left');
        if (ci === 7) subRow.getCell(ci + 1).numFmt = '#,##0';
      });
    }
  }

  // Total general
  const totalRow = ws.addRow({
    identification: '', operario: `TOTAL GENERAL (${data.length} registros)`,
    numero_remision: '', maquina: '', fecha_servicio: '',
    bonificacion_por_hora: '',
    horas_liquidadas: totales.total_horas,
    comision_horas_liquidadas: totales.total_comision,
  });
  totalRow.height = 22;
  cols.forEach((_, ci) => {
    const cell = totalRow.getCell(ci + 1);
    applyTotalStyle(cell, ci >= 6 ? 'right' : 'left');
    if (ci === 7) cell.numFmt = '#,##0';
  });

  // Hoja de productividad por operario
  const prodWs = wb.addWorksheet('Productividad Operarios');
  prodWs.columns = [
    { header: 'Operario',         key: 'full_name',                width: 30 },
    { header: 'Horas Totales',    key: 'total_horas_operario',     width: 16 },
    { header: 'Productividad %',  key: 'productividad_pct',        width: 16 },
    { header: 'Comisión Total',   key: 'total_comision_operario',  width: 18 },
  ];

  const prodHeader = prodWs.getRow(1);
  prodWs.columns.forEach((_, idx) => {
    const cell = prodHeader.getCell(idx + 1);
    cell.value = prodWs.columns[idx].header;
    applyHeaderStyle(cell);
  });
  prodHeader.height = 22;

  subtotales.forEach((sub, si) => {
    const prod = parseFloat(sub.productividad_pct || 0);
    const prodFill = { argb: prod >= 80 ? 'FF10B981' : prod >= 60 ? 'FFF59E0B' : 'FFEF4444' };
    const row = prodWs.addRow({
      full_name:               sub.full_name,
      total_horas_operario:    parseFloat(sub.total_horas_operario || 0),
      productividad_pct:       prod,
      total_comision_operario: parseFloat(sub.total_comision_operario || 0),
    });
    row.height = 18;
    prodWs.columns.forEach((_, ci) => {
      const cell = row.getCell(ci + 1);
      cell.font = { size: 9, bold: ci === 2, name: 'Calibri', color: ci === 2 ? WHITE : { argb: 'FF1A202C' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: ci === 2 ? prodFill : (si % 2 === 0 ? LIGHT_GRAY : WHITE) };
      cell.alignment = { vertical: 'middle', horizontal: ci >= 1 ? 'right' : 'left' };
      if (ci === 2) cell.numFmt = '0.00"%"';
      if (ci === 3) cell.numFmt = '#,##0';
    });
  });

  return wb.xlsx.writeBuffer();
}

// ============================================================
// EXPORT UNIFICADO
// ============================================================
export async function generateInformeExcel({ tipo, data, kpis, subtotales, totales, generadoPor, filtros }) {
  if (tipo === 'TOTALIZADO') {
    return buildTotalizadoExcel({ data, kpis, generadoPor, filtros });
  }
  return buildLiquidacionExcel({ data, subtotales, totales, generadoPor, filtros });
}
