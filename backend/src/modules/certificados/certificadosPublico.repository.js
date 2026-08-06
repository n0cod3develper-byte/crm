import { query } from '../../config/database.js';
import crypto from 'crypto';

export class CertificadosPublicoRepository {
  /**
   * Buscar empleado por nombre completo y número de documento
   * Devuelve solo si tiene correo_personal registrado
   */
  async findEmpleadoByNombreYDoc(nombreCompleto, numeroDoc) {
    const sql = `
      SELECT id, full_name, numero_documento, correo_personal, fecha_retiro, fecha_ingreso
      FROM employees
      WHERE LOWER(full_name) = LOWER($1)
        AND numero_documento = $2
        AND (correo_personal IS NOT NULL AND correo_personal != '')
    `;
    const result = await query(sql, [nombreCompleto, numeroDoc]);
    return result.rows[0] || null;
  }

  /**
   * Crear token OTP para verificación
   */
  async createOtpToken({ empleadoId, numeroDoc, correoEnviado, ipSolicitante, expiresMinutes = 10 }) {
    // Generar código OTP numérico de 6 dígitos
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const tokenHash = crypto.createHash('sha256').update(otpCode).digest('hex');

    // Invalidar tokens anteriores del mismo empleado
    await query(
      `UPDATE certificado_otp_tokens SET usado = TRUE WHERE empleado_id = $1 AND usado = FALSE`,
      [empleadoId]
    );

    const sql = `
      INSERT INTO certificado_otp_tokens (empleado_id, numero_doc, token_hash, correo_enviado, ip_solicitante, expires_at)
      VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' minutes')::INTERVAL)
      RETURNING id, expires_at
    `;
    const result = await query(sql, [empleadoId, numeroDoc, tokenHash, correoEnviado, ipSolicitante, String(expiresMinutes)]);

    return { otpCode, tokenId: result.rows[0].id, expiresAt: result.rows[0].expires_at };
  }

  /**
   * Validar código OTP
   */
  async validateOtpToken(tokenId, otpCode) {
    // Buscar el token
    const tokenResult = await query(
      `SELECT t.*, e.full_name, e.numero_documento, e.correo_personal, e.fecha_ingreso, e.fecha_retiro
       FROM certificado_otp_tokens t
       JOIN employees e ON e.id = t.empleado_id
       WHERE t.id = $1`,
      [tokenId]
    );

    if (tokenResult.rows.length === 0) return { valid: false, error: 'Token no encontrado' };

    const token = tokenResult.rows[0];

    // Verificar si ya fue usado
    if (token.usado) return { valid: false, error: 'Código ya utilizado' };

    // Verificar expiración
    if (new Date(token.expires_at) < new Date()) return { valid: false, error: 'Código expirado' };

    // Verificar intentos fallidos
    if (token.intentos_fallidos >= token.max_intentos) return { valid: false, error: 'Demasiados intentos' };

    // Verificar código
    const inputHash = crypto.createHash('sha256').update(otpCode).digest('hex');
    if (inputHash !== token.token_hash) {
      // Incrementar intentos fallidos
      await query(
        `UPDATE certificado_otp_tokens SET intentos_fallidos = intentos_fallidos + 1 WHERE id = $1`,
        [tokenId]
      );
      return { valid: false, error: 'Código incorrecto' };
    }

    // Marcar como usado
    await query(
      `UPDATE certificado_otp_tokens SET usado = TRUE WHERE id = $1`,
      [tokenId]
    );

    return {
      valid: true,
      empleado: {
        id: token.empleado_id,
        nombre: token.full_name,
        numeroDocumento: token.numero_documento,
        fechaIngreso: token.fecha_ingreso,
        fechaRetiro: token.fecha_retiro
      }
    };
  }

  /**
   * Obtener datos del empleado para generar certificado
   */
  async getDatosCertificado(empleadoId) {
    const sql = `
      SELECT
        e.id, e.full_name, e.numero_documento, e.tipo_documento,
        e.position, e.fecha_ingreso, e.fecha_retiro, e.tipo_contrato,
        e.salario, e.correo_personal
      FROM employees e
      WHERE e.id = $1
    `;
    const result = await query(sql, [empleadoId]);
    return result.rows[0] || null;
  }
}
