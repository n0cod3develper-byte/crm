import fs from 'fs';
import readline from 'readline';
import path from 'path';
import ExcelJS from 'exceljs';
import { query, withTransaction } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

/**
 * Limpia y normaliza números en diversos formatos (colombiano 1.000.000,00, estándar 1000000.00 o numérico directo)
 */
const parseNumeroUniversal = (val, lineCount) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  if (!str) return 0;

  // Quitar signos de moneda y espacios
  str = str.replace(/[$ ]/g, '');

  // Formato negativo con paréntesis (100.000) -> -100.000
  if (str.startsWith('(') && str.endsWith(')')) {
    str = '-' + str.substring(1, str.length - 1);
  }

  // Detectar formato: si tiene puntos y coma (1.234.567,89) o sólo coma como decimal (1234,56)
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // Formato colombiano: 1.000.000,50
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato anglosajón: 1,000,000.50
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Solo tiene comas: si hay una sola coma cerca del final, es decimal; si hay varias, son miles
    const commaCount = (str.match(/,/g) || []).length;
    if (commaCount === 1) {
      str = str.replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes('.')) {
    // Solo tiene puntos: si tiene más de 1 punto, son separadores de miles
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      str = str.replace(/\./g, '');
    }
  }

  const num = parseFloat(str);
  if (isNaN(num)) {
    throw new Error(`Valor numérico inválido "${val}" en la fila ${lineCount}`);
  }
  return num;
};

/**
 * Parsea archivo Excel (.xlsx, .xls)
 */
const parsearExcel = async (filePath) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('El archivo Excel no contiene hojas de cálculo.');
  }

  const movimientos = [];
  const cuentasUnicas = new Map();
  let headerRowIndex = -1;
  let colMap = {};

  const expectedAliases = {
    cuecodigo: ['cuecodigo', 'cuenta', 'codigo', 'codigo_cuenta', 'cuenta_codigo', 'cod_cuenta'],
    cuenombre: ['cuenombre', 'nombre', 'nombre_cuenta', 'descripcion', 'concepto'],
    sldant_ml: ['sldant_ml', 'saldo_anterior', 'saldo_ant', 'saldo anterior', 'sldant'],
    db_ml: ['db_ml', 'debito', 'debitos', 'débito', 'débitos', 'db'],
    cr_ml: ['cr_ml', 'credito', 'creditos', 'crédito', 'créditos', 'cr'],
    neto_ml: ['neto_ml', 'neto', 'mov_neto', 'movimiento_neto'],
    sldact_ml: ['sldact_ml', 'saldo_actual', 'saldo_act', 'saldo actual', 'saldo_final', 'sldact']
  };

  worksheet.eachRow((row, rowNumber) => {
    const rowValues = row.values;
    if (!Array.isArray(rowValues)) return;

    if (headerRowIndex === -1) {
      // Buscar la fila de encabezados
      const cleanHeaders = rowValues.map(v => (v ? String(v).trim().toLowerCase() : ''));
      
      const foundCols = {};
      Object.keys(expectedAliases).forEach(field => {
        const aliases = expectedAliases[field];
        const idx = cleanHeaders.findIndex(h => aliases.includes(h));
        if (idx !== -1) {
          foundCols[field] = idx;
        }
      });

      // Si encontramos al menos cuecodigo o la mayoría de columnas requeridas
      if (foundCols.cuecodigo !== undefined) {
        headerRowIndex = rowNumber;
        colMap = foundCols;
      }
      return;
    }

    // Procesar fila de datos
    const getVal = (field) => {
      const idx = colMap[field];
      if (idx === undefined) return '';
      const cellVal = rowValues[idx];
      if (cellVal && typeof cellVal === 'object' && cellVal.result !== undefined) {
        return cellVal.result;
      }
      return cellVal;
    };

    const codigoRaw = getVal('cuecodigo');
    if (!codigoRaw) return; // Fila vacía

    const cuecodigo = String(codigoRaw).trim();
    const cuenombre = String(getVal('cuenombre') || '').trim() || `Cuenta ${cuecodigo}`;

    const sldant_ml = parseNumeroUniversal(getVal('sldant_ml'), rowNumber);
    const db_ml = parseNumeroUniversal(getVal('db_ml'), rowNumber);
    const cr_ml = parseNumeroUniversal(getVal('cr_ml'), rowNumber);
    const neto_ml = getVal('neto_ml') !== '' ? parseNumeroUniversal(getVal('neto_ml'), rowNumber) : (db_ml - cr_ml);
    const sldact_ml = getVal('sldact_ml') !== '' ? parseNumeroUniversal(getVal('sldact_ml'), rowNumber) : (sldant_ml + neto_ml);

    movimientos.push({
      cuenta_codigo: cuecodigo,
      saldo_anterior: sldant_ml,
      debito: db_ml,
      credito: cr_ml,
      neto: neto_ml,
      saldo_actual: sldact_ml
    });

    cuentasUnicas.set(cuecodigo, { codigo: cuecodigo, nombre: cuenombre });
  });

  if (headerRowIndex === -1) {
    throw new Error('No se encontraron los encabezados requeridos en el archivo Excel (cuecodigo, cuenombre, sldant_ml, db_ml, cr_ml, neto_ml, sldact_ml).');
  }

  return { movimientos, cuentas: Array.from(cuentasUnicas.values()) };
};

/**
 * Parsea archivo de texto plano (TSV, CSV, TXT con tabulación, punto y coma o coma)
 */
const parsearTextoPlano = async (filePath) => {
  const movimientos = [];
  const cuentasUnicas = new Map();
  
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let isFirstLine = true;
  let lineCount = 0;
  let delimiter = '\t';
  let colIndices = {
    cuecodigo: 0,
    cuenombre: 1,
    sldant_ml: 2,
    db_ml: 3,
    cr_ml: 4,
    neto_ml: 5,
    sldact_ml: 6
  };

  for await (const line of rl) {
    lineCount++;
    if (!line.trim()) continue;

    if (isFirstLine) {
      // Auto-detectar delimitador (\t, ;, ,)
      const tabCount = (line.match(/\t/g) || []).length;
      const semiCount = (line.match(/;/g) || []).length;
      const commaCount = (line.match(/,/g) || []).length;

      if (tabCount >= 4) {
        delimiter = '\t';
      } else if (semiCount >= 4) {
        delimiter = ';';
      } else if (commaCount >= 4) {
        delimiter = ',';
      }

      const columnas = line.split(delimiter).map(c => c.trim().toLowerCase().replace(/^["']|["']$/g, ''));
      
      const expectedAliases = {
        cuecodigo: ['cuecodigo', 'cuenta', 'codigo', 'codigo_cuenta', 'cuenta_codigo'],
        cuenombre: ['cuenombre', 'nombre', 'nombre_cuenta', 'descripcion'],
        sldant_ml: ['sldant_ml', 'saldo_anterior', 'saldo_ant', 'saldo anterior', 'sldant'],
        db_ml: ['db_ml', 'debito', 'debitos', 'débito', 'débitos', 'db'],
        cr_ml: ['cr_ml', 'credito', 'creditos', 'crédito', 'créditos', 'cr'],
        neto_ml: ['neto_ml', 'neto', 'mov_neto', 'movimiento_neto'],
        sldact_ml: ['sldact_ml', 'saldo_actual', 'saldo_act', 'saldo actual', 'saldo_final', 'sldact']
      };

      let mappedAny = false;
      Object.keys(expectedAliases).forEach(field => {
        const aliases = expectedAliases[field];
        const idx = columnas.findIndex(c => aliases.includes(c));
        if (idx !== -1) {
          colIndices[field] = idx;
          mappedAny = true;
        }
      });

      if (!mappedAny && columnas.length < 5) {
        throw new Error('Encabezados inválidos en el archivo. Se esperaba: cuecodigo, cuenombre, sldant_ml, db_ml, cr_ml, neto_ml, sldact_ml');
      }

      isFirstLine = false;
      continue;
    }

    let columnas;
    if (delimiter === ',') {
      // Soporte para CSV con comas dentro de comillas
      const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
      columnas = [];
      let match;
      while ((match = regex.exec(line)) !== null && match[0] !== '') {
        columnas.push(match[1].replace(/^"|"$/g, '').replace(/""/g, '"').trim());
      }
    } else {
      columnas = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    }

    if (columnas.length < 2) continue;

    const cuecodigo = columnas[colIndices.cuecodigo] || '';
    if (!cuecodigo) continue;

    const cuenombre = columnas[colIndices.cuenombre] || `Cuenta ${cuecodigo}`;
    const sldant_ml = parseNumeroUniversal(columnas[colIndices.sldant_ml], lineCount);
    const db_ml = parseNumeroUniversal(columnas[colIndices.db_ml], lineCount);
    const cr_ml = parseNumeroUniversal(columnas[colIndices.cr_ml], lineCount);
    const neto_ml = columnas[colIndices.neto_ml] ? parseNumeroUniversal(columnas[colIndices.neto_ml], lineCount) : (db_ml - cr_ml);
    const sldact_ml = columnas[colIndices.sldact_ml] ? parseNumeroUniversal(columnas[colIndices.sldact_ml], lineCount) : (sldant_ml + neto_ml);

    movimientos.push({
      cuenta_codigo: cuecodigo,
      saldo_anterior: sldant_ml,
      debito: db_ml,
      credito: cr_ml,
      neto: neto_ml,
      saldo_actual: sldact_ml
    });

    cuentasUnicas.set(cuecodigo, { codigo: cuecodigo, nombre: cuenombre });
  }

  return { movimientos, cuentas: Array.from(cuentasUnicas.values()) };
};

/**
 * Parsea archivo en cualquier formato soportado (Excel .xlsx/.xls, TSV, CSV, TXT)
 */
export const parsearArchivo = async (filePath, originalName = '') => {
  const ext = (originalName ? path.extname(originalName) : path.extname(filePath)).toLowerCase();

  if (ext === '.xlsx' || ext === '.xls') {
    return await parsearExcel(filePath);
  } else {
    try {
      return await parsearTextoPlano(filePath);
    } catch (textErr) {
      // Si falla texto plano, intentar con Excel por si el archivo tenía extensión incorrecta
      try {
        return await parsearExcel(filePath);
      } catch {
        throw textErr;
      }
    }
  }
};

/**
 * Genera una plantilla de Excel con formato profesional y datos de ejemplo
 */
export const generarPlantillaExcel = async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Libro Mayor');

  worksheet.columns = [
    { header: 'cuecodigo', key: 'cuecodigo', width: 16 },
    { header: 'cuenombre', key: 'cuenombre', width: 35 },
    { header: 'sldant_ml', key: 'sldant_ml', width: 18 },
    { header: 'db_ml', key: 'db_ml', width: 18 },
    { header: 'cr_ml', key: 'cr_ml', width: 18 },
    { header: 'neto_ml', key: 'neto_ml', width: 18 },
    { header: 'sldact_ml', key: 'sldact_ml', width: 18 }
  ];

  // Estilo de encabezados
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Filas de ejemplo realistas
  const sampleRows = [
    { cuecodigo: '110505', cuenombre: 'Caja General', sldant_ml: 10000000, db_ml: 5000000, cr_ml: 3000000, neto_ml: 2000000, sldact_ml: 12000000 },
    { cuecodigo: '111005', cuenombre: 'Bancos Nacionales', sldant_ml: 50000000, db_ml: 20000000, cr_ml: 15000000, neto_ml: 5000000, sldact_ml: 55000000 },
    { cuecodigo: '130505', cuenombre: 'Clientes Nacionales', sldant_ml: 25000000, db_ml: 12000000, cr_ml: 7000000, neto_ml: 5000000, sldact_ml: 30000000 },
    { cuecodigo: '152405', cuenombre: 'Equipo de Computación y Comunicación', sldant_ml: 15000000, db_ml: 0, cr_ml: 0, neto_ml: 0, sldact_ml: 15000000 },
    { cuecodigo: '220505', cuenombre: 'Proveedores Nacionales', sldant_ml: 18000000, db_ml: 4000000, cr_ml: 8000000, neto_ml: -4000000, sldact_ml: 22000000 },
    { cuecodigo: '310505', cuenombre: 'Capital Suscrito y Pagado', sldant_ml: 90000000, db_ml: 0, cr_ml: 0, neto_ml: 0, sldact_ml: 90000000 },
    { cuecodigo: '413505', cuenombre: 'Venta de Servicios de Carga', sldant_ml: 0, db_ml: 0, cr_ml: 35000000, neto_ml: -35000000, sldact_ml: 35000000 },
    { cuecodigo: '510506', cuenombre: 'Sueldos Personal Administrativo', sldant_ml: 0, db_ml: 8500000, cr_ml: 0, neto_ml: 8500000, sldact_ml: 8500000 },
    { cuecodigo: '513535', cuenombre: 'Servicios de Mantenimiento', sldant_ml: 0, db_ml: 1200000, cr_ml: 0, neto_ml: 1200000, sldact_ml: 1200000 },
    { cuecodigo: '520506', cuenombre: 'Comisiones de Ventas', sldant_ml: 0, db_ml: 4300000, cr_ml: 0, neto_ml: 4300000, sldact_ml: 4300000 }
  ];

  sampleRows.forEach(r => {
    const row = worksheet.addRow(r);
    // Formato numérico en moneda
    for (let c = 3; c <= 7; c++) {
      row.getCell(c).numFmt = '$#,##0.00;($#,##0.00);"-"';
    }
  });

  return await workbook.xlsx.writeBuffer();
};

/**
 * Genera una plantilla CSV
 */
export const generarPlantillaCsv = () => {
  return `cuecodigo\tcuenombre\tsldant_ml\tdb_ml\tcr_ml\tneto_ml\tsldact_ml
110505\tCaja General\t10.000.000,00\t5.000.000,00\t3.000.000,00\t2.000.000,00\t12.000.000,00
111005\tBancos Nacionales\t50.000.000,00\t20.000.000,00\t15.000.000,00\t5.000.000,00\t55.000.000,00
130505\tClientes Nacionales\t25.000.000,00\t12.000.000,00\t7.000.000,00\t5.000.000,00\t30.000.000,00
152405\tEquipo de Computación\t15.000.000,00\t0,00\t0,00\t0,00\t15.000.000,00
220505\tProveedores Nacionales\t18.000.000,00\t4.000.000,00\t8.000.000,00\t-4.000.000,00\t22.000.000,00
310505\tCapital Suscrito\t90.000.000,00\t0,00\t0,00\t0,00\t90.000.000,00
413505\tVenta de Servicios\t0,00\t0,00\t35.000.000,00\t-35.000.000,00\t35.000.000,00
510506\tSueldos Personal Admin\t0,00\t8.500.000,00\t0,00\t8.500.000,00\t8.500.000,00
520506\tComisiones Ventas\t0,00\t4.300.000,00\t0,00\t4.300.000,00\t4.300.000,00`;
};

/**
 * Importa los movimientos a la base de datos transaccionalmente.
 */
export const importarPeriodo = async (anio, mes, cuentas, movimientos, usuarioId) => {
  return await withTransaction(async (client) => {
    // 1. Guardar/Actualizar cuentas
    for (const cuenta of cuentas) {
      await client.query(`
        INSERT INTO contabilidad_cuentas (codigo, nombre) 
        VALUES ($1, $2)
        ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre
      `, [cuenta.codigo, cuenta.nombre]);
    }

    // 2. Gestionar el periodo
    let periodoId;
    const resPeriodo = await client.query(`
      SELECT id FROM contabilidad_periodos WHERE anio = $1 AND mes = $2
    `, [anio, mes]);

    if (resPeriodo.rows.length > 0) {
      periodoId = resPeriodo.rows[0].id;
      // Sobrescribir: eliminar movimientos anteriores
      await client.query(`
        DELETE FROM contabilidad_movimientos WHERE periodo_id = $1
      `, [periodoId]);
      
      await client.query(`
        UPDATE contabilidad_periodos 
        SET fecha_importacion = NOW(), importado_por = $1
        WHERE id = $2
      `, [usuarioId, periodoId]);
    } else {
      const resNew = await client.query(`
        INSERT INTO contabilidad_periodos (anio, mes, importado_por)
        VALUES ($1, $2, $3) RETURNING id
      `, [anio, mes, usuarioId]);
      periodoId = resNew.rows[0].id;
    }

    // 3. Insertar nuevos movimientos (batch)
    const BATCH_SIZE = 1000;
    for (let i = 0; i < movimientos.length; i += BATCH_SIZE) {
      const batch = movimientos.slice(i, i + BATCH_SIZE);
      const values = [];
      const params = [];
      let paramCount = 1;
      
      batch.forEach(m => {
        values.push(`($${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++})`);
        params.push(periodoId, m.cuenta_codigo, m.saldo_anterior, m.debito, m.credito, m.neto, m.saldo_actual);
      });

      const queryStr = `
        INSERT INTO contabilidad_movimientos 
        (periodo_id, cuenta_codigo, saldo_anterior, debito, credito, neto, saldo_actual)
        VALUES ${values.join(', ')}
      `;
      await client.query(queryStr, params);
    }

    return periodoId;
  });
};

/**
 * Retorna las cuentas mapeadas a un rubro para un reporte dado.
 */
export const obtenerReporte = async (periodoId, tipoReporte) => {
  const sql = `
    WITH mapeos_ordenados AS (
      SELECT 
        mc.cuenta_codigo as patron, 
        mc.rubro_id,
        LENGTH(mc.cuenta_codigo) as len
      FROM contabilidad_mapeo_cuentas mc
    ),
    movimientos_con_rubro AS (
      SELECT 
        m.id,
        m.cuenta_codigo,
        m.saldo_actual,
        (
          SELECT rubro_id 
          FROM mapeos_ordenados mo 
          WHERE m.cuenta_codigo LIKE mo.patron 
          ORDER BY mo.len DESC 
          LIMIT 1
        ) as rubro_id
      FROM contabilidad_movimientos m
      WHERE m.periodo_id = $1
    )
    SELECT 
      r.id as rubro_id,
      r.codigo,
      r.seccion,
      r.nombre,
      r.orden,
      r.naturaleza,
      r.es_subtotal,
      COALESCE(SUM(mr.saldo_actual), 0) as total_rubro
    FROM contabilidad_rubros r
    LEFT JOIN movimientos_con_rubro mr ON r.id = mr.rubro_id
    WHERE r.reporte = $2
    GROUP BY r.id, r.codigo, r.seccion, r.nombre, r.orden, r.naturaleza, r.es_subtotal
    ORDER BY r.orden ASC
  `;
  
  const result = await query(sql, [periodoId, tipoReporte]);
  
  const sqlSinClasificar = `
    WITH mapeos_ordenados AS (
      SELECT 
        mc.cuenta_codigo as patron, 
        mc.rubro_id,
        LENGTH(mc.cuenta_codigo) as len
      FROM contabilidad_mapeo_cuentas mc
    )
    SELECT 
      m.cuenta_codigo, c.nombre, m.saldo_actual
    FROM contabilidad_movimientos m
    JOIN contabilidad_cuentas c ON m.cuenta_codigo = c.codigo
    WHERE m.periodo_id = $1
    AND NOT EXISTS (
      SELECT 1 
      FROM mapeos_ordenados mo 
      WHERE m.cuenta_codigo LIKE mo.patron
    )
  `;
  const sinClasificar = await query(sqlSinClasificar, [periodoId]);

  return {
    rubros: result.rows,
    cuentasSinClasificar: sinClasificar.rows,
    totalSinClasificar: sinClasificar.rows.reduce((acc, row) => acc + Number(row.saldo_actual), 0)
  };
};

export const listarPeriodos = async () => {
  const sql = `
    SELECT p.id, p.anio, p.mes, p.fecha_importacion, u.nombre as importado_por_nombre
    FROM contabilidad_periodos p
    LEFT JOIN users u ON p.importado_por = u.id
    ORDER BY p.anio DESC, p.mes DESC
  `;
  const result = await query(sql);
  return result.rows;
};

export const obtenerCatalogoCuentas = async () => {
  const sql = `
    WITH mapeos_ordenados AS (
      SELECT 
        mc.cuenta_codigo as patron, 
        mc.rubro_id,
        LENGTH(mc.cuenta_codigo) as len
      FROM contabilidad_mapeo_cuentas mc
    )
    SELECT 
      c.codigo,
      c.nombre,
      (
        SELECT r.nombre
        FROM mapeos_ordenados mo 
        JOIN contabilidad_rubros r ON mo.rubro_id = r.id
        WHERE c.codigo LIKE mo.patron 
        ORDER BY mo.len DESC 
        LIMIT 1
      ) as rubro_asignado
    FROM contabilidad_cuentas c
    ORDER BY c.codigo ASC
  `;
  const result = await query(sql);
  return result.rows;
};

export const listarRubros = async () => {
  const sql = `SELECT * FROM contabilidad_rubros ORDER BY reporte, orden ASC`;
  const result = await query(sql);
  return result.rows;
};

export const asignarMapeoCuenta = async (codigoCuenta, rubroId) => {
  const sql = `
    INSERT INTO contabilidad_mapeo_cuentas (cuenta_codigo, rubro_id)
    VALUES ($1, $2)
    ON CONFLICT (cuenta_codigo) DO UPDATE SET rubro_id = EXCLUDED.rubro_id
    RETURNING *
  `;
  const result = await query(sql, [codigoCuenta, rubroId]);
  return result.rows[0];
};
