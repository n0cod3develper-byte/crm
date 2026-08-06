import { llamadosRepository } from './llamados.repository.js';
import { logger } from '../../utils/logger.js';

export const llamadosController = {
  async listarPorEmpleado(req, res, next) {
    try {
      const { empleadoId } = req.params;
      const data = await llamadosRepository.findByEmpleado(empleadoId);
      res.json({ data });
    } catch (error) {
      logger.error('Error en listarPorEmpleado', { error: error.message });
      next(error);
    }
  },

  async obtener(req, res, next) {
    try {
      const { id } = req.params;
      const data = await llamadosRepository.findById(id);
      if (!data) return res.status(404).json({ error: 'Registro no encontrado' });
      res.json({ data });
    } catch (error) {
      logger.error('Error en obtener', { error: error.message });
      next(error);
    }
  },

  async crear(req, res, next) {
    try {
      const { empleado_id, tipo, gravedad, fecha, descripcion, observaciones, estado } = req.body;
      if (!empleado_id || !tipo || !descripcion) {
        return res.status(400).json({ error: 'empleado_id, tipo y descripcion son requeridos' });
      }
      const data = await llamadosRepository.create({
        empleado_id, tipo, gravedad, fecha, descripcion, observaciones,
        registrado_por: req.userId, estado
      });
      res.status(201).json({ data });
    } catch (error) {
      logger.error('Error en crear', { error: error.message });
      next(error);
    }
  },

  async actualizar(req, res, next) {
    try {
      const { id } = req.params;
      const data = await llamadosRepository.update(id, req.body);
      if (!data) return res.status(404).json({ error: 'Registro no encontrado' });
      res.json({ data });
    } catch (error) {
      logger.error('Error en actualizar', { error: error.message });
      next(error);
    }
  },

  async eliminar(req, res, next) {
    try {
      const { id } = req.params;
      const data = await llamadosRepository.remove(id);
      if (!data) return res.status(404).json({ error: 'Registro no encontrado' });
      res.json({ message: 'Eliminado correctamente' });
    } catch (error) {
      logger.error('Error en eliminar', { error: error.message });
      next(error);
    }
  }
};
