// quotes.pdf.js
import puppeteer from 'puppeteer';
import { QuotesRepository } from './quotes.repository.js';

const repo = new QuotesRepository();

export const generarPDFCotizacionCliente = async (quoteId) => {
  const quote = await repo.findById(quoteId);
  if (!quote) throw new Error('Cotización no encontrada');

  let itemsHtml = '';
  quote.items.forEach((item, index) => {
    const unitPrice = parseFloat(item.unit_price || 0);
    const qty = parseFloat(item.quantity || 1);
    const disc = parseFloat(item.discount || 0);
    const itemSubtotal = qty * unitPrice * (1 - disc / 100);

    itemsHtml += `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${index + 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">
          ${item.description}
          ${item.origen === 'proveedor' ? '<div style="font-size: 8px; color: #4338ca; font-weight: bold; margin-top: 2px;">Ítem bajo cotización especial</div>' : ''}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${qty}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${unitPrice.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${disc}%</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${itemSubtotal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
      </tr>
    `;
  });

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Cotización - ${quote.quote_number}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; font-size: 12px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #4338ca; padding-bottom: 20px; margin-bottom: 20px; }
        .logo { font-size: 24px; font-weight: bold; color: #4338ca; }
        .title-box { text-align: right; }
        .title-box h1 { margin: 0; font-size: 20px; color: #333; }
        .title-box p { margin: 5px 0 0; font-size: 14px; font-weight: bold; color: #4338ca; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; margin-bottom: 30px; }
        .info-box { background: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 4px; }
        .info-box h3 { margin-top: 0; color: #4338ca; font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #4338ca; color: white; padding: 10px; text-align: left; font-size: 12px; }
        .totals-box { width: 300px; float: right; border: 1px solid #ddd; background: #fafafa; padding: 10px; margin-bottom: 40px; }
        .totals-row { display: flex; justify-content: space-between; padding: 5px 0; }
        .totals-row.bold { font-weight: bold; font-size: 14px; border-top: 1px solid #ccc; margin-top: 5px; padding-top: 5px; }
        .terms { clear: both; font-size: 10px; color: #555; background: #fdfdfd; padding: 10px; border: 1px dashed #ccc; }
        .footer { clear: both; margin-top: 40px; text-align: center; font-size: 9px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">CARGAR S.A.S.</div>
        <div class="title-box">
          <h1>COTIZACIÓN DE VENTA</h1>
          <p>${quote.quote_number}</p>
          <div style="margin-top: 10px; font-size: 11px;">
            Emisión: ${new Date(quote.created_at).toLocaleDateString('es-CO')}<br/>
            Válido hasta: ${quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('es-CO') : 'N/A'}
          </div>
        </div>
      </div>

      <div class="details-grid">
        <div class="info-box">
          <h3>DATOS DEL CLIENTE</h3>
          <b>${quote.company_name || 'N/A'}</b><br/>
          NIT: ${quote.nit || 'N/A'}<br/>
          Contacto: ${quote.contact_name || 'N/A'}<br/>
          Teléfono: ${quote.phone || 'N/A'}
        </div>
        <div class="info-box">
          <h3>DATOS COMERCIALES</h3>
          <b>Asesor Comercial:</b> ${quote.created_by_name || 'Asesor de Ventas'}<br/>
          <b>Moneda:</b> ${quote.currency || 'COP'}<br/>
          <b>Estado:</b> ${quote.status?.toUpperCase() || 'DRAFT'}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">#</th>
            <th>Descripción del Producto/Servicio</th>
            <th style="width: 80px; text-align: center;">Cantidad</th>
            <th style="width: 100px; text-align: right;">V. Unitario</th>
            <th style="width: 60px; text-align: right;">Desc.</th>
            <th style="width: 110px; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="totals-box">
        <div class="totals-row">
          <span>Subtotal:</span>
          <span>$${parseFloat(quote.subtotal || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}</span>
        </div>
        <div class="totals-row">
          <span>IVA (${parseFloat(quote.tax_rate || 19).toFixed(0)}%):</span>
          <span>$${parseFloat(quote.tax_amount || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}</span>
        </div>
        <div class="totals-row bold">
          <span>TOTAL:</span>
          <span>$${parseFloat(quote.total || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })} COP</span>
        </div>
      </div>

      <div class="terms">
        <b>Condiciones y Observaciones Comerciales:</b><br/>
        <p style="margin: 5px 0;">${quote.notes || 'Las condiciones comerciales estándar se aplican a esta propuesta. Oferta sujeta a disponibilidad de stock y confirmación de pago.'}</p>
      </div>

      <div class="footer">
        Documento generado automáticamente por CARGAR CRM - ${new Date().toLocaleString('es-CO')}<br/>
        CARGAR S.A.S. - CRM Ventas
      </div>
    </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({
    format: 'Letter',
    margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
  });
  await browser.close();

  return pdfBuffer;
};
