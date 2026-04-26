import { db } from '../../config/database.js';
import { comprasRepository } from './compras.repository.js';

export class ComprasService {
  async crearSolicitud(data, userId) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      
      // Auto-generar consecutivo
      const seqRes = await client.query("SELECT nextval('seq_solicitudes_compra') as seq");
      const consecutivo = `SC-${String(seqRes.rows[0].seq).padStart(5, '0')}`;

      const solRes = await client.query(`
        INSERT INTO solicitudes_compra (consecutivo, solicitante_id, area_solicitante, fecha_requerida, prioridad, justificacion, notas, estado)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'BORRADOR')
        RETURNING *
      `, [consecutivo, userId, data.area_solicitante, data.fecha_requerida, data.prioridad || 'MEDIA', data.justificacion, data.notas]);
      
      const solicitudId = solRes.rows[0].id;

      for (const item of data.items) {
        await client.query(`
          INSERT INTO solicitud_items (solicitud_id, item_inventario_id, descripcion, unidad, cantidad_solicitada, notas_item)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [solicitudId, item.item_inventario_id || null, item.descripcion, item.unidad, item.cantidad_solicitada, item.notas_item]);
      }

      await client.query('COMMIT');
      return solRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async actualizarSolicitud(id, data, userId) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        UPDATE solicitudes_compra 
        SET area_solicitante = $1, fecha_requerida = $2, prioridad = $3, justificacion = $4, notas = $5, updated_at = NOW()
        WHERE id = $6 AND estado = 'BORRADOR'
      `, [data.area_solicitante, data.fecha_requerida, data.prioridad || 'MEDIA', data.justificacion, data.notas, id]);

      // Replace items: delete old, insert new
      await client.query('DELETE FROM solicitud_items WHERE solicitud_id = $1', [id]);

      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          await client.query(`
            INSERT INTO solicitud_items (solicitud_id, item_inventario_id, descripcion, unidad, cantidad_solicitada, notas_item)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [id, item.item_inventario_id || null, item.descripcion, item.unidad, item.cantidad_solicitada, item.notas_item]);
        }
      }

      await client.query('COMMIT');

      return await comprasRepository.getSolicitudById(id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async registrarCotizacion(solicitudId, data) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      
      const resSol = await client.query('SELECT estado FROM solicitudes_compra WHERE id = $1', [solicitudId]);
      if (resSol.rows[0].estado !== 'EN_COTIZACION') {
        throw new Error('La solicitud no está en estado EN_COTIZACION');
      }

      const seqRes = await client.query("SELECT nextval('seq_cotizaciones') as seq");
      const consecutivo = `COT-${String(seqRes.rows[0].seq).padStart(5, '0')}`;

      const subtotal = data.items.reduce((acc, item) => acc + (item.cantidad * item.precio_unitario), 0);
      const iva = data.items.reduce((acc, item) => {
        return item.aplica_iva ? acc + ((item.cantidad * item.precio_unitario) * (item.iva_pct / 100)) : acc;
      }, 0);
      const total = subtotal + iva;

      const cotRes = await client.query(`
        INSERT INTO cotizaciones (consecutivo, solicitud_id, proveedor_id, fecha_cotizacion, fecha_vencimiento, condicion_pago, dias_entrega, subtotal, iva_valor, total)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [consecutivo, solicitudId, data.proveedor_id, data.fecha_cotizacion, data.fecha_vencimiento, data.condicion_pago, data.dias_entrega, subtotal, iva, total]);
      
      const cotId = cotRes.rows[0].id;

      for (const item of data.items) {
        const itemSubtotal = item.cantidad * item.precio_unitario;
        const itemIva = item.aplica_iva ? (itemSubtotal * (item.iva_pct / 100)) : 0;
        await client.query(`
          INSERT INTO cotizacion_items (cotizacion_id, solicitud_item_id, descripcion, cantidad, precio_unitario, aplica_iva, iva_pct, iva_valor, total_item, marca)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [cotId, item.solicitud_item_id, item.descripcion, item.cantidad, item.precio_unitario, item.aplica_iva, item.iva_pct || 19, itemIva, itemSubtotal + itemIva, item.marca]);
      }

      await client.query('COMMIT');
      return cotRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async generarOcDesdeCotizacion(cotizacionId, userId) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      
      // select cotizacion and items
      const cotRes = await client.query('SELECT * FROM cotizaciones WHERE id = $1', [cotizacionId]);
      const cot = cotRes.rows[0];
      
      if (cot.estado === 'SELECCIONADA') {
         throw new Error('Esta cotización ya generó una OC');
      }

      const itemsRes = await client.query(`
        SELECT ci.*, si.unidad, si.item_inventario_id
        FROM cotizacion_items ci
        JOIN solicitud_items si ON ci.solicitud_item_id = si.id
        WHERE ci.cotizacion_id = $1
      `, [cotizacionId]);
      
      const configRes = await comprasRepository.getConfig();
      const terminos = configRes.terminos_oc?.texto || '';

      const seqRes = await client.query("SELECT nextval('seq_ordenes_compra') as seq");
      const consecutivo = `OC-${String(seqRes.rows[0].seq).padStart(5, '0')}`;

      // Insertar OC
      const ocRes = await client.query(`
        INSERT INTO ordenes_compra (consecutivo, solicitud_id, cotizacion_id, proveedor_id, condicion_pago, subtotal, iva_valor, total, estado, terminos_condiciones, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'BORRADOR', $9, $10)
        RETURNING *
      `, [consecutivo, cot.solicitud_id, cotizacionId, cot.proveedor_id, cot.condicion_pago, cot.subtotal, cot.iva_valor, cot.total, terminos, userId]);
      
      const ocId = ocRes.rows[0].id;

      for (const item of itemsRes.rows) {
        await client.query(`
          INSERT INTO oc_items (orden_compra_id, item_inventario_id, descripcion, unidad, cantidad_ordenada, precio_unitario, aplica_iva, iva_pct, iva_valor, total_item, marca)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [ocId, item.item_inventario_id, item.descripcion, item.unidad, item.cantidad, item.precio_unitario, item.aplica_iva, item.iva_pct, item.iva_valor, item.total_item, item.marca]);
      }

      // Marcar cotizacion como seleccionada y solicitud como OC_GENERADA
      await client.query("UPDATE cotizaciones SET estado = 'SELECCIONADA' WHERE id = $1", [cotizacionId]);
      await client.query("UPDATE solicitudes_compra SET estado = 'OC_GENERADA' WHERE id = $1", [cot.solicitud_id]);

      await client.query('COMMIT');
      return ocId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async recibirMercancia(ocId, data, userId) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      
      // Update items
      let allFullyReceived = true;
      let anyReceived = false;

      for (const item of data.items) {
        // item: { oc_item_id, cantidad_recibida }
        const currentItemRes = await client.query('SELECT * FROM oc_items WHERE id = $1 FOR UPDATE', [item.oc_item_id]);
        const currentItem = currentItemRes.rows[0];

        const newReceived = parseFloat(currentItem.cantidad_recibida) + parseFloat(item.cantidad_recibida);
        const status = newReceived >= parseFloat(currentItem.cantidad_ordenada) ? 'RECIBIDO_TOTAL' : 'RECIBIDO_PARCIAL';
        
        if (parseFloat(item.cantidad_recibida) > 0) anyReceived = true;
        if (status !== 'RECIBIDO_TOTAL') allFullyReceived = false;

        await client.query('UPDATE oc_items SET cantidad_recibida = $1, estado_item = $2 WHERE id = $3', [newReceived, status, item.oc_item_id]);

        // ================= INVENTARIO INTEGRATION =================
        if (item.cantidad_recibida > 0) {
          let itemInvId = currentItem.item_inventario_id;

          // If it was a manual item with no inventory link, create it now
          if (!itemInvId) {
            // Accept enriched data from frontend (sku, category, stock_minimum)
            const newInvData = item.new_inventory_data || {};
            const resNewInv = await client.query(`
              INSERT INTO inventory_items (sku, name, description, category, unit, unit_cost, unit_price, stock_current, stock_minimum, is_active)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
              RETURNING id
            `, [
              newInvData.sku || null,
              newInvData.name || currentItem.descripcion,
              newInvData.description || currentItem.descripcion,
              newInvData.category || null,
              currentItem.unidad,
              currentItem.precio_unitario,
              newInvData.unit_price || currentItem.precio_unitario,
              item.cantidad_recibida,
              newInvData.stock_minimum || 0
            ]);
            itemInvId = resNewInv.rows[0].id;
            
            // link oc_item with the new inventory record
            await client.query('UPDATE oc_items SET item_inventario_id = $1 WHERE id = $2', [itemInvId, item.oc_item_id]);

            // also link solicitud_item if traceability is available
            await client.query(`
              UPDATE solicitud_items si
              SET item_inventario_id = $1
              FROM oc_items oi
              WHERE oi.id = $2
                AND si.id = (
                  SELECT ci.solicitud_item_id
                  FROM cotizacion_items ci
                  JOIN cotizaciones c ON c.id = ci.cotizacion_id
                  JOIN ordenes_compra oc ON oc.cotizacion_id = c.id
                  WHERE oc.id = $3 AND ci.descripcion = $4
                  LIMIT 1
                )
            `, [itemInvId, item.oc_item_id, ocId, currentItem.descripcion]);

          } else {
             // update existing inventory stock AND cost (weighted average would be ideal, this updates to latest)
             await client.query(`
                UPDATE inventory_items 
                SET stock_current = stock_current + $1, unit_cost = $2, updated_at = NOW() 
                WHERE id = $3
             `, [item.cantidad_recibida, currentItem.precio_unitario, itemInvId]);
          }

          // Insert movement
          const ocRes = await client.query('SELECT consecutivo FROM ordenes_compra WHERE id = $1', [ocId]);
          await client.query(`
            INSERT INTO inventory_movements (item_id, type, quantity, reference, notes, created_by)
            VALUES ($1, 'in', $2, $3, $4, $5)
          `, [itemInvId, item.cantidad_recibida, `RECEPCIÓN OC ${ocRes.rows[0].consecutivo}`, `Precio unitario de OC: ${currentItem.precio_unitario}`, userId]);

        }
      }

      if (anyReceived) {
         const globalState = allFullyReceived ? 'RECIBIDA_TOTAL' : 'RECIBIDA_PARCIAL';
         await client.query('UPDATE ordenes_compra SET estado = $1, updated_at = NOW() WHERE id = $2', [globalState, ocId]);
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async procesarAprobacion(ocId, action, userId, comentario) {
    // action: APROBAR or RECHAZAR
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const configRes = await comprasRepository.getConfig();
      const limites = configRes.aprobacion_limites || { nivel_1: 5000000, nivel_2: 20000000 };
      
      const ocRes = await client.query('SELECT total FROM ordenes_compra WHERE id = $1 FOR UPDATE', [ocId]);
      const total = parseFloat(ocRes.rows[0].total);

      let requiredLevels = 1;
      if (total > limites.nivel_2) requiredLevels = 3;
      else if (total > limites.nivel_1) requiredLevels = 2;

      // Calculate current level
      const aprobRes = await client.query('SELECT * FROM aprobaciones_oc WHERE entidad_id = $1 ORDER BY nivel ASC', [ocId]);
      
      if (action === 'RECHAZAR') {
         await client.query("UPDATE ordenes_compra SET estado = 'BORRADOR' WHERE id = $1", [ocId]);
         // User requested: return to draft to be quoted again.
         await client.query("INSERT INTO aprobaciones_oc (entidad_id, nivel, aprobador_id, estado, comentario, fecha_accion) VALUES ($1, $2, $3, 'RECHAZADO', $4, NOW())", [ocId, aprobRes.rowCount + 1, userId, comentario]);
      } else {
         const currentLevel = aprobRes.rowCount + 1;
         await client.query("INSERT INTO aprobaciones_oc (entidad_id, nivel, aprobador_id, estado, comentario, fecha_accion) VALUES ($1, $2, $3, 'APROBADO', $4, NOW())", [ocId, currentLevel, userId, comentario]);
         
         if (currentLevel >= requiredLevels) {
            await client.query("UPDATE ordenes_compra SET estado = 'APROBADA' WHERE id = $1", [ocId]);
         }
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
       await client.query('ROLLBACK');
       throw error;
    } finally {
       client.release();
    }
  }
}

export const comprasService = new ComprasService();
