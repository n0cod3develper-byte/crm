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

/**
 * Determina si un error de Graph API es recuperable (reintentable).
 * Errores 429 (Too Many Requests) y 5xx son transitorios.
 */
function esErrorReintentable(result) {
  if (!result || result.success) return false;
  const code = result.errorCode || '';
  const msg = (result.errorMessage || '').toLowerCase();
  return (
    code === '429' ||
    code === 'TooManyRequests' ||
    code.startsWith('5') ||
    msg.includes('too many requests') ||
    msg.includes('service unavailable') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('throttled')
  );
}

/**
 * Envía un correo con reintentos automáticos ante fallos transitorios de Graph API.
 * Reintenta hasta 3 veces con backoff exponencial (2s → 4s → 8s).
 *
 * @param {Object} options Opciones de envío (mismo contrato que sendMail)
 * @returns {Promise<{success: boolean, errorCode?: string, errorMessage?: string}>}
 */
export async function sendMailWithRetry(options) {
  const MAX_INTENTOS = 3;
  const BACKOFF_BASE_MS = 2000;

  let lastResult;

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    lastResult = await sendMail(options);

    if (lastResult.success) return lastResult;

    if (!esErrorReintentable(lastResult)) {
      // Error permanente (destinatario inválido, credenciales, etc.) — no reintentar
      return lastResult;
    }

    if (intento < MAX_INTENTOS) {
      const espera = BACKOFF_BASE_MS * Math.pow(2, intento - 1); // 2s, 4s, 8s
      logger.warn(
        `[sendMailWithRetry] Intento ${intento}/${MAX_INTENTOS} fallido (${lastResult.errorCode}). ` +
        `Reintentando en ${espera / 1000}s...`,
        { to: options.to, errorMessage: lastResult.errorMessage }
      );
      await new Promise((resolve) => setTimeout(resolve, espera));
    }
  }

  logger.error(
    `[sendMailWithRetry] Agotados ${MAX_INTENTOS} intentos. Último error: ${lastResult?.errorMessage}`,
    { to: options.to }
  );
  return lastResult;
}
