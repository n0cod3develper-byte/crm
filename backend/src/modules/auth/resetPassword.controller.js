import bcrypt from 'bcryptjs';
import { query } from '../../config/database.js';
import { AppError } from '../../utils/errors.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { redis } from '../../config/redis.js';
import { sendMail } from '../../services/email/emailService.js';
import {
  generateResetToken,
  findUserByEmail,
  invalidatePreviousTokens,
  createResetToken,
  validateResetToken,
  markTokenUsed,
  updatePassword,
  invalidateAllSessions
} from './resetPassword.repository.js';

const TOKEN_EXPIRY_MINUTES = 15;

/**
 * POST /auth/forgot-password
 * Solicita un enlace de recuperación de contraseña.
 * Siempre retorna el mismo mensaje por prevención de enumeración.
 */
export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const genericMessage = 'Si el correo está registrado y activo, recibirás un enlace de recuperación en breve.';

    if (!email || typeof email !== 'string') {
      return res.json({ success: true, message: genericMessage });
    }

    const user = await findUserByEmail(email);

    // Si el usuario no existe o está inactivo, responder igual (no revelar)
    if (!user || user.estado !== 'ACTIVO') {
      // Retraso artificial para evitar timing attack
      await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
      return res.json({ success: true, message: genericMessage });
    }

    logger.info('Solicitud de recuperación recibida', { email: user.email, ip: req.ip });

    // Invalidar tokens anteriores del usuario
    await invalidatePreviousTokens(user.id);

    // Generar token y calcular expiración
    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

    // Guardar hash del token en BD
    await createResetToken(user.id, token, expiresAt, req.ip);

    // Construir enlace
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;

    // Enviar correo
    try {
      await sendMail({
        to: [user.email],
        subject: 'Recuperación de contraseña — CARGAR SAS CRM',
        htmlBody: buildResetEmailHtml(user.nombre, resetUrl, TOKEN_EXPIRY_MINUTES)
      });
      // Retraso artificial consistente para evitar timing attack
      await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
      logger.info('Correo de recuperación enviado', { userId: user.id, email: user.email });
    } catch (emailErr) {
      logger.error('Error enviando correo de recuperación', { userId: user.id, error: emailErr.message });
      // No revelar al usuario que falló el correo
    }

    return res.json({ success: true, message: genericMessage });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /auth/reset-password/validate/:token
 * Valida que el token exista, no haya expirado y no esté usado.
 * Solo retorna si el token es válido (para habilitar el formulario).
 */
export async function validateResetTokenEndpoint(req, res, next) {
  try {
    const { token } = req.params;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Token inválido' });
    }

    const tokenData = await validateResetToken(token);

    if (!tokenData) {
      return res.status(400).json({
        success: false,
        error: 'El enlace de recuperación es inválido o ha expirado. Solicita uno nuevo.'
      });
    }

    return res.json({ success: true, message: 'Token válido' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/reset-password
 * Aplica la nueva contraseña usando el token.
 */
export async function resetPassword(req, res, next) {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      throw new AppError('Token, nueva contraseña y confirmación son requeridos', 400);
    }

    if (newPassword !== confirmPassword) {
      throw new AppError('Las contraseñas no coinciden', 400);
    }

    if (newPassword.length < 8) {
      throw new AppError('La contraseña debe tener al menos 8 caracteres', 400);
    }

    // Validar token
    const tokenData = await validateResetToken(token);
    if (!tokenData) {
      logger.warn('Intento de reset con token inválido/expirado', { ip: req.ip });
      return res.status(400).json({
        success: false,
        error: 'El enlace de recuperación es inválido o ha expirado. Solicita uno nuevo.'
      });
    }

    const userId = tokenData.user_id;

    // Obtener datos del usuario para evitar misma contraseña y enviar confirmación
    const userResult = await query('SELECT password_hash, email, nombre FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    if (user && user.password_hash) {
      const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
      if (isSamePassword) {
        throw new AppError('La nueva contraseña no puede ser igual a la actual', 400);
      }
    }

    // Generar nuevo hash y actualizar
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    await updatePassword(userId, passwordHash);

    // Marcar token como usado
    await markTokenUsed(token);

    // Invalidar todas las sesiones activas del usuario
    await invalidateAllSessions(userId, redis);

    // Enviar correo de confirmación
    try {
      if (user && user.email) {
        await sendMail({
          to: [user.email],
          subject: 'Tu contraseña fue cambiada — CARGAR SAS CRM',
          htmlBody: buildConfirmationEmailHtml(user.nombre)
        });
      }
    } catch (emailErr) {
      logger.error('Error enviando correo de confirmación de cambio', { userId, error: emailErr.message });
    }

    logger.info('Solicitud de recuperación exitosa', { userId, ip: req.ip });

    return res.json({
      success: true,
      message: 'Contraseña actualizada correctamente. Ahora puedes iniciar sesión.'
    });
  } catch (err) {
    next(err);
  }
}

// ─── Helpers de plantillas HTML ───────────────────────────────

function buildResetEmailHtml(userName, resetUrl, expiryMinutes) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f4f6f9;">
<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">CARGAR SAS CRM</h1>
  </div>
  <div style="padding:32px;">
    <h2 style="color:#1e293b;font-size:18px;margin:0 0 16px;">Recuperación de contraseña</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Hola <strong>${userName || ''}</strong>,</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente botón para crear una nueva:</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">Restablecer contraseña</a>
    </div>
    <p style="color:#94a3b8;font-size:12px;line-height:1.5;">Este enlace expirará en <strong>${expiryMinutes} minutos</strong>. Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
  </div>
  <div style="padding:16px 32px;background:#f8fafc;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">© ${new Date().getFullYear()} CARGAR SAS — Este es un correo automático, no respondas a este mensaje.</p>
  </div>
</div>
</body>
</html>`;
}

function buildConfirmationEmailHtml(userName) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f4f6f9;">
<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:32px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">CARGAR SAS CRM</h1>
  </div>
  <div style="padding:32px;">
    <h2 style="color:#1e293b;font-size:18px;margin:0 0 16px;">Contraseña cambiada</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Hola <strong>${userName || ''}</strong>,</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Tu contraseña fue cambiada exitosamente.</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Si no realizaste este cambio, contacta al administrador del sistema de inmediato.</p>
  </div>
  <div style="padding:16px 32px;background:#f8fafc;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">© ${new Date().getFullYear()} CARGAR SAS — Este es un correo automático, no respondas a este mensaje.</p>
  </div>
</div>
</body>
</html>`;
}

export const resetPasswordController = {
  forgotPassword,
  validateResetTokenEndpoint,
  resetPassword
};

