import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { findChromePath } from '../../utils/chromeFinder.js';
import { logger } from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getLogoBase64() {
  try {
    const logoPath = join(__dirname, '..', '..', 'assets', 'logo.png');
    const buffer = readFileSync(logoPath);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (err) {
    logger.warn('Could not load logo for certificate PDF', { error: err.message });
    return null;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
}

function formatCOP(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0
  }).format(value || 0);
}

function calcularAntiguedad(fechaIngreso) {
  if (!fechaIngreso) return '';
  const ingreso = new Date(fechaIngreso);
  const hoy = new Date();
  let anios = hoy.getFullYear() - ingreso.getFullYear();
  let meses = hoy.getMonth() - ingreso.getMonth();
  if (meses < 0) { anios--; meses += 12; }
  if (anios > 0 && meses > 0) return `${anios} año${anios > 1 ? 's' : ''} y ${meses} mes${meses > 1 ? 'es' : ''}`;
  if (anios > 0) return `${anios} año${anios > 1 ? 's' : ''}`;
  return `${meses} mes${meses > 1 ? 'es' : ''}`;
}

/**
 * Generate the HTML for the labor certificate using tables (not CSS Grid).
 * @param {Object} emp - Employee data
 * @param {Object} options - { showSalary: boolean, firmaNombre: string, firmaCargo: string }
 */
function buildCertificateHtml(emp, options = {}) {
  const logo = getLogoBase64();
  const logoHtml = logo
    ? `<img src="${logo}" style="height:70px;" alt="Logo" />`
    : `<div style="font-size:28px;font-weight:800;color:#4338ca;">CARGAR S.A.S.</div>`;

  const showSalary = options.showSalary !== false; // default true
  const firmaNombre = options.firmaNombre || 'Robinson Alzate';
  const firmaCargo = options.firmaCargo || 'Gerente General';
  const fechaExpedicion = formatDate(new Date().toISOString());
  const antiguedad = calcularAntiguedad(emp.fecha_ingreso);
  const tipoContrato = emp.tipo_contrato || 'Término Indefinido';

  // Company data for CARGAR S.A.S. (the only company issuing certificates)
  const company = {
    nombre: 'CARGAR S.A.S.',
    nit: '890919352-2',
    direccion: 'Calle 31 No. 41-51, Itagüí - Antioquia',
    telefono: '444 7773 EXT 113',
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 12px;
      color: #1e293b;
      line-height: 1.6;
      padding: 40px 50px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #4338ca;
      padding-bottom: 15px;
      margin-bottom: 25px;
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
    table.info-table {
      width: 100%;
      border-collapse: collapse;
    }
    table.info-table td {
      padding: 4px 8px;
      font-size: 11px;
      vertical-align: top;
    }
    table.info-table .label {
      width: 200px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 10px;
    }
    table.info-table .value {
      color: #1e293b;
      font-weight: 500;
    }
    .body-text {
      font-size: 12px;
      line-height: 1.8;
      text-align: justify;
      margin: 15px 0;
    }
    .signature-section {
      margin-top: 50px;
      display: flex;
      justify-content: center;
      gap: 80px;
    }
    .signature-box {
      text-align: center;
      width: 220px;
    }
    .sig-line {
      border-top: 1px solid #1e293b;
      padding-top: 8px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #1e293b;
    }
    .sig-name {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }
    .page-footer {
      position: fixed;
      bottom: 20px;
      left: 50px;
      right: 50px;
      font-size: 9px;
      color: #94a3b8;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="header-left">
      ${logoHtml}
      <div>
        <div style="font-size:14px;font-weight:800;color:#1e293b;">${company.nombre}</div>
        <div style="font-size:9px;color:#64748b;">NIT: ${company.nit}</div>
        <div style="font-size:9px;color:#64748b;">${company.direccion}</div>
        <div style="font-size:9px;color:#64748b;">Tel: ${company.telefono}</div>
      </div>
    </div>
    <div class="header-right">
      <div class="doc-title">Certificado Laboral</div>
      <div class="doc-subtitle">Fecha de expedición: ${fechaExpedicion}</div>
    </div>
  </div>

  <!-- Datos del Empleado -->
  <div class="section">
    <div class="section-title">Datos del Empleado</div>
    <table class="info-table">
      <tr>
        <td class="label">Nombre completo:</td>
        <td class="value">${emp.full_name || ''}</td>
        <td class="label">Documento de identidad:</td>
        <td class="value">${emp.tipo_documento || 'CC'} ${emp.numero_documento || ''}</td>
      </tr>
      <tr>
        <td class="label">Cargo:</td>
        <td class="value">${emp.position || ''}</td>
        <td class="label">Departamento:</td>
        <td class="value">${emp.departamento || 'N/A'}</td>
      </tr>
      <tr>
        <td class="label">Fecha de ingreso:</td>
        <td class="value">${formatDateShort(emp.fecha_ingreso)}</td>
        <td class="label">Antigüedad:</td>
        <td class="value">${antiguedad}</td>
      </tr>
      <tr>
        <td class="label">Tipo de contrato:</td>
        <td class="value">${tipoContrato}</td>
        ${emp.fecha_retiro ? `
        <td class="label">Fecha de retiro:</td>
        <td class="value">${formatDateShort(emp.fecha_retiro)}</td>
        ` : `
        <td class="label">Estado:</td>
        <td class="value" style="color:#22c55e;font-weight:700;">Activo</td>
        `}
      </tr>
      ${showSalary ? `
      <tr>
        <td class="label">Salario base mensual:</td>
        <td class="value" style="font-weight:700;">${formatCOP(emp.salario)}</td>
        <td class="label">Jornada:</td>
        <td class="value">${emp.jornada || 'Lunes a Viernes'}</td>
      </tr>
      ` : ''}
    </table>
  </div>

  <!-- Cuerpo del certificado -->
  <div class="body-text">
    <p style="margin-bottom:12px;">
      La empresa <strong>${company.nombre}</strong>, identificada con NIT ${company.nit},
      hace constar que el/la señor(a) <strong>${emp.full_name || ''}</strong>,
      identificado(a) con ${emp.tipo_documento || 'Cédula de Ciudadanía'} No. ${emp.numero_documento || ''},
      se encuentra vinculado(a) a nuestra empresa desde el
      <strong>${formatDateShort(emp.fecha_ingreso)}</strong>
      ${emp.fecha_retiro ? `hasta el <strong>${formatDateShort(emp.fecha_retiro)}</strong>` : ''},
      desempeñando el cargo de <strong>${emp.position || ''}</strong>,
      con un tipo de contrato a <strong>${tipoContrato}</strong>.
    </p>
    ${showSalary ? `
    <p style="margin-bottom:12px;">
      Su remuneración mensual es de <strong>${formatCOP(emp.salario)}</strong>
      ${antiguedad ? `, con una antigüedad de <strong>${antiguedad}</strong>` : ''}.
    </p>
    ` : ''}
    ${emp.motivo_retiro ? `
    <p style="margin-bottom:12px;">
      El motivo de retiro fue: <strong>${emp.motivo_retiro}</strong>.
    </p>
    ` : ''}
    <p>
      Se expide el presente certificado a solicitud del interesado(a) para los fines legales que estime convenientes.
    </p>
  </div>

  <!-- Firmas -->
  <div class="signature-section">
    <div class="signature-box">
      <div class="sig-line">Elaborado por</div>
      <div class="sig-name">Gestión Humana</div>
    </div>
    <div class="signature-box">
      <div class="sig-line">${firmaNombre}</div>
      <div class="sig-name">${firmaCargo}</div>
    </div>
  </div>

  <!-- Pie de página -->
  <div class="page-footer">
    CARGAR S.A.S. — Certificado Laboral — Generado: ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
  </div>
</body>
</html>`;
}

/**
 * Generate a labor certificate PDF using Puppeteer.
 * @param {Object} emp - Employee data
 * @param {Object} options - { showSalary, firmaNombre, firmaCargo }
 * @returns {Buffer} PDF buffer
 */
/**
 * Replace {{variable}} placeholders in template content.
 * Supports simple {{var}} and conditional {{#if var}}...{{/if}} blocks.
 */
function renderTemplate(templateContent, variables) {
  let result = templateContent;

  // Process conditional blocks: {{#if var}}...{{/if}}
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, varName, content) => {
    const val = variables[varName];
    if (val === true || val === 'true') {
      // Process nested variables inside the block
      return content.replace(/\{\{(\w+)\}\}/g, (_, innerVar) => variables[innerVar] || '');
    }
    return '';
  });

  // Replace remaining simple {{variable}} placeholders
  result = result.replace(/\{\{(\w+)\}\}/g, (_, varName) => variables[varName] || '');

  return result;
}

/**
 * Generate a certificate PDF from a dynamic template.
 * @param {Object} emp - Employee data
 * @param {Object} template - Template object with contenido field
 * @param {Object} options - { firmaNombre, firmaCargo, mostrarSalario }
 * @returns {Buffer} PDF buffer
 */
export async function generateCertificatePdfFromTemplate(emp, template, options = {}) {
  try {
    const logo = getLogoBase64();
    const logoHtml = logo
      ? `<img src="${logo}" style="height:70px;" alt="Logo" />`
      : `<div style="font-size:28px;font-weight:800;color:#4338ca;">CARGAR S.A.S.</div>`;

    const company = {
      nombre: 'CARGAR S.A.S.',
      nit: '890919352-2',
      direccion: 'Calle 31 No. 41-51, Itagüí - Antioquia',
      telefono: '444 7773 EXT 113',
    };

    const mostrarSalario = options.mostrarSalario !== false;
    const antiguedad = calcularAntiguedad(emp.fecha_ingreso);

    // Build variables map for template rendering
    const variables = {
      nombre_completo: emp.full_name || '',
      tipo_documento: emp.tipo_documento || 'CC',
      numero_documento: emp.numero_documento || '',
      cargo: emp.position || '',
      departamento: emp.departamento || 'N/A',
      fecha_ingreso: formatDateShort(emp.fecha_ingreso),
      fecha_retiro: emp.fecha_retiro ? formatDateShort(emp.fecha_retiro) : '',
      tipo_contrato: emp.tipo_contrato || 'Término Indefinido',
      salario: formatCOP(emp.salario),
      jornada: emp.jornada || 'Lunes a Viernes',
      antiguedad: antiguedad,
      motivo_retiro: emp.motivo_retiro || '',
      fecha_expedicion: formatDate(new Date().toISOString()),
      firma_nombre: options.firmaNombre || 'Robinson Alzate',
      firma_cargo: options.firmaCargo || 'Gerente General',
      mostrar_salario: mostrarSalario,
    };

    // Render template content
    const bodyText = renderTemplate(template.contenido, variables);

    const fechaExpedicion = formatDate(new Date().toISOString());

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 12px;
      color: #1e293b;
      line-height: 1.6;
      padding: 40px 50px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #4338ca;
      padding-bottom: 15px;
      margin-bottom: 25px;
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
    table.info-table {
      width: 100%;
      border-collapse: collapse;
    }
    table.info-table td {
      padding: 4px 8px;
      font-size: 11px;
      vertical-align: top;
    }
    table.info-table .label {
      width: 200px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 10px;
    }
    table.info-table .value {
      color: #1e293b;
      font-weight: 500;
    }
    .body-text {
      font-size: 12px;
      line-height: 1.8;
      text-align: justify;
      margin: 15px 0;
    }
    .signature-section {
      margin-top: 50px;
      display: flex;
      justify-content: center;
      gap: 80px;
    }
    .signature-box {
      text-align: center;
      width: 220px;
    }
    .sig-line {
      border-top: 1px solid #1e293b;
      padding-top: 8px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #1e293b;
    }
    .sig-name {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }
    .page-footer {
      position: fixed;
      bottom: 20px;
      left: 50px;
      right: 50px;
      font-size: 9px;
      color: #94a3b8;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="header-left">
      ${logoHtml}
      <div>
        <div style="font-size:14px;font-weight:800;color:#1e293b;">${company.nombre}</div>
        <div style="font-size:9px;color:#64748b;">NIT: ${company.nit}</div>
        <div style="font-size:9px;color:#64748b;">${company.direccion}</div>
        <div style="font-size:9px;color:#64748b;">Tel: ${company.telefono}</div>
      </div>
    </div>
    <div class="header-right">
      <div class="doc-title">Certificado Laboral</div>
      <div class="doc-subtitle">${template.nombre}</div>
      <div class="doc-subtitle">Fecha de expedición: ${fechaExpedicion}</div>
    </div>
  </div>

  <!-- Datos del Empleado -->
  <div class="section">
    <div class="section-title">Datos del Empleado</div>
    <table class="info-table">
      <tr>
        <td class="label">Nombre completo:</td>
        <td class="value">${emp.full_name || ''}</td>
        <td class="label">Documento de identidad:</td>
        <td class="value">${emp.tipo_documento || 'CC'} ${emp.numero_documento || ''}</td>
      </tr>
      <tr>
        <td class="label">Cargo:</td>
        <td class="value">${emp.position || ''}</td>
        <td class="label">Departamento:</td>
        <td class="value">${emp.departamento || 'N/A'}</td>
      </tr>
      <tr>
        <td class="label">Fecha de ingreso:</td>
        <td class="value">${formatDateShort(emp.fecha_ingreso)}</td>
        <td class="label">Antigüedad:</td>
        <td class="value">${antiguedad}</td>
      </tr>
      <tr>
        <td class="label">Tipo de contrato:</td>
        <td class="value">${emp.tipo_contrato || 'Término Indefinido'}</td>
        ${emp.fecha_retiro ? `
        <td class="label">Fecha de retiro:</td>
        <td class="value">${formatDateShort(emp.fecha_retiro)}</td>
        ` : `
        <td class="label">Estado:</td>
        <td class="value" style="color:#22c55e;font-weight:700;">Activo</td>
        `}
      </tr>
      ${mostrarSalario ? `
      <tr>
        <td class="label">Salario base mensual:</td>
        <td class="value" style="font-weight:700;">${formatCOP(emp.salario)}</td>
        <td class="label">Jornada:</td>
        <td class="value">${emp.jornada || 'Lunes a Viernes'}</td>
      </tr>
      ` : ''}
    </table>
  </div>

  <!-- Cuerpo del certificado (rendered from template) -->
  <div class="body-text">
    ${bodyText}
  </div>

  <!-- Firmas -->
  <div class="signature-section">
    <div class="signature-box">
      <div class="sig-line">Elaborado por</div>
      <div class="sig-name">Gestión Humana</div>
    </div>
    <div class="signature-box">
      <div class="sig-line">${variables.firma_nombre}</div>
      <div class="sig-name">${variables.firma_cargo}</div>
    </div>
  </div>

  <!-- Pie de página -->
  <div class="page-footer">
    ${company.nombre} — Certificado Laboral — Generado: ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
  </div>
</body>
</html>`;

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

    logger.debug('Launching puppeteer for certificate PDF (template)', { employee: emp.full_name, template: template.nombre });
    const browser = await puppeteer.launch(launchOptions);

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: { top: '10px', bottom: '10px', left: '0', right: '0' },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  } catch (err) {
    logger.error('Error generating certificate PDF from template', { error: err.message, stack: err.stack });
    throw err;
  }
}

export async function generateCertificatePdf(emp, options = {}) {
  try {
    const html = buildCertificateHtml(emp, options);

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

    logger.debug('Launching puppeteer for certificate PDF', { employee: emp.full_name });
    const browser = await puppeteer.launch(launchOptions);

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: { top: '10px', bottom: '10px', left: '0', right: '0' },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  } catch (err) {
    logger.error('Error generating certificate PDF', { error: err.message, stack: err.stack });
    throw err;
  }
}
