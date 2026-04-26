import { Webhook } from 'svix';
import { query } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { invalidarCacheUsuario } from '../../middleware/auth.js';

/**
 * Procesa webhooks de Clerk para sincronizar usuarios
 * POST /api/v1/webhooks/clerk
 */
export async function handleClerkWebhook(req, res) {
  const WEBHOOK_SECRET = env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    logger.error('CLERK_WEBHOOK_SECRET no configurado');
    return res.status(500).json({ error: 'Webhook secret no configurado' });
  }

  // Obtener headers de svix
  const svix_id = req.headers['svix-id'];
  const svix_timestamp = req.headers['svix-timestamp'];
  const svix_signature = req.headers['svix-signature'];

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({ error: 'Faltan headers de svix' });
  }

  // Obtener el body (asumiendo que express.json() ya lo procesó)
  const payload = JSON.stringify(req.body);
  const headers = {
    'svix-id': svix_id,
    'svix-timestamp': svix_timestamp,
    'svix-signature': svix_signature,
  };

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt;

  try {
    evt = wh.verify(payload, headers);
  } catch (err) {
    logger.error('Error verificando firma de webhook', { error: err.message });
    return res.status(400).json({ error: 'Firma inválida' });
  }

  const { id } = evt.data;
  const eventType = evt.type;

  logger.info(`Evento de Clerk recibido: ${eventType}`, { clerk_id: id });

  try {
    switch (eventType) {
      case 'user.created': {
        const { id: clerk_id, first_name, last_name, email_addresses, image_url, public_metadata } = evt.data;
        const email = email_addresses[0]?.email_address;
        const pending_rol_id = public_metadata?.pending_rol_id || null;
        
        // Insertar usuario en la BD
        const sql = `
          INSERT INTO users (clerk_user_id, nombre, apellido, email, avatar_url, rol_id)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (clerk_user_id) DO UPDATE SET
            nombre = EXCLUDED.nombre,
            apellido = EXCLUDED.apellido,
            email = EXCLUDED.email,
            avatar_url = EXCLUDED.avatar_url,
            rol_id = COALESCE(users.rol_id, EXCLUDED.rol_id),
            estado = 'ACTIVO',
            updated_at = NOW()
        `;
        await query(sql, [clerk_id, first_name, last_name, email, image_url, pending_rol_id]);
        logger.info('Usuario creado/sincronizado desde Clerk', { clerk_id, email, assigned_role: pending_rol_id });
        break;
      }

      case 'user.updated': {
        const { id: clerk_id, first_name, last_name, email_addresses, image_url } = evt.data;
        const email = email_addresses[0]?.email_address;

        const sql = `
          UPDATE users SET
            nombre = $2,
            apellido = $3,
            email = $4,
            avatar_url = $5,
            updated_at = NOW()
          WHERE clerk_user_id = $1
        `;
        await query(sql, [clerk_id, first_name, last_name, email, image_url]);
        invalidarCacheUsuario(clerk_id);
        logger.info('Usuario actualizado desde Clerk', { clerk_id });
        break;
      }

      case 'user.deleted': {
        const { id: clerk_id } = evt.data;
        
        // No eliminamos físicamente para mantener integridad referencial
        const sql = `UPDATE users SET estado = 'INACTIVO', updated_at = NOW() WHERE clerk_user_id = $1`;
        await query(sql, [clerk_id]);
        invalidarCacheUsuario(clerk_id);
        logger.info('Usuario marcado como inactivo desde Clerk', { clerk_id });
        break;
      }

      default:
        logger.debug(`Evento no manejado: ${eventType}`);
    }

    // Clerk espera una respuesta 200 para confirmar recepción
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error('Error procesando evento de webhook', { eventType, error: err.message });
    // Retornamos 200 igual para evitar reintentos infinitos si es un error de lógica nuestro,
    // o 500 si queremos que Clerk reintente (Clerk reintenta hasta 3 veces).
    // Usaremos 200 por ahora para cumplir con el requerimiento de "evitar bucles".
    return res.status(200).json({ success: false, error: 'Error interno en procesamiento' });
  }
}
