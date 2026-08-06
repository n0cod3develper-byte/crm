import { z } from 'zod';
import { emailMarketingRepository as repo } from './email-marketing.repository.js';
import { prepararCampana, getTrackingPixel, compilarPruebaPlantilla } from './email-marketing.service.js';
import { sendMailWithRetry } from '../../services/email/emailService.js';
import { logger } from '../../utils/logger.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';

// ─── Schemas de validación ────────────────────────────────────

const listaSchema = z.object({
  nombre: z.string().min(2, 'Nombre requerido'),
  descripcion: z.string().optional().nullable(),
  criterio_segmentacion: z.any().optional(),
});

const contactoSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido'),
  correo: z.string().email('Correo inválido'),
  empresa_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  estado: z.enum(['activo', 'baja', 'rebotado']).optional(),
  origen: z.enum(['manual', 'importado_crm', 'importado_empresa', 'formulario']).optional(),
  consentimiento_tipo: z.enum(['explicito', 'relacion_comercial', 'pendiente']).optional(),
  consentimiento_fuente: z.string().optional().nullable(),
});

const plantillaSchema = z.object({
  nombre: z.string().min(2, 'Nombre requerido'),
  asunto: z.string().min(2, 'Asunto requerido'),
  cuerpo_handlebars: z.string().min(10, 'Cuerpo requerido'),
  variables_disponibles: z.array(z.string()).optional(),
});

const campanaSchema = z.object({
  nombre: z.string().min(2, 'Nombre requerido'),
  plantilla_id: z.string().uuid('plantilla_id debe ser UUID'),
  lista_id: z.string().uuid('lista_id debe ser UUID'),
  estado: z.enum(['borrador', 'programada', 'cancelada']).optional(),
  programada_para: z.string().datetime().optional().nullable(),
});

// ─── Helpers ─────────────────────────────────────────────────

function handleZodError(err, res) {
  return res.status(400).json({
    success: false,
    error: { message: 'Validación fallida', details: err.errors },
  });
}

// ════════════════════════════════════════════════════════════
// CONTROLADORES
// ════════════════════════════════════════════════════════════

export const emailMarketingController = {

  // ── LISTAS ──────────────────────────────────────────────────

  async getListas(req, res, next) {
    try {
      const { search, limit, offset } = req.query;
      const result = await repo.getListas({
        search: search || '',
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0,
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async getListaById(req, res, next) {
    try {
      const lista = await repo.getListaById(req.params.id);
      if (!lista) throw new NotFoundError('Lista');
      res.json({ success: true, data: lista });
    } catch (err) { next(err); }
  },

  async createLista(req, res, next) {
    try {
      const data = listaSchema.parse(req.body);
      const lista = await repo.createLista(data);
      res.status(201).json({ success: true, data: lista });
    } catch (err) {
      if (err instanceof z.ZodError) return handleZodError(err, res);
      next(err);
    }
  },

  async updateLista(req, res, next) {
    try {
      const data = listaSchema.partial().parse(req.body);
      const lista = await repo.updateLista(req.params.id, data);
      if (!lista) throw new NotFoundError('Lista');
      res.json({ success: true, data: lista });
    } catch (err) {
      if (err instanceof z.ZodError) return handleZodError(err, res);
      next(err);
    }
  },

  async deleteLista(req, res, next) {
    try {
      const deleted = await repo.deleteLista(req.params.id);
      if (!deleted) throw new NotFoundError('Lista');
      res.json({ success: true, data: { id: req.params.id } });
    } catch (err) { next(err); }
  },

  async getContactosDeLista(req, res, next) {
    try {
      const contactos = await repo.getContactosDeLista(req.params.id);
      res.json({ success: true, data: contactos });
    } catch (err) { next(err); }
  },

  async importarContactosEmpresa(req, res, next) {
    try {
      const { empresa_id } = req.body;
      if (!empresa_id) throw new BadRequestError('empresa_id es requerido');
      const result = await repo.importarDesdeEmpresa(empresa_id, req.params.id);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  async agregarContactoALista(req, res, next) {
    try {
      const { contacto_id } = req.body;
      if (!contacto_id) throw new BadRequestError('contacto_id es requerido');
      await repo.agregarContactoALista(req.params.id, contacto_id);
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  async quitarContactoDeLista(req, res, next) {
    try {
      await repo.quitarContactoDeLista(req.params.id, req.params.contactoId);
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  // ── CONTACTOS ───────────────────────────────────────────────

  async getContactos(req, res, next) {
    try {
      const { search, estado, lista_id, limit, offset } = req.query;
      const result = await repo.getContactos({
        search: search || '',
        estado: estado || null,
        lista_id: lista_id || null,
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0,
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async getContactoById(req, res, next) {
    try {
      const contacto = await repo.getContactoById(req.params.id);
      if (!contacto) throw new NotFoundError('Contacto');
      res.json({ success: true, data: contacto });
    } catch (err) { next(err); }
  },

  async createContacto(req, res, next) {
    try {
      const data = contactoSchema.parse(req.body);
      const existe = await repo.getContactoByCorreo(data.correo);
      if (existe) {
        return res.status(409).json({
          success: false,
          error: { message: `Ya existe un contacto con el correo ${data.correo}` },
        });
      }
      const contacto = await repo.createContacto(data);
      res.status(201).json({ success: true, data: contacto });
    } catch (err) {
      if (err instanceof z.ZodError) return handleZodError(err, res);
      next(err);
    }
  },

  async updateContacto(req, res, next) {
    try {
      const data = contactoSchema.partial().parse(req.body);
      const contacto = await repo.updateContacto(req.params.id, data);
      if (!contacto) throw new NotFoundError('Contacto');
      res.json({ success: true, data: contacto });
    } catch (err) {
      if (err instanceof z.ZodError) return handleZodError(err, res);
      next(err);
    }
  },

  async deleteContacto(req, res, next) {
    try {
      const deleted = await repo.deleteContacto(req.params.id);
      if (!deleted) throw new NotFoundError('Contacto');
      res.json({ success: true, data: { id: req.params.id } });
    } catch (err) { next(err); }
  },

  // ── PLANTILLAS ──────────────────────────────────────────────

  async getPlantillas(req, res, next) {
    try {
      const { search, limit, offset } = req.query;
      const data = await repo.getPlantillas({
        search: search || '',
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async getPlantillaById(req, res, next) {
    try {
      const plantilla = await repo.getPlantillaById(req.params.id);
      if (!plantilla) throw new NotFoundError('Plantilla');
      res.json({ success: true, data: plantilla });
    } catch (err) { next(err); }
  },

  async createPlantilla(req, res, next) {
    try {
      const data = plantillaSchema.parse(req.body);
      const plantilla = await repo.createPlantilla(data);
      res.status(201).json({ success: true, data: plantilla });
    } catch (err) {
      if (err instanceof z.ZodError) return handleZodError(err, res);
      next(err);
    }
  },

  async updatePlantilla(req, res, next) {
    try {
      const data = plantillaSchema.partial().parse(req.body);
      const plantilla = await repo.updatePlantilla(req.params.id, data);
      if (!plantilla) throw new NotFoundError('Plantilla');
      res.json({ success: true, data: plantilla });
    } catch (err) {
      if (err instanceof z.ZodError) return handleZodError(err, res);
      next(err);
    }
  },

  async deletePlantilla(req, res, next) {
    try {
      const deleted = await repo.deletePlantilla(req.params.id);
      if (!deleted) throw new NotFoundError('Plantilla');
      res.json({ success: true, data: { id: req.params.id } });
    } catch (err) { next(err); }
  },

  // ── CAMPAÑAS ────────────────────────────────────────────────

  async getCampanas(req, res, next) {
    try {
      const { search, estado, limit, offset } = req.query;
      const data = await repo.getCampanas({
        search: search || '',
        estado: estado || null,
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async getCampanaById(req, res, next) {
    try {
      const campana = await repo.getCampanaById(req.params.id);
      if (!campana) throw new NotFoundError('Campaña');
      res.json({ success: true, data: campana });
    } catch (err) { next(err); }
  },

  async createCampana(req, res, next) {
    try {
      const data = campanaSchema.parse(req.body);
      const campana = await repo.createCampana(data, req.userId);
      res.status(201).json({ success: true, data: campana });
    } catch (err) {
      if (err instanceof z.ZodError) return handleZodError(err, res);
      next(err);
    }
  },

  async updateCampana(req, res, next) {
    try {
      const campana = await repo.getCampanaById(req.params.id);
      if (!campana) throw new NotFoundError('Campaña');
      if (['enviando', 'completada'].includes(campana.estado)) {
        throw new BadRequestError('No se puede editar una campaña en estado enviando o completada');
      }
      const data = campanaSchema.partial().parse(req.body);
      const updated = await repo.updateCampana(req.params.id, data);
      res.json({ success: true, data: updated });
    } catch (err) {
      if (err instanceof z.ZodError) return handleZodError(err, res);
      next(err);
    }
  },

  async deleteCampana(req, res, next) {
    try {
      const campana = await repo.getCampanaById(req.params.id);
      if (!campana) throw new NotFoundError('Campaña');
      if (campana.estado === 'enviando') {
        throw new BadRequestError('No se puede eliminar una campaña que está enviando');
      }
      const deleted = await repo.deleteCampana(req.params.id);
      res.json({ success: true, data: { id: req.params.id } });
    } catch (err) { next(err); }
  },

  async enviarCampana(req, res, next) {
    try {
      const campana = await repo.getCampanaById(req.params.id);
      if (!campana) throw new NotFoundError('Campaña');
      if (!['borrador', 'programada'].includes(campana.estado)) {
        throw new BadRequestError(`No se puede enviar una campaña en estado "${campana.estado}"`);
      }

      const total = await prepararCampana(campana);
      logger.info(`[EmailMarketing] Campaña ${campana.nombre} lista para enviar (${total} envíos)`);

      res.json({ success: true, data: { total_envios: total, mensaje: 'Campaña en cola de envío' } });
    } catch (err) { next(err); }
  },

  async cancelarCampana(req, res, next) {
    try {
      const campana = await repo.getCampanaById(req.params.id);
      if (!campana) throw new NotFoundError('Campaña');
      if (campana.estado === 'completada') {
        throw new BadRequestError('No se puede cancelar una campaña ya completada');
      }
      const updated = await repo.updateCampana(req.params.id, { estado: 'cancelada' });
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  },

  async getEnviosDeCampana(req, res, next) {
    try {
      const { estado, limit, offset } = req.query;
      const data = await repo.getEnviosDeCampana(req.params.id, {
        estado: estado || null,
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  // ── TRACKING (PÚBLICOS, sin auth) ───────────────────────────

  async trackOpen(req, res) {
    const { envio_id } = req.params;
    try {
      await repo.registrarApertura(envio_id);
    } catch (err) {
      logger.warn(`[EmailMarketing] Error registrando apertura ${envio_id}`, { error: err.message });
    }
    // Siempre devolver el pixel, incluso si falla el registro
    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': TRACKING_PIXEL_LENGTH,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    });
    res.end(getTrackingPixel());
  },

  async trackClick(req, res, next) {
    const { envio_id } = req.params;
    const { url } = req.query;

    if (!url) return res.status(400).send('URL requerida');

    try {
      const decoded = decodeURIComponent(url);
      await repo.registrarClick(envio_id, decoded);
      return res.redirect(302, decoded);
    } catch (err) {
      logger.warn(`[EmailMarketing] Error registrando clic ${envio_id}`, { error: err.message });
      // Redirigir de todas formas
      try {
        return res.redirect(302, decodeURIComponent(url));
      } catch {
        return res.status(400).send('URL inválida');
      }
    }
  },

  async unsubscribePage(req, res, next) {
    const { token } = req.params;
    try {
      const contacto = await repo.getContactoByToken(token);
      if (!contacto) {
        return res.status(404).send(renderUnsubscribePage('not_found', null));
      }
      if (contacto.estado === 'baja') {
        return res.send(renderUnsubscribePage('already_unsubscribed', contacto));
      }
      return res.send(renderUnsubscribePage('confirm', contacto));
    } catch (err) {
      next(err);
    }
  },

  async confirmarUnsubscribe(req, res, next) {
    const { token } = req.params;
    const { motivo } = req.body;
    try {
      const contacto = await repo.getContactoByToken(token);
      if (!contacto) {
        return res.status(404).json({ success: false, error: 'Token inválido' });
      }
      if (contacto.estado !== 'baja') {
        await repo.marcarContactoBaja(contacto.id, null, motivo || 'Solicitud del usuario');
      }
      return res.send(renderUnsubscribePage('done', contacto));
    } catch (err) {
      next(err);
    }
  },

  // ── ENVÍO DE PRUEBA ──────────────────────────────────────────

  /**
   * POST /plantillas/:id/prueba
   * Envía un correo de prueba al email del usuario autenticado.
   * Usa datos ficticios para las variables. No crea registros en email_envios.
   */
  async enviarPruebaDePlantilla(req, res, next) {
    const { id } = req.params;
    const usuarioCorreo = req.user?.email;
    if (!usuarioCorreo) {
      return res.status(400).json({ success: false, error: { message: 'No se encontró el email del usuario autenticado.' } });
    }
    try {
      const plantilla = await repo.getPlantillaById(id);
      if (!plantilla) throw new NotFoundError('Plantilla no encontrada');

      const { asunto, htmlBody } = compilarPruebaPlantilla(plantilla, usuarioCorreo);
      const result = await sendMailWithRetry({ to: [usuarioCorreo], subject: asunto, htmlBody });

      if (!result.success) {
        return res.status(502).json({ success: false, error: { message: `Error al enviar: ${result.errorMessage}` } });
      }
      logger.info(`[EmailMarketing] Prueba de plantilla "${plantilla.nombre}" enviada a ${usuarioCorreo}`);
      return res.json({ success: true, message: `Correo de prueba enviado a ${usuarioCorreo}` });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /campanas/:id/prueba
   * Envía un correo de prueba al email del usuario autenticado usando
   * la plantilla de la campaña. No crea registros en email_envios.
   */
  async enviarPruebaDeCampana(req, res, next) {
    const { id } = req.params;
    const usuarioCorreo = req.user?.email;
    if (!usuarioCorreo) {
      return res.status(400).json({ success: false, error: { message: 'No se encontró el email del usuario autenticado.' } });
    }
    try {
      const campana = await repo.getCampanaById(id);
      if (!campana) throw new NotFoundError('Campaña no encontrada');

      const plantilla = await repo.getPlantillaById(campana.plantilla_id);
      if (!plantilla) throw new NotFoundError('Plantilla de la campaña no encontrada');

      const { asunto, htmlBody } = compilarPruebaPlantilla(plantilla, usuarioCorreo);
      const result = await sendMailWithRetry({ to: [usuarioCorreo], subject: asunto, htmlBody });

      if (!result.success) {
        return res.status(502).json({ success: false, error: { message: `Error al enviar: ${result.errorMessage}` } });
      }
      logger.info(`[EmailMarketing] Prueba de campaña "${campana.nombre}" enviada a ${usuarioCorreo}`);
      return res.json({ success: true, message: `Correo de prueba enviado a ${usuarioCorreo}` });
    } catch (err) {
      next(err);
    }
  },
};

// Tamaño del tracking pixel (constante)
const TRACKING_PIXEL_LENGTH = 43;

/**
 * Renderiza la página HTML pública de unsubscribe (sin framework)
 */
function renderUnsubscribePage(estado, contacto) {
  const mensajes = {
    confirm: {
      titulo: 'Solicitud de baja',
      cuerpo: `
        <p>Hola <strong>${contacto?.nombre || ''}</strong>,</p>
        <p>¿Confirmas que no deseas recibir más correos de CARGAR S.A.S.?</p>
        <form method="POST" style="margin-top:24px;">
          <label style="display:block;margin-bottom:12px;">Motivo (opcional):</label>
          <select name="motivo" style="width:100%;padding:10px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:16px;">
            <option value="">Seleccionar...</option>
            <option>No me interesa el contenido</option>
            <option>Recibo demasiados correos</option>
            <option>No recuerdo haberme suscrito</option>
            <option>Otro</option>
          </select>
          <button type="submit" style="background:#e53e3e;color:white;padding:12px 24px;border:none;border-radius:8px;cursor:pointer;font-size:16px;width:100%;">
            Confirmar baja
          </button>
        </form>`,
      color: '#e53e3e',
    },
    done: {
      titulo: '✓ Baja registrada',
      cuerpo: `<p>Has sido dado de baja exitosamente. No recibirás más correos de CARGAR S.A.S.</p>
               <p style="margin-top:16px;color:#718096;font-size:14px;">Si esto fue un error, contacta a <a href="mailto:servicioalcliente@cargar.com.co" style="color:#718096;">servicioalcliente@cargar.com.co</a></p>`,
      color: '#48bb78',
    },
    already_unsubscribed: {
      titulo: 'Ya estás dado de baja',
      cuerpo: `<p>Tu correo ya estaba en nuestra lista de bajas. No recibirás más correos.</p>`,
      color: '#718096',
    },
    not_found: {
      titulo: 'Enlace inválido',
      cuerpo: `<p>El enlace de baja no es válido o ya fue utilizado.</p>`,
      color: '#e53e3e',
    },
  };

  const m = mensajes[estado] || mensajes.not_found;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${m.titulo} — CARGAR S.A.S.</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #f7fafc; min-height: 100vh; display: flex;
           align-items: center; justify-content: center; padding: 24px; }
    .card { background: white; border-radius: 16px; padding: 40px;
            max-width: 480px; width: 100%;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .logo { font-size: 22px; font-weight: 700; color: #2d3748; margin-bottom: 24px; }
    .badge { display: inline-block; width: 48px; height: 48px; border-radius: 50%;
             background: ${m.color}20; margin-bottom: 20px; line-height: 48px;
             text-align: center; font-size: 24px; }
    h1 { font-size: 20px; color: #2d3748; margin-bottom: 16px; }
    p { color: #4a5568; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">CARGAR S.A.S.</div>
    <h1>${m.titulo}</h1>
    ${m.cuerpo}
  </div>
</body>
</html>`;
}
