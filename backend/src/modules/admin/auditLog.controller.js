import { AuditLogRepository } from './auditLog.repository.js';
import { logger } from '../../utils/logger.js';

/**
 * Lista logs de auditoría con filtros y paginación
 * GET /api/v1/admin/auditoria
 */
export async function listarLogs(req, res) {
  try {
    const { page, limit, modulo, userId, accion, fechaDesde, fechaHasta, search } = req.query;

    const result = await AuditLogRepository.listar({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      modulo,
      userId,
      accion,
      fechaDesde,
      fechaHasta,
      search
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (err) {
    logger.error('Error listando logs de auditoría', { error: err.message });
    res.status(500).json({ error: 'Error obteniendo logs de auditoría' });
  }
}

/**
 * Obtiene un log por ID
 * GET /api/v1/admin/auditoria/:id
 */
export async function obtenerLog(req, res) {
  try {
    const { id } = req.params;
    const log = await AuditLogRepository.obtenerPorId(id);

    if (!log) {
      return res.status(404).json({ error: 'Log de auditoría no encontrado' });
    }

    res.json({ success: true, data: log });
  } catch (err) {
    logger.error('Error obteniendo log de auditoría', { error: err.message });
    res.status(500).json({ error: 'Error obteniendo log de auditoría' });
  }
}

/**
 * Obtiene estadísticas de auditoría
 * GET /api/v1/admin/auditoria/stats
 */
export async function obtenerEstadisticas(req, res) {
  try {
    const stats = await AuditLogRepository.obtenerEstadisticas();
    res.json({ success: true, data: stats });
  } catch (err) {
    logger.error('Error obteniendo estadísticas de auditoría', { error: err.message });
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
}

/**
 * Obtiene lista de módulos únicos
 * GET /api/v1/admin/auditoria/modulos
 */
export async function obtenerModulos(req, res) {
  try {
    const modulos = await AuditLogRepository.obtenerModulos();
    res.json({ success: true, data: modulos });
  } catch (err) {
    logger.error('Error obteniendo módulos de auditoría', { error: err.message });
    res.status(500).json({ error: 'Error obteniendo módulos' });
  }
}

/**
 * Exporta logs de auditoría en formato JSON (para Excel)
 * GET /api/v1/admin/auditoria/export
 */
export async function exportarLogs(req, res) {
  try {
    const { modulo, userId, accion, fechaDesde, fechaHasta, search } = req.query;

    const result = await AuditLogRepository.listar({
      page: 1,
      limit: 5000, // Cap de seguridad para exportación
      modulo,
      userId,
      accion,
      fechaDesde,
      fechaHasta,
      search
    });

    res.json({
      success: true,
      data: result.data.map(log => ({
        ID: log.id,
        Usuario: log.user_name || 'N/A',
        Módulo: log.modulo,
        Acción: log.accion,
        Ruta: log.ruta,
        Método: log.metodo,
        'IP': log.ip_address,
        Fecha: new Date(log.created_at).toLocaleString('es-CO')
      }))
    });
  } catch (err) {
    logger.error('Error exportando logs de auditoría', { error: err.message });
    res.status(500).json({ error: 'Error exportando logs' });
  }
}
