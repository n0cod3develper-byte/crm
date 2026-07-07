import { CentrosCostosRepository } from './centros_costos.repository.js';
import { AppError } from '../../utils/errors.js';

const repo = new CentrosCostosRepository();

export async function findAll(req, res, next) {
  try {
    const { empresa_id, search, estado, limit, cursor } = req.query;
    const result = await repo.findAll({
      empresa_id,
      search,
      estado,
      limit: limit ? parseInt(limit) : 50,
      cursor
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function findById(req, res, next) {
  try {
    const { id } = req.params;
    const cc = await repo.findById(id);
    if (!cc) throw new AppError('Centro de Costos no encontrado', 404);
    res.json(cc);
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const { empresa_id, nombre, descripcion, estado } = req.body;
    
    if (!empresa_id || !nombre) {
      throw new AppError('La empresa y el nombre son obligatorios', 400);
    }
    
    const cc = await repo.create({ empresa_id, nombre, descripcion, estado });
    res.status(201).json(cc);
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { empresa_id, nombre, descripcion, estado } = req.body;
    
    const updated = await repo.update(id, { empresa_id, nombre, descripcion, estado });
    if (!updated) throw new AppError('Centro de Costos no encontrado', 404);
    
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function softDelete(req, res, next) {
  try {
    const { id } = req.params;
    const deleted = await repo.softDelete(id);
    if (!deleted) throw new AppError('Centro de Costos no encontrado', 404);
    
    res.json({ message: 'Centro de Costos eliminado correctamente' });
  } catch (error) {
    next(error);
  }
}

// ---- Items Management ----

export async function getItems(req, res, next) {
  try {
    const { id } = req.params;
    const items = await repo.getItems(id);
    res.json(items);
  } catch (error) {
    next(error);
  }
}

export async function addItem(req, res, next) {
  try {
    const { id } = req.params;
    const { inventario_id } = req.body;
    
    if (!inventario_id) {
      throw new AppError('El ID del ítem (inventario_id) es requerido', 400);
    }
    
    await repo.addItem(id, inventario_id);
    res.status(201).json({ message: 'Ítem agregado al Centro de Costos' });
  } catch (error) {
    next(error);
  }
}

export async function removeItem(req, res, next) {
  try {
    const { id, item_id } = req.params;
    await repo.removeItem(id, item_id);
    res.json({ message: 'Ítem removido del Centro de Costos' });
  } catch (error) {
    next(error);
  }
}
