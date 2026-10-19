import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';
import { sendMailWithRetry } from './email/emailService.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { LeadsRepository } from '../modules/leads/leads.repository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repo = new LeadsRepository();

// Compilar la plantilla una sola vez, igual que hace soatEmailNotifier
const templatePath = path.join(__dirname, '..', 'templates', 'lead_asignado.hbs');
let compiledTemplate = null;

try {
  if (fs.existsSync(templatePath)) {
    compiledTemplate = Handlebars.compile(fs.readFileSync(templatePath, 'utf-8'));
  } else {
    logger.error(`[LeadAsignadoNotifier] No se encontró la plantilla en: ${templatePath}`);
  }
} catch (error) {
  logger.error(`[LeadAsignadoNotifier] Error al compilar la plantilla: ${error.message}`);
}

// Formato de fecha para Colombia (America/Bogota, UTC-5 sin horario de verano)
const formatoFechaCO = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  dateStyle: 'medium',
  timeStyle: 'short',
});

// Validación simple de formato antes de intentar el envío
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Notifica por correo a un empleado que se le ha asignado (o reasignado) un lead.
 *
 * DISEÑO: esta función NUNCA lanza excepciones hacia el caller. El lead ya está
 * persistido y confirmado cuando se llama aquí; un fallo de correo se registra y
 * se devuelve como resultado, pero no revierte ni pierde el lead.
 *
 * @param {Object}  params
 * @param {Object}  params.lead              Lead ya persistido (con id y datos).
 * @param {Object}  params.empleado          { id, full_name, email, status }.
 * @param {string}  params.asignadoPorId     UUID del usuario que asigna.
 * @param {string}  params.asignadoPorNombre Nombre visible del usuario que asigna.
 * @param {boolean} params.esReasignacion    true si el lead ya tenía responsable.
 * @param {string}  [params.empleadoAnteriorId] UUID del empleado anterior (para dedup y auditoría).
 * @returns {Promise<{enviado: boolean, motivo?: string}>}
 */
export async function notificarAsignacionLead({ lead, empleado, asignadoPorId, asignadoPorNombre, esReasignacion, empleadoAnteriorId }) {
  try {
    if (!lead?.id || !empleado?.id) {
      return { enviado: false, motivo: 'datos_incompletos' };
    }

    // 1. Correo válido. Si no lo hay, se registra el evento y se avisa sin perder el lead.
    const correo = (empleado.email || '').trim();
    if (!EMAIL_RE.test(correo)) {
      logger.warn('[LeadAsignadoNotifier] Empleado sin correo corporativo válido; no se envía notificación.', {
        leadId: lead.id,
        empleadoId: empleado.id,
      });
      // Clave con sufijo propio: este registro de error no debe bloquear un envío
      // válido posterior si el correo del empleado se corrige.
      const registroInvalido = await repo.registrarNotificacion({
        leadId: lead.id,
        empleadoId: empleado.id,
        asignadoPor: asignadoPorId,
        dedupKey: `${dedupKeyDe(lead.id, empleado.id, empleadoAnteriorId)}:sin_correo`,
        recipients: '',
      });
      if (registroInvalido) {
        await repo.marcarNotificacionError(registroInvalido.id, 'Correo del empleado ausente o con formato inválido');
      }
      return { enviado: false, motivo: 'correo_invalido' };
    }

    if (!compiledTemplate) {
      logger.error('[LeadAsignadoNotifier] Plantilla no disponible; no se envía notificación.', { leadId: lead.id });
      return { enviado: false, motivo: 'plantilla_no_disponible' };
    }

    // 2. Registro previo (dedup). Si ya existe, alguien ya fue notificado: no se duplica.
    const registro = await repo.registrarNotificacion({
      leadId: lead.id,
      empleadoId: empleado.id,
      asignadoPor: asignadoPorId,
      dedupKey: dedupKeyDe(lead.id, empleado.id, empleadoAnteriorId),
      recipients: correo,
    });

    if (!registro) {
      logger.info('[LeadAsignadoNotifier] Notificación ya registrada previamente; se omite el envío.', {
        leadId: lead.id,
        empleadoId: empleado.id,
      });
      return { enviado: false, motivo: 'duplicado' };
    }

    // 3. Render y envío
    const htmlBody = compiledTemplate({
      titulo: esReasignacion ? 'Lead reasignado — CARGAR S.A.S.' : 'Nuevo Lead asignado — CARGAR S.A.S.',
      mensaje_intro: esReasignacion
        ? 'Se te ha reasignado un Lead en el sistema CRM de CARGAR S.A.S.'
        : 'Se te ha asignado un Lead en el sistema CRM de CARGAR S.A.S.',
      nombre_empleado: empleado.full_name || 'colaborador',
      codigo: lead.id,
      empresa: lead.company_name || '—',
      contacto: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '—',
      telefono: lead.phone || '—',
      correo: lead.email || '—',
      descripcion: lead.notes || '—',
      fecha_asignacion: formatoFechaCO.format(new Date()),
      asignado_por: asignadoPorNombre || 'Sistema CRM',
      // Ahora existe la ruta de detalle, así que el enlace va DIRECTO al lead.
      url_lead: `${(env.FRONTEND_URL || '').replace(/\/$/, '')}/leads/${lead.id}`,
    });

    const resultado = await sendMailWithRetry({ to: [correo], subject: tituloDe(esReasignacion), htmlBody });

    // 4. Registrar el resultado
    if (resultado?.success) {
      await repo.marcarNotificacionEnviada(registro.id);
      logger.info('[LeadAsignadoNotifier] Notificación de asignación enviada.', {
        leadId: lead.id,
        empleadoId: empleado.id,
        esReasignacion: !!esReasignacion,
      });
      return { enviado: true };
    }

    await repo.marcarNotificacionError(registro.id, resultado?.errorMessage);
    logger.error('[LeadAsignadoNotifier] Falló el envío de la notificación de asignación.', {
      leadId: lead.id,
      empleadoId: empleado.id,
      errorCode: resultado?.errorCode,
    });
    return { enviado: false, motivo: 'error_envio' };

  } catch (error) {
    // Nunca propagar: el lead ya está guardado.
    logger.error('[LeadAsignadoNotifier] Error inesperado notificando asignación.', {
      leadId: lead?.id,
      empleadoId: empleado?.id,
      error: error.message,
    });
    return { enviado: false, motivo: 'error_inesperado' };
  }
}

function tituloDe(esReasignacion) {
  return esReasignacion
    ? 'Lead reasignado — CARGAR S.A.S.'
    : 'Nuevo Lead asignado — CARGAR S.A.S.';
}

// Una TRANSICIÓN concreta de asignación genera como mucho un envío.
// Incluye al empleado anterior para que A→B y B→A sean eventos distintos (ambos
// notifican), mientras que una petición repetida que no cambia el responsable
// produciría la misma clave y quedaría suprimida por ON CONFLICT DO NOTHING.
function dedupKeyDe(leadId, empleadoId, empleadoAnteriorId) {
  return `lead_asignacion:${leadId}:${empleadoId}:${empleadoAnteriorId || 'sin_asignar'}`;
}
