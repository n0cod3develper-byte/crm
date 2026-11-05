import ExcelJS from 'exceljs';

/**
 * Neutraliza la inyección de fórmulas de Excel anteponiendo un apóstrofe
 * si el texto comienza con '=', '+', '-' o '@'.
 */
export const sanitizeExcelText = (val) => {
  if (val == null) return '';
  const str = String(val).trim();
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
};

/**
 * Exporta el catálogo de productos y servicios a Excel utilizando ExcelJS
 * con el formato corporativo profesional homologado de Reportes/Servicios.
 *
 * @param {Array} items - Arreglo de ítems del catálogo retornados por la API
 * @param {Object} options - Opciones de exportación
 * @param {string} options.tipo - Filtro aplicado ('todos', 'PRODUCTO', 'SERVICIO')
 * @param {string} [options.usuario] - Nombre del usuario que genera el informe
 */
export async function exportCatalogToExcel(items, { tipo = 'todos', usuario = 'Mercadeo Cargar' } = {}) {
  if (!items || items.length === 0) {
    throw new Error('No hay datos para exportar');
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CARGAR SAS CRM';
  wb.created = new Date();

  const ws = wb.addWorksheet('Catálogo', {
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9, // A4
      printTitlesRow: '5:5' // Repetir encabezados al imprimir
    }
  });

  // ─── FILAS DE ENCABEZADO SUPERIOR ───

  // Fila 1: Título institucional
  const titleRow = ws.addRow(['CATÁLOGO DE PRODUCTOS Y SERVICIOS']);
  titleRow.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E293B' } };
  titleRow.height = 22;

  // Fila 2: Metadatos de generación (Zona horaria Colombia: America/Bogota)
  const now = new Date();
  const fechaGen = now.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  const genRow = ws.addRow([`Generado por ${fechaGen} en ${usuario || 'Mercadeo Cargar'}`]);
  genRow.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
  genRow.height = 18;

  // Fila 3: Cantidad de registros exportados
  const countRow = ws.addRow([`Cantidad de registros : ${items.length}`]);
  countRow.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
  countRow.height = 18;

  // Fila 4: Espaciador en blanco
  const blankRow = ws.addRow([]);
  blankRow.height = 10;

  // ─── FILA 5: TÍTULOS DE COLUMNAS (19 COLUMNAS) ───
  const headers = [
    'Tipo',
    'Código Interno',
    'Nombre Comercial',
    'Nombre Interno / Ref',
    'Referencia Fabricante',
    'Referencia Sistema (SKU)',
    'Marca',
    'Familia / Categoría',
    'Área',
    'Ubicación Física',
    'Unidad de Medida',
    'Stock Actual',
    'Stock Mínimo',
    'Precio Unitario',
    'Costo Reposición / Mínimo',
    'Aplica IVA',
    '% IVA',
    'Estado',
    'Fecha de Creación'
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

  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF1E293B' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
      right: { style: 'thin', color: { argb: 'FF475569' } }
    };
  });

  // Estilos compartidos para optimizar rendimiento y memoria
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
  };
  const fontBase = { name: 'Calibri', size: 10 };

  // ─── FILAS DE DATOS ───
  items.forEach((item) => {
    const isProducto = item.tipo === 'PRODUCTO';
    const tipoLabel = isProducto ? 'Producto' : 'Servicio';

    // Fecha nativa en UTC para permitir filtrado real por fechas en Excel
    let fechaCreacionVal = '—';
    if (item.created_at) {
      const dt = new Date(item.created_at);
      if (!isNaN(dt.getTime())) {
        fechaCreacionVal = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
      }
    }

    const rowValues = [
      sanitizeExcelText(tipoLabel),
      sanitizeExcelText(item.codigo_interno || '—'),
      sanitizeExcelText(item.nombre_comercial || '—'),
      sanitizeExcelText(item.nombre_interno || '—'),
      sanitizeExcelText(item.referencia_fabricante || '—'),
      sanitizeExcelText(item.referencia_sistema || '—'),
      sanitizeExcelText(item.marca || '—'),
      sanitizeExcelText(item.categoria_nombre || '—'),
      sanitizeExcelText(item.area || '—'),
      sanitizeExcelText(item.codigo_ubicacion || '—'),
      sanitizeExcelText(item.unidad_medida || '—'),
      isProducto ? Number(item.stock_actual || 0) : 'N/A',
      isProducto ? Number(item.stock_minimo || 0) : 'N/A',
      Number(item.precio_venta || 0),
      Number(item.costo_o_minimo || 0),
      item.aplica_iva ? 'SÍ' : 'NO',
      item.iva_pct ? Number(item.iva_pct) : 0,
      item.is_active ? 'Activo' : 'Inactivo',
      fechaCreacionVal
    ];

    const row = ws.addRow(rowValues);
    row.height = 20;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = thinBorder;
      cell.font = fontBase;

      switch (colNumber) {
        // Columna 1: Tipo
        case 1:
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          break;

        // Columnas 2, 5, 6: Códigos (Código Interno, Ref Fabricante, Ref Sistema / SKU)
        // Se preservan explícitamente como texto para conservar ceros y evitar notación científica
        case 2:
        case 5:
        case 6:
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.numFmt = '@';
          break;

        // Columnas descriptivas de texto (Izquierda)
        case 3: // Nombre Comercial
        case 4: // Nombre Interno / Ref
        case 7: // Marca
        case 8: // Familia / Categoría
        case 9: // Área
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          break;

        // Columnas cortas de texto (Centro)
        case 10: // Ubicación Física
        case 11: // Unidad de Medida
        case 16: // Aplica IVA
        case 18: // Estado
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          break;

        // Columnas 12, 13: Stock Actual y Stock Mínimo
        case 12:
        case 13:
          if (typeof cell.value === 'number') {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
            cell.numFmt = '#,##0.##';
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
          break;

        // Columnas 14, 15: Precios y Costos (Moneda COP)
        case 14:
        case 15:
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '"$"#,##0';
          break;

        // Columna 17: % IVA
        case 17:
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.numFmt = '0"%"';
          break;

        // Columna 19: Fecha de Creación
        case 19:
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          if (cell.value instanceof Date) {
            cell.numFmt = 'DD/MM/YYYY';
          }
          break;

        default:
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  // ─── INMOVILIZAR PANELES Y AUTOFILTRO ───
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }];
  ws.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5, column: headers.length }
  };

  // ─── AJUSTE DINÁMICO DE ANCHOS DE COLUMNA ───
  const minColWidths = {
    1: 14,  // Tipo
    2: 18,  // Código Interno
    3: 32,  // Nombre Comercial
    4: 28,  // Nombre Interno / Ref
    5: 22,  // Referencia Fabricante
    6: 24,  // Referencia Sistema (SKU)
    7: 18,  // Marca
    8: 24,  // Familia / Categoría
    9: 16,  // Área
    10: 16, // Ubicación Física
    11: 16, // Unidad de Medida
    12: 15, // Stock Actual
    13: 15, // Stock Mínimo
    14: 18, // Precio Unitario
    15: 24, // Costo Reposición / Mínimo
    16: 13, // Aplica IVA
    17: 12, // % IVA
    18: 13, // Estado
    19: 18  // Fecha de Creación
  };

  ws.columns.forEach((column, index) => {
    const colNum = index + 1;
    let maxLength = 0;
    column.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.row < 5) return; // Omitir filas superiores
      const val = cell.value;
      if (val instanceof Date) {
        maxLength = Math.max(maxLength, 10);
      } else if (typeof val === 'number') {
        maxLength = Math.max(maxLength, String(val).length + 4);
      } else if (val != null) {
        maxLength = Math.max(maxLength, String(val).length);
      }
    });
    const minWidth = minColWidths[colNum] || 14;
    column.width = Math.max(minWidth, Math.min(maxLength + 3, 50));
  });

  // ─── GENERACIÓN DEL BUFFER Y DESCARGA DIRECTA ───
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;

  const todayStr = new Date().toISOString().split('T')[0];
  const tipoStr = (tipo || 'todos').toLowerCase();
  anchor.download = `Catalogo_Productos_Servicios_${tipoStr}_${todayStr}.xlsx`;

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
