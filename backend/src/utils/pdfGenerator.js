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

  const estadoColors = {
    'COMPLETADA': '#22c55e',
    'OMITIDA': '#f59e0b',
    'EN_PROCESO': '#3b82f6',
    'PENDIENTE': '#94a3b8',
  };

  const rows = hasActividades ? actividades.map(a => `
        <tr>
          <td style="text-align:center">${a.orden}</td>
          <td style="font-weight:600">${a.codigo || ''} - ${a.nombre}</td>
          <td>
            <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;color:white;background:${estadoColors[a.estado] || '#94a3b8'}">
              ${a.estado}
            </span>
          </td>
          <td>${a.completada_por_nombre || '—'}</td>
          <td style="font-size:9px;color:#64748b">${a.observacion || ''}</td>
        </tr>`).join('')
    : Array(6).fill(0).map((_, i) => `
        <tr>
          <td style="text-align:center;height:24px;">${i + 1}</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>`).join('');

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
    <div class="grid3">
      <div class="field"><label>Frecuencia</label><div class="value" style="font-weight:700;color:#4338ca">${ot.frecuencia_nombre || '—'}</div></div>
      <div class="field"><label>Horómetro inicio</label><div class="value">${ot.horometro_inicial ?? '—'}</div></div>
      <div class="field"><label>Próximo preventivo (horómetro)</label><div class="value" style="font-weight:700;color:#f59e0b">${ot.horometro_frecuencia ?? '—'}</div></div>
    </div>
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
    <div class="grid3">
      <div class="field">
        <label>Horómetro final registrado</label>
        <div class="value">${horoFinal ?? '—'}</div>
      </div>
      <div class="field">
        <label>Horómetro proyectado próximo PM</label>
        <div class="value" style="font-weight:700;color:#4338ca;font-size:14px">${nextHoro ?? '—'}</div>
      </div>
      <div class="field">
        <label>Frecuencia</label>
        <div class="value">${ot.frecuencia_nombre || '—'}</div>
      </div>
    </div>
  </div>`;
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
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .header-left { display: flex; align-items: center; gap: 15px; }
    .header-right { text-align: right; }
    .ot-number {
      font-size: 16px;
      font-weight: 800;
      color: #4338ca;
      letter-spacing: 1px;
    }
    .ot-label {
      font-size: 13px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
    }
    .estado-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      color: white;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .tipo-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .section {
      margin-bottom: 18px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: #4338ca;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 10px;
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
      font-size: 9px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .field .value {
      font-size: 11px;
      font-weight: 500;
      color: #1e293b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    thead { background: #f1f5f9; }
    th {
      padding: 6px 8px;
      text-align: left;
      font-weight: 700;
      color: #475569;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      border-bottom: 2px solid #e2e8f0;
    }
    td {
      padding: 5px 8px;
      border-bottom: 1px solid #f1f5f9;
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
      padding: 15px;
      margin-top: 10px;
    }
    .liq-grid {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 4px 20px;
      font-size: 11px;
    }
    .liq-label { color: #64748b; font-weight: 500; }
    .liq-value { text-align: right; font-weight: 600; }
    .liq-total {
      font-size: 16px;
      font-weight: 800;
      color: #4338ca;
    }
    .detail-text {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px;
      font-size: 11px;
      white-space: pre-wrap;
      line-height: 1.5;
    }
    .footer {
      margin-top: 40px;
      border-top: 1px solid #e2e8f0;
      padding-top: 20px;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr ${isPM ? '1fr' : ''};
      gap: 40px;
      margin-top: 30px;
    }
    .sig-line {
      border-top: 1px solid #1e293b;
      padding-top: 6px;
      text-align: center;
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
    }
    .origin-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 8px;
      font-size: 8px;
      font-weight: 700;
    }
    .origin-plantilla { background: rgba(67,56,202,0.1); color: #4338ca; }
    .origin-manual { background: rgba(245,158,11,0.1); color: #f59e0b; }
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

  <!-- Encabezado -->
  <div class="header">
    <div class="header-left">
      ${logoHtml}
    </div>
    <div class="header-right">
      <div class="ot-label">Orden de Trabajo</div>
      <div class="ot-number">${ot.consecutivo}</div>
      <div style="margin-top: 4px; font-size: 9px; color: #64748b;">
        Fecha: ${formatDate(ot.created_at)}
      </div>
    </div>
  </div>

  <!-- Sección PM Header (solo preventivo) -->
  ${buildPMHeaderSection(ot)}

  <!-- Datos Generales -->
  <div class="section">
    <div class="section-title">Datos Generales</div>
    <div class="grid4">
      <div class="field"><label>Tipo mantenimiento</label><div class="value">${ot.tipo_mantenimiento}</div></div>
      <div class="field"><label>Empresa</label><div class="value">${ot.empresa_nombre || '—'}</div></div>
      <div class="field"><label>NIT</label><div class="value">${ot.empresa_nit || '—'}</div></div>
      <div class="field"><label>Dirección servicio</label><div class="value">${ot.empresa_direccion || '—'}</div></div>  
      <div class="field"><label>Contacto</label><div class="value">${ot.contacto_empresa || '—'}</div></div>
      <div class="field"><label>Teléfono contacto</label><div class="value">${ot.telefono_contacto || '—'}</div></div>
      <div class="field"><label>Correo contacto</label><div class="value">${ot.contacto_email || '—'}</div></div>
      <div class="field"><label>Equipo</label><div class="value">${ot.equipo_marca} ${ot.equipo_modelo}</div></div>
      <div class="field"><label>Serial</label><div class="value">${ot.equipo_serial || '—'}</div></div> 
      <div class="field"><label>Horómetro inicial</label><div class="value">${ot.horometro_inicial ?? '—'}</div></div>
      <div class="field"><label>Horómetro final</label><div class="value">${ot.horometro_final ?? '—'}</div></div>
      <div class="field"><label>Responsable</label><div class="value">${ot.responsable || '—'}</div></div>
    </div>
  </div>

  <!-- Detalle del servicio -->
  ${ot.detalle_servicio ? `
  <div class="section">
    <div class="section-title">Detalle del Servicio</div>
    <div class="detail-text">${ot.detalle_servicio}</div>
  </div>` : ''}

  ${ot.observaciones ? `
  <div class="section">
    <div class="section-title">Observaciones</div>
    <div class="detail-text">${ot.observaciones}</div>
  </div>` : ''}

  <!-- Actividades del mantenimiento -->
  ${buildActividadesSection(ot)}

  <!-- Técnicos asignados -->
  ${tecnicos.length > 0 ? `
  <div class="section">
    <div class="section-title">Técnicos Asignados</div>
    <table>
      <thead>
        <tr>
          <th>Técnico</th>
          <th>Fecha/Hora Salida</th>
          <th>Fecha/Hora Regreso</th>
          <th class="text-right">Tiempo</th>
        </tr>
      </thead>
      <tbody>
        ${tecnicos.map(t => `
        <tr>
          <td>${t.full_name}</td>
          <td>${formatDate(t.fecha_salida)} ${formatTime(t.hora_salida)}</td>
          <td>${formatDate(t.fecha_regreso)} ${formatTime(t.hora_regreso)}</td>
          <td class="text-right">${formatMinutes(t.tiempo_total_min)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <!-- Repuestos e insumos -->
  ${repuestos.length > 0 ? `
  <div class="section">
    <div class="section-title">Repuestos e Insumos</div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          ${isPM ? '<th>Origen</th>' : ''}
          <th class="text-right">Cantidad</th>
          <th>Unidad</th>
          <th class="text-right">P.Unit.</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${repuestos.map(r => `
        <tr>
          <td>${r.descripcion}</td>
          ${isPM ? `<td><span class="origin-badge ${r.origen === 'PLANTILLA_PM' ? 'origin-plantilla' : 'origin-manual'}">${r.origen === 'PLANTILLA_PM' ? 'PLANTILLA' : 'MANUAL'}</span></td>` : ''}
          <td class="text-right">${r.cantidad}</td>
          <td>${r.unidad}</td>
          <td class="text-right">${formatCOP(r.precio_unitario)}</td>
          <td class="text-right">${formatCOP(r.total)}</td>
        </tr>`).join('')}
        <tr class="total-row">
          <td colspan="${isPM ? 5 : 4}" class="text-right">Total Repuestos</td>
          <td class="text-right">${formatCOP(totalRep)}</td>
        </tr>
      </tbody>
    </table>
  </div>` : ''}

  <!-- Liquidación -->
  ${liq ? `
  <div class="section">
    <div class="section-title">Resumen de Liquidación</div>
    <div class="liq-box">
      <div class="liq-grid">
        <div class="liq-label">Total Mano de Obra</div>
        <div class="liq-value">${formatCOP(liq.total_mano_obra)}</div>
        <div class="liq-label">Total Repuestos</div>
        <div class="liq-value">${formatCOP(liq.total_repuestos)}</div>
        <div class="liq-label">Subtotal</div>
        <div class="liq-value">${formatCOP(liq.subtotal)}</div>
        <div class="liq-label">Impuesto (${liq.impuesto_pct}%)</div>
        <div class="liq-value">${formatCOP(liq.impuesto_valor)}</div>
        <div class="liq-label liq-total">TOTAL FINAL</div>
        <div class="liq-value liq-total">${formatCOP(liq.total_final)}</div>
      </div>
      ${liq.notas_liquidacion ? `<div style="margin-top:10px;font-size:10px;color:#64748b;">Notas: ${liq.notas_liquidacion}</div>` : ''}
    </div>
  </div>` : ''}

  <!-- Próximo Mantenimiento (solo PM) -->
  ${isPM ? buildNextMaintenanceSection(ot) : ''}

  <!-- Firmas -->
  <div class="footer">
    <div class="signatures">
      <div>
        <div class="sig-line">Técnico Responsable</div>
      </div>
      ${isPM ? `<div>
        <div class="sig-line">Visto Bueno Supervisor</div>
      </div>` : ''}
      <div>
        <div class="sig-line">Recibido a Conformidad</div>
      </div>
    </div>
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
      const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: { top: '20px', bottom: '50px', left: '0', right: '0' },
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
