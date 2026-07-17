import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { findChromePath } from './chromeFinder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Intenta cargar el logo de la empresa como base64 para embeber en el HTML.
 * Si no existe, retorna null y el PDF se genera sin logo.
 */
function getLogoBase64() {
  try {
    const logoPath = join(__dirname, '..', 'assets', 'logo.png');
    const buffer = readFileSync(logoPath);
    logger.debug('Logo loaded successfully');
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (err) {
    logger.warn('Could not load logo for PDF', { error: err.message });
    return null;
  }
}

/**
 * Formatea un número como moneda colombiana.
 */
function formatCOP(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0
  }).format(value || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  // time comes as HH:MM:SS from pg
  return timeStr.substring(0, 5);
}

function formatMinutes(mins) {
  if (!mins && mins !== 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

/**
 * Genera la sección HTML de actividades para el PDF.
 * Si no hay actividades (ej. Mantenimiento Correctivo sin plan), imprime filas en blanco.
 */
function buildActividadesSection(ot) {
  const actividades = ot.pm_actividades || [];
  const hasActividades = actividades.length > 0;

  const estadoMap = {
    'COMPLETADA': { text: 'OK', bg: '#e6f4ea', color: '#1a7a3c' },
    'OMITIDA': { text: 'N/A', bg: '#f7f9fc', color: '#64748b' },
    'EN_PROCESO': { text: 'N/A', bg: '#f7f9fc', color: '#64748b' },
    'PENDIENTE': { text: 'N/A', bg: '#f7f9fc', color: '#64748b' }
  };

  const rows = hasActividades ? actividades.map(a => {
    const st = estadoMap[a.estado] || { text: 'N/A', bg: '#f7f9fc', color: '#64748b' };
    return `
        <tr>
          <td style="text-align:center">${a.orden}</td>
          <td style="font-weight:600">${a.codigo || ''} - ${a.nombre}</td>
          <td>
            <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;color:${st.color};background:${st.bg}">
              ${st.text}
            </span>
          </td>
          <td>${a.completada_por_nombre || '—'}</td>
          <td style="font-size:9px;color:#64748b">${a.observacion || ''}</td>
        </tr>`;
  }).join('')
    : `<tr><td colspan="5" style="text-align:center;padding:15px;color:#64748b;font-style:italic;">Sin actividades registradas por código para esta orden</td></tr>`;

  return `
  <div class="section">
    <div class="section-title">Actividades Realizadas ${ot.frecuencia_nombre ? `— Preventivo ${ot.frecuencia_nombre}` : ''}</div>
    <table>
      <thead>
        <tr>
          <th style="width:30px">Item</th>
          <th>Actividad (Código / Descripción)</th>
          <th>Estado</th>
          <th>Técnico</th>
          <th>Observaciones</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>`;
}

/**
 * Genera la sección de tipo de mantenimiento preventivo para el PDF.
 */
function buildPMHeaderSection(ot) {
  if (ot.tipo_mantenimiento !== 'PREVENTIVO') return '';

  return `
  <div class="section">
    <div class="section-title" style="background:#4338ca;color:white;padding:8px 12px;border-radius:6px;border:none;margin-bottom:12px;">
      MANTENIMIENTO PREVENTIVO — ${ot.frecuencia_nombre || 'N/A'}
    </div>
    <table style="width:100%;border:none;">
      <tr>
        <td style="border:none;padding:0;width:33%;">
          <div class="field"><label>Frecuencia</label><div class="value" style="font-weight:700;color:#4338ca">${ot.frecuencia_nombre || '—'}</div></div>
        </td>
        <td style="border:none;padding:0;width:33%;">
          <div class="field"><label>Horómetro inicio</label><div class="value">${ot.horometro_inicial ?? '—'}</div></div>
        </td>
        <td style="border:none;padding:0;width:33%;">
          <div class="field"><label>Próximo preventivo (horómetro)</label><div class="value" style="font-weight:700;color:#f59e0b">${ot.horometro_frecuencia ?? '—'}</div></div>
        </td>
      </tr>
    </table>
  </div>`;
}

/**
 * Genera la sección de próximo mantenimiento para el PDF.
 */
function buildNextMaintenanceSection(ot) {
  if (ot.tipo_mantenimiento !== 'PREVENTIVO') return '';

  const horoFinal = ot.horometro_final ? parseFloat(ot.horometro_final) : null;
  const freqHoras = ot.frecuencia_horas;
  const nextHoro = horoFinal && freqHoras ? horoFinal + freqHoras : null;

  return `
  <div class="section">
    <div class="section-title">Próximo Mantenimiento</div>
    <table style="width:100%;border:none;">
      <tr>
        <td style="border:none;padding:0;width:33%;">
          <div class="field">
            <label>Horómetro final registrado</label>
            <div class="value">${horoFinal ?? '—'}</div>
          </div>
        </td>
        <td style="border:none;padding:0;width:33%;">
          <div class="field">
            <label>Horómetro proyectado próximo PM</label>
            <div class="value" style="font-weight:700;color:#4338ca;font-size:14px">${nextHoro ?? '—'}</div>
          </div>
        </td>
        <td style="border:none;padding:0;width:33%;">
          <div class="field">
            <label>Frecuencia</label>
            <div class="value">${ot.frecuencia_nombre || '—'}</div>
          </div>
        </td>
      </tr>
    </table>
  </div>`;
}

/**
 * Genera la parte superior del PDF para Mantenimiento Preventivo
 * con el formato exacto solicitado.
 */
function buildPMTop(ot, logoHtml) {
  return `
  <!-- Top PM Header according to Image -->
  <table style="width: 100%; font-family: Arial, sans-serif; font-size: 11px; margin-bottom: 2px;">
    <tr>
      <td style="width: 25%; vertical-align: middle;">
        ${logoHtml}
      </td>
      <td style="width: 25%; vertical-align: middle; font-size: 9px;">
        <b>CARGAR S.A.S</b><br/>
        NIT: 890919352-2<br/>
        TEL: 444 7773 EXT 113<br/>
        CALLE 31 No. 41 51 ITAGUI -<br/>
        ANTIOQUIA
      </td>
      <td style="width: 25%; vertical-align: middle; text-align: center;">
        <b style="font-size: 14px;">ORDEN DE TRABAJO</b><br/>
        <b style="font-size: 14px;">No. ${ot.consecutivo || ''}</b><br/><br/>
        <span style="font-size: 10px;">MANTENIMIENTO PREVENTIVO</span><br/>
        <span style="font-size: 10px;">CADA ${ot.frecuencia_nombre ? ot.frecuencia_nombre.toUpperCase() : ''}</span>
      </td>
      <td style="width: 25%; vertical-align: middle; text-align: right; font-size: 12px;">
        FECHA: ${formatDate(ot.created_at)}<br/><br/>
        FECHA ENTREGA: ___/___/___
      </td>
    </tr>
  </table>
  <hr style="border: 1px solid black; margin-bottom: 5px; margin-top: 2px;" />

  <table style="width: 100%; font-family: Arial, sans-serif; font-size: 11px; margin-bottom: 5px;">
    <tr>
      <td style="width: 50%; vertical-align: top;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="text-align: right; width: 120px; padding-right: 10px; color: #555; height: 18px;">CLIENTE</td><td style="text-transform: uppercase;">${ot.empresa_nombre || ''} - ${ot.empresa_nit || ''}</td></tr>
          <tr><td style="text-align: right; padding-right: 10px; color: #555; height: 18px;">EQUIPO:</td><td style="text-transform: uppercase;">MONTACARGAS</td></tr>
          <tr><td style="text-align: right; padding-right: 10px; color: #555; height: 18px;">MARCA:</td><td style="text-transform: uppercase;">${ot.equipo_marca || ''}</td></tr>
          <tr><td style="text-align: right; padding-right: 10px; color: #555; height: 18px;">MODELO:</td><td style="text-transform: uppercase;">${ot.equipo_modelo || ''}</td></tr>
          <tr><td style="text-align: right; padding-right: 10px; color: #555; height: 18px;">SERIE</td><td style="text-transform: uppercase;">${ot.equipo_serial || ''}</td></tr>
          <tr><td style="text-align: right; padding-right: 10px; color: #555; height: 18px;">CÓDIGO</td><td style="text-transform: uppercase;">${ot.equipo_serial || ''}</td></tr>
          <tr><td style="text-align: right; padding-right: 10px; color: #555; height: 18px;">HOROMETRO:</td><td style="border-bottom: 1px solid black;">${ot.horometro_inicial || ''}</td></tr>
          <tr><td style="text-align: right; padding-right: 10px; color: #555; height: 18px;">AUTORIZADO POR:</td><td style="text-transform: uppercase;">${ot.responsable || ''}</td></tr>
        </table>
      </td>
      <td style="width: 50%; vertical-align: bottom;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="text-align: right; width: 140px; padding-right: 10px; color: #555; height: 18px;">COTIZACIÓN No.:</td><td style="border-bottom: 1px solid black;"></td></tr>
          <tr><td style="text-align: right; padding-right: 10px; color: #555; height: 18px;">ORDEN DE COMPRA No.:</td><td style="border-bottom: 1px solid black;"></td></tr>
          <tr><td style="text-align: right; padding-right: 10px; color: #555; height: 18px;">SDC No.:</td><td style="border-bottom: 1px solid black;"></td></tr>
          <tr><td style="text-align: right; padding-right: 10px; color: #555; height: 18px;">Hora Salida Cargar.:</td><td style="border-bottom: 1px solid black;"></td></tr>
          <tr><td style="text-align: right; padding-right: 10px; color: #555; height: 18px;">Hora Llegada Cliente:</td><td style="border-bottom: 1px solid black;"></td></tr>
          <tr><td style="text-align: right; padding-right: 10px; color: #555; height: 18px;">Hora Salida Cliente:</td><td style="border-bottom: 1px solid black;"></td></tr>
          <tr><td style="text-align: right; padding-right: 10px; color: #555; height: 18px;">Hora Llegada Cargar:</td><td style="border-bottom: 1px solid black;"></td></tr>
        </table>
      </td>
    </tr>
  </table>
  `;
}

function buildPMActividadesSection(ot) {
  const actividades = ot.pm_actividades || [];
  
  const rows = actividades.map(a => `
    <tr>
      <td style="border: 1px solid #ccc; padding: 2px 4px; text-transform: uppercase; font-weight: 500;">${a.nombre}</td>
      <td style="border: 1px solid #ccc; padding: 2px 4px;"></td>
      <td style="border: 1px solid #ccc; padding: 2px 4px;"></td>
      <td style="border: 1px solid #ccc; padding: 2px 4px;"></td>
      <td style="border: 1px solid #ccc; padding: 2px 4px;"></td>
    </tr>`).join('');

  // 1 fila en blanco al final para no ocupar tanto espacio
  const blankRows = Array(1).fill(0).map(() => `
    <tr>
      <td style="border: 1px solid #ccc; padding: 6px 4px;"></td>
      <td style="border: 1px solid #ccc; padding: 6px 4px;"></td>
      <td style="border: 1px solid #ccc; padding: 6px 4px;"></td>
      <td style="border: 1px solid #ccc; padding: 6px 4px;"></td>
      <td style="border: 1px solid #ccc; padding: 6px 4px;"></td>
    </tr>`).join('');

  return `
  <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 10px; margin-bottom: 5px;">
    <thead>
      <tr>
        <th colspan="5" style="text-align: center; border: 1px solid #ccc; padding: 4px; color: #555; background-color: #f8fafc; font-size: 11px; text-transform: uppercase;">DESCRIPCIÓN DEL SERVICIO Y REPUESTOS NECESARIOS</th>
      </tr>
      <tr>
        <th style="border: 1px solid #ccc; padding: 3px; text-align: center; color: #555; background-color: #f8fafc; width: 35%;">DETALLE</th>
        <th style="border: 1px solid #ccc; padding: 3px; text-align: center; color: #555; background-color: #f8fafc; width: 40px;">CANT</th>
        <th style="border: 1px solid #ccc; padding: 3px; text-align: center; color: #555; background-color: #f8fafc; width: 60px;">ESTADO</th>
        <th style="border: 1px solid #ccc; padding: 3px; text-align: center; color: #555; background-color: #f8fafc; width: 80px;">TÉCNICO</th>
        <th style="border: 1px solid #ccc; padding: 3px; text-align: center; color: #555; background-color: #f8fafc;">OBSERVACIÓN</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      ${blankRows}
      <tr>
        <td colspan="4" style="border: 1px solid #ccc; text-align: right; padding: 4px; font-weight: bold; color: #555;">TOTAL</td>
        <td style="border: 1px solid #ccc; padding: 4px;"></td>
      </tr>
    </tbody>
  </table>
  `;
}

/**
 * Genera el HTML completo del PDF de la Orden de Trabajo.
 */
function buildOTHtml(ot) {
  const logo = getLogoBase64();
  const logoHtml = logo
    ? `<img src="${logo}" style="height:60px;" alt="Logo" />`
    : `<div style="font-size:24px;font-weight:800;color:#4338ca;">CARGAR S.A.S.</div>`;

  const tecnicos = ot.tecnicos_asignados || [];
  const repuestos = ot.repuestos_insumos || [];
  const liq = ot.liquidacion;
  const isPM = ot.tipo_mantenimiento === 'PREVENTIVO';

  const totalMO = tecnicos.reduce((s, t) => s + parseFloat(t.total_mano_obra || 0), 0);
  const totalRep = repuestos.reduce((s, r) => s + parseFloat(r.total || 0), 0);

  const estadoBadge = {
    'ABIERTA': '#3b82f6',
    'EN_PROCESO': '#f59e0b',
    'LIQUIDADA': '#22c55e',
    'FACTURADA': '#22c55e',
    'CERRADA': '#64748b',
  };

  // Separar repuestos por origen para distinguir visualmente
  const repPlantilla = repuestos.filter(r => r.origen === 'PLANTILLA_PM');
  const repManual = repuestos.filter(r => r.origen !== 'PLANTILLA_PM');

  let quoteItems = [];
  if (liq && liq.quote_snapshot) {
    try {
      const snap = typeof liq.quote_snapshot === 'string' ? JSON.parse(liq.quote_snapshot) : liq.quote_snapshot;
      quoteItems = snap.items || [];
    } catch (e) {
      logger.error('Error parsing quote_snapshot in PDF generator', { error: e.message });
    }
  }

  let repuestosDisplay = [...repuestos];
  if (quoteItems.length > 0) {
    repuestosDisplay = [
      ...repuestosDisplay,
      ...quoteItems.map(it => ({
        descripcion: it.description,
        origen: 'COTIZACION',
        cantidad: it.quantity,
        unidad: it.unit || 'unidad',
        precio_unitario: it.unit_price,
        total: (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0) * (1 - (parseFloat(it.discount) || 0) / 100)
      }))
    ];
  }

  const showOrigenCol = isPM || quoteItems.length > 0;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 10px;
      color: #1e293b;
      line-height: 1.4;
      padding: ${isPM ? '8px 15px' : '30px 40px'};
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #4338ca;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .header-left { display: flex; align-items: center; gap: 15px; }
    .header-right { text-align: right; }
    .ot-number {
      font-size: 14px;
      font-weight: 800;
      color: #4338ca;
      letter-spacing: 1px;
    }
    .ot-label {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
    }
    .estado-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 12px;
      color: white;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .tipo-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 12px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .section {
      margin-bottom: ${isPM ? '6px' : '12px'};
    }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      color: #4338ca;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 2px;
      margin-bottom: 6px;
    }
    .grid2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 20px;
    }
    .grid3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px 20px;
    }
    .grid4 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 2px 10px;
    }
    .field label {
      font-size: 8px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .field .value {
      font-size: 10px;
      font-weight: 500;
      color: #1e293b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
    }
    thead { background: #f1f5f9; }
    th {
      padding: 3px 6px;
      text-align: left;
      font-weight: 700;
      color: #475569;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      border-bottom: 1px solid #e2e8f0;
    }
    td {
      padding: ${isPM ? '3px 6px' : '5px 8px'};
      border-bottom: ${isPM ? 'none' : '1px solid #f1f5f9'};
    }
    .text-right { text-align: right; }
    .total-row {
      font-weight: 700;
      background: #f8fafc;
    }
    .total-row td { border-top: 2px solid #e2e8f0; }
    .liq-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 0;
      margin-top: 6px;
      width: 250px;
      float: right;
    }
    .liq-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    .liq-table td {
      padding: 4px 10px;
      border: none;
    }
    .liq-label { color: #64748b; font-weight: 500; }
    .liq-value { text-align: right; font-weight: 600; }
    .liq-total-row td {
      background: #0b2f6b;
      color: white;
      font-size: 12px;
      font-weight: 800;
    }
    .liq-total-row td:first-child { border-bottom-left-radius: 8px; }
    .liq-total-row td:last-child { border-bottom-right-radius: 8px; }
    .detail-text {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px;
      font-size: 10px;
      white-space: pre-wrap;
      line-height: 1.3;
    }
    .footer {
      margin-top: 15px;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      clear: both;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr ${isPM ? '1fr' : ''};
      gap: 20px;
      margin-top: 15px;
    }
    .sig-line {
      border-top: 1px solid #1e293b;
      padding-top: 6px;
      text-align: center;
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
    }
    .origin-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 8px;
      font-size: 8px;
      font-weight: 700;
    }
    .origin-plantilla { background: rgba(67,56,202,0.1); color: #4338ca; }
    .origin-manual { background: #fdf1e2; color: #9a5b00; }
    .origin-cotizacion { background: #e0e7ff; color: #0b2f6b; }
    .page-footer {
      position: fixed;
      bottom: 20px;
      left: 40px;
      right: 40px;
      font-size: 9px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  ${isPM ? `
  ${buildPMTop(ot, logoHtml)}
  
  <!-- Detalle del servicio y Observaciones (si las hay) -->
  ${ot.detalle_servicio ? `
  <div class="section" style="margin-bottom: 10px;">
    <div class="section-title" style="font-size:10px;">Detalle del Servicio</div>
    <div class="detail-text">${ot.detalle_servicio}</div>
  </div>` : ''}
  ${ot.observaciones ? `
  <div class="section" style="margin-bottom: 10px;">
    <div class="section-title" style="font-size:10px;">Observaciones</div>
    <div class="detail-text">${ot.observaciones}</div>
  </div>` : ''}

  ${buildPMActividadesSection(ot)}
  ` : `
  <!-- Encabezado -->
  <div class="header">
    <div class="header-left">
      ${logoHtml}
    </div>
    <div class="header-right">
      <div class="ot-label">Orden de Trabajo</div>
      <div class="ot-number">${ot.consecutivo}</div>
      <div style="margin-top: 4px; font-size: 9px; color: #64748b; margin-bottom: 4px;">
        Fecha: ${formatDate(ot.created_at)}
      </div>
      <div>
        <span class="tipo-badge" style="${isPM ? 'background:#e6f4ea;color:#1a7a3c;' : 'background:#fef2f2;color:#ef4444;'}">
          MANTENIMIENTO ${ot.tipo_mantenimiento}
        </span>
      </div>
    </div>
  </div>

  <!-- Sección PM Header (solo preventivo) -->
  ${buildPMHeaderSection(ot)}

  <!-- Datos Generales -->
  <div class="section" style="background: #f7f9fc; padding: 8px 12px; border-radius: 8px;">
    <div class="section-title" style="margin-bottom: 2px;">Datos Generales</div>
    <table style="width:100%; border:none;">
      <tr>
        <td style="border:none; padding: 4px; width:33%; vertical-align: top;">
          <div class="field" style="margin-bottom: 8px;"><label>Empresa</label><div class="value">${ot.empresa_nombre || '—'}</div></div>
          <div class="field" style="margin-bottom: 8px;"><label>NIT</label><div class="value">${ot.empresa_nit || '—'}</div></div>
          <div class="field"><label>Equipo</label><div class="value">${ot.equipo_marca || ''} ${ot.equipo_modelo || ''}</div></div>
        </td>
        <td style="border:none; padding: 4px; width:33%; vertical-align: top;">
          <div class="field" style="margin-bottom: 8px;"><label>Serial</label><div class="value">${ot.equipo_serial || '—'}</div></div> 
          <div class="field" style="margin-bottom: 8px;"><label>Contacto</label><div class="value">${ot.contacto_empresa || '—'}</div></div>
          <div class="field"><label>Teléfono contacto</label><div class="value">${ot.telefono_contacto || '—'}</div></div>
        </td>
        <td style="border:none; padding: 4px; width:33%; vertical-align: top;">
          <div class="field" style="margin-bottom: 8px;"><label>Correo contacto</label><div class="value">${ot.contacto_email || '—'}</div></div>
          <div class="field" style="margin-bottom: 8px;"><label>Responsable</label><div class="value">${ot.responsable || '—'}</div></div>
          <div class="field"><label>Horómetro</label><div class="value">${ot.horometro_inicial ?? '—'} ${ot.horometro_final ? `→ ${ot.horometro_final}` : ''}</div></div>
        </td>
      </tr>
      <tr>
        <td colspan="3" style="border:none; padding: 4px; padding-top: 12px;">
          <div class="field"><label>Dirección de servicio</label><div class="value">${ot.empresa_direccion || '—'}</div></div>  
        </td>
      </tr>
    </table>
  </div>

  <!-- Detalle del servicio -->
  ${ot.detalle_servicio ? `
  <div class="section">
    <div class="section-title">Detalle del Servicio</div>
    <div class="detail-text" style="border-left: 4px solid #a41e1e;">${ot.detalle_servicio}</div>
  </div>` : ''}

  <!-- Observaciones -->
  ${ot.observaciones ? `
  <div class="section">
    <div class="section-title">Observaciones</div>
    <div class="detail-text" style="border-left: 4px solid #4338ca;">${ot.observaciones}</div>
  </div>` : ''}

  <!-- Actividades del mantenimiento -->
  ${buildActividadesSection(ot)}
  `}

  <!-- Técnicos asignados -->
  ${tecnicos.length > 0 ? `
  <div class="section">
    <div class="section-title">Técnicos Asignados</div>
    <table style="${isPM ? 'border-collapse: collapse; border: 1px solid #ccc;' : ''}">
      <thead>
        <tr>
          <th style="${isPM ? 'border: 1px solid #ccc; background:#f8fafc;' : ''}">Técnico</th>
          <th style="${isPM ? 'border: 1px solid #ccc; background:#f8fafc;' : ''}">Fecha/Hora Salida</th>
          <th style="${isPM ? 'border: 1px solid #ccc; background:#f8fafc;' : ''}">Fecha/Hora Regreso</th>
          <th class="text-right" style="${isPM ? 'border: 1px solid #ccc; background:#f8fafc;' : ''}">Tiempo</th>
        </tr>
      </thead>
      <tbody>
        ${tecnicos.map(t => `
        <tr>
          <td style="${isPM ? 'border: 1px solid #ccc;' : ''}">${t.full_name}</td>
          <td style="${isPM ? 'border: 1px solid #ccc;' : ''}">${formatDate(t.fecha_salida)} ${formatTime(t.hora_salida)}</td>
          <td style="${isPM ? 'border: 1px solid #ccc;' : ''}">${formatDate(t.fecha_regreso)} ${formatTime(t.hora_regreso)}</td>
          <td class="text-right" style="${isPM ? 'border: 1px solid #ccc;' : ''}">${formatMinutes(t.tiempo_total_min)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <!-- Repuestos e insumos -->
  ${repuestosDisplay.length > 0 ? `
  <div class="section">
    <div class="section-title">Repuestos e Insumos</div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          ${showOrigenCol ? '<th>Origen</th>' : ''}
          <th class="text-right">Cantidad</th>
          <th>Unidad</th>
          <th class="text-right">P.Unit.</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${repuestosDisplay.map(r => `
        <tr>
          <td>${r.descripcion}</td>
          ${showOrigenCol ? `<td><span class="origin-badge ${r.origen === 'PLANTILLA_PM' ? 'origin-plantilla' : r.origen === 'COTIZACION' ? 'origin-cotizacion' : 'origin-manual'}">${r.origen === 'PLANTILLA_PM' ? 'PLANTILLA' : r.origen === 'COTIZACION' ? 'COTIZACIÓN' : 'MANUAL'}</span></td>` : ''}
          <td class="text-right">${r.cantidad}</td>
          <td>${r.unidad}</td>
          <td class="text-right">${formatCOP(r.precio_unitario)}</td>
          <td class="text-right">${formatCOP(r.total)}</td>
        </tr>`).join('')}
        <tr class="total-row">
          <td colspan="${showOrigenCol ? 5 : 4}" class="text-right">Total Repuestos</td>
          <td class="text-right">${formatCOP(repuestosDisplay.reduce((s, r) => s + parseFloat(r.total || 0), 0))}</td>
        </tr>
      </tbody>
    </table>
  </div>` : ''}

  <!-- Liquidación -->
  ${liq ? `
  <div class="section" style="overflow:hidden;">
    <div class="section-title">Resumen de Liquidación</div>
    <div class="liq-box">
      <table class="liq-table">
        <tr>
          <td class="liq-label">Total Mano de Obra</td>
          <td class="liq-value">${formatCOP(liq.total_mano_obra)}</td>
        </tr>
        <tr>
          <td class="liq-label">Total Repuestos</td>
          <td class="liq-value">${formatCOP(liq.total_repuestos)}</td>
        </tr>
        <tr>
          <td class="liq-label">Subtotal</td>
          <td class="liq-value">${formatCOP(liq.subtotal)}</td>
        </tr>
        <tr>
          <td class="liq-label">Impuesto (${liq.impuesto_pct}%)</td>
          <td class="liq-value">${formatCOP(liq.impuesto_valor)}</td>
        </tr>
        <tr class="liq-total-row">
          <td class="liq-label" style="border-bottom-left-radius:8px;">TOTAL FINAL</td>
          <td class="liq-value" style="border-bottom-right-radius:8px;">${formatCOP(liq.total_final)}</td>
        </tr>
      </table>
    </div>
    ${liq.notas_liquidacion ? `<div style="clear:both;text-align:right;margin-top:10px;font-size:10px;color:#64748b;">Notas: ${liq.notas_liquidacion}</div>` : ''}
  </div>` : ''}

  <!-- Próximo Mantenimiento (solo OT estándar, no en PM nuevo diseño) -->
  ${!isPM && ot.tipo_mantenimiento === 'PREVENTIVO' ? buildNextMaintenanceSection(ot) : ''}

  <!-- Firmas -->
  <div class="footer">
    <table style="width:100%; border:none; margin-top:15px;">
      <tr>
        <td style="border:none; padding:0; width:${isPM ? '33.33%' : '50%'}; vertical-align:top;">
          <div class="sig-line" style="margin-right:20px;">Técnico Responsable</div>
        </td>
        ${isPM ? `<td style="border:none; padding:0; width:33.33%; vertical-align:top;">
          <div class="sig-line" style="margin-right:20px;">Visto Bueno Supervisor</div>
        </td>` : ''}
        <td style="border:none; padding:0; width:${isPM ? '33.33%' : '50%'}; vertical-align:top;">
          <div class="sig-line" style="${isPM ? '' : 'margin-left:20px;'}">Recibido a Conformidad</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Pie de página -->
  <div class="page-footer">
    <span>${ot.consecutivo}</span>
    <span>Generado: ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
  </div>

</body>
</html>`;
}

/**
 * Genera un PDF de la Orden de Trabajo usando Puppeteer.
 * @param {Object} ot - Objeto OT completo (con técnicos, repuestos, liquidación).
 * @returns {Buffer} Buffer del PDF generado.
 */
import { logger } from './logger.js';

export async function generateOTPdf(ot) {
  try {
    const html = buildOTHtml(ot);

    const launchOptions = {
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    };

    const chromePath = findChromePath();
    if (chromePath) {
      launchOptions.executablePath = chromePath;
    } else if (process.platform === 'linux') {
      launchOptions.executablePath = '/usr/bin/chromium-browser';
    }

    logger.debug('Launching puppeteer for OT PDF', { consecutivo: ot.consecutivo });
    const browser = await puppeteer.launch(launchOptions);

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      logger.debug('Generating PDF buffer');
      const isPMOT = ot.tipo_mantenimiento === 'PREVENTIVO';
      const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: isPMOT
          ? { top: '5px', bottom: '5px', left: '0', right: '0' }
          : { top: '20px', bottom: '50px', left: '0', right: '0' },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  } catch (err) {
    logger.error('Error generating OT PDF', { error: err.message, stack: err.stack });
    throw err;
  }
}
/**
 * Genera el HTML completo para la PREFACTURA / REMISIÓN
 */
function buildPrefacturaHtml(factura) {
  const logo = getLogoBase64();
  const logoHtml = logo
    ? `<img src="${logo}" style="height:60px;" alt="Logo" />`
    : `<div style="font-size:24px;font-weight:800;color:#4338ca;">CARGAR S.A.S.</div>`;

  const isPrefactura = factura.estado === 'PREFACTURA';
  const colorEstado = isPrefactura ? '#f59e0b' : '#22c55e';

  return `<!DOCTYPE html>
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
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .header-left { display: flex; align-items: center; gap: 15px; }
    .header-right { text-align: right; }
    .doc-number {
      font-size: 22px;
      font-weight: 800;
      color: #4338ca;
      letter-spacing: 1px;
    }
    .doc-label {
      font-size: 13px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
    }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 80px;
      color: rgba(0,0,0,0.05);
      font-weight: 900;
      white-space: nowrap;
      z-index: -1;
      pointer-events: none;
    }
    .section { margin-bottom: 18px; }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: #4338ca;
      text-transform: uppercase;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 10px;
    }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
    .field label { font-size: 9px; font-weight: 600; color: #94a3b8; text-transform: uppercase; }
    .field .value { font-size: 11px; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { padding: 6px 8px; text-align: left; font-weight: 700; background: #f1f5f9; border-bottom: 2px solid #e2e8f0; }
    td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
    .text-right { text-align: right; }
    .totals-box { margin-top: 20px; display: flex; justify-content: flex-end; }
    .totals-grid { display: grid; grid-template-columns: 1fr auto; gap: 4px 20px; min-width: 250px; }
    .total-val { font-size: 16px; font-weight: 800; color: #4338ca; }
    .footer-msg { margin-top: 40px; text-align: center; font-size: 10px; color: #64748b; font-style: italic; }
  </style>
</head>
<body>
  ${isPrefactura ? '<div class="watermark">PREFACTURA - NO VÁLIDA</div>' : ''}
  
  <div class="header">
    <div class="header-left">
      ${logoHtml}
    </div>
    <div class="header-right">
      <div class="doc-label">${isPrefactura ? 'Prefactura de Servicios' : 'Relación de Facturación'}</div>
      <div class="doc-number">${factura.consecutivo_interno}</div>
      ${factura.numero_factura ? `<div style="font-weight:700;color:#22c55e">Ref: ${factura.numero_factura}</div>` : ''}
      <div style="font-size:10px;color:#64748b">Fecha: ${formatDate(factura.fecha_prefactura)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Datos del Cliente</div>
    <div class="grid2">
      <div class="field"><label>Cliente</label><div class="value">${factura.empresa_nombre}</div></div>
      <div class="field"><label>NIT</label><div class="value">${factura.empresa_nit}</div></div>
      <div class="field"><label>Dirección</label><div class="value">${factura.empresa_direccion || '—'}</div></div>
      <div class="field"><label>Teléfono</label><div class="value">${factura.empresa_telefono || '—'}</div></div>
      <div class="field"><label>Condición Pago</label><div class="value">${factura.condicion_pago || '—'}</div></div>
      <div class="field"><label>Vencimiento</label><div class="value">${formatDate(factura.fecha_vencimiento)}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Detalle de Servicios / OTs</div>
    <table>
      <thead>
        <tr>
          <th>OT</th>
          <th>Fecha OT</th>
          <th>Descripción</th>
          <th class="text-right">Subtotal</th>
          <th class="text-right">IVA</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${factura.ots.map(ot => `
          <tr>
            <td>${ot.ot_consecutivo}</td>
            <td>${formatDate(ot.ot_fecha)}</td>
            <td>Servicio de mantenimiento ${ot.tipo_mantenimiento}</td>
            <td class="text-right">${formatCOP(ot.subtotal_ot)}</td>
            <td class="text-right">${formatCOP(ot.iva_ot)}</td>
            <td class="text-right">${formatCOP(ot.total_ot)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="totals-box">
    <div class="totals-grid">
      <div style="color:#64748b">Subtotal:</div><div class="text-right">${formatCOP(factura.subtotal)}</div>
      <div style="color:#64748b">IVA (${factura.iva_pct}%):</div><div class="text-right">${formatCOP(factura.iva_valor)}</div>
      <div class="total-val">TOTAL:</div><div class="text-right total-val">${formatCOP(factura.total)}</div>
    </div>
  </div>

  ${factura.notas ? `
  <div class="section" style="margin-top:20px;">
    <div class="section-title">Observaciones</div>
    <div style="font-size:10px;white-space:pre-wrap;">${factura.notas}</div>
  </div>` : ''}

  <div class="footer-msg">
    Este documento es un soporte administrativo de los servicios prestados.<br>
    ${isPrefactura ? 'NO es una factura de venta legal.' : 'Corresponde a la factura oficial registrada en el sistema contable.'}
  </div>

</body>
</html>`;
}

export async function generatePrefacturaPdf(factura) {
  try {
    const html = buildPrefacturaHtml(factura);
    const launchOptions = {
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    };

    const chromePath = findChromePath();
    if (chromePath) {
      launchOptions.executablePath = chromePath;
    } else if (process.platform === 'linux') {
      launchOptions.executablePath = '/usr/bin/chromium-browser';
    }

    logger.debug('Launching puppeteer for Prefactura PDF', { consecutivo: factura.consecutivo_interno });
    const browser = await puppeteer.launch(launchOptions);

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: { top: '20px', bottom: '20px', left: '0', right: '0' },
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  } catch (err) {
    logger.error('Error generating Prefactura PDF', { error: err.message, stack: err.stack });
    throw err;
  }
}
