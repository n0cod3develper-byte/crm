/**
 * turnosCierreAutomatico.job.js
 * Job nocturno: cierra automáticamente los turnos que quedan ACTIVO
 * a las 23:59 de cada día.
 *
 * Usa node-cron. Si node-cron no está instalado:
 *   npm install node-cron --save   (en el directorio /backend)
 */
import cron from 'node-cron';
import { cerrarTurnosActivos } from '../modules/turnos/turnos.repository.js';
import { logger } from '../utils/logger.js';

let jobHandle = null;

/**
 * Inicializa el job de cierre automático.
 * Llamar desde app.js en el bootstrap, después de verificar la conexión a BD.
 */
export function iniciarJobCierreAutomatico() {
  // Ejecutar a las 23:59 todos los días
  // Formato cron: minuto hora día-mes mes día-semana
  jobHandle = cron.schedule('59 23 * * *', async () => {
    logger.info('[TurnoJob] Iniciando cierre automático de turnos...');
    try {
      const resultado = await cerrarTurnosActivos();
      logger.info('[TurnoJob] Cierre automático completado', resultado);
    } catch (err) {
      logger.error('[TurnoJob] Error en cierre automático', { error: err.message });
    }
  }, {
    timezone: 'America/Bogota', // Zona horaria colombiana
  });

  logger.info('[TurnoJob] Job de cierre automático de turnos iniciado (23:59 America/Bogota)');
  return jobHandle;
}

/**
 * Detiene el job (para tests o apagado graceful).
 */
export function detenerJobCierreAutomatico() {
  if (jobHandle) {
    jobHandle.stop();
    logger.info('[TurnoJob] Job de cierre automático detenido.');
    jobHandle = null;
  }
}
