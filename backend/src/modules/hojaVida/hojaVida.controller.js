import { HojaVidaRepository } from './hojaVida.repository.js';
import { query } from '../../config/database.js';
import { NotFoundError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import ExcelJS from 'exceljs';
import Handlebars from 'handlebars';
import puppeteer from 'puppeteer';
import { findChromePath } from '../../utils/chromeFinder.js';
import { getLogoBase64 } from '../../utils/pdfGenerator.js';

const repo = new HojaVidaRepository();

/**
 * Template Handlebars para la Hoja de Vida (PDF).
 * Sigue el patrón email-marketing (Handlebars.compile) y usa el mismo CSS/estructura
 * que generateOTPdf / generatePrefacturaPdf (puppeteer + logo base64).
 */
const HOJA_VIDA_PDF_TEMPLATE = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      color: #1e293b;
      line-height: 1.5;
      padding: 30px 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #4338ca;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .header-left { display: flex; align-items: center; gap: 15px; }
    .header-right { text-align: right; }
    .doc-title {
      font-size: 20px;
      font-weight: 800;
      color: #4338ca;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .doc-subtitle {
      font-size: 11px;
      color: #64748b;
      margin-top: 4px;
    }
    .section { margin-bottom: 16px; }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: #4338ca;
      text-transform: uppercase;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 10px;
    }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; }
    .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 20px; }
    .field label {
      font-size: 9px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      display: block;
    }
    .field .value {
      font-size: 11px;
      font-weight: 500;
      color: #1e293b;
    }
    .propiedad-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .propiedad-cargar { background: #fef3c7; color: #92400e; }
    .propiedad-cliente { background: #dbeafe; color: #1e40af; }
    .estado-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .estado-operativo { background: #dcfce7; color: #166534; }
    .estado-en_mantenimiento { background: #fef3c7; color: #92400e; }
    .estado-fuera_de_servicio { background: #fee2e2; color: #991b1b; }
    .estado-alquilado { background: #e0e7ff; color: #3730a3; }
    .estado-retirado { background: #f3f4f6; color: #6b7280; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-top: 6px;
    }
    th {
      padding: 6px 8px;
      text-align: left;
      font-weight: 700;
      background: #f1f5f9;
      border-bottom: 2px solid #e2e8f0;
      color: #475569;
      font-size: 9px;
      text-transform: uppercase;
    }
    td {
      padding: 5px 8px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
    }
    .text-right { text-align: right; }
    .tipo-label {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 8px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .tipo-remision { background: #ede9fe; color: #5b21b6; }
    .tipo-tramo { background: #ffedd5; color: #9a3412; }
    .tipo-ot { background: #dbeafe; color: #1e40af; }
    .tipo-estado { background: #e0e7ff; color: #3730a3; }
    .empty { color: #94a3b8; font-style: italic; text-align: center; padding: 20px; }
    .footer {
      margin-top: 25px;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      text-align: center;
      font-size: 9px;
      color: #94a3b8;
    }
    .resumen-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
    .resumen-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      text-align: center;
    }
    .resumen-card .label {
      font-size: 9px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }
    .resumen-card .value {
      font-size: 16px;
      font-weight: 800;
      color: #4338ca;
      margin-top: 3px;
    }
    .resumen-card .sub {
      font-size: 9px;
      color: #94a3b8;
    }
    .page-footer {
      position: fixed;
      bottom: 20px;
      left: 40px;
      right: 40px;
      font-size: 9px;
      color: #94a3b8;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <img src="{{logoBase64}}" style="height:60px;" alt="Logo" />
      <div>
        <div style="font-size:14px;font-weight:800;color:#1e293b;">CARGAR S.A.S.</div>
        <div style="font-size:9px;color:#64748b;">NIT: 890919352-2</div>
        <div style="font-size:9px;color:#64748b;">Calle 31 No. 41-51, Itagüí - Antioquia</div>
        <div style="font-size:9px;color:#64748b;">Tel: 444 7773 EXT 113</div>
      </div>
    </div>
    <div class="header-right">
      <div class="doc-title">Hoja de Vida</div>
      <div class="doc-subtitle">Información consolidada del equipo</div>
    </div>
  </div>

  <div class="resumen-grid">
    <div class="resumen-card">
      <div class="label">Horas Totales</div>
      <div class="value">{{resumen.horas_totales.total}}</div>
      <div class="sub">{{resumen.horas_totales.alquilado}}h alq. + {{resumen.horas_totales.taller}}h taller</div>
    </div>
    <div class="resumen-card">
      <div class="label">Servicios</div>
      <div class="value">{{resumen.numero_servicios}}</div>
      <div class="sub">remisiones</div>
    </div>
    <div class="resumen-card">
      <div class="label">Mantenimientos</div>
      <div class="value">{{resumen.numero_mantenimientos}}</div>
      <div class="sub">OTs</div>
    </div>
    <div class="resumen-card">
      <div class="label">Costo Mantenimiento</div>
      <div class="value">{{resumen.costo_mantenimiento_total}}</div>
      <div class="sub">histórico</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Datos del Equipo</div>
    <div class="grid2">
      <div class="field"><label>Propiedad</label><div class="value">
        <span class="propiedad-badge {{propiedadCSS}}">{{propiedad}}</span>
      </div></div>
      <div class="field"><label>Estado Operativo</label><div class="value">
        <span class="estado-badge estado-{{estadoCSS}}">{{equipo.estado}}</span>
        {{#if equipo.motivo_estado}}<div style="font-size:9px;color:#64748b;margin-top:2px;">{{equipo.motivo_estado}}</div>{{/if}}
      </div></div>
      <div class="field"><label>Tipo de equipo</label><div class="value">{{equipo.tipo_equipo}}</div></div>
      <div class="field"><label>Tipo de propulsión</label><div class="value">{{equipo.tipo_propulsion}}</div></div>
      <div class="field"><label>Marca</label><div class="value">{{equipo.marca}}</div></div>
      <div class="field"><label>Modelo</label><div class="value">{{equipo.modelo}}</div></div>
      <div class="field"><label>Serie</label><div class="value">{{equipo.serie}}</div></div>
      <div class="field"><label>Serial / Placa</label><div class="value">{{equipo.serial}}</div></div>
      <div class="field"><label>Horómetro actual</label><div class="value">{{equipo.horometro_actual}} h</div></div>
      <div class="field"><label>Fecha horómetro</label><div class="value">{{equipo.fecha_horometro}}</div></div>
      <div class="field"><label>Odómetro</label><div class="value">{{equipo.odometro}} km</div></div>
      <div class="field"><label>Ubicación física</label><div class="value">{{equipo.ubicacion_fisica}}</div></div>
      <div class="field"><label>Ciudad</label><div class="value">{{equipo.ciudad_ubicacion}}</div></div>
      <div class="field"><label>SOAT</label><div class="value">
        {{#if equipo.soat_vigente}}
          {{#if equipo.soat_vencimiento}}Vigente - Vence: {{equipo.soat_vencimiento}}
          {{else}}Vigente{{/if}}
        {{else}}No registrado{{/if}}
      </div></div>
      <div class="field"><label>Bonificación / hora</label>      <div class="value">{{equipo.bonificacion_hora}}</div></div>
      <div class="field"><label>Generado el</label><div class="value">{{generated_at}}</div></div>
      <div class="field"></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Estado de Facturación de Servicios</div>
    <div class="grid3">
      <div class="field"><label>Total neto servicios</label>      <div class="value">{{resumen.resumen_facturacion.total_neto}}</div></div>
      <div class="field"><label>Total facturado</label><div class="value">{{resumen.resumen_facturacion.total_facturado}}</div></div>
      <div class="field"><label>Saldo pendiente</label><div class="value" style="color:{{saldoColor}}">{{resumen.resumen_facturacion.saldo_pendiente}}</div></div>
      <div class="field"><label>N° facturas</label><div class="value">{{resumen.resumen_facturacion.numero_facturas}}</div></div>
      <div class="field"></div>
      <div class="field"></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Historial Cronológico</div>
    {{#if historial.length}}
    <table>
      <thead>
        <tr>
          <th style="width:90px;">Fecha</th>
          <th style="width:90px;">Tipo</th>
          <th>Identificador</th>
          <th style="width:85px;">Estado</th>
          <th style="width:110px;">Empresa / Cliente</th>
          <th style="width:110px;">Responsable</th>
          <th>Descripción / Servicios</th>
          <th class="text-right" style="width:50px;">Horas</th>
          <th style="width:70px;">H. Entrada</th>
          <th style="width:70px;">H. Salida</th>
          <th class="text-right" style="width:70px;">Costo</th>
          <th style="width:90px;">Factura(s)</th>
        </tr>
      </thead>
      <tbody>
        {{#each historial}}
        <tr>
          <td>{{fecha}}</td>
          <td><span class="tipo-label tipo-{{tipoShort}}">{{tipo}}</span></td>
          <td><strong>{{id}}</strong></td>
          <td>{{estado}}</td>
          <td>{{empresa}}</td>
          <td>{{responsable}}</td>
          <td>{{{descripcion}}}</td>
          <td class="text-right">{{horas}}</td>
          <td class="text-right">{{hEntrada}}</td>
          <td class="text-right">{{hSalida}}</td>
          <td class="text-right">{{#if costo}}{{costo}}{{/if}}</td>
          <td>{{facturas}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
    {{else}}
    <div class="empty">No hay historial registrado para este equipo.</div>
    {{/if}}
  </div>

  <div class="page-footer">
    CARGAR S.A.S. — Hoja de Vida del Equipo — Generado: {{generated_at}} — Página 1
  </div>
</body>
</html>`;


// ─── Helpers ────────────────────────────────────────────────────────────────

/** Identifica si un equipo es de CARGAR o de cliente cruzando empresa_id contra la empresa CARGAR. */
async function _esCargar(equipo) {
  if (!equipo.empresa_id) return null;
  const res = await query(`SELECT name FROM companies WHERE id = $1`, [equipo.empresa_id]);
  const nombre = res.rows[0]?.name || '';
  return nombre.toUpperCase().includes('CARGAR') ? 'CARGAR S.A.S.' : nombre;
}

/**
 * Mismo formato de facturación que usa servicios.controller.downloadPDF:
 * string_agg() de factura_remisiones + facturas.
 */
async function _fetchRemisionesConFacturacion(equipoId) {
  const sql = `
    SELECT
      r.id,
      r.numero_remision,
      r.fecha_servicio,
      r.estado AS remision_estado,
      r.total_neto,
      c.name AS empresa_nombre,
      COALESCE(
        (SELECT string_agg(DISTINCT em.full_name, ', ')
         FROM remision_operarios ro
         JOIN employees em ON em.id = ro.empleado_id
         WHERE ro.remision_id = r.id), '—'
      ) AS operarios,
      COALESCE(
        (SELECT string_agg(COALESCE(inv.nombre_comercial, cs.nombre), ' / ')
         FROM remision_servicios rs
         LEFT JOIN inventario inv ON inv.id = rs.catalogo_servicio_id
         LEFT JOIN catalogo_servicios cs ON cs.id = rs.catalogo_servicio_id
         WHERE rs.remision_id = r.id),
        '—'
      ) AS servicio_nombres,
      r.cantidad_horas,
      r.horometro_salida,
      r.horometro_regreso,
      (SELECT string_agg(f.numero_factura, ', ' ORDER BY f.created_at)
       FROM factura_remisiones fr
       JOIN facturas f ON f.id = fr.factura_id
       WHERE fr.remision_id = r.id) AS numero_facturas,
      (SELECT string_agg(f.estado, ', ' ORDER BY f.created_at)
       FROM factura_remisiones fr
       JOIN facturas f ON f.id = fr.factura_id
       WHERE fr.remision_id = r.id) AS facturas_estados
    FROM remisiones r
    JOIN companies c ON c.id = r.company_id
    WHERE r.equipo_id = $1
      AND r.deleted_at IS NULL
      AND r.estado <> 'ANULADO'
    ORDER BY r.fecha_servicio DESC
  `;
  return query(sql, [equipoId]);
}

async function _fetchTramos(equipoId) {
  const sql = `
    SELECT
      t.id,
      t.remision_id,
      r.numero_remision,
      t.fecha_inicio,
      t.fecha_fin,
      t.motivo,
      t.fecha_fin IS NULL AS vigente,
      r.estado AS remision_estado,
      c.name AS empresa_nombre
    FROM remision_tramos_equipo t
    JOIN remisiones r ON r.id = t.remision_id
    JOIN companies c ON c.id = r.company_id
    WHERE t.equipo_id = $1
    ORDER BY t.fecha_inicio DESC
  `;
  return query(sql, [equipoId]);
}

async function _fetchOTs(equipoId) {
  const sql = `
    SELECT
      ot.id,
      ot.consecutivo,
      ot.created_at                      AS fecha,
      ot.tipo_mantenimiento,
      ot.estado                          AS ot_estado,
      ot.detalle_servicio,
      ot.horometro_inicial,
      ot.horometro_final,
      ot.fecha_hora_ingreso_taller,
      ot.fecha_hora_salida_taller,
      c.name                            AS empresa_nombre,
      COALESCE(
        (SELECT string_agg(DISTINCT em.full_name, ', ')
         FROM ot_tecnicos t
         JOIN employees em ON em.id = t.empleado_id
         WHERE t.orden_trabajo_id = ot.id), '—'
      )                                AS tecnicos,
      (SELECT total_final FROM ot_liquidacion WHERE orden_trabajo_id = ot.id) AS costo_total,
      (SELECT numero_factura FROM facturas WHERE id = ot.factura_id)          AS numero_factura
    FROM ordenes_trabajo ot
    JOIN companies c ON c.id = ot.empresa_id
    WHERE ot.equipo_id = $1
      AND ot.deleted_at IS NULL
    ORDER BY ot.created_at DESC
  `;
  return query(sql, [equipoId]);
}

async function _fetchHistorialEstado(equipoId) {
  const sql = `
    SELECT id, estado_anterior, estado_nuevo, motivo, cambiado_por, created_at AS fecha
    FROM equipos_historial_estado
    WHERE equipo_id = $1
    ORDER BY created_at DESC
    LIMIT 50
  `;
  return query(sql, [equipoId]);
}

// ─── Endpoint: Hoja de Vida data ─────────────────────────────────────────────

export const getHojaDeVida = async (req, res, next) => {
  try {
    const equipoId = req.params.id;
    if (!equipoId) throw new NotFoundError('Equipo');

    // 1. Equipo maestro desde equipos_completo (incluye empresa_nombre, estado badge, SOAT, etc.)
    const equipoRes = await query(`SELECT * FROM equipos_completo WHERE id = $1 AND deleted_at IS NULL`, [equipoId]);
    if (!equipoRes.rows[0]) throw new NotFoundError('Equipo no encontrado');
    const equipo = equipoRes.rows[0];
    const propiedad = await _esCargar(equipo);

    // 2. Resumen agregado
    const resumen = await repo.getResumen(equipoId);

    // 3. Historial paginado
    const { fecha_desde, fecha_hasta, page, limit } = req.query;
    const pageNum = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 50;

    // getHistorial usa cursor-based pagination internamente con LIMIT.
    // Para simplificar, cargamos todo el historial (el UNION tiene LIMIT=$limit+1
    // por defecto = 51, suficiente para la mayoría de equipos).
    // Si en producción hay equipos con >50 eventos, se amplía el LIMIT del repo.
    const historialRes = await repo.getHistorial(equipoId, { fecha_desde, fecha_hasta, limit: pageSize });
    return res.json({
      success: true,
      data: {
        equipo,
        propiedad,
        resumen,
        historial: historialRes.data,
        pagination: {
          page: pageNum,
          limit: pageSize,
          total: historialRes.data.length,
          hasMore: historialRes.pagination.hasMore,
          nextPage: historialRes.pagination.hasMore ? pageNum + 1 : null,
        },
      },
    });
  } catch (err) {
    logger.error('[HojaVida] getHojaDeVida error', { error: err.message });
    next(err);
  }
};

// ─── Export: Excel ─────────────────────────────────────────────────────────────

export const exportExcel = async (req, res, next) => {
  try {
    const equipoId = req.params.id;
    if (!equipoId) throw new NotFoundError('Equipo');

    const equipoRes = await query(`SELECT * FROM equipos_completo WHERE id = $1 AND deleted_at IS NULL`, [equipoId]);
    if (equipoRes.rows.length === 0) throw new NotFoundError('Equipo no encontrado');
    const equipo = equipoRes.rows[0];
    const propiedad = await _esCargar(equipo);

    const [remisionesRes, tramosRes, otsRes, estadoRes, resumen] = await Promise.all([
      _fetchRemisionesConFacturacion(equipoId),
      _fetchTramos(equipoId),
      _fetchOTs(equipoId),
      _fetchHistorialEstado(equipoId),
      repo.getResumen(equipoId),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Cargar CRM';
    workbook.created = new Date();
    workbook.properties.title = `Hoja de Vida - ${equipo.marca || ''} ${equipo.modelo || ''} ${equipo.serie || ''}`;

    // ── Hoja 1: Cabecera ─────────────────────────────────────────────────────
    const sheet1 = workbook.addWorksheet('Cabecera');
    const propLabel = propiedad === 'CARGAR S.A.S.' ? 'CARGAR S.A.S. (Propio)' : propiedad || 'Cliente';
    const rows = [
      ['HOJA DE VIDA', '', ''],
      ['Equipo:', `${equipo.marca || '—'} — ${equipo.modelo || '—'}`, ''],
      ['Serie:', equipo.serie || '—', ''],
      ['Serial / Placa:', equipo.serial || '—', ''],
      ['Tipo de equipo:', equipo.tipo_equipo || '—', ''],
      ['Tipo de propulsión:', equipo.tipo_propulsion || '—', ''],
      ['Propiedad:', propLabel, ''],
      ['Estado operativo:', equipo.estado, ''],
      ['Motivo estado:', equipo.motivo_estado || '—', ''],
      ['Horómetro actual:', equipo.horometro_actual ? equipo.horometro_actual.toFixed(2) : '—', ''],
      ['Fecha horómetro:', equipo.fecha_horometro || '—', ''],
      ['Odómetro:', equipo.odometro ? equipo.odometro.toFixed(2) : '—', ''],
      ['Ubicación física:', equipo.ubicacion_fisica || '—', ''],
      ['Ciudad:', equipo.ciudad_ubicacion || '—', ''],
      ['SOAT:', equipo.soat_vigente ? (equipo.soat_vencimiento ? `${equipo.soat_vencimiento}` : 'Vigente') : 'No registrado', ''],
      ['Bonificación/hora:', equipo.bonificacion_hora ? equipo.bonificacion_hora.toFixed(2) : '—', ''],
    ];
    rows.forEach((r, idx) => {
      sheet1.addRow(r);
    });

    // Resumen agregado
    sheet1.addRow([]);
    sheet1.addRow(['RESUMEN AGREGADO', '', '']);
    const resumenRows = [
      ['Horas totales (alquilado):', resumen.horas_totales.alquilado.toFixed(2), 'h'],
      ['Horas totales (taller):', resumen.horas_totales.taller.toFixed(2), 'h'],
      ['Horas totales (suma):', resumen.horas_totales.total.toFixed(2), 'h'],
      ['Número de servicios (remisiones):', resumen.numero_servicios, ''],
      ['Número de mantenimientos (OTs):', resumen.numero_mantenimientos, ''],
      ['Costo total de mantenimiento:', resumen.costo_mantenimiento_total.toFixed(2), ''],
      ['Total neto servicios:', resumen.resumen_facturacion.total_neto.toFixed(2), ''],
      ['Total facturado:', resumen.resumen_facturacion.total_facturado.toFixed(2), ''],
      ['Saldo pendiente:', resumen.resumen_facturacion.saldo_pendiente.toFixed(2), ''],
      ['Número de facturas:', resumen.resumen_facturacion.numero_facturas, ''],
    ];
    resumenRows.forEach(r => sheet1.addRow(r));

    // ── Hoja 2: Historial ─────────────────────────────────────────────────────
    const sheet2 = workbook.addWorksheet('Historial');
    const headers = [
      'Fecha',
      'Tipo',
      'N° / Consecutivo',
      'Estado',
      'Empresa / Cliente',
      'Operarios / Técnicos',
      'Servicio / Descripción',
      'Horas',
      'Horómetro entrada',
      'Horómetro salida',
      'Costo total',
      'Factura(s)',
    ];
    sheet2.addRow(headers);

    // Unificar y ordenar: remisiones + tramos + OTs + estados → unificado por fecha DESC
    const unificado = [];
    remisionesRes.rows.forEach(r => {
      unificado.push({
        fecha: r.fecha_servicio,
        tipo: 'Remisión',
        id: r.numero_remision,
        estado: r.remision_estado,
        empresa: r.empresa_nombre,
        responsable: r.operarios,
        descripcion: r.servicio_nombres,
        horas: r.cantidad_horas,
        h_entrada: r.horometro_salida,
        h_salida: r.horometro_regreso,
        costo: null,
        facturas: r.numero_facturas ? `${r.numero_facturas} (${r.facturas_estados})` : '—',
      });
    });
    tramosRes.rows.forEach(t => {
      unificado.push({
        fecha: t.fecha_inicio,
        tipo: t.vigente ? 'Tramo (vigente)' : 'Tramo',
        id: t.numero_remision,
        estado: t.remision_estado,
        empresa: t.empresa_nombre,
        responsable: '—',
        descripcion: t.motivo || 'Sustitución de equipo',
        horas: null,
        h_entrada: '',
        h_salida: '',
        costo: null,
        facturas: '—',
      });
    });
    otsRes.rows.forEach(ot => {
      unificado.push({
        fecha: ot.fecha,
        tipo: 'OT / Mantenimiento',
        id: ot.consecutivo,
        estado: ot.ot_estado,
        empresa: ot.empresa_nombre,
        responsable: ot.tecnicos,
        descripcion: ot.detalle_servicio || `${ot.tipo_mantenimiento} — ${ot.tipo_mantenimiento}`,
        horas: null,
        h_entrada: ot.horometro_inicial,
        h_salida: ot.horometro_final,
        costo: ot.costo_total,
        facturas: ot.numero_factura || '—',
      });
    });
    estadoRes.rows.forEach(eh => {
      unificado.push({
        fecha: eh.fecha,
        tipo: 'Cambio de estado',
        id: `${eh.estado_anterior} → ${eh.estado_nuevo}`,
        estado: '—',
        empresa: '—',
        responsable: eh.cambiado_por || '—',
        descripcion: eh.motivo || '',
        horas: null,
        h_entrada: '',
        h_salida: '',
        costo: null,
        facturas: '—',
      });
    });

    unificado.sort((a, b) => {
      const da = new Date(a.fecha);
      const db = new Date(b.fecha);
      return db - da;
    });

    unificado.forEach(fila => {
      sheet2.addRow([
        fila.fecha,
        fila.tipo,
        fila.id,
        fila.estado,
        fila.empresa,
        fila.responsable,
        fila.descripcion,
        fila.horas,
        fila.h_entrada,
        fila.h_salida,
        fila.costo,
        fila.facturas,
      ]);
    });

    // ── Encabezados de estilo ─────────────────────────────────────────────────
    sheet1.getRow(1).font = { bold: true, size: 14 };
    sheet1.getRow(1).alignment = { horizontal: 'center' };
    sheet2.getRow(1).font = { bold: true };
    sheet2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    sheet2.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Column widths
    sheet1.getColumn('A').width = 22;
    sheet1.getColumn('B').width = 45;
    sheet1.getColumn('C').width = 15;
    sheet2.getColumn('A').width = 14;
    sheet2.getColumn('B').width = 22;
    sheet2.getColumn('C').width = 18;
    sheet2.getColumn('D').width = 12;
    sheet2.getColumn('E').width = 20;
    sheet2.getColumn('F').width = 24;
    sheet2.getColumn('G').width = 30;
    sheet2.getColumn('H').width = 10;
    sheet2.getColumn('I').width = 14;
    sheet2.getColumn('J').width = 14;
    sheet2.getColumn('K').width = 14;
    sheet2.getColumn('L').width = 24;

    const buffer = await workbook.xlsx.writeBuffer();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="HojaDeVida-${equipo.serie || equipo.id}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  } catch (err) {
    logger.error('[HojaVida] exportExcel error', { error: err.message });
    next(err);
  }
};// ─── Export: PDF (patrón Handlebars + puppeteer, igual que email-marketing + OTs) ──
export const exportPdf = async (req, res, next) => {
  try {
    const equipoId = req.params.id;
    if (!equipoId) throw new NotFoundError('Equipo');

    const equipoRes = await query(`SELECT * FROM equipos_completo WHERE id = $1 AND deleted_at IS NULL`, [equipoId]);
    if (equipoRes.rows.length === 0) throw new NotFoundError('Equipo no encontrado');
    const equipo = equipoRes.rows[0];
    const propiedad = await _esCargar(equipo);

    const [remisionesRes, tramosRes, otsRes, estadoRes, resumen] = await Promise.all([
      _fetchRemisionesConFacturacion(equipoId),
      _fetchTramos(equipoId),
      _fetchOTs(equipoId),
      _fetchHistorialEstado(equipoId),
      repo.getResumen(equipoId),
    ]);

    // Unificar historial para el template (misma shape que la API REST)
    const historial = [
      ...remisionesRes.rows.map(r => ({
        tipo: 'Remisión',
        tipoShort: 'remision',
        id: r.numero_remision,
        fecha: r.fecha_servicio,
        estado: r.remision_estado,
        empresa: r.empresa_nombre,
        responsable: r.operarios,
        descripcion: r.servicio_nombres,
        horas: r.cantidad_horas,
        hEntrada: r.horometro_salida,
        hSalida: r.horometro_regreso,
        costo: r.total_neto ? parseFloat(r.total_neto).toFixed(0) : null,
        facturas: r.numero_facturas ? `${r.numero_facturas} (${r.facturas_estados})` : '—',
      })),
      ...tramosRes.rows.map(t => ({
        tipo: t.vigente ? 'Tramo (vigente)' : 'Tramo',
        tipoShort: 'tramo',
        id: t.numero_remision,
        fecha: t.fecha_inicio,
        estado: t.remision_estado,
        empresa: t.empresa_nombre,
        responsable: '—',
        descripcion: t.motivo || 'Sustitución de equipo',
        horas: null,
        hEntrada: '',
        hSalida: '',
        costo: null,
        facturas: '—',
      })),
      ...otsRes.rows.map(ot => ({
        tipo: 'OT / Mantenimiento',
        tipoShort: 'ot',
        id: ot.consecutivo,
        fecha: ot.fecha,
        estado: ot.ot_estado,
        empresa: ot.empresa_nombre,
        responsable: ot.tecnicos,
        descripcion: ot.detalle_servicio || `${ot.tipo_mantenimiento}`,
        horas: null,
        hEntrada: ot.horometro_inicial,
        hSalida: ot.horometro_final,
        costo: ot.costo_total ? parseFloat(ot.costo_total).toFixed(0) : null,
        facturas: ot.numero_factura || '—',
      })),
      ...estadoRes.rows.map(eh => ({
        tipo: 'Cambio de estado',
        tipoShort: 'estado',
        id: `${eh.estado_anterior} → ${eh.estado_nuevo}`,
        fecha: eh.fecha,
        estado: '—',
        empresa: '—',
        responsable: eh.cambiado_por || '—',
        descripcion: eh.motivo || '',
        horas: null,
        hEntrada: '',
        hSalida: '',
        costo: null,
        facturas: '—',
      })),
    ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const propLabel = propiedad === 'CARGAR S.A.S.' ? 'CARGAR S.A.S. (Propio)' : propiedad || 'Cliente';
    const propiedadCSS = propiedad === 'CARGAR S.A.S.' ? 'propiedad-cargar' : 'propiedad-cliente';
    const estadoCSS = (equipo.estado || '').toLowerCase().replace(/_/g, '_');
    const saldo = parseFloat(resumen.resumen_facturacion.saldo_pendiente || 0);
    const saldoColor = saldo > 0 ? '#dc2626' : '#16a34a';
    const generatedAt = new Date().toLocaleString('es-CO', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });

    // Formatear valores de moneda para el template (el símbolo $ se incluye aquí,
    // no en el template Handlebars, para evitar conflictos con template literals de JS)
    const fmt = (v) => (v != null && v !== '' ? `$${Number(v).toLocaleString('es-CO', { minimumFractionDigits: 0 })}` : '—');
    const resumenFmt = {
      ...resumen,
      costo_mantenimiento_total: fmt(resumen.costo_mantenimiento_total),
      resumen_facturacion: {
        ...resumen.resumen_facturacion,
        total_neto:        fmt(resumen.resumen_facturacion.total_neto),
        total_facturado:   fmt(resumen.resumen_facturacion.total_facturado),
        saldo_pendiente:   fmt(resumen.resumen_facturacion.saldo_pendiente),
      },
    };
    const historialFmt = historial.map(f => ({
      ...f,
      costo: f.costo != null ? `$${Number(f.costo).toLocaleString('es-CO', { minimumFractionDigits: 0 })}` : null,
    }));

    // Compilar template Handlebars (patrón email-marketing)
    const template = Handlebars.compile(HOJA_VIDA_PDF_TEMPLATE);
    const html = template({
      logoBase64: getLogoBase64(),
      propiedad,
      propiedadCSS,
      equipo,
      resumen: resumenFmt,
      saldoColor,
      historial: historialFmt,
      generated_at: generatedAt,
    });

    // Renderizar con puppeteer (patrón generateOTPdf / generatePrefacturaPdf)
    const launchOptions = {
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    };
    const chromePath = findChromePath();
    if (chromePath) launchOptions.executablePath = chromePath;
    else if (process.platform === 'linux') launchOptions.executablePath = '/usr/bin/chromium-browser';

    const browser = await puppeteer.launch(launchOptions);
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: { top: '15px', bottom: '15px', left: '0', right: '0' },
      });
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="HojaDeVida-${equipo.serie || equipo.id}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });
      res.send(Buffer.from(pdfBuffer));
    } finally {
      await browser.close();
    }
  } catch (err) {
    logger.error('[HojaVida] exportPdf error', { error: err.message });
    next(err);
  }
};

