import { CertificadosRepository } from './certificados.repository.js';
import { CertificadoTemplateRepository } from './certificadoTemplate.repository.js';
import { generateCertificatePdf, generateCertificatePdfFromTemplate } from './certificadosPdf.generator.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

const repo = new CertificadosRepository();
const templateRepo = new CertificadoTemplateRepository();

export const certificadosController = {
  /**
   * GET /api/v1/certificados/admin/:id
   * Admin/RRHH downloads certificate for any employee.
   * Requires authentication (handled by middleware).
   */
  async downloadAdmin(req, res, next) {
    try {
      // RBAC: Solo roles admin, rrhh, gerencia pueden descargar certificados de otros empleados
      const allowedRoles = ['admin', 'rrhh', 'gerencia'];
      if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
        throw new AppError('No tiene permisos para descargar certificados de otros empleados.', 403);
      }

      const { id } = req.params;
      const { template_id, mostrar_salario } = req.query;
      const emp = await repo.getEmployeeForCertificate(id);
      if (!emp) throw new AppError('Empleado no encontrado', 404);

      logger.info('[Certificado] Generando certificado admin', { employeeId: id, name: emp.full_name, template_id });

      // Use dynamic template if template_id is provided
      if (template_id) {
        const template = await templateRepo.findById(template_id);
        if (!template) throw new AppError('Plantilla no encontrada', 404);

        const pdfBuffer = await generateCertificatePdfFromTemplate(emp, template, {
          mostrarSalario: mostrar_salario !== 'false',
          firmaNombre: req.user?.nombre || 'Robinson Alzate',
          firmaCargo: req.user?.rol_nombre || 'Administrador',
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Certificado_Laboral_${(emp.full_name || 'empleado').replace(/\s+/g, '_')}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
        return;
      }

      // Fallback: use default hardcoded template
      const pdfBuffer = await generateCertificatePdf(emp, {
        showSalary: mostrar_salario !== 'false',
        firmaNombre: req.user?.nombre || 'Robinson Alzate',
        firmaCargo: req.user?.rol_nombre || 'Administrador',
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Certificado_Laboral_${(emp.full_name || 'empleado').replace(/\s+/g, '_')}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);

      logger.info('[Certificado] PDF generado exitosamente', { employeeId: id });
    } catch (err) {
      logger.error('[Certificado] Error generando certificado admin', { error: err.message });
      next(err);
    }
  },

  /**
   * GET /api/v1/certificados/mi-certificado
   * Authenticated user downloads their own certificate.
   * Requires authentication (handled by middleware).
   */
  async downloadMiCertificado(req, res, next) {
    try {
      const userId = req.userId;
      if (!userId) throw new AppError('No autorizado', 401);

      const emp = await repo.getEmployeeByUserId(userId);
      if (!emp) throw new AppError('No se encontró un empleado vinculado a su cuenta', 404);
      if (emp.status !== 'Activo') throw new AppError('Su cuenta de empleado no se encuentra activa', 403);

      logger.info('[Certificado] Generando mi certificado', { userId, name: emp.full_name });

      const pdfBuffer = await generateCertificatePdf(emp, {
        showSalary: true,
        firmaNombre: 'Robinson Alzate',
        firmaCargo: 'Gerente General',
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Certificado_Laboral_${(emp.full_name || 'empleado').replace(/\s+/g, '_')}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);

      logger.info('[Certificado] PDF generado exitosamente', { userId });
    } catch (err) {
      logger.error('[Certificado] Error generando mi certificado', { error: err.message });
      next(err);
    }
  },
};
