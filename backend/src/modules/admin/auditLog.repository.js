import { query } from '../../config/database.js';

export class AuditLogRepository {
  /**
   * Registra una nueva entrada de auditoría
   */
  static async insertar({ userId, userName, modulo, accion, ruta, metodo, datosAntes, datosDespues, ipAddress, userAgent }) {
    const sql = `
      INSERT INTO audit_logs (user_id, user_name, modulo, accion, ruta, metodo, datos_antes, datos_despues, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;
    const result = await query(sql, [
      userId || null,
      userName || null,
      modulo,
      accion,
      ruta,
      metodo,
      datosAntes ? JSON.stringify(datosAntes) : null,
      datosDespues ? JSON.stringify(datosDespues) : null,
      ipAddress || null,
      userAgent || null
    ]);
    return result.rows[0];
  }

  /**
   * Lista logs de auditoría con filtros y paginación
   */
  static async listar({ page = 1, limit = 50, modulo, userId, accion, fechaDesde, fechaHasta, search }) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (modulo) {
      conditions.push(`modulo = $${paramIndex++}`);
      params.push(modulo);
    }

    if (userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(userId);
    }

    if (accion) {
      conditions.push(`accion ILIKE $${paramIndex++}`);
      params.push(`%${accion}%`);
    }

    if (fechaDesde) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(fechaDesde);
    }

    if (fechaHasta) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(fechaHasta);
    }

    if (search) {
      conditions.push(`(user_name ILIKE $${paramIndex} OR ruta ILIKE $${paramIndex} OR modulo ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query principal
    const offset = (page - 1) * limit;
    const sql = `
      SELECT 
        id, user_id, user_name, modulo, accion, ruta, metodo,
        datos_antes, datos_despues, ip_address, user_agent, created_at
      FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    // Query de conteo
    const countSql = `
      SELECT COUNT(*) as total
      FROM audit_logs
      ${whereClause}
    `;

    const [dataResult, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, params.slice(0, -2)) // Excluir limit y offset
    ]);

    return {
      data: dataResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      }
    };
  }

  /**
   * Obtiene un log por ID
   */
  static async obtenerPorId(id) {
    const sql = `
      SELECT 
        id, user_id, user_name, modulo, accion, ruta, metodo,
        datos_antes, datos_despues, ip_address, user_agent, created_at
      FROM audit_logs
      WHERE id = $1
    `;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }

  /**
   * Obtiene estadísticas de auditoría
   */
  static async obtenerEstadisticas() {
    const sql = `
      SELECT 
        COUNT(*) as total_logs,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT modulo) as unique_modules,
        MAX(created_at) as last_activity
      FROM audit_logs
    `;
    const result = await query(sql);
    return result.rows[0];
  }

  /**
   * Obtiene lista de módulos únicos
   */
  static async obtenerModulos() {
    const sql = `
      SELECT DISTINCT modulo
      FROM audit_logs
      ORDER BY modulo
    `;
    const result = await query(sql);
    return result.rows.map(r => r.modulo);
  }
}
