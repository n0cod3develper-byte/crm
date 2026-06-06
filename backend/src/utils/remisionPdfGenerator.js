import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { findChromePath } from './chromeFinder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getLogoBase64() {
  try {
    const logoPath = join(__dirname, '..', 'assets', 'logo.png');
    const buffer = readFileSync(logoPath);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

function formatCOP(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0
  }).format(value || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function formatTime(t) {
  if (!t) return '';
  return String(t).substring(0, 5);
}

const TERMINOS = `CARGAR S.A.S. en la prestación de servicio en montacargas ha pactado las siguientes cláusulas:
1. Cuenta con una póliza de responsabilidad civil contractual.
2. El cliente asume totalmente la responsabilidad por la dirección, supervisión y control de la operación del montacargas que se le suministraron operario calificado, evitando riesgos virtuales de siniestros ó movimientos y operaciones efectuados de modo impropio.
3. En caso de siniestro o daños, las partes interesadas se responsabilizaran de manera equitativa por los hechos ocurridos, evitando una reclamacion o demanda futura por perdida o daños quedando por consiguiente CARGAR S.A.S. a paz y salvo y libre de toda responsabilidad.
4. Si el servicio es después de las 5 PM se cobrará a la tarifa con el recargo correspondiente y los sábados después de las 12 M.`;

function buildRemisionHtml(rem, horasLaborales = []) {
  const logo = getLogoBase64();
  const logoHtml = logo
    ? `<img src="${logo}" style="height:55px;" alt="Logo" />`
    : `<div style="font-size:20px;font-weight:800;color:#333;">CARGAR S.A.S.</div>`;

  const operarios = rem.operarios || [];

  // Se usan los campos principales del servicio en la fila DIURNO, según solicitud
  const horarioRows = [
    { label: 'DIURNO',         horas: rem.cantidad_horas,        valor: rem.valor_hora },
    { label: 'NOCTURNO',       horas: rem.horas_nocturnas,       valor: rem.valor_hora_nocturna },
    { label: 'FESTIVO DIURNO', horas: rem.horas_fest_diurnas,    valor: rem.valor_hora_fest_dia },
    { label: 'FESTIVO NOCTURNO', horas: rem.horas_fest_nocturnas, valor: rem.valor_hora_fest_noc },
    { label: 'OTRO',           horas: rem.horas_otras,           valor: rem.valor_hora_otras },
  ];

  // Recalcular el total parcial desglose usando la nueva fila diurno
  const totalParcialDesglose =
    ((parseFloat(rem.cantidad_horas) || 0) * (parseFloat(rem.valor_hora) || 0)) +
    ((parseFloat(rem.horas_nocturnas) || 0) * (parseFloat(rem.valor_hora_nocturna) || 0)) +
    ((parseFloat(rem.horas_fest_diurnas) || 0) * (parseFloat(rem.valor_hora_fest_dia) || 0)) +
    ((parseFloat(rem.horas_fest_nocturnas) || 0) * (parseFloat(rem.valor_hora_fest_noc) || 0)) +
    ((parseFloat(rem.horas_otras) || 0) * (parseFloat(rem.valor_hora_otras) || 0));

  const totalHorasDesglose =
    (parseFloat(rem.cantidad_horas) || 0) +
    (parseFloat(rem.horas_nocturnas) || 0) +
    (parseFloat(rem.horas_fest_diurnas) || 0) +
    (parseFloat(rem.horas_fest_nocturnas) || 0) +
    (parseFloat(rem.horas_otras) || 0);

  const totalLiquidado = horasLaborales.reduce((sum, h) => sum + parseFloat(h.total_liquidado || 0), 0);
  // El nuevo TOTAL NETO es el neto de la remisión + lo liquidado a operarios
  const totalNetoFinal = parseFloat(rem.total_neto || 0) + totalLiquidado;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 10px;
      color: #000;
      padding: 18px 24px;
      line-height: 1.4;
    }
    .header-wrap {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }
    .header-center {
      text-align: center;
      flex: 1;
      font-size: 10px;
      line-height: 1.6;
    }
    .header-right {
      text-align: right;
      font-size: 10px;
      min-width: 130px;
    }
    .order-number {
      font-size: 14px;
      font-weight: bold;
      color: #000;
    }
    .nit-label { font-weight: bold; font-size: 10px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th, td { border: 1px solid #000; padding: 3px 5px; }
    th { background: #fff; font-weight: bold; text-align: center; font-size: 9px; }
    td { text-align: left; }
    .td-center { text-align: center; }
    .client-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 4px 16px;
      margin-bottom: 8px;
    }
    .client-row { display: flex; gap: 8px; margin-bottom: 4px; }
    .client-label { font-weight: bold; }
    .section-title {
      font-weight: bold;
      font-size: 10px;
      text-align: center;
      border: 1px solid #000;
      padding: 4px;
      background: #f0f0f0;
      margin: 8px 0 4px;
    }
    .terminos-box {
      border: 1px solid #000;
      padding: 4px 8px;
      font-size: 9px;
      line-height: 1.15;
      margin-bottom: 6px;
      white-space: pre-wrap;
    }
    .totals-grid {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 2px 10px;
      margin-top: 6px;
      margin-left: auto;
      width: 220px;
      font-size: 10px;
    }
    .totals-label { font-weight: bold; text-align: right; }
    .totals-value { text-align: right; }
    .totals-final { font-weight: bold; font-size: 11px; }
    .firma-section {
      margin-top: 40px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    .firma-line {
      border-top: 1px solid #000;
      padding-top: 4px;
      text-align: center;
      font-size: 9px;
      font-weight: bold;
    }
    .operarios-list { font-size: 10px; margin-bottom: 4px; }
  </style>
</head>
<body>

  <!-- ENCABEZADO -->
  <div class="header-wrap">
    <div>${logoHtml}<div class="nit-label">NIT. 890.919.352-2</div></div>
    <div class="header-center">
      CALLE 31 # 41-51<br>
      Itagüí, Antioquia<br>
      PBX: (+57) 444 77 73 Cel: 320 693 73 94<br>
      www.cargar.co<br>
      mercadeo@cargar.com.co
    </div>
    <div class="header-right">
      Orden de Servicio<br>
      <span class="order-number">No.: ${rem.numero_remision}</span>
    </div>
  </div>

  <!-- DATOS CLIENTE -->
  <div style="margin-bottom: 8px;">
    <div style="display:grid; grid-template-columns: auto 1fr auto; gap: 4px 16px; align-items: start;">
      <div>
        <div><span class="client-label">Señores:</span> ${rem.empresa_nombre || '—'}</div>
        <div><span class="client-label">Nit:</span> ${rem.empresa_nit || '—'}</div>
        <div><span class="client-label">Dirección:</span> ${rem.empresa_direccion || '—'}</div>
      </div>
      <div style="text-align: center; padding-top: 4px;">
        <div><span class="client-label">Teléfono:</span> ${rem.empresa_telefono || '—'}</div>
        ${operarios.length > 0 ? `<div class="operarios-list"><span class="client-label">Operario(s):</span> ${operarios.map(o => o.full_name).join(', ')}</div>` : ''}
      </div>
      <div style="text-align: right;">
        <div><span class="client-label">Fecha:</span> ${formatDate(rem.fecha_servicio)}</div>
        <div><span class="client-label">Solicitado Por:</span> ${rem.solicitado_por || '—'}</div>
        <div><span class="client-label">Dirección de servicio:</span> ${rem.direccion_servicio || '—'}</div>
      </div>
    </div>
  </div>

  <!-- TÉRMINOS Y CONDICIONES -->
  <div class="section-title">TERMINOS Y CONDICIONES</div>
  <div class="terminos-box">${TERMINOS}</div>

  <!-- LIQUIDACIÓN DEL SERVICIO -->
  <div class="section-title">LIQUIDACIÓN DEL SERVICIO</div>
  <table style="margin-bottom: 8px;">
    <thead>
      <tr>
        <th>MÁQUINA</th>
        <th>HORA SALIDA CARGAR</th>
        <th>HORA LLEGADA CLIENTE</th>
        <th>HORA SALIDA CLIENTE</th>
        <th>HORA LLEGADA CARGAR</th>
        <th>DESCUENTO</th>
        <th>HOROMETRO SALIDA</th>
        <th>HOROMETRO REGRESO</th>
      </tr>
    </thead>
    <tbody>
      ${operarios.length > 0 ? operarios.map((op, idx) => {
        const h_sal_cargar = idx === 1 ? rem.segundo_hora_salida_cargar : rem.hora_salida_cargar;
        const h_lleg_cliente = idx === 1 ? rem.segundo_hora_llegada_cliente : rem.hora_llegada_cliente;
        const h_sal_cliente = idx === 1 ? rem.segundo_hora_salida_cliente : rem.hora_salida_cliente;
        const h_lleg_cargar = idx === 1 ? rem.segundo_hora_llegada_cargar : rem.hora_llegada_cargar;
        return `
      <tr>
        <td class="td-center" style="font-size: 8px;"><strong>${op.full_name}</strong><br/>Máq: ${rem.numero_maquina || ''}</td>
        <td class="td-center">${formatTime(h_sal_cargar)}</td>
        <td class="td-center">${formatTime(h_lleg_cliente)}</td>
        <td class="td-center">${formatTime(h_sal_cliente)}</td>
        <td class="td-center">${formatTime(h_lleg_cargar)}</td>
        <td class="td-center">${idx === 0 && rem.descuentos ? formatCOP(rem.descuentos) : ''}</td>
        <td class="td-center">${idx === 0 ? (rem.horometro_salida || '') : ''}</td>
        <td class="td-center">${idx === 0 ? (rem.horometro_regreso || '') : ''}</td>
      </tr>`;
      }).join('') : `
      <tr>
        <td class="td-center">${rem.numero_maquina || ''}</td>
        <td class="td-center">${formatTime(rem.hora_salida_cargar)}</td>
        <td class="td-center">${formatTime(rem.hora_llegada_cliente)}</td>
        <td class="td-center">${formatTime(rem.hora_salida_cliente)}</td>
        <td class="td-center">${formatTime(rem.hora_llegada_cargar)}</td>
        <td class="td-center">${rem.descuentos ? formatCOP(rem.descuentos) : ''}</td>
        <td class="td-center">${rem.horometro_salida || ''}</td>
        <td class="td-center">${rem.horometro_regreso || ''}</td>
      </tr>`}
    </tbody>
  </table>

  <!-- DESCRIPCIÓN SERVICIO -->
  <div style="font-weight: bold; margin-bottom: 2px;">DESCRIPCIÓN SERVICIO</div>
  <table style="margin-bottom: 12px;">
    <thead>
      <tr>
        <th style="width:30px">ITEM</th>
        <th style="text-align:left">CÓDIGO / DESCRIPCION</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="td-center">1</td>
        <td><strong>${rem.servicio_codigo || ''}</strong><br>${rem.servicio_nombre || ''}</td>
      </tr>
    </tbody>
  </table>

  ${rem.observaciones ? `<div style="margin-bottom:12px;font-size:9px;color:#333;"><strong>Observaciones:</strong> ${rem.observaciones}</div>` : ''}

  <!-- TABLA DE HORARIO -->
  <table>
    <thead>
      <tr>
        <th style="text-align:left; width:140px">HORARIO</th>
        <th>HORAS</th>
        <th>VR. HORA SERVICIO</th>
        <th>VR. PARCIAL SERVICIO</th>
      </tr>
    </thead>
    <tbody>
      ${horarioRows.map(row => `
      <tr>
        <td>${row.label}</td>
        <td class="td-center">${parseFloat(row.horas) > 0 ? row.horas : ''}</td>
        <td class="td-center">${parseFloat(row.horas) > 0 && parseFloat(row.valor) > 0 ? 'CO$ ' + new Intl.NumberFormat('es-CO').format(row.valor) : ''}</td>
        <td class="td-center">${(parseFloat(row.horas) > 0 && parseFloat(row.valor) > 0) ? 'CO$ ' + new Intl.NumberFormat('es-CO').format(parseFloat(row.horas) * parseFloat(row.valor)) : ''}</td>
      </tr>`).join('')}
      <tr style="font-weight: bold; background: #f0f0f0;">
        <td>TOTAL</td>
        <td class="td-center">${totalHorasDesglose > 0 ? totalHorasDesglose : ''}</td>
        <td></td>
        <td class="td-center">${totalParcialDesglose > 0 ? 'CO$ ' + new Intl.NumberFormat('es-CO').format(totalParcialDesglose) : ''}</td>
      </tr>
    </tbody>
  </table>

  <!-- TOTALES -->
  <div class="totals-grid">
    <div class="totals-label">TOTAL BRUTO</div>
    <div class="totals-value">CO$ ${new Intl.NumberFormat('es-CO').format(rem.total_bruto || 0)}</div>
    ${totalLiquidado > 0 ? `
    <div class="totals-label" style="color:#000;">TOTAL LIQUIDAR OPERARIOS</div>
    <div class="totals-value" style="color:#000;">CO$ ${new Intl.NumberFormat('es-CO').format(totalLiquidado)}</div>
    ` : ''}
    <div class="totals-label">+IVA</div>
    <div class="totals-value">CO$ ${new Intl.NumberFormat('es-CO').format(rem.iva_valor || 0)}</div>
    <div class="totals-label">DESCUENTOS</div>
    <div class="totals-value">CO$ ${new Intl.NumberFormat('es-CO').format(rem.descuentos || 0)}</div>
    <div class="totals-label totals-final">TOTAL NETO</div>
    <div class="totals-value totals-final">CO$ ${new Intl.NumberFormat('es-CO').format(totalNetoFinal)}</div>
  </div>

  <!-- NOTA INFORMATIVA -->
  <div style="border: 1.5px solid #000; padding: 8px 10px; margin-top: 12px; margin-bottom: 8px; font-size: 9px; line-height: 1.5;">
    <div style="font-weight: bold; text-align: center; font-size: 10px; margin-bottom: 6px; text-transform: uppercase;">NOTA INFORMATIVA PARA EL CLIENTE</div>
    <p style="margin: 0;">
      <strong>ESTIMADO USUARIO:</strong> La labor solo comenzará cuando usted firme este documento, mediante el cual, en calidad de cliente, se compromete a aceptar y cumplir las cláusulas del contrato de servicio de montacargas previamente estipuladas y designa una persona responsable para la dirección y supervisión de las operaciones.
    </p>
    <p style="margin: 8px 0 0; text-align: right;">
      Atentamente,<br/>
      <strong>CARGAR S.A.S.</strong>
    </p>
  </div>

  <!-- FIRMA -->
  <div class="firma-section">
    <div>
      <div style="height: 50px;"></div>
      <div class="firma-line">Firma Operario / CARGAR S.A.S.</div>
    </div>
    <div>
      <div style="height: 50px;"></div>
      <div class="firma-line">Firma y Sello Cliente — Recibido a Conformidad</div>
    </div>
  </div>

  <div style="margin-top: 10px; font-size: 8px; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 6px;">
    Remisión No. ${rem.numero_remision} | Generado: ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
  </div>

</body>
</html>`;
}

export async function generateRemisionPdf(remision, horasLaborales = []) {
  const html = buildRemisionHtml(remision, horasLaborales);

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

  const browser = await puppeteer.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '15px', bottom: '30px', left: '0', right: '0' },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
