import { CertificadoTemplateRepository } from './certificadoTemplate.repository.js';
import { AppError, NotFoundError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

const repo = new CertificadoTemplateRepository();

// Helper: RBAC check for template CRUD
function checkTemplateAccess(userRole) {
  const allowed = ['admin', 'rrhh', 'gerencia'];
  if (!allowed.includes(userRole)) {
    const err = new AppError('Solo roles Administrador, RRHH o Gerencia pueden gestionar plantillas.', 403);
    throw err;
  }
}

export const certificadoTemplateController = {
  /**
   * GET /api/v1/certificados/templates
   * List all active templates.
   */
  async listar(req, res, next) {
    try {
      const templates = await repo.findAll();
      res.json({ success: true, data: templates });
    } catch (err) { next(err); }
  },

  /**
   * GET /api/v1/certificados/templates/variables
   * Get available variables for template editing.
   */
  async getVariables(req, res, next) {
    try {
      const variables = repo.getAvailableVariables();
      res.json({ success: true, data: variables });
    } catch (err) { next(err); }
  },

  /**
   * GET /api/v1/certificados/templates/:id
   * Get a single template by ID.
   */
  async obtener(req, res, next) {
    try {
      const template = await repo.findById(req.params.id);
      if (!template) throw new NotFoundError('Plantilla');
      res.json({ success: true, data: template });
    } catch (err) { next(err); }
  },

  /**
   * POST /api/v1/certificados/templates
   * Create a new template (admin/rrhh/gerencia only).
   */
  async crear(req, res, next) {
    try {
      checkTemplateAccess(req.user?.role);
      const { nombre, descripcion, contenido, variables_disponibles, es_predeterminada } = req.body;
      if (!nombre || !contenido) throw new AppError('Nombre y contenido son requeridos', 400);
      
      const template = await repo.create({
        nombre,
        descripcion,
        contenido,
        variables_disponibles: variables_disponibles || '[]',
        es_predeterminada,
        creado_por: req.userId,
      });
      
      res.status(201).json({ success: true, data: template });
    } catch (err) { next(err); }
  },

  /**
   * PATCH /api/v1/certificados/templates/:id
   * Update a template (creates new version).
   */
  async actualizar(req, res, next) {
    try {
      checkTemplateAccess(req.user?.role);
      const template = await repo.update(req.params.id, req.body, req.userId);
      if (!template) throw new NotFoundError('Plantilla');
      res.json({ success: true, data: template });
    } catch (err) { next(err); }
  },

  /**
   * DELETE /api/v1/certificados/templates/:id
   * Soft-delete a template (set activa = FALSE).
   */
  async eliminar(req, res, next) {
    try {
      checkTemplateAccess(req.user?.role);
      const template = await repo.deactivate(req.params.id);
      if (!template) throw new NotFoundError('Plantilla');
      res.json({ success: true, message: 'Plantilla desactivada' });
    } catch (err) { next(err); }
  },

  /**
   * GET /api/v1/certificados/templates/:id/versiones
   * Get version history for a template.
   */
  async getVersiones(req, res, next) {
    try {
      const versions = await repo.getVersions(req.params.id);
      res.json({ success: true, data: versions });
    } catch (err) { next(err); }
  },
};
