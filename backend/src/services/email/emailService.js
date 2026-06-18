import { getGraphAccessToken, getGraphClient } from './graphMailClient.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

/**
 * Envía un correo electrónico usando Microsoft Graph API.
 * 
 * @param {Object} options Opciones de envío
 * @param {string[]} options.to Lista de correos destinatarios
 * @param {string} options.subject Asunto del correo
 * @param {string} options.htmlBody Cuerpo en HTML
 * @returns {Promise<{success: boolean, errorCode?: string, errorMessage?: string}>} Resultado
 */
export async function sendMail({ to, subject, htmlBody }) {
  try {
    if (!env.GRAPH_TENANT_ID || !env.GRAPH_CLIENT_ID || !env.GRAPH_CLIENT_SECRET || !env.GRAPH_SENDER_MAILBOX) {
      logger.warn('Faltan credenciales de Graph API. El correo no se enviará.');
      return { success: false, errorCode: 'MISSING_CREDENTIALS', errorMessage: 'Credenciales Graph no configuradas' };
    }

    const accessToken = await getGraphAccessToken();
    const client = getGraphClient(accessToken);

    const message = {
      message: {
        subject,
        body: {
          contentType: 'HTML',
          content: htmlBody,
        },
        toRecipients: to.map((email) => ({
          emailAddress: { address: email.trim() },
        })),
      },
      saveToSentItems: false,
    };

    await client.api(`/users/${env.GRAPH_SENDER_MAILBOX}/sendMail`).post(message);

    return { success: true };
  } catch (error) {
    logger.error('Error al enviar correo por Graph API', { error: error.message, code: error.code });
    return {
      success: false,
      errorCode: error.code || 'GRAPH_API_ERROR',
      errorMessage: error.message,
    };
  }
}
