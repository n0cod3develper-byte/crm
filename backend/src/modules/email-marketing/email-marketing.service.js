import Handlebars from 'handlebars';
import { sendMailWithRetry } from '../../services/email/emailService.js';
import { emailMarketingRepository as repo } from './email-marketing.repository.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

// ─── GIF 1×1 pixel de tracking ───────────────────────────────
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);
// ─── Parciales Handlebars reutilizables ──────────────────────────────
// Se registran una sola vez al importar el módulo.
// Usar en plantillas con {{> email_header}}, {{> email_footer}}, {{> cta_whatsapp}}

Handlebars.registerPartial('email_header', `
<div style="background:#1a202c;padding:20px 32px;border-radius:12px 12px 0 0;">
  <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">CARGAR S.A.S.</p>
  <p style="margin:4px 0 0;color:#a0aec0;font-size:12px;">Soluciones en elevación y manejo de carga</p>
</div>
`);

Handlebars.registerPartial('email_footer', `
<div style="background:#f7fafc;padding:20px 32px;border-top:1px solid #e2e8f0;border-radius:0 0 12px 12px;text-align:center;">
  <p style="margin:0;font-size:12px;color:#718096;">CARGAR S.A.S. &bull; Medellín, Colombia</p>
  <p style="margin:6px 0 0;font-size:12px;color:#718096;">
    <a href="mailto:servicioalcliente@cargar.com.co" style="color:#718096;">servicioalcliente@cargar.com.co</a>
    &bull; <a href="http://www.cargar.co" style="color:#718096;">www.cargar.co</a>
  </p>
  <p style="margin:10px 0 0;font-size:11px;color:#a0aec0;">
    <a href="{{unsubscribe_url}}" style="color:#a0aec0;">Darse de baja</a>
  </p>
</div>
`);

Handlebars.registerPartial('cta_whatsapp', `
<div style="text-align:center;margin:24px 0;">
  <a href="https://wa.me/573045286199?text={{encode_uri 'Hola, quiero más información'}}"
     style="display:inline-block;background:#25d366;color:#ffffff;font-size:15px;font-weight:600;
            padding:14px 28px;border-radius:50px;text-decoration:none;">
    💬 Chatear por WhatsApp
  </a>
</div>
`);


/**
 * Compila una plantilla Handlebars con los datos del contacto.
 * Inyecta pixel de tracking, links de clic reescritos y link de unsubscribe.
 *
 * @param {string} cuerpo_handlebars   Cuerpo HTML de la plantilla
 * @param {object} contacto            Datos del contacto: nombre, correo, empresa_nombre, unsubscribe_token
 * @param {string} envioId             UUID del envío (para tracking)
 * @returns {string} HTML compilado y listo para enviar
 */
export function compilarPlantilla(cuerpo_handlebars, contacto, envioId) {
  const baseUrl = env.API_BASE_URL || 'http://localhost:4000';

  // Registrar helpers una sola vez (idempotente)
  if (!Handlebars.helpers['encode_uri']) {
    Handlebars.registerHelper('encode_uri', (str) => encodeURIComponent(str || ''));
  }

  const template = Handlebars.compile(cuerpo_handlebars);

  const unsubscribeUrl = `${baseUrl}/api/email-marketing/unsubscribe/${contacto.unsubscribe_token}`;
  const pixelUrl = `${baseUrl}/api/email-marketing/track/open/${envioId}`;

  const contexto = {
    nombre: contacto.nombre || '',
    correo: contacto.correo || '',
    empresa: contacto.empresa_nombre || '',
    unsubscribe_url: unsubscribeUrl,
  };

  let html = template(contexto);

  // Reescribir URLs externas con tracking de clic
  html = reescribirLinks(html, envioId, baseUrl);

  // Inyectar pixel de apertura justo antes del </body>
  const pixelTag = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;" />`;
  if (html.includes('</body>')) {
    html = html.replace('</body>', `${pixelTag}\n</body>`);
  } else {
    html += pixelTag;
  }

  // Inyectar link de unsubscribe al pie si no viene en la plantilla
  if (!html.includes(unsubscribeUrl)) {
    const unsub = `
      <div style="text-align:center;margin-top:24px;font-size:11px;color:#999;">
        ¿No deseas recibir más correos?
        <a href="${unsubscribeUrl}" style="color:#999;">Darte de baja aquí</a>
      </div>`;
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${unsub}\n</body>`);
    } else {
      html += unsub;
    }
  }

  return html;
}

/**
 * Reescribe todas las URLs del cuerpo HTML por links de tracking.
 * Se excluyen: pixels de tracking, unsubscribe, mailto, anchors internos.
 */
export function reescribirLinks(html, envioId, baseUrl) {
  const trackBase = `${baseUrl}/api/email-marketing/track/click/${envioId}?url=`;

  // Captura href="..." pero excluye links internos del CRM y anchors
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (match, url) => {
    // No reescribir links que ya son de tracking o del propio backend
    if (url.includes('/api/email-marketing/')) return match;
    return `href="${trackBase}${encodeURIComponent(url)}"`;
  });
}

/**
 * Devuelve el buffer del GIF 1×1 pixel.
 */
export function getTrackingPixel() {
  return TRACKING_PIXEL;
}

/**
 * Ejecuta el envío de un lote de correos pendientes de una campaña.
 * @param {object} campana   Objeto campaña con id, plantilla, lista
 * @param {number} loteSize  Máximo de correos a enviar en esta ejecución
 */
export async function enviarLoteCampana(campana, loteSize = 25) {
  const plantilla = await repo.getPlantillaById(campana.plantilla_id);
  if (!plantilla) {
    logger.error(`[EmailService] Plantilla ${campana.plantilla_id} no encontrada para campaña ${campana.id}`);
    return;
  }

  let lote = await repo.getLotePendiente(campana.id, loteSize);
  if (lote.length === 0 && (campana.estado === 'programada' || parseInt(campana.total_envios || 0) === 0)) {
    const totalPreparados = await prepararCampana(campana);
    if (totalPreparados > 0) {
      lote = await repo.getLotePendiente(campana.id, loteSize);
    }
  }

  if (lote.length === 0) {
    await repo.verificarCampanaCompleta(campana.id);
    return;
  }

  logger.info(`[EmailService] Enviando lote de ${lote.length} correos — Campaña: ${campana.nombre}`);

  for (const item of lote) {
    try {
      const htmlBody = compilarPlantilla(plantilla.cuerpo_handlebars, item, item.envio_id);
      const asunto = Handlebars.compile(plantilla.asunto)({
        nombre: item.nombre,
        empresa: item.empresa_nombre || '',
      });

      const result = await sendMailWithRetry({
        to: [item.correo],
        subject: asunto,
        htmlBody,
      });

      if (result.success) {
        await repo.marcarEnvioEnviado(item.envio_id, result.messageId || null);
        logger.info(`[EmailService] ✓ Enviado a ${item.correo}`);
      } else {
        await repo.marcarEnvioFallido(item.envio_id, result.errorMessage || 'Error desconocido');
        logger.warn(`[EmailService] ✗ Fallo enviando a ${item.correo}: ${result.errorMessage}`);

        // Si es error de destinatario, marcar contacto como rebotado
        if (result.errorCode === 'ErrorInvalidRecipients' ||
            result.errorCode === 'ErrorMailboxNotFound' ||
            result.errorMessage?.toLowerCase().includes('recipient')) {
          await repo.marcarContactoRebotado(item.contacto_id);
        }
      }
    } catch (err) {
      logger.error(`[EmailService] Error inesperado enviando a ${item.correo}`, { error: err.message });
      await repo.marcarEnvioFallido(item.envio_id, err.message);
    }
  }

  // Verificar si la campaña está completa
  await repo.verificarCampanaCompleta(campana.id);
}

/**
 * Segmenta y prepara todos los envíos de una campaña.
 * Excluye contactos dados de baja o rebotados.
 * @returns {number} Total de envíos preparados
 */
export async function prepararCampana(campana) {
  const total = await repo.prepararEnviosCampana(campana.id, campana.lista_id);
  logger.info(`[EmailService] Campaña ${campana.nombre}: ${total} envíos preparados`);
  return total;
}

/**
 * Excluye contactos no aptos de una lista de envíos.
 * Útil para validación previa al envío.
 */
export function excluirContactosNoAptos(contactos) {
  return contactos.filter(c => c.estado === 'activo');
}

/**
 * Compila una plantilla con datos ficticios para envío de prueba.
 * No crea registros en email_envios. No inyecta pixel de tracking.
 *
 * @param {object} plantilla   Objeto plantilla con asunto y cuerpo_handlebars
 * @param {string} correoDestino  Email al que se envía la prueba
 * @returns {{ asunto: string, htmlBody: string }}
 */
export function compilarPruebaPlantilla(plantilla, correoDestino) {
  const baseUrl = env.API_BASE_URL || 'http://localhost:4000';

  // Registrar helper si no existe
  if (!Handlebars.helpers['encode_uri']) {
    Handlebars.registerHelper('encode_uri', (str) => encodeURIComponent(str || ''));
  }

  const contexto = {
    nombre: 'Nombre de Prueba',
    correo: correoDestino,
    empresa: 'Empresa de Prueba S.A.S.',
    unsubscribe_url: `${baseUrl}/api/email-marketing/unsubscribe/TOKEN_DE_PRUEBA`,
  };

  const asunto = `[PRUEBA] ${Handlebars.compile(plantilla.asunto)(contexto)}`;
  const htmlBody = Handlebars.compile(plantilla.cuerpo_handlebars)(contexto);

  return { asunto, htmlBody };
}
