// compras.pdf.js
import puppeteer from 'puppeteer';
import { comprasRepository } from './compras.repository.js';
import { db } from '../../config/database.js';

export const generarPDFOrdenCompra = async (ocId) => {
  const oc = await comprasRepository.getOrdenCompraById(ocId);
  if (!oc) throw new Error('Orden de Compra no encontrada');

  const configRes = await db.query("SELECT valor FROM compras_config WHERE clave = 'terminos_oc'");
  const terminos = configRes.rows[0]?.valor?.texto || oc.terminos_condiciones || '';

  // Get info from the approving user (Nivel 3 or highest)
  const lastAprobacion = oc.aprobaciones && oc.aprobaciones.length > 0 ? oc.aprobaciones[oc.aprobaciones.length - 1] : null;
  const firmaNombre = lastAprobacion ? lastAprobacion.aprobador : 'Aprobador Autorizado';

  let itemsHtml = '';
  oc.items.forEach((item, index) => {
    itemsHtml += `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${index + 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">
          ${item.descripcion}
          <div style="font-size: 10px; color: #666;">${item.marca || ''} ${item.referencia || ''}</div>
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.cantidad_ordenada} ${item.unidad}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${parseFloat(item.precio_unitario).toLocaleString()}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${item.iva_pct}%</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${parseFloat(item.total_item).toLocaleString()}</td>
      </tr>
    `;
  });

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Orden de Compra - ${oc.consecutivo}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; font-size: 12px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0056b3; padding-bottom: 20px; mb-6; }
        .logo { font-size: 24px; font-weight: bold; color: #0056b3; }
        .title-box { text-align: right; }
        .title-box h1 { margin: 0; font-size: 20px; color: #333; }
        .title-box p { margin: 5px 0 0; font-size: 14px; font-weight: bold; color: #e11d48; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; margin-bottom: 30px; }
        .info-box { background: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 4px; }
        .info-box h3 { margin-top: 0; color: #0056b3; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        table { w-full border-collapse; width: 100%; margin-bottom: 20px; }
        th { background: #0056b3; color: white; padding: 10px; text-align: left; font-size: 12px; }
        .totals-box { width: 300px; float: right; border: 1px solid #ddd; background: #fafafa; padding: 10px; margin-bottom: 40px; }
        .totals-row { display: flex; justify-content: space-between; padding: 5px 0; }
        .totals-row.bold { font-weight: bold; font-size: 14px; border-top: 1px solid #ccc; margin-top: 5px; padding-top: 5px; }
        .terms { clear: both; font-size: 10px; color: #555; background: #fdfdfd; padding: 10px; border: 1px dashed #ccc; }
        .signature { margin-top: 60px; text-align: center; width: 250px; float: left; }
        .sig-line { border-top: 1px solid #333; margin-bottom: 5px; }
        .footer { clear: both; margin-top: 40px; text-align: center; font-size: 9px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">CARGAR S.A.S.</div>
        <div class="title-box">
          <h1>ORDEN DE COMPRA</h1>
          <p>${oc.consecutivo}</p>
          <div style="margin-top: 10px; font-size: 11px;">
            Emisión: ${new Date(oc.fecha_emision).toLocaleDateString()}<br/>
            Entrega Esperada: ${new Date(oc.fecha_entrega_esperada).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div class="details-grid">
        <div class="info-box">
          <h3>DATOS DEL PROVEEDOR</h3>
          <b>${oc.proveedor_nombre}</b><br/>
          NIT: ${oc.proveedor_nit}<br/>
          Dirección: ${oc.proveedor_direccion || 'N/A'}<br/>
          Teléfono: ${oc.telefono_principal || 'N/A'}<br/>
          Email: ${oc.email_principal || 'N/A'}<br/>
          <i>Condición de pago: ${oc.condicion_pago?.replace('_', ' ') || 'N/A'}</i>
        </div>
        <div class="info-box">
          <h3>DATOS DE ENTREGA</h3>
          <b>Dirección de Recepción:</b><br/>
          ${oc.direccion_entrega || 'Dirección de bodega principal CARGAR S.A.S.'}<br/><br/>
          <b>Contacto en Recepción:</b><br/>
          ${oc.contacto_recepcion || 'Recepcionista de Bodega'}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Descripción del Ítem</th>
            <th style="text-align: center;">Cantidad</th>
            <th style="text-align: right;">V. Unitario</th>
            <th style="text-align: right;">IVA</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="totals-box">
        <div class="totals-row">
          <span>Subtotal:</span>
          <span>$${parseFloat(oc.subtotal).toLocaleString()}</span>
        </div>
        <div class="totals-row">
          <span>IVA Calculado:</span>
          <span>$${parseFloat(oc.iva_valor).toLocaleString()}</span>
        </div>
        <div class="totals-row bold">
          <span>TOTAL:</span>
          <span>$${parseFloat(oc.total).toLocaleString()} COP</span>
        </div>
      </div>

      <div class="terms">
        <b>Términos y Condiciones:</b><br/>
        <pre style="font-family: inherit; font-size: 9px; white-space: pre-wrap;">${terminos}</pre>
        <p style="margin-top: 10px;"><b>Notas:</b> ${oc.notas || 'Sin observaciones'}</p>
      </div>

      <div class="signature">
        <div class="sig-line"></div>
        <b>${firmaNombre}</b><br/>
        Firma Autorizada y Sello
      </div>

      <div class="footer">
        Documento generado automáticamente por CARGAR CRM - ${new Date().toLocaleString()}<br/>
        Este documento es una orden de pedido oficial, sujeta a verificación en la entrega.
      </div>
    </body>
    </html>
  `;

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({
    format: 'A4',
    margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
  });
  await browser.close();

  return pdfBuffer;
};
