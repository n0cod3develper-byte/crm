import cron from 'node-cron';
import { emailMarketingRepository as repo } from '../modules/email-marketing/email-marketing.repository.js';
import { enviarLoteCampana } from '../modules/email-marketing/email-marketing.service.js';
import { logger } from '../utils/logger.js';

const LOTE_SIZE = 25; // Máx correos por ejecución del job
let jobHandle = null;

/**
 * Ejecuta el envío de lotes pendientes para todas las campañas activas.
 * Diseñado para correr cada 3 minutos.
 */
export async function ejecutarJobEnvioCampanas() {
  logger.info('[EmailCampanaJob] Verificando campañas listas para enviar...');

  try {
    const campanas = await repo.getCampanasParaEnviar();

    if (campanas.length === 0) {
      logger.info('[EmailCampanaJob] No hay campañas activas en este momento.');
      return;
    }

    logger.info(`[EmailCampanaJob] ${campanas.length} campaña(s) activa(s) encontrada(s).`);

    for (const campana of campanas) {
      try {
        logger.info(`[EmailCampanaJob] Procesando campaña: ${campana.nombre} (${campana.id})`);
        await enviarLoteCampana(campana, LOTE_SIZE);
      } catch (err) {
        logger.error(`[EmailCampanaJob] Error procesando campaña ${campana.id}`, {
          error: err.message,
          stack: err.stack,
        });
      }
    }
  } catch (err) {
    logger.error('[EmailCampanaJob] Error general en el job', {
      error: err.message,
      stack: err.stack,
    });
  }
}

/**
 * Inicializa el job de envío de campañas.
 * Corre cada 3 minutos para respetar los rate limits de Graph API
 * y no disparar filtros de spam (25 correos cada 3 min ≈ 500/hora máx).
 * Llamar desde app.js durante bootstrap.
 */
export function iniciarJobEnvioCampanas() {
  // Cada 3 minutos
  jobHandle = cron.schedule('*/3 * * * *', async () => {
    await ejecutarJobEnvioCampanas();
  }, {
    timezone: 'America/Bogota',
  });

  logger.info('[EmailCampanaJob] Job de envío programado (cada 3 minutos, America/Bogota)');
  return jobHandle;
}

export function detenerJobEnvioCampanas() {
  if (jobHandle) {
    jobHandle.stop();
    logger.info('[EmailCampanaJob] Job detenido.');
    jobHandle = null;
  }
}
