import crypto from 'crypto';
import { CertificadosPublicoRepository } from './certificadosPublico.repository.js';
import { sendMail } from '../../services/email/emailService.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../utils/errors.js';
import { CertificadoTemplateRepository } from './certificadoTemplate.repository.js';
import { query } from '../../config/database.js';
import { generateCertificatePdfFromTemplate } from './certificadosPdf.generator.js';

const repo = new CertificadosPublicoRepository();
const templateRepo = new CertificadoTemplateRepository();

// Respuesta genérica para evitar enumeración de usuarios
const GENERIC_MSG = 'Si los datos son correctos, se ha enviado un código de verificación a tu correo registrado.';

export const certificadosPublicoController = {
  /**
   * POST /api/v1/certificados-publico/solicitar
   * Recibe nombre completo + número de documento
   * Si coincide y tiene correo_personal, envía OTP
   */
  async solicitar(req, res, next) {
    try {
      const { nombre_completo, numero_documento } = req.body;

      if (!nombre_completo || !numero_documento) {
        throw new AppError('Nombre completo y número de documento son requeridos.', 400);
      }

      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

      // Buscar empleado (solo si tiene correo_personal)
      const empleado = await repo.findEmpleadoByNombreYDoc(nombre_completo, numero_documento);

      // Siempre devolver la misma respuesta para evitar enumeración
      if (!empleado) {
        // Log para auditoría (sin exponer datos sensibles)
        logger.info('Solicitud certificado público - datos no válidos', { ip, numero_documento: numero_documento.slice(-4) });
        return res.json({ success: true, message: GENERIC_MSG });
      }

      // Generar y enviar OTP
      const { otpCode, tokenId, expiresAt } = await repo.createOtpToken({
        empleadoId: empleado.id,
        numeroDoc: numero_documento,
        correoEnviado: empleado.correo_personal,
        ipSolicitante: ip,
        expiresMinutes: 10
      });

      // Enviar código por correo
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a1a2e; padding: 20px; text-align: center;">
            <h1 style="color: #fff; font-size: 18px;">CARGAR S.A.S.</h1>
          </div>
          <div style="padding: 30px; background: #f9fafb;">
            <h2 style="color: #1f2937; font-size: 16px;">Código de Verificación</h2>
            <p style="color: #4b5563;">Hola,</p>
            <p style="color: #4b5563;">Has solicitado descargar tu certificado laboral. Utiliza el siguiente código:</p>
            <div style="background: #fff; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #1a1a2e; letter-spacing: 8px;">${otpCode}</span>
            </div>
            <p style="color: #6b7280; font-size: 13px;">Este código expira en 10 minutos.</p>
            <p style="color: #6b7280; font-size: 13px;">Si no solicitaste este certificado, puedes ignorar este mensaje.</p>
          </div>
          <div style="padding: 15px; text-align: center; color: #9ca3af; font-size: 11px;">
            <p>CARGAR S.A.S. - Sistema CRM</p>
          </div>
        </div>
      `;

      const emailResult = await sendMail({
        to: [empleado.correo_personal],
        subject: 'Código de Verificación - Certificado Laboral CARGAR',
        htmlBody
      });

      if (!emailResult.success) {
        logger.error('Error enviando OTP certificado', { error: emailResult.errorMessage });
        // No revelar error de envío - devolver respuesta genérica
      }

      // Log de auditoría
      logger.info('Solicitud certificado público - OTP enviado', {
        empleadoId: empleado.id,
        correo: empleado.correo_personal.replace(/(.{2}).*(@.*)/, '$1***$2'),
        ip
      });

      return res.json({
        success: true,
        message: GENERIC_MSG,
        data: { tokenId, expiresAt }
      });

    } catch (err) { next(err); }
  },

  /**
   * POST /api/v1/certificados-publico/validar-otp
   * Valida el código OTP y devuelve token de descarga si es válido
   */
  async validarOtp(req, res, next) {
    try {
      const { token_id, codigo } = req.body;

      if (!token_id || !codigo) {
        throw new AppError('Token y código son requeridos.', 400);
      }

      const result = await repo.validateOtpToken(token_id, codigo);

      if (!result.valid) {
        logger.info('Intento OTP certificado fallido', { token_id, error: result.error });
        throw new AppError(result.error, 401);
      }

      // Generar token de descarga (corta duración)
      const downloadToken = crypto.randomBytes(32).toString('hex');

      // Almacenar temporalmente el token de descarga (5 minutos)
      const sql = `
        UPDATE certificado_otp_tokens
        SET token_hash = $1, expires_at = NOW() + INTERVAL '5 minutes'
        WHERE id = $2
        RETURNING id
      `;
      await query(sql, [crypto.createHash('sha256').update(downloadToken).digest('hex'), token_id]);

      logger.info('OTP certificado validado', { empleadoId: result.empleado.id });

      return res.json({
        success: true,
        data: {
          downloadToken,
          empleado: {
            nombre: result.empleado.nombre,
            fechaIngreso: result.empleado.fechaIngreso,
            fechaRetiro: result.empleado.fechaRetiro
          }
        }
      });

    } catch (err) { next(err); }
  },

  /**
   * GET /api/v1/certificados-publico/descargar/:downloadToken
   * Descarga el certificado PDF SIN salario
   */
  async descargar(req, res, next) {
    try {
      const { downloadToken } = req.params;

      if (!downloadToken) throw new AppError('Token de descarga requerido.', 400);

      // Validar token de descarga
      const tokenHash = crypto.createHash('sha256').update(downloadToken).digest('hex');

      const sql = `
        SELECT t.empleado_id
        FROM certificado_otp_tokens t
        WHERE t.token_hash = $1
          AND t.usado = TRUE
          AND t.expires_at > NOW()
      `;
      const result = await query(sql, [tokenHash]);

      if (result.rows.length === 0) {
        throw new AppError('Token de descarga inválido o expirado.', 401);
      }

      const empleadoId = result.rows[0].empleado_id;

      // Obtener datos del empleado
      const empleado = await repo.getDatosCertificado(empleadoId);
      if (!empleado) throw new AppError('Empleado no encontrado.', 404);

      // Obtener plantilla predeterminada
      const template = await templateRepo.findDefault();
      if (!template) throw new AppError('No hay plantilla de certificado disponible.', 500);

      // Preparar variables (SIN salario en el flujo público)
      const variables = {
        nombre_completo: empleado.full_name,
        numero_documento: empleado.numero_documento,
        tipo_documento: empleado.tipo_documento || 'Cédula de Ciudadanía',
        cargo: empleado.position || 'No especificado',
        fecha_ingreso: empleado.fecha_ingreso ? new Date(empleado.fecha_ingreso).toLocaleDateString('es-CO') : 'No registra',
        fecha_terminacion: empleado.fecha_retiro ? new Date(empleado.fecha_retiro).toLocaleDateString('es-CO') : 'No aplica',
        tipo_contrato: empleado.tipo_contrato || 'No especificado',
        mostrar_salario: false, // SIEMPRE false en el flujo público
        salario: '', // Nunca mostrar en portal público
        fecha_expedicion: new Date().toLocaleDateString('es-CO'),
        firma_nombre: '',
        firma_cargo: ''
      };

      // Generar PDF
      const pdfBuffer = await generateCertificatePdfFromTemplate(template, variables);

      // Invalidar token de descarga
      await query(`DELETE FROM certificado_otp_tokens WHERE empleado_id = $1 AND usado = TRUE`, [empleadoId]);

      // Log de auditoría
      logger.info('Certificado descargado via portal publico', { empleadoId, ip: req.ip });

      // Enviar PDF
      res.setHeader('Content-Type', 'application/pdf');
      const safeName = (empleado.full_name || 'empleado').replace(/\s+/g, '_');
      res.setHeader('Content-Disposition', `attachment; filename="certificado_${safeName}.pdf"`);
      return res.send(pdfBuffer);

    } catch (err) { next(err); }
  }
};
