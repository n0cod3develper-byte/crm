import cron from 'node-cron';
import { getGraphAccessToken, getGraphClient } from '../services/email/graphMailClient.js';
import { emailMarketingRepository as repo } from '../modules/email-marketing/email-marketing.repository.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let jobHandle = null;

// Palabras clave en el asunto que indican un NDR (non-delivery report)
const NDR_SUBJECTS = [
  'undeliverable',
  'delivery failed',
  'delivery status notification',
  'mail delivery failed',
  'returned mail',
  'failure notice',
  'correo no entregado',
];

/**
 * Detecta si un asunto de correo corresponde a un NDR
 */
function esNDR(subject = '') {
  const lower = subject.toLowerCase();
  return NDR_SUBJECTS.some(kw => lower.includes(kw));
}

/**
 * Extrae la dirección de destino de un cuerpo de NDR.
 * Graph API devuelve el cuerpo como HTML/texto — buscamos patrones comunes.
 */
function extraerCorreoDeNDR(body = '') {
  // Intentar extraer un correo del cuerpo del NDR
  const match = body.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
  if (!match) return null;
  // El primer correo que no sea del remitente propio es probablemente el destinatario fallido
  const senderDomain = env.GRAPH_SENDER_MAILBOX?.split('@')[1] || '';
  return match.find(e => !e.endsWith(senderDomain)) || null;
}

/**
 * Lee el buzón del remitente y busca NDRs recientes (últimas 2 horas).
 * Marca los contactos y envíos afectados como rebotados.
 */
export async function ejecutarJobRebotes() {
  if (!env.GRAPH_SENDER_MAILBOX) {
    logger.warn('[EmailRebotesJob] GRAPH_SENDER_MAILBOX no configurado. Saltando.');
    return;
  }

  logger.info('[EmailRebotesJob] Verificando buzón de rebotes...');

  try {
    const accessToken = await getGraphAccessToken();
    const graphClient = getGraphClient(accessToken);

    // Buscar mensajes de las últimas 2 horas que sean NDR
    const doceHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const messages = await graphClient
      .api(`/users/${env.GRAPH_SENDER_MAILBOX}/messages`)
      .filter(`receivedDateTime ge ${doceHorasAtras}`)
      .select('id,subject,body,receivedDateTime')
      .top(50)
      .get();

    if (!messages?.value?.length) {
      logger.info('[EmailRebotesJob] No hay mensajes nuevos en el buzón.');
      return;
    }

    let rebotesDetectados = 0;

    for (const msg of messages.value) {
      if (!esNDR(msg.subject)) continue;

      const correoAfectado = extraerCorreoDeNDR(msg.body?.content || '');
      if (!correoAfectado) continue;

      logger.info(`[EmailRebotesJob] NDR detectado para: ${correoAfectado}`);

      // Buscar envío reciente a ese correo
      const envio = await repo.getEnviosPorCorreo(correoAfectado);
      if (envio) {
        await repo.marcarEnvioRebotado(envio.id);
        rebotesDetectados++;
        logger.info(`[EmailRebotesJob] Envío ${envio.id} marcado como rebotado.`);
      } else {
        // Marcar directamente el contacto si existe
        const contacto = await repo.getContactoByCorreo(correoAfectado);
        if (contacto && contacto.estado !== 'rebotado') {
          await repo.marcarContactoRebotado(contacto.id);
          rebotesDetectados++;
          logger.info(`[EmailRebotesJob] Contacto ${contacto.id} marcado como rebotado.`);
        }
      }
    }

    logger.info(`[EmailRebotesJob] Procesados ${rebotesDetectados} rebote(s).`);

  } catch (err) {
    logger.error('[EmailRebotesJob] Error al verificar buzón de rebotes', {
      error: err.message,
      stack: err.stack,
    });
  }
}

/**
 * Inicializa el job de detección de rebotes.
 * Corre cada hora para no saturar la API de Graph.
 * Llamar desde app.js durante bootstrap.
 */
export function iniciarJobRebotes() {
  // Cada hora a los 15 minutos (15 * * * *)
  jobHandle = cron.schedule('15 * * * *', async () => {
    await ejecutarJobRebotes();
  }, {
    timezone: 'America/Bogota',
  });

  logger.info('[EmailRebotesJob] Job de rebotes programado (cada hora :15, America/Bogota)');
  return jobHandle;
}

export function detenerJobRebotes() {
  if (jobHandle) {
    jobHandle.stop();
    logger.info('[EmailRebotesJob] Job detenido.');
    jobHandle = null;
  }
}
