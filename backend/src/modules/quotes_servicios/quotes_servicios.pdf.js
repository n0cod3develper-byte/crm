import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getLogoBase64() {
  try {
    const logoPath = join(__dirname, '..', '..', 'assets', 'logo.png');
    const buffer = readFileSync(logoPath);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

export const generateQuoteServicioPDF = async (quote) => {
  const logoSrc = getLogoBase64();
  const logoHtml = logoSrc 
    ? `<img src="${logoSrc}" style="max-height: 80px; filter: grayscale(100%); opacity: 0.6;" alt="Logo CARGAR"/>`
    : `<div class="logo-text">CARGAR S.A.S.</div>`;

  let itemsHtml = '';
  if (quote.items && quote.items.length > 0) {
    quote.items.forEach((item, index) => {
      const unitPrice = parseFloat(item.valor_unitario || 0);
      const qty = parseFloat(item.cantidad || 1);
      const itemSubtotal = parseFloat(item.subtotal || (qty * unitPrice));
      
      const servicio = item.servicio_nombre || quote.servicio_nombre || 'Servicio General';
      const descripcion = item.descripcion || '';
      
      itemsHtml += `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${index + 1}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${servicio}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${descripcion}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${qty}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${unitPrice.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${itemSubtotal.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
        </tr>
      `;
    });
  } else {
    itemsHtml = `
      <tr>
        <td colspan="6" style="padding: 12px; text-align: center; color: #666;">No hay ítems detallados para esta cotización</td>
      </tr>
    `;
  }

  const termsHtml = `
    <div class="terms-section">
      <h3>Términos y condiciones</h3>
      
      <p class="terms-title">CARGAR SAS SE COMPROMETE A:</p>
      <ol>
        <li>Realizar el mantenimiento preventivo y correctivo del equipo de manera oportuna y eficiente, asegurando la máxima operatividad.</li>
        <li>Garantizar la continuidad del servicio. En caso de una falla irreparable, reemplazaremos el equipo conforme a lo establecido en el contrato, para que tu operación no se detenga.</li>
        <li>Responsabilizarnos completamente por nuestro personal, cumpliendo con todas las obligaciones laborales y legales, asegurando que cada miembro esté preparado para brindar el mejor servicio.</li>
        <li>Cumplir con todas las normativas vigentes, garantizando que nuestras operaciones se ajusten a la ley y a los más altos estándares de calidad.</li>
        <li>Proteger tu operación con una póliza de responsabilidad civil extracontractual, siempre que nuestros técnicos especializados operen el equipo, asegurando la tranquilidad de tu empresa.</li>
      </ol>

      <p class="terms-title">EL CLIENTE SE COMPROMETE A:</p>
      <ul>
        <li>Para alquileres sin operario de Cargar a asumir la responsabilidad por la operación del equipo, incluyendo su supervisión y control.</li>
        <li>Garantizar que el equipo sea operado por personal calificado, asegurando la seguridad y efectividad en su uso. Enviar certificación de montacarguista.</li>
        <li>El equipo debe ser utilizado de acuerdo con las recomendaciones del fabricante y las indicaciones de Cargar SAS, estas indicaciones siempre deberán ser por escrito. El mal uso, la negligencia o el uso en condiciones distintas a las recomendadas serán responsabilidad exclusiva del cliente.</li>
        <li>Usar el equipo exclusivamente en las ubicaciones acordadas, respetando siempre las capacidades y especificaciones técnicas para un óptimo rendimiento. Enviar para efectos de pólizas direcciones exactas de operación.</li>
        <li>Asegurar que el equipo opere en terreno plano y seguro, libre de grietas, imperfecciones o inclinaciones que puedan comprometer su funcionamiento. Compartir registro fotográfico.</li>
        <li>En caso de daños, atribuibles al cliente, este deberá cubrir el costo de reparación o sustitución de piezas afectadas, conforme a las tarifas vigentes de Cargar SAS o proveedores autorizados.</li>
        <li>El cliente se compromete a notificar de inmediato a Cargar SAS sobre cualquier daño o fallo del equipo para su evaluación y reparación. El incumplimiento de esta notificación exime a Cargar SAS de cualquier responsabilidad por defectos o fallos resultantes. El cliente, ni ningún colaborador suyo o tercero está autorizado para abrir las tapas de protección del equipo y sus componentes, ni a retirar ni manipular piezas o componentes, salvo autorización expresa y por escrito de Cargar SAS.</li>
        <li>El cliente es responsable y debe asumir cualquier daño o pérdida del equipo alquilado que ocurra durante el período de alquiler, salvo daños causados por el desgaste natural por el uso normal, por defectos de fabricación o mantenimiento realizado exclusivamente por Cargar SAS.</li>
        <li>Cargar SAS ofrece servicios de inspección y mantenimiento preventivo para minimizar riesgos. Sin embargo, el cliente deberá permitir el acceso al equipo para llevar a cabo estas actividades, de acuerdo con el cronograma establecido al momento de la firma del contrato.</li>
        <li>Respetar las condiciones del alquiler, incluso en casos donde el equipo no sea utilizado por razones ajenas a nuestra responsabilidad, el tiempo pactado será facturado según lo acordado.</li>
        <li>Cumplir con los términos de pago acordados, siendo:<br/>
          *Servicios esporádicos: Pago de contado al finalizar el servicio. (El tiempo de servicio esporádico cuenta desde que la maquina sale de CARGAR SAS y hasta que regresa a CARGAR SAS.)<br/>
          *Alquiler permanente: Pago mensual anticipado dentro de los primeros 5 días hábiles fecha factura.
        </li>
      </ul>
    </div>
  `;

  // Calculating a simple valid date if none exists.
  let fechaValidaStr;
  if (quote.valido_hasta) {
    const d = new Date(quote.valido_hasta);
    // Add timezone offset to avoid previous day display issues
    const userOffset = d.getTimezoneOffset() * 60000;
    fechaValidaStr = new Date(d.getTime() + userOffset).toLocaleDateString('es-CO');
  } else {
    const fechaDoc = quote.fecha ? new Date(quote.fecha) : new Date();
    const fechaValida = new Date(fechaDoc.getTime() + 15 * 24 * 60 * 60 * 1000);
    fechaValidaStr = fechaValida.toLocaleDateString('es-CO');
  }

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Cotización - ${quote.consecutivo}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #000; font-size: 12px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .logo-text { font-size: 24px; font-weight: bold; color: #a3e635; }
        .header-center { text-align: center; font-size: 11px; line-height: 1.4; color: #000; }
        .header-center strong { font-size: 14px; display: block; margin-bottom: 2px; }
        .header-right { text-align: right; }
        .quote-number { font-size: 18px; font-weight: bold; color: #000; }
        .quote-number span { color: #dc2626; font-size: 20px; }
        
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #ccc; margin-bottom: 20px; }
        .info-box { padding: 10px 15px; font-size: 12px; line-height: 1.5; }
        .info-box.left { border-right: 1px solid #ccc; }
        .info-box h3 { margin: 0 0 5px 0; font-size: 13px; color: #000; }
        
        .service-info { margin-bottom: 20px; padding: 15px; border: 1px solid #ccc; border-top: 3px solid #a3e635; background: #fafafa; }
        .service-info h3 { margin-top: 0; color: #000; font-size: 14px; margin-bottom: 10px; text-transform: uppercase; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
        th { background: #e5e7eb; color: #000; padding: 10px; text-align: left; }
        
        .totals-box { width: 300px; float: right; border: 1px solid #ccc; padding: 10px; margin-bottom: 30px; }
        .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
        .totals-row.bold { font-weight: bold; font-size: 13px; border-top: 1px solid #eee; margin-top: 4px; padding-top: 4px; }
        
        .terms-section { clear: both; margin-top: 30px; font-size: 10px; line-height: 1.4; color: #333; }
        .terms-section h3 { font-size: 12px; color: #000; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        .terms-title { font-weight: bold; margin-top: 10px; margin-bottom: 5px; color: #000; }
        .terms-section ol, .terms-section ul { margin: 0; padding-left: 20px; margin-bottom: 15px; }
        .terms-section li { margin-bottom: 4px; text-align: justify; }
        
        .footer { clear: both; margin-top: 30px; text-align: center; font-size: 9px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          ${logoHtml}
        </div>
        <div class="header-center">
          <div class="quote-number">Cotización<br/>No. <span>${quote.consecutivo}</span></div>
        </div>
        <div class="header-right" style="font-size: 11px; line-height: 1.4; color: #313030ff;">
          <strong>CARGAR S.A.S.</strong><br/>
          NIT. 890.919.352-2<br/>
          CALLE 31 # 41-51<br/>
          PBX: (604) 44447773<br/>
          Itagüí, Antioquia<br/>
          Celular: 320 693 73 94<br/>
          <strong>www.cargar.co</strong>
        </div>
      </div>

      <div class="details-grid">
        <div class="info-box left">
          <h3>Señores:</h3>
          <b>${quote.company_name || 'N/A'}</b><br/>
          Nit: ${quote.company_nit || 'N/A'}<br/>
          Teléfono: ${quote.contact_phone || quote.company_phone || 'N/A'}<br/>
          ${quote.direccion_invitacion || 'N/A'} ${quote.ciudad_envio ? ', ' + quote.ciudad_envio : ''}
        </div>
        <div class="info-box">
          Valida hasta: ${fechaValidaStr}<br/>
          Solicitado por: ${quote.contact_name || 'N/A'}<br/>
          Estado Cotización: ${quote.estado || 'En Espera'}
        </div>
      </div>

      <div class="service-info">
        <h3>${quote.asunto || 'Propuesta de Servicio'}</h3>
        ${quote.descripcion ? quote.descripcion.replace(/\\n/g, '<br/>') : 'Sin descripción adicional.'}
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">#</th>
            <th style="width: 140px;">Servicio</th>
            <th>Descripción</th>
            <th style="width: 60px; text-align: center;">Cantidad</th>
            <th style="width: 90px; text-align: right;">V. Unitario</th>
            <th style="width: 100px; text-align: right;">Total</th>
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
          <span>IVA:</span>
          <span>$${parseFloat(quote.iva_valor || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}</span>
        </div>
        <div class="totals-row bold">
          <span>TOTAL:</span>
          <span>$${parseFloat(quote.total || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })} COP</span>
        </div>
      </div>

      ${termsHtml}

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
    margin: { top: '30px', right: '30px', bottom: '30px', left: '30px' },
    printBackground: true
  });
  await browser.close();

  return pdfBuffer;
};
