import { componentesRepository } from './componentes.repository.js';
import { logger } from '../../utils/logger.js';

export async function getAllActive(req, res, next) {
  try {
    const data = await componentesRepository.getAllActive();
    res.json({ data });
  } catch (error) {
    logger.error('Error al obtener componentes de mantenimiento activos', { error: error.message });
    next(error);
  }
}

export async function getAll(req, res, next) {
  try {
    const data = await componentesRepository.getAll();
    res.json({ data });
  } catch (error) {
    logger.error('Error al obtener componentes de mantenimiento', { error: error.message });
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const data = await componentesRepository.create(req.body);
    res.status(201).json({ data });
  } catch (error) {
    logger.error('Error al crear componente de mantenimiento', { error: error.message });
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params;
    const data = await componentesRepository.update(id, req.body);
    res.json({ data });
  } catch (error) {
    logger.error('Error al actualizar componente de mantenimiento', { error: error.message });
    next(error);
  }
}
