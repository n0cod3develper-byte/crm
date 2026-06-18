import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';
import { query } from '../config/database.js';
import { sendMail } from '../services/email/emailService.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Compilar la plantilla Handlebars una vez al inicio
const templatePath = path.join(__dirname, '..', 'templates', 'soat_vencimiento.hbs');
let compiledTemplate = null;

try {
  if (fs.existsSync(templatePath)) {
    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    
    // Helper para dar color a los días restantes
    Handlebars.registerHelper('colorDias', function (dias) {
      if (dias <= 1) return '#d9534f'; // Rojo
      if (dias <= 5) return '#f0ad4e'; // Naranja
      if (dias <= 15) return '#f0ad4e'; // Naranja
      return '#5bc0de'; // Azul claro
    });

    compiledTemplate = Handlebars.compile(templateSource);
  } else {
    logger.error(`[SoatEmailNotifier] No se encontró la plantilla en: ${templatePath}`);
  }
} catch (error) {
  logger.error(`[SoatEmailNotifier] Error al compilar la plantilla: ${error.message}`);
}

let jobHandle = null;

/**
 * Función principal que ejecuta la detección y el envío
 */
export async function ejecutarJobSoatEmail() {
  logger.info('[SoatEmailNotifier] Iniciando revisión de SOAT por vencer...');

  if (!compiledTemplate) {
    logger.error('[SoatEmailNotifier] Plantilla no disponible, cancelando ejecución.');
    return;
  }

  const recipientsStr = env.SOAT_ALERT_RECIPIENTS || process.env.SOAT_ALERT_RECIPIENTS;
  if (!recipientsStr) {
    logger.warn('[SoatEmailNotifier] SOAT_ALERT_RECIPIENTS no está configurado. Cancelando.');
    return;
  }

  const recipients = recipientsStr.split(',').map(e => e.trim()).filter(e => e);
  if (recipients.length === 0) {
    logger.warn('[SoatEmailNotifier] SOAT_ALERT_RECIPIENTS está vacío. Cancelando.');
    return;
  }

  try {
    // 1. Obtener equipos próximos a vencer usando umbrales en rangos:
    //    - Umbral 30: entre 16 y 30 días
    //    - Umbral 15: entre 6 y 15 días
    //    - Umbral 5:  entre 2 y 5 días
    //    - Umbral 1:  0 o 1 día (incluye el día de vencimiento)
    //    La dedup_key usa el UMBRAL, no el día exacto, para evitar reenvíos dentro del mismo rango.
    const equiposPorVencer = await query(`
      SELECT 
        e.id as equipo_id,
        e.marca,
        e.modelo,
        e.serial,
        e.soat_vencimiento,
        c.name as empresa_nombre,
        CURRENT_DATE AS hoy,
        (e.soat_vencimiento - CURRENT_DATE) as dias_restantes,
        CASE
          WHEN (e.soat_vencimiento - CURRENT_DATE) <= 1  THEN 1
          WHEN (e.soat_vencimiento - CURRENT_DATE) <= 5  THEN 5
          WHEN (e.soat_vencimiento - CURRENT_DATE) <= 15 THEN 15
          ELSE 30
        END AS umbral_aviso
      FROM equipos e
      LEFT JOIN companies c ON e.empresa_id = c.id
      WHERE e.deleted_at IS NULL
        AND e.soat_vigente = TRUE
        AND e.soat_vencimiento IS NOT NULL
        AND (e.soat_vencimiento - CURRENT_DATE) BETWEEN 0 AND 30
    `);

    if (equiposPorVencer.rows.length === 0) {
      logger.info('[SoatEmailNotifier] No hay equipos próximos a vencer en los umbrales configurados.');
      return;
    }

    const notificacionesAEnviar = [];

    // 2. Intentar registrar cada notificación para deduplicar
    for (const equipo of equiposPorVencer.rows) {
      const { equipo_id, soat_vencimiento, dias_restantes, umbral_aviso } = equipo;
      
      // Formatear fecha a YYYY-MM-DD para la dedup_key
      const fechaVencimientoStr = soat_vencimiento.toISOString().split('T')[0];
      // La dedup_key usa umbral_aviso (no dias_restantes exacto) para no reenviar dentro del mismo rango
      const dedupKey = `soat_email:${equipo_id}:${fechaVencimientoStr}:umbral${umbral_aviso}`;

      try {
        const insertResult = await query(`
          INSERT INTO soat_email_notifications 
            (equipo_id, fecha_vencimiento, dias_aviso, dedup_key, recipients)
          VALUES 
            ($1, $2, $3, $4, $5)
          ON CONFLICT (dedup_key) DO NOTHING
          RETURNING id
        `, [equipo_id, fechaVencimientoStr, umbral_aviso, dedupKey, recipientsStr]);

        if (insertResult.rows.length > 0) {
          // Se insertó una nueva fila, este equipo debe ser incluido en el correo
          notificacionesAEnviar.push({
            notificationId: insertResult.rows[0].id,
            equipo: {
              ...equipo,
              dias_aviso: umbral_aviso,
              soat_vencimiento: fechaVencimientoStr // Para la plantilla
            }
          });
        }
      } catch (err) {
        logger.error(`[SoatEmailNotifier] Error al insertar notificación para equipo ${equipo_id}`, { error: err.message });
      }
    }

    if (notificacionesAEnviar.length === 0) {
      logger.info('[SoatEmailNotifier] Las notificaciones de estos equipos ya fueron enviadas anteriormente. No hay correos nuevos por enviar hoy.');
      return;
    }

    logger.info(`[SoatEmailNotifier] Se enviará correo para ${notificacionesAEnviar.length} equipos.`);

    // 3. Preparar y enviar el correo
    const htmlBody = compiledTemplate({
      equipos: notificacionesAEnviar.map(n => n.equipo)
    });

    const sendResult = await sendMail({
      to: recipients,
      subject: `🚨 Alerta: ${notificacionesAEnviar.length} SOAT(s) próximo(s) a vencer`,
      htmlBody
    });

    // 4. Actualizar estado en la base de datos
    const notificationIds = notificacionesAEnviar.map(n => n.notificationId);

    if (sendResult.success) {
      await query(`
        UPDATE soat_email_notifications
        SET status = 'enviado', sent_at = NOW(), attempts = attempts + 1
        WHERE id = ANY($1::int[])
      `, [notificationIds]);
      
      logger.info('[SoatEmailNotifier] Correo enviado exitosamente y registros actualizados.');
    } else {
      await query(`
        UPDATE soat_email_notifications
        SET status = 'error', last_error = $1, attempts = attempts + 1
        WHERE id = ANY($2::int[])
      `, [sendResult.errorMessage || 'Unknown error', notificationIds]);
      
      logger.error('[SoatEmailNotifier] Falló el envío del correo, registros marcados con error.');
    }

  } catch (error) {
    logger.error('[SoatEmailNotifier] Error general ejecutando el job', { error: error.message, stack: error.stack });
  }
}

/**
 * Inicializa el job de notificación de SOAT.
 * Llamar desde app.js
 */
export function iniciarJobSoatEmail() {
  // Ejecutar a las 6:00 AM todos los días
  jobHandle = cron.schedule('0 6 * * *', async () => {
    logger.info('[SoatEmailNotifier] Ejecución programada iniciada.');
    await ejecutarJobSoatEmail();
  }, {
    timezone: 'America/Bogota',
  });

  logger.info('[SoatEmailNotifier] Job programado (06:00 America/Bogota)');
  return jobHandle;
}

export function detenerJobSoatEmail() {
  if (jobHandle) {
    jobHandle.stop();
    logger.info('[SoatEmailNotifier] Job detenido.');
    jobHandle = null;
  }
}
