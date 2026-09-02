import { query, withTransaction } from '../../config/database.js';
import { MantenimientoRepository } from './mantenimiento.repository.js';
import { registrarMovimiento } from '../../services/inventoryMovements.service.js';
import { calcularFechaVencimientoGracia } from '../../services/calendarioService.js';

const otRepo = new MantenimientoRepository();

export class CorteContableRepository {
  
  async getCorteById(id) {
    const res = await query(`SELECT * FROM ot_cortes_contables WHERE id = $1`, [id]);
    if (!res.rows[0]) return null;
    const corte = res.rows[0];

    const itemsRes = await query(`
      SELECT ci.*, ot.consecutivo as original_consecutivo, n_ot.consecutivo as nueva_consecutivo
      FROM ot_corte_items ci
      JOIN ordenes_trabajo ot ON ot.id = ci.orden_trabajo_id
      LEFT JOIN ordenes_trabajo n_ot ON n_ot.id = ci.nueva_ot_id
      WHERE ci.corte_id = $1
    `, [id]);
    corte.items = itemsRes.rows;
    return corte;
  }

  async findCorteByPeriodo(periodo) {
    const res = await query(`SELECT * FROM ot_cortes_contables WHERE periodo = $1`, [periodo]);
    return res.rows[0] || null;
  }

  async findAllCortes({ estado, limit = 50, cursor } = {}) {
    const conditions = [];
    const params = [];
    let i = 1;

    if (estado && estado !== 'all') {
      conditions.push(`estado = $${i++}`);
      params.push(estado);
    }
    if (cursor) {
      conditions.push(`propuesto_at < (SELECT propuesto_at FROM ot_cortes_contables WHERE id = $${i++})`);
      params.push(cursor);
    }
    params.push(limit + 1);

    const sql = `
      SELECT * FROM ot_cortes_contables
      ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
      ORDER BY propuesto_at DESC
      LIMIT $${i}
    `;

    const result = await query(sql, params);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    return {
      data: rows,
      pagination: {
        hasMore,
        nextCursor: hasMore ? rows[rows.length - 1].id : null
      }
    };
  }

  async generarPropuestaCorte(fechaCorteStr) {
    const fechaCorte = new Date(fechaCorteStr);
    const year = fechaCorte.getFullYear();
    const month = String(fechaCorte.getMonth() + 1).padStart(2, '0');
    const periodo = `${year}-${month}`;

    const existe = await this.findCorteByPeriodo(periodo);
    if (existe && existe.estado !== 'CANCELADO') {
      throw new Error(`Ya existe un corte contable para el periodo ${periodo} en estado ${existe.estado}`);
    }

    // 1. Buscar OTs candidatas de servicio continuo y abiertas
    const otsRes = await query(`
      SELECT ot.*, c.name as empresa_nombre, e.marca, e.modelo, e.serial
      FROM ordenes_trabajo ot
      JOIN companies c ON c.id = ot.empresa_id
      JOIN equipos e ON e.id = ot.equipo_id
      WHERE ot.deleted_at IS NULL
        AND ot.es_servicio_continuo = TRUE
        AND ot.estado IN ('ABIERTA', 'EN_PROCESO')
    `);

    if (otsRes.rows.length === 0) {
      return { success: true, message: 'No hay Órdenes de Trabajo de servicio continuo abiertas para cortar.', corte: null };
    }

    return await withTransaction(async (client) => {
      // 2. Insertar cabecera del lote
      const insertCorte = await client.query(`
        INSERT INTO ot_cortes_contables (periodo, fecha_corte, estado)
        VALUES ($1, $2, 'PROPUESTO')
        RETURNING *
      `, [periodo, fechaCorteStr]);
      const corte = insertCorte.rows[0];

      let totalOts = 0;

      for (const ot of otsRes.rows) {
        // Calcular Mano de obra hasta la fecha de corte
        const moRes = await client.query(`
          SELECT COALESCE(SUM(total_mano_obra), 0) as total
          FROM ot_tecnicos
          WHERE orden_trabajo_id = $1
            AND (fecha_regreso IS NULL OR fecha_regreso <= $2)
        `, [ot.id, fechaCorteStr]);
        const montoMo = parseFloat(moRes.rows[0].total) || 0;

        // Calcular repuestos hasta la fecha de corte
        const repRes = await client.query(`
          SELECT COALESCE(SUM(total), 0) as total
          FROM ot_repuestos_insumos
          WHERE orden_trabajo_id = $1
            AND created_at <= $2
        `, [ot.id, fechaCorteStr + ' 23:59:59']);
        const montoRep = parseFloat(repRes.rows[0].total) || 0;

        // Calcular MO adicional
        const moAdicRes = await client.query(`
          SELECT COALESCE(SUM(precio), 0) as total
          FROM ot_mano_obra_adicional
          WHERE orden_trabajo_id = $1
            AND created_at <= $2
        `, [ot.id, fechaCorteStr + ' 23:59:59']);
        const montoMoAdic = parseFloat(moAdicRes.rows[0].total) || 0;

        const subtotal = montoMo + montoRep + montoMoAdic;
        const equipoResumen = `${ot.marca || ''} ${ot.modelo || ''} (Serial: ${ot.serial || ''})`.trim();

        await client.query(`
          INSERT INTO ot_corte_items 
            (corte_id, orden_trabajo_id, consecutivo_ot, empresa_nombre, equipo_resumen, monto_mano_obra, monto_repuestos, monto_mo_adicional, subtotal)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [corte.id, ot.id, ot.consecutivo, ot.empresa_nombre, equipoResumen, montoMo, montoRep, montoMoAdic, subtotal]);

        totalOts++;
      }

      const updateCount = await client.query(`
        UPDATE ot_cortes_contables SET total_ots = $1 WHERE id = $2 RETURNING *
      `, [totalOts, corte.id]);

      return { success: true, corte: updateCount.rows[0] };
    });
  }

  async confirmarCorte(id, userId) {
    const res = await query(`
      UPDATE ot_cortes_contables 
      SET estado = 'CONFIRMADO', confirmado_at = NOW(), confirmado_por = $1
      WHERE id = $2 AND estado = 'PROPUESTO' RETURNING *
    `, [userId, id]);
    if (!res.rows[0]) throw new Error('El corte no existe o no está en estado PROPUESTO');
    return res.rows[0];
  }

  async cancelarCorte(id, userId) {
    const res = await query(`
      UPDATE ot_cortes_contables 
      SET estado = 'CANCELADO', notas = COALESCE(notas, '') || ' Cancelado por el usuario.'
      WHERE id = $1 AND estado IN ('PROPUESTO', 'CONFIRMADO') RETURNING *
    `, [id]);
    if (!res.rows[0]) throw new Error('El corte no existe o ya ha sido procesado/cancelado');
    return res.rows[0];
  }

  async ejecutarCorte(corteId, userId) {
    const corteRes = await query(`SELECT * FROM ot_cortes_contables WHERE id = $1 FOR UPDATE`, [corteId]);
    if (!corteRes.rows[0]) throw new Error('Corte no encontrado');
    const corte = corteRes.rows[0];
    if (corte.estado !== 'CONFIRMADO') throw new Error('Solo se pueden ejecutar cortes en estado CONFIRMADO');

    const itemsRes = await query(`SELECT * FROM ot_corte_items WHERE corte_id = $1`, [corteId]);
    const items = itemsRes.rows;

    const fechaCorteStr = corte.fecha_corte instanceof Date 
      ? corte.fecha_corte.toISOString().split('T')[0] 
      : String(corte.fecha_corte).split('T')[0];

    // Actualizar cada OT del corte
    for (const item of items) {
      try {
        await withTransaction(async (client) => {
          // Bloquear la OT
          const otRes = await client.query(
            `SELECT id, estado FROM ordenes_trabajo WHERE id = $1 FOR UPDATE`,
            [item.orden_trabajo_id]
          );
          if (otRes.rows.length === 0) throw new Error('OT no encontrada');
          
          // Actualizar la OT original con la fecha de corte y el id de periodo de cierre sin cambiar su estado
          await client.query(
            `UPDATE ordenes_trabajo 
             SET fecha_ultimo_corte = $1, periodo_cierre_id = $2, updated_at = NOW() 
             WHERE id = $3`,
            [fechaCorteStr, corte.id, item.orden_trabajo_id]
          );

          // Limpiar mensaje de error e indicar que no hay nueva_ot_id
          await client.query(
            `UPDATE ot_corte_items 
             SET nueva_ot_id = NULL, error_mensaje = NULL 
             WHERE id = $1`,
            [item.id]
          );
        });
      } catch (err) {
        console.error(`Error procesando corte de OT ${item.consecutivo_ot}:`, err.message);
        await query(`UPDATE ot_corte_items SET error_mensaje = $1 WHERE id = $2`, [err.message, item.id]);
      }
    }

    // Calcular la fecha de vencimiento de gracia (2 días hábiles)
    const fechaVencimientoGracia = await calcularFechaVencimientoGracia(fechaCorteStr, 2);

    // Cambiar estado del lote a EN_GRACIA
    await query(`
      UPDATE ot_cortes_contables 
      SET estado = 'EN_GRACIA', 
          ejecutado_at = NOW(), 
          ejecutado_por = $1,
          fecha_vencimiento_gracia = $2
      WHERE id = $3
    `, [userId, fechaVencimientoGracia, corteId]);

    return await this.getCorteById(corteId);
  }

  async cerrarPeriodo(corteId, userId) {
    const corteRes = await query(`SELECT * FROM ot_cortes_contables WHERE id = $1 FOR UPDATE`, [corteId]);
    if (!corteRes.rows[0]) throw new Error('Corte no encontrado');
    const corte = corteRes.rows[0];
    if (corte.estado !== 'EN_GRACIA') {
      throw new Error('Solo se pueden cerrar cortes que se encuentran en estado EN_GRACIA');
    }

    await query(`
      UPDATE ot_cortes_contables
      SET estado = 'CERRADO',
          cerrado_at = NOW(),
          cerrado_por = $1
      WHERE id = $2
    `, [userId, corteId]);

    return await this.getCorteById(corteId);
  }

  async reabrirPeriodo(corteId, userId, userName, justificacion) {
    if (!justificacion || justificacion.trim().length < 20) {
      throw new Error('La justificación es requerida y debe tener al menos 20 caracteres');
    }

    const corteRes = await query(`SELECT * FROM ot_cortes_contables WHERE id = $1 FOR UPDATE`, [corteId]);
    if (!corteRes.rows[0]) throw new Error('Corte no encontrado');
    const corte = corteRes.rows[0];
    if (corte.estado !== 'CERRADO' && corte.estado !== 'EJECUTADO') {
      throw new Error('Solo se pueden reabrir cortes que se encuentran en estado CERRADO');
    }

    return await withTransaction(async (client) => {
      // 1. Cambiar estado a REABIERTO y guardar justificación
      await client.query(`
        UPDATE ot_cortes_contables
        SET estado = 'REABIERTO',
            reabierto_at = NOW(),
            reabierto_por = $1,
            justificacion_reapertura = $2
        WHERE id = $3
      `, [userId, justificacion, corteId]);

      // 2. Registrar en log de auditoría
      await client.query(`
        INSERT INTO audit_logs (user_id, user_name, modulo, accion, ruta, metodo, datos_antes, datos_despues)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        userId,
        userName || null,
        'cierre_contable',
        'REAPERTURA_PERIODO',
        `/cortes/${corteId}/reabrir`,
        'POST',
        JSON.stringify({ corte_id: corteId, estado_anterior: corte.estado }),
        JSON.stringify({ estado_nuevo: 'REABIERTO', justificacion })
      ]);

      const itemsRes = await client.query(`
        SELECT ci.*, ot.consecutivo as original_consecutivo, n_ot.consecutivo as nueva_consecutivo
        FROM ot_corte_items ci
        JOIN ordenes_trabajo ot ON ot.id = ci.orden_trabajo_id
        LEFT JOIN ordenes_trabajo n_ot ON n_ot.id = ci.nueva_ot_id
        WHERE ci.corte_id = $1
      `, [corteId]);
      corte.items = itemsRes.rows;
      corte.estado = 'REABIERTO';
      corte.reabierto_at = new Date();
      corte.reabierto_por = userId;
      corte.justificacion_reapertura = justificacion;

      return corte;
    });
  }

  async getHistorialCadena(cadenaServicioId) {
    const res = await query(`
      SELECT ot.id, ot.consecutivo, ot.estado, ot.created_at,
             liq.subtotal, liq.total_final, liq.fecha_liquidacion
      FROM ordenes_trabajo ot
      LEFT JOIN ot_liquidacion liq ON liq.orden_trabajo_id = ot.id
      WHERE ot.cadena_servicio_id = $1 OR ot.id = $1
      ORDER BY ot.created_at ASC
    `, [cadenaServicioId]);
    return res.rows;
  }
}
