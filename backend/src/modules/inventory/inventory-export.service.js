import { query } from '../../config/database.js';
import ExcelJS from 'exceljs';

/**
 * Servicio unificado de exportación de inventario.
 * Soporta áreas: MANTENIMIENTO, SISTEMAS, SST, LOCATIVO y combinación de todas.
 * Filtros por área y rango de fechas.
 * Escalable para nuevas áreas: solo agregar el case en getAreaData().
 */
export class InventoryExportService {
  /**
   * Obtiene datos filtrados de todas las áreas.
   */
  async getAllAreaData({ area, fecha_desde, fecha_hasta } = {}) {
    if (area && area !== 'all' && area !== 'LOCATIVO') {
      return this.getAreaData({ area, fecha_desde, fecha_hasta });
    }
    if (area === 'LOCATIVO') {
      return this.getLocativoData({ fecha_desde, fecha_hasta });
    }

    // Todas las áreas: combinar datos de inventario general + locativo
    const [general, locativo] = await Promise.all([
      this.getAreaData({ fecha_desde, fecha_hasta }),
      this.getLocativoData({ fecha_desde, fecha_hasta }),
    ]);

    return [...general, ...locativo];
  }

  /**
   * Obtiene datos de las tablas inventario (MANTENIMIENTO, SISTEMAS, SST).
   */
  async getAreaData({ area, fecha_desde, fecha_hasta } = {}) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (area && area !== 'all') {
      conditions.push(`i.area = $${i++}`);
      params.push(area);
    }

    if (fecha_desde) {
      conditions.push(`i.created_at >= $${i++}`);
      params.push(fecha_desde);
    }

    if (fecha_hasta) {
      conditions.push(`i.created_at <= $${i++}`);
      params.push(fecha_hasta + 'T23:59:59.999Z');
    }

    const sql = `
      SELECT
        i.id,
        i.sku AS codigo,
        i.name AS nombre,
        i.marca,
        i.area,
        'INVENTARIO' AS tipo_tabla,
        i.description AS descripcion,
        i.tipo AS tipo_item,
        i.unit AS unidad,
        i.unit_price AS precio_unitario,
        i.costo_reposicion,
        i.stock_actual AS cantidad,
        i.stock_minimum AS stock_minimo,
        i.is_active AS activo,
        i.created_at AS fecha_creacion,
        i.updated_at AS fecha_actualizacion,
        c.nombre AS familia,
        u.codigo_ubicacion AS ubicacion,
        emp.full_name AS responsable,
        i.codigo_activo,
        i.numero_serie,
        i.tipo_activo,
        i.sst_tipo_elemento,
        i.sst_estado,
        i.sst_proxima_revision,
        i.fecha_compra,
        i.fin_garantia,
        i.factura_oc,
        i.proveedor,
        i.observaciones
      FROM inventario i
      LEFT JOIN catalogo_categorias c ON i.categoria_id = c.id
      LEFT JOIN ubicaciones_bodega u ON i.ubicacion_id = u.id
      LEFT JOIN employees emp ON i.responsable_id = emp.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY i.name ASC
    `;

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Obtiene datos de la tabla inventario_locativo.
   */
  async getLocativoData({ fecha_desde, fecha_hasta } = {}) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (fecha_desde) {
      conditions.push(`l.created_at >= $${i++}`);
      params.push(fecha_desde);
    }

    if (fecha_hasta) {
      conditions.push(`l.created_at <= $${i++}`);
      params.push(fecha_hasta + 'T23:59:59.999Z');
    }

    const sql = `
      SELECT
        l.id,
        l.codigo_interno AS codigo,
        l.nombre,
        NULL::varchar AS marca,
        'LOCATIVO' AS area,
        'LOCATIVO' AS tipo_tabla,
        l.descripcion,
        l.grupo_locativo,
        l.subcategoria,
        sc.nombre AS subcategoria_nombre,
        l.clasificacion_contable,
        l.cuenta_contable,
        l.costo_historico AS precio_unitario,
        l.costo_historico,
        NULL::numeric AS costo_reposicion,
        1 AS cantidad,
        NULL::integer AS stock_minimo,
        l.activo,
        l.created_at AS fecha_creacion,
        l.updated_at AS fecha_actualizacion,
        NULL::varchar AS familia,
        l.sede AS ubicacion,
        emp.full_name AS responsable,
        NULL::varchar AS codigo_activo,
        NULL::varchar AS numero_serie,
        NULL::varchar AS tipo_activo,
        NULL::varchar AS sst_tipo_elemento,
        NULL::varchar AS sst_estado,
        NULL::timestamp AS sst_proxima_revision,
        l.fecha_adquisicion AS fecha_compra,
        NULL::date AS fin_garantia,
        l.numero_documento_soporte AS factura_oc,
        prov.nombre AS proveedor,
        l.observaciones,
        l.estado_fisico,
        l.tipo_propiedad,
        l.vida_util_anios,
        l.valor_residual,
        l.metodo_depreciacion,
        l.fecha_fin_contrato,
        l.sede,
        l.piso_nivel,
        l.area_oficina_bodega,
        l.direccion_inmueble,
        l.responsable_nombre
      FROM inventario_locativo l
      LEFT JOIN locativo_subcategorias sc ON sc.codigo = l.subcategoria
      LEFT JOIN employees emp ON emp.id = l.responsable_id
      LEFT JOIN proveedores prov ON prov.id = l.proveedor_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY l.nombre ASC
    `;

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Genera un libro Excel profesional con los datos del inventario.
   */
  async generateExcel(data, { area, fecha_desde, fecha_hasta } = {}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CARGAR SAS CRM';
    workbook.created = new Date();

    // ─── Estilos compartidos ─────────────────────────────────
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } },
      border: {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } },
      },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    };

    const cellStyle = {
      font: { size: 10, name: 'Calibri' },
      border: {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      },
      alignment: { vertical: 'middle', wrapText: true },
    };

    const currencyFormat = '$#,##0';
    const dateFormat = 'dd/mm/yyyy';

    // ─── Hoja de resumen ─────────────────────────────────────
    const summarySheet = workbook.addWorksheet('Resumen', {
      properties: { tabColor: { argb: 'FF6366F1' } },
    });

    // Título
    summarySheet.mergeCells('A1:F1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = 'Inventario General — Reporte Exportado';
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF1E293B' }, name: 'Calibri' };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(1).height = 40;

    // Metadatos del reporte
    summarySheet.mergeCells('A2:F2');
    const metaCell = summarySheet.getCell('A2');
    const fechaReporte = new Date().toLocaleDateString('es-CO', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    const filtrosAplicados = [];
    if (area && area !== 'all') filtrosAplicados.push(`Área: ${area}`);
    if (fecha_desde) filtrosAplicados.push(`Desde: ${new Date(fecha_desde).toLocaleDateString('es-CO')}`);
    if (fecha_hasta) filtrosAplicados.push(`Hasta: ${new Date(fecha_hasta).toLocaleDateString('es-CO')}`);
    metaCell.value = `Generado: ${fechaReporte}${filtrosAplicados.length ? ` | Filtros: ${filtrosAplicados.join(', ')}` : ''}`;
    metaCell.font = { size: 10, color: { argb: 'FF64748B' }, name: 'Calibri' };
    metaCell.alignment = { horizontal: 'center' };
    summarySheet.getRow(2).height = 24;

    // KPIs principales
    const kpiHeaders = ['Total Ítems', 'Activos', 'Inactivos', 'Valor Total', 'Ítems Locativos', 'Ítems Generales'];
    const kpiRow = summarySheet.getRow(4);
    kpiHeaders.forEach((header, idx) => {
      const cell = kpiRow.getCell(idx + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };
      cell.border = headerStyle.border;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const totalItems = data.length;
    const activos = data.filter(d => d.activo === true || d.activo === 't' || d.activo === 1 || d.activo === '1').length;
    const inactivos = totalItems - activos;
    const valorTotal = data.reduce((sum, d) => sum + (parseFloat(d.precio_unitario) || 0), 0);
    const locativos = data.filter(d => d.tipo_tabla === 'LOCATIVO').length;
    const generales = data.filter(d => d.tipo_tabla !== 'LOCATIVO').length;

    const kpiValues = [totalItems, activos, inactivos, valorTotal, locativos, generales];
    const valueRow = summarySheet.getRow(5);
    kpiValues.forEach((val, idx) => {
      const cell = valueRow.getCell(idx + 1);
      cell.value = val;
      if (idx === 3) {
        cell.numFmt = currencyFormat;
      }
      cell.font = { bold: true, size: 12, name: 'Calibri', color: { argb: 'FF1E293B' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = cellStyle.border;
    });

    // Totales por área
    const areaSummaryHeaders = ['Área', 'Cantidad', 'Valor Total', '% del Total'];
    const areaSummaryHeaderRow = summarySheet.getRow(7);
    areaSummaryHeaders.forEach((header, idx) => {
      const cell = areaSummaryHeaderRow.getCell(idx + 1);
      cell.value = header;
      Object.assign(cell, { font: headerStyle.font, fill: headerStyle.fill, border: headerStyle.border, alignment: { horizontal: 'center' } });
    });

    const areas = ['MANTENIMIENTO', 'SISTEMAS', 'SST', 'LOCATIVO'];
    let rowNum = 8;
    for (const areaName of areas) {
      const itemsArea = data.filter(d => d.area === areaName);
      if (itemsArea.length === 0) continue;
      const valorArea = itemsArea.reduce((sum, d) => sum + (parseFloat(d.precio_unitario) || 0), 0);
      const pct = totalItems > 0 ? ((itemsArea.length / totalItems) * 100).toFixed(1) : 0;

      const cells = [
        summarySheet.getCell(`A${rowNum}`),
        summarySheet.getCell(`B${rowNum}`),
        summarySheet.getCell(`C${rowNum}`),
        summarySheet.getCell(`D${rowNum}`),
      ];
      cells[0].value = areaName;
      cells[0].font = { bold: true, size: 10, name: 'Calibri' };
      cells[1].value = itemsArea.length;
      cells[1].alignment = { horizontal: 'center' };
      cells[2].value = valorArea;
      cells[2].numFmt = currencyFormat;
      cells[3].value = parseFloat(pct);
      cells[3].numFmt = '0.0"%"';
      cells.forEach(c => {
        c.border = cellStyle.border;
        c.alignment = { ...c.alignment, vertical: 'middle' };
      });
      rowNum++;
    }

    // Ancho de columnas de la hoja de resumen
    summarySheet.getColumn(1).width = 18;
    summarySheet.getColumn(2).width = 14;
    summarySheet.getColumn(3).width = 16;
    summarySheet.getColumn(4).width = 14;
    summarySheet.getColumn(5).width = 18;
    summarySheet.getColumn(6).width = 18;

    // ─── Hoja de datos ───────────────────────────────────────
    const isLocativoOnly = area === 'LOCATIVO';

    const detailSheetName = isLocativoOnly ? 'Inventario Locativo' : 'Inventario General';
    const detailSheet = workbook.addWorksheet(detailSheetName, {
      properties: { tabColor: { argb: isLocativoOnly ? 'FFF97316' : 'FF3B82F6' } },
    });

    // Definir columnas según el tipo de datos
    const generalColumns = [
      { header: 'Código', key: 'codigo', width: 18 },
      { header: 'Nombre', key: 'nombre', width: 35 },
      { header: 'Marca', key: 'marca', width: 18 },
      { header: 'Área', key: 'area', width: 16 },
      { header: 'Familia / Subcategoría', key: 'familia', width: 22 },
      { header: 'Ubicación', key: 'ubicacion', width: 20 },
      { header: 'Cantidad', key: 'cantidad', width: 10 },
      { header: 'Precio Unit.', key: 'precio_unitario', width: 16 },
      { header: 'Responsable', key: 'responsable', width: 22 },
      { header: 'Proveedor', key: 'proveedor', width: 22 },
      { header: 'Fecha Compra', key: 'fecha_compra', width: 14 },
      { header: 'Activo', key: 'activo', width: 10 },
      { header: 'Observaciones', key: 'observaciones', width: 30 },
    ];

    const locativoColumns = [
      { header: 'Código Interno', key: 'codigo', width: 18 },
      { header: 'Nombre', key: 'nombre', width: 35 },
      { header: 'Grupo', key: 'grupo_locativo', width: 10 },
      { header: 'Subcategoría', key: 'subcategoria_nombre', width: 22 },
      { header: 'Clasif. Contable', key: 'clasificacion_contable', width: 18 },
      { header: 'Costo Histórico', key: 'costo_historico', width: 16 },
      { header: 'Vida Útil (años)', key: 'vida_util_anios', width: 14 },
      { header: 'Método Deprec.', key: 'metodo_depreciacion', width: 16 },
      { header: 'Estado Físico', key: 'estado_fisico', width: 14 },
      { header: 'Sede', key: 'sede', width: 20 },
      { header: 'Piso/Nivel', key: 'piso_nivel', width: 14 },
      { header: 'Ubicación', key: 'area_oficina_bodega', width: 20 },
      { header: 'Responsable', key: 'responsable_nombre', width: 22 },
      { header: 'Proveedor', key: 'proveedor', width: 22 },
      { header: 'Tipo Propiedad', key: 'tipo_propiedad', width: 14 },
      { header: 'Cuenta PUC', key: 'cuenta_contable', width: 14 },
      { header: 'Doc. Soporte', key: 'factura_oc', width: 20 },
      { header: 'Fecha Adquisición', key: 'fecha_compra', width: 14 },
      { header: 'Dirección', key: 'direccion_inmueble', width: 25 },
    ];

    const columns = isLocativoOnly ? locativoColumns : generalColumns;
    detailSheet.columns = columns;

    // Render header row
    const headerRow = detailSheet.getRow(1);
    headerRow.height = 32;
    columns.forEach((col, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = col.header;
      Object.assign(cell, {
        font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } },
        border: headerStyle.border,
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      });
    });

    // Render data rows
    data.forEach((item, rowIndex) => {
      const row = detailSheet.getRow(rowIndex + 2);
      row.height = 22;

      columns.forEach((col, colIndex) => {
        let value = item[col.key];
        const cell = row.getCell(colIndex + 1);

        // Formatear valores booleanos
        if (col.key === 'activo') {
          value = (value === true || value === 't' || value === 1 || value === '1') ? 'Sí' : 'No';
        }

        // Formatear fechas
        if ((col.key === 'fecha_compra' || col.key === 'fecha_adquisicion') && value) {
          const d = new Date(value);
          if (!isNaN(d.getTime())) {
            cell.value = d;
            cell.numFmt = dateFormat;
          } else {
            cell.value = value;
          }
        } else {
          cell.value = value ?? '—';
        }

        // Formato moneda
        if ((col.key === 'precio_unitario' || col.key === 'costo_historico') && value && !isNaN(parseFloat(value))) {
          cell.value = parseFloat(value);
          cell.numFmt = currencyFormat;
        }

        Object.assign(cell, {
          font: { size: 10, name: 'Calibri' },
          border: cellStyle.border,
          alignment: { vertical: 'middle', ...(col.key === 'cantidad' ? { horizontal: 'center' } : {}) },
        });
      });
    });

    // ─── Auto-filtro ─────────────────────────────────────────
    if (data.length > 0) {
      detailSheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1 + data.length, column: columns.length },
      };
    }

    return workbook;
  }

  /**
   * Genera un CSV con BOM para compatibilidad Excel.
   */
  async generateCSV(data, { area } = {}) {
    const isLocativoOnly = area === 'LOCATIVO';

    const generalHeaders = [
      'Código', 'Nombre', 'Marca', 'Área', 'Familia', 'Ubicación',
      'Cantidad', 'Precio Unit.', 'Responsable', 'Proveedor',
      'Fecha Compra', 'Activo', 'Observaciones',
    ];

    const locativoHeaders = [
      'Código Interno', 'Nombre', 'Grupo', 'Subcategoría', 'Clasif. Contable',
      'Costo Histórico', 'Vida Útil', 'Método Deprec.', 'Estado Físico',
      'Sede', 'Piso/Nivel', 'Ubicación', 'Responsable', 'Proveedor',
      'Tipo Propiedad', 'Cuenta PUC', 'Doc. Soporte', 'Fecha Adquisición',
      'Dirección',
    ];

    const headers = isLocativoOnly ? locativoHeaders : generalHeaders;
    const csvRows = [headers.join(';')];

    for (const item of data) {
      const row = isLocativoOnly
        ? [
            item.codigo,
            item.nombre,
            item.grupo_locativo,
            item.subcategoria_nombre || item.subcategoria,
            item.clasificacion_contable,
            item.costo_historico,
            item.vida_util_anios,
            item.metodo_depreciacion,
            item.estado_fisico,
            item.sede,
            item.piso_nivel,
            item.ubicacion_detalle || item.area_oficina_bodega,
            item.responsable_nombre || item.responsable,
            item.proveedor,
            item.tipo_propiedad,
            item.cuenta_contable,
            item.factura_oc,
            item.fecha_compra ? new Date(item.fecha_compra).toLocaleDateString('es-CO') : '',
            item.direccion_inmueble,
          ]
        : [
            item.codigo,
            `"${(item.nombre || '').replace(/"/g, '""')}"`,
            item.marca || '',
            item.area,
            item.familia || '',
            item.ubicacion || '',
            item.cantidad,
            item.precio_unitario,
            item.responsable || '',
            item.proveedor || '',
            item.fecha_compra ? new Date(item.fecha_compra).toLocaleDateString('es-CO') : '',
            item.activo ? 'Sí' : 'No',
            `"${(item.observaciones || '').replace(/"/g, '""')}"`,
          ];
      csvRows.push(row.join(';'));
    }

    return '\uFEFF' + csvRows.join('\n');
  }
}

export const inventoryExportService = new InventoryExportService();
