import { query, withTransaction } from '../../config/database.js';
import { MantenimientoRepository } from './mantenimiento.repository.js';
import { registrarMovimiento } from '../../services/inventoryMovements.service.js';

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

    // Procesar cada OT de manera independiente para que fallos individuales no rompan todo el proceso,
    // pero marcando el error en el ítem correspondiente.
    for (const item of items) {
      try {
        await withTransaction(async (client) => {
          // 1. Obtener la OT original
          const otRes = await client.query(`
            SELECT * FROM ordenes_trabajo WHERE id = $1 FOR UPDATE
          `, [item.orden_trabajo_id]);
          const ot = otRes.rows[0];
          if (!ot) throw new Error('OT no encontrada');
          if (ot.estado !== 'ABIERTA' && ot.estado !== 'EN_PROCESO') {
             throw new Error(`La OT ya está en estado ${ot.estado}`);
          }

          // Definir cadena_servicio_id si no existe
          const cadenaServicioId = ot.cadena_servicio_id || ot.id;
          if (!ot.cadena_servicio_id) {
             await client.query(`UPDATE ordenes_trabajo SET cadena_servicio_id = $1 WHERE id = $2`, [cadenaServicioId, ot.id]);
          }

          // 2. Liquidar conceptos de la OT original hasta la fecha de corte
          const fechaCorteStr = corte.fecha_corte instanceof Date 
            ? corte.fecha_corte.toISOString().split('T')[0] 
            : String(corte.fecha_corte).split('T')[0];

          // 2a. Repuestos a descargar
          const reps = await client.query(`
            SELECT * FROM ot_repuestos_insumos 
            WHERE orden_trabajo_id = $1 AND created_at <= $2 FOR UPDATE
          `, [ot.id, fechaCorteStr + ' 23:59:59']);

          // Verificar stock
          const insuficientes = [];
          for(const rep of reps.rows) {
              const invRes = await client.query(`SELECT stock_actual FROM inventario WHERE id = $1 FOR UPDATE`, [rep.item_inventario_id]);
              if (invRes.rows.length === 0) throw new Error(`Item ${rep.descripcion} no existe en inventario.`);
              const currentStock = parseFloat(invRes.rows[0].stock_actual);
              const requested = parseFloat(rep.cantidad);
              if (currentStock < requested) {
                  insuficientes.push(`${rep.descripcion}: requiere ${requested}, disponible ${currentStock}`);
              }
          }
          if (insuficientes.length > 0) {
              throw new Error(`Stock insuficiente: \n${insuficientes.join('\n')}`);
          }

          // Descargar stock
          for(const rep of reps.rows) {
              const requested = parseFloat(rep.cantidad);
              await registrarMovimiento({
                  inventario_id: rep.item_inventario_id,
                  tipo_movimiento: 'SALIDA_OT',
                  cantidad: requested,
                  numero_documento: ot.consecutivo,
                  ot_id: ot.id,
                  notas: `Corte mensual automático de OT ${ot.consecutivo}`,
                  registrado_por: userId
              }, client);

              await client.query(`UPDATE ot_repuestos_insumos SET descargado = TRUE, fecha_descargo = NOW() WHERE id = $1`, [rep.id]);
          }

          // 3. Crear registro de liquidación (ot_liquidacion)
          const subtotal = parseFloat(item.monto_mano_obra) + parseFloat(item.monto_repuestos) + parseFloat(item.monto_mo_adicional);
          const impuesto_pct = 19.0;
          const impuesto_valor = subtotal * (impuesto_pct / 100);
          const total_final = subtotal + impuesto_valor;

          await client.query(`
            INSERT INTO ot_liquidacion (orden_trabajo_id, total_mano_obra, total_repuestos, subtotal, impuesto_pct, impuesto_valor, total_final, liquidado_por, notas_liquidacion)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [ot.id, parseFloat(item.monto_mano_obra) + parseFloat(item.monto_mo_adicional), parseFloat(item.monto_repuestos), subtotal, impuesto_pct, impuesto_valor, total_final, userId, `Cierre contable del periodo ${corte.periodo}.`]);

          // Actualizar estado de OT original a LIQUIDADA_CORTE
          await client.query(`UPDATE ordenes_trabajo SET estado = 'LIQUIDADA_CORTE', updated_at = NOW() WHERE id = $1`, [ot.id]);

          // 4. Crear la nueva OT de continuación
          const consecutivo = await otRepo.generarConsecutivo(item.empresa_nombre, client);
          
          const newOtRes = await client.query(`
            INSERT INTO ordenes_trabajo 
              (consecutivo, tipo_mantenimiento, empresa_id, equipo_id, componente_id, horometro_inicial, responsable, contacto_empresa, telefono_contacto, detalle_servicio, created_by, pm_frecuencia_id, es_servicio_continuo, orden_origen_id, cadena_servicio_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE, $13, $14)
            RETURNING *
          `, [
            consecutivo,
            ot.tipo_mantenimiento,
            ot.empresa_id,
            ot.equipo_id,
            ot.componente_id,
            ot.horometro_final || ot.horometro_inicial, // arranca con el último horómetro conocido
            ot.responsable,
            ot.contacto_empresa,
            ot.telefono_contacto,
            ot.detalle_servicio,
            userId,
            ot.pm_frecuencia_id,
            ot.id,
            cadenaServicioId
          ]);
          const nuevaOt = newOtRes.rows[0];

          // Copiar técnicos sin horas trabajadas para que queden asignados
          const tecnicos = await client.query(`SELECT empleado_id, tarifa_hora FROM ot_tecnicos WHERE orden_trabajo_id = $1`, [ot.id]);
          for(const tech of tecnicos.rows) {
            await client.query(
              `INSERT INTO ot_tecnicos (orden_trabajo_id, empleado_id, tarifa_hora) VALUES ($1, $2, $3)`,
              [nuevaOt.id, tech.empleado_id, tech.tarifa_hora]
            );
          }

          // Guardar el vínculo en el item del corte
          await client.query(`UPDATE ot_corte_items SET nueva_ot_id = $1, error_mensaje = NULL WHERE id = $2`, [nuevaOt.id, item.id]);
        });
      } catch (err) {
        console.error(`Error procesando corte de OT ${item.consecutivo_ot}:`, err.message);
        await query(`UPDATE ot_corte_items SET error_mensaje = $1 WHERE id = $2`, [err.message, item.id]);
      }
    }

    // Cambiar estado del lote a EJECUTADO
    await query(`
      UPDATE ot_cortes_contables 
      SET estado = 'EJECUTADO', ejecutado_at = NOW(), ejecutado_por = $1
      WHERE id = $2
    `, [userId, corteId]);

    return await this.getCorteById(corteId);
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
