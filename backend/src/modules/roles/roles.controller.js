import * as rolesRepo from './roles.repository.js';
import { AppError, ConflictError, NotFoundError } from '../../utils/errors.js';
import { invalidarTodoElCache } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';

/**
 * GET /api/v1/roles
 * Lista todos los roles con conteo de usuarios asignados.
 */
export async function listarRoles(req, res, next) {
  try {
    const roles = await rolesRepo.getAllRoles();
    res.json({ success: true, data: roles });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/roles/:id
 * Obtiene un rol con todos sus permisos desglosados por módulo.
 */
export async function obtenerRol(req, res, next) {
  try {
    const { id } = req.params;
    const rol = await rolesRepo.getRolById(id);

    if (!rol) {
      throw new NotFoundError('Rol');
    }

    res.json({ success: true, data: rol });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/roles/modulos
 * Lista módulos y acciones disponibles del sistema.
 */
export async function listarModulos(req, res, next) {
  try {
    const data = await rolesRepo.getModulosDisponibles();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/roles
 * Crea un nuevo rol con permisos inicializados en false.
 */
export async function crearRol(req, res, next) {
  try {
    const { nombre, descripcion } = req.body;

    // Validación
    if (!nombre || nombre.trim().length === 0) {
      throw new AppError('El nombre del rol es requerido', 400);
    }
    if (nombre.trim().length < 3) {
      throw new AppError('El nombre del rol debe tener al menos 3 caracteres', 400);
    }
    if (nombre.trim().length > 100) {
      throw new AppError('El nombre del rol no puede exceder 100 caracteres', 400);
    }
    if (descripcion && descripcion.trim().length > 500) {
      throw new AppError('La descripción no puede exceder 500 caracteres', 400);
    }

    const nuevoRol = await rolesRepo.createRol(nombre, descripcion);

    res.status(201).json({
      success: true,
      data: nuevoRol,
      message: `Rol "${nuevoRol.nombre}" creado exitosamente`
    });
  } catch (err) {
    // Manejar errores de duplicado del repositorio
    if (err.statusCode === 409) {
      return res.status(409).json({ success: false, error: err.message });
    }
    next(err);
  }
}

/**
 * PUT /api/v1/roles/:id
 * Actualiza nombre y/o descripción de un rol.
 */
export async function actualizarRol(req, res, next) {
  try {
    const { id } = req.params;
    const { nombre, descripcion } = req.body;

    // Al menos un campo debe venir para actualizar
    if (!nombre && descripcion === undefined) {
      throw new AppError('Debe proporcionar al menos nombre o descripción para actualizar', 400);
    }

    if (nombre) {
      if (nombre.trim().length < 3) {
        throw new AppError('El nombre del rol debe tener al menos 3 caracteres', 400);
      }
      if (nombre.trim().length > 100) {
        throw new AppError('El nombre del rol no puede exceder 100 caracteres', 400);
      }
    }

    if (descripcion && descripcion.trim().length > 500) {
      throw new AppError('La descripción no puede exceder 500 caracteres', 400);
    }

    const rolActualizado = await rolesRepo.updateRol(id, nombre, descripcion);

    // Invalidar caché de permisos (los slugs podrían haber cambiado)
    invalidarTodoElCache();

    res.json({
      success: true,
      data: rolActualizado,
      message: `Rol "${rolActualizado.nombre}" actualizado correctamente`
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    next(err);
  }
}

/**
 * DELETE /api/v1/roles/:id
 * Elimina un rol (con validaciones de seguridad).
 */
export async function eliminarRol(req, res, next) {
  try {
    const { id } = req.params;
    const resultado = await rolesRepo.deleteRol(id);

    res.json({
      success: true,
      message: `Rol "${resultado.nombre}" eliminado correctamente`
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    next(err);
  }
}

/**
 * PUT /api/v1/roles/:id/permisos
 * Actualiza TODOS los permisos de un rol (bulk update).
 */
export async function actualizarPermisos(req, res, next) {
  try {
    const { id } = req.params;
    const { permisos } = req.body;

    if (!Array.isArray(permisos) || permisos.length === 0) {
      throw new AppError('El campo "permisos" debe ser un array con al menos un elemento', 400);
    }

    // Validar que cada permiso tenga modulo_id
    for (const p of permisos) {
      if (!p.modulo_id) {
        throw new AppError('Cada permiso debe tener un modulo_id', 400);
      }
    }

    const ejecutadoPor = req.userId || req.user?.id || 'desconocido';
    const resultado = await rolesRepo.updatePermisos(id, permisos, ejecutadoPor);

    // Invalidar caché global de permisos para que surta efecto inmediato
    invalidarTodoElCache();

    logger.info('Permisos de rol actualizados por admin', {
      rolId: id,
      ejecutadoPor,
      permisosActualizados: resultado.updated
    });

    res.json({
      success: true,
      message: 'Permisos actualizados correctamente',
      data: resultado
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    next(err);
  }
}

/**
 * PUT /api/v1/roles/:id/permisos/:modulo/:accion
 * Toggle individual de un permiso.
 */
export async function togglePermisoIndividual(req, res, next) {
  try {
    const { id, modulo, accion } = req.params;

    const resultado = await rolesRepo.togglePermiso(id, modulo, accion);

    // Invalidar caché
    invalidarTodoElCache();

    res.json({
      success: true,
      data: resultado,
      message: `Permiso ${resultado.valor ? 'activado' : 'desactivado'}`
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    next(err);
  }
}
