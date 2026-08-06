import { query } from '../../config/database.js';

export class ServiciosNegadosRepository {
  async findAll({ fecha_inicio, fecha_fin, empresa_id, causa, page = 1, limit = 50 }) {
    const conditions = [];
    const params = [];
    let i = 1;
    if (fecha_inicio) { conditions.push(`sn.fecha_solicitud >= $${i++}`); params.push(fecha_inicio); }
    if (fecha_fin) { conditions.push(`sn.fecha_solicitud <= $${i++}`); params.push(fecha_fin); }
    if (empresa_id) { conditions.push(`sn.empresa_id = $${i++}`); params.push(empresa_id); }
    if (causa) { conditions.push(`sn.causa = $${i++}`); params.push(causa); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const safeLimit = Math.min(parseInt(limit) || 50, 200);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * safeLimit;
    const countResult = await query(`SELECT COUNT(*) as total FROM servicios_negados sn ${where}`, params);
    const total = parseInt(countResult.rows[0].total);
    params.push(safeLimit, offset);
    const result = await query(
      `SELECT sn.*, u.nombre || ' ' || COALESCE(u.apellido, '') as registrado_por_nombre
       FROM servicios_negados sn LEFT JOIN users u ON sn.registrado_por = u.id
       ${where} ORDER BY sn.fecha_solicitud DESC, sn.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      params
    );
    return { data: result.rows, total, page: parseInt(page) || 1, totalPages: Math.ceil(total / safeLimit) };
  }

  async create({ fecha_solicitud, empresa_id, empresa_nombre, tipo_equipo, causa, observacion, valor_estimado, registrado_por }) {
    const result = await query(
      `INSERT INTO servicios_negados (fecha_solicitud, empresa_id, empresa_nombre, tipo_equipo, causa, observacion, valor_estimado, registrado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [fecha_solicitud || new Date().toISOString().split('T')[0], empresa_id || null, empresa_nombre || '', tipo_equipo, causa, observacion || '', valor_estimado || 0, registrado_por]
    );
    return result.rows[0];
  }

  async delete(id) {
    const result = await query('DELETE FROM servicios_negados WHERE id = $1 RETURNING id', [id]);
    return result.rows[0];
  }

  async getInforme({ fecha_inicio, fecha_fin, empresa_id, causa }) {
    const conditions = [];
    const params = [];
    let i = 1;
    if (fecha_inicio) { conditions.push(`fecha_solicitud >= $${i++}`); params.push(fecha_inicio); }
    if (fecha_fin) { conditions.push(`fecha_solicitud <= $${i++}`); params.push(fecha_fin); }
    if (empresa_id) { conditions.push(`empresa_id = $${i++}`); params.push(empresa_id); }
    if (causa) { conditions.push(`causa = $${i++}`); params.push(causa); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const resumen = await query(`SELECT COUNT(*) as total_negaciones, COALESCE(SUM(valor_estimado), 0) as total_valor FROM servicios_negados ${where}`, params);
    const porCausa = await query(`SELECT causa, COUNT(*) as cantidad, COALESCE(SUM(valor_estimado), 0) as valor, STRING_AGG(DISTINCT tipo_equipo, ', ') as tipos_equipo FROM servicios_negados ${where} GROUP BY causa ORDER BY cantidad DESC`, params);
    const porEmpresa = await query(`SELECT COALESCE(NULLIF(empresa_nombre,''),'Sin empresa') as empresa, COUNT(*) as cantidad FROM servicios_negados ${where} GROUP BY empresa_nombre ORDER BY cantidad DESC LIMIT 10`, params);
    const porMes = await query(`SELECT TO_CHAR(fecha_solicitud,'YYYY-MM') as mes, COUNT(*) as cantidad FROM servicios_negados ${where} GROUP BY mes ORDER BY mes`, params);
    const porTipoEquipo = await query(`SELECT tipo_equipo, COUNT(*) as cantidad, COALESCE(SUM(valor_estimado), 0) as valor FROM servicios_negados ${where} GROUP BY tipo_equipo ORDER BY cantidad DESC`, params);
    return { resumen: resumen.rows[0], por_causa: porCausa.rows, por_empresa: porEmpresa.rows, por_mes: porMes.rows, por_tipo_equipo: porTipoEquipo.rows };
  }
}
export const serviciosNegadosRepository = new ServiciosNegadosRepository();
