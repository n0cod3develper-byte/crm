import cron from 'node-cron';
import { CorteContableRepository } from '../modules/mantenimiento/corteContable.repository.js';
import { logger } from '../utils/logger.js';

const repo = new CorteContableRepository();
let jobHandle = null;

/**
 * Función principal que revisa si es fin de mes y genera la propuesta
 */
export async function ejecutarJobCorteContable() {
  const hoy = new Date();
  
  // Revisar si hoy es el último día del mes
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);
  const esUltimoDia = manana.getMonth() !== hoy.getMonth();

  if (!esUltimoDia) {
    logger.info('[CorteContableJob] Hoy no es el último día del mes. Saltando ejecución.');
    return;
  }

  const fechaCorteStr = hoy.toISOString().split('T')[0];
  logger.info(`[CorteContableJob] Iniciando generación automática de propuesta de corte para: ${fechaCorteStr}`);

  try {
    const result = await repo.generarPropuestaCorte(fechaCorteStr);
    logger.info('[CorteContableJob] Propuesta de corte mensual generada con éxito.', result);
  } catch (err) {
    logger.error('[CorteContableJob] Error al generar propuesta de corte automática:', { error: err.message });
  }
}

/**
 * Inicializa el job de corte contable programado.
 * Se ejecuta a las 23:00 todos los días.
 */
export function iniciarJobCierreContableOT() {
  // 23:00 todos los días
  jobHandle = cron.schedule('0 23 * * *', async () => {
    await ejecutarJobCorteContable();
  }, {
    timezone: 'America/Bogota',
  });

  logger.info('[CorteContableJob] Job programado (23:00 America/Bogota)');
  return jobHandle;
}

export function detenerJobCierreContableOT() {
  if (jobHandle) {
    jobHandle.stop();
    logger.info('[CorteContableJob] Job detenido.');
    jobHandle = null;
  }
}
