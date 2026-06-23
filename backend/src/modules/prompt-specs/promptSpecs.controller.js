import * as promptSpecService from '../../services/promptSpecService.js';
import { logger } from '../../utils/logger.js';

export const promptSpecsController = {
  /**
   * POST /api/prompt-specs
   * Crea un nuevo prompt spec y ensambla el prompt en el servidor.
   */
  async create(req, res, next) {
    try {
      const data = req.body;
      const record = await promptSpecService.createPromptSpec(data, req.userId);
      res.status(201).json(record);
    } catch (error) {
      logger.error('Error creating prompt spec', {
        promptSpecId: null,
        nombreModulo: req.body?.nombreModulo,
        error: error.message,
      });
      next(error);
    }
  },

  /**
   * GET /api/prompt-specs
   * Lista el historial paginado.
   */
  async list(req, res, next) {
    try {
      const { page, limit, area, search } = req.query;
      const result = await promptSpecService.listPromptSpecs({ page, limit, area, search });
      res.json(result);
    } catch (error) {
      logger.error('Error listing prompt specs', { error: error.message });
      next(error);
    }
  },

  /**
   * GET /api/prompt-specs/:id
   * Devuelve un registro completo.
   */
  async getById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'ID invalido' });

      const record = await promptSpecService.getPromptSpecById(id);
      if (!record) return res.status(404).json({ error: 'Prompt spec no encontrado' });

      res.json(record);
    } catch (error) {
      logger.error('Error getting prompt spec', { promptSpecId: req.params.id, error: error.message });
      next(error);
    }
  },

  /**
   * POST /api/prompt-specs/:id/clonar
   * Devuelve los datos del original para precargar el formulario.
   * No inserta nada en BD.
   */
  async clone(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'ID invalido' });

      const original = await promptSpecService.getPromptSpecById(id);
      if (!original) return res.status(404).json({ error: 'Prompt spec original no encontrado' });

      res.json(original);
    } catch (error) {
      logger.error('Error cloning prompt spec', { promptSpecId: req.params.id, error: error.message });
      next(error);
    }
  },

  /**
   * DELETE /api/prompt-specs/:id
   * Elimina un registro. Solo creador o admin.
   */
  async remove(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'ID invalido' });

      const result = await promptSpecService.deletePromptSpec(id, req.userId, req.user.role);

      if (!result.deleted) {
        if (result.reason === 'not_found') {
          return res.status(404).json({ error: 'Prompt spec no encontrado' });
        }
        if (result.reason === 'forbidden') {
          return res.status(403).json({ error: 'No tienes permisos para eliminar este prompt spec' });
        }
      }

      res.json({ success: true, message: 'Prompt spec eliminado' });
    } catch (error) {
      logger.error('Error deleting prompt spec', { promptSpecId: req.params.id, error: error.message });
      next(error);
    }
  },

  /**
   * GET /api/prompt-specs/modulos
   * Devuelve la lista de modulos existentes para el campo relaciones.
   */
  getModulos(_req, res) {
    res.json(promptSpecService.MODULOS_EXISTENTES);
  },
};
