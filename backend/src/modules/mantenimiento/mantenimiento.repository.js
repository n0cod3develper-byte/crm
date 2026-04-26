import { query, withTransaction } from '../../config/database.js';
import { env } from '../../config/env.js';
import { PMRepository } from './pm.repository.js';

const pmRepo = new PMRepository();

export class MantenimientoRepository {
  
  // ==========================================
  // ORDENES DE TRABAJO (OT)
  // ==========================================

  async findAllOT({ empresa_id, equipo_id, estado, tipo_mantenimiento, search, limit = 50, cursor }) {
    const conditions = ['ot.deleted_at IS NULL'];
    const params = [];
    let i = 1;

    if (empresa_id) { conditions.push(`ot.empresa_id = $${i++}`); params.push(empresa_id); }
    if (equipo_id) { conditions.push(`ot.equipo_id = $${i++}`); params.push(equipo_id); }
    if (estado && estado !== 'all') { conditions.push(`ot.estado = $${i++}`); params.push(estado); }
    if (tipo_mantenimiento && tipo_mantenimiento !== 'all') { conditions.push(`ot.tipo_mantenimiento = $${i++}`); params.push(tipo_mantenimiento); }
    if (search && search.trim() !== '') {
      conditions.push(`(ot.consecutivo ILIKE $${i} OR ot.detalle_servicio ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }
    if (cursor) {
      conditions.push(`ot.created_at < (SELECT created_at FROM ordenes_trabajo WHERE id = $${i++})`);
      params.push(cursor);
    }
    params.push(limit + 1);

    const sql = `
      SELECT ot.*, 
             c.name AS empresa_nombre,
             e.marca AS equipo_marca, e.modelo AS equipo_modelo, e.serial AS equipo_serial,
             f.nombre AS frecuencia_nombre, f.horas AS frecuencia_horas
      FROM ordenes_trabajo ot
      JOIN companies c ON c.id = ot.empresa_id
      JOIN equipos e ON e.id = ot.equipo_id
      LEFT JOIN pm_frecuencias f ON f.id = ot.pm_frecuencia_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ot.created_at DESC
      LIMIT $${i}
    `;

    const result = await query(sql, params);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    // Obtener los técnicos asignados de manera agregada
    if (rows.length > 0) {
      const otIds = rows.map(r => r.id);
      const tecnicosStr = otIds.map((_, index) => `$${index + 1}`).join(', ');
      
      const tecnicosRes = await query(`
        SELECT t.orden_trabajo_id, em.full_name
        FROM ot_tecnicos t
        JOIN employees em ON em.id = t.empleado_id
        WHERE t.orden_trabajo_id IN (${tecnicosStr})
      `, otIds);

      rows.forEach(r => {
        r.tecnicos = tecnicosRes.rows
          .filter(t => t.orden_trabajo_id === r.id)
          .map(t => t.full_name);
      });
    }

    return { data: rows, pagination: { hasMore, nextCursor: hasMore ? rows[rows.length - 1].id : null } };
  }

  async findOTById(id) {
    const otRes = await query(`
      SELECT ot.*, 
             c.name AS empresa_nombre, c.nit AS empresa_nit, c.phone as empresa_telefono, c.address as empresa_direccion,
             e.marca AS equipo_marca, e.modelo AS equipo_modelo, e.serial AS equipo_serial,
             f.nombre AS frecuencia_nombre, f.horas AS frecuencia_horas, f.version AS frecuencia_version
      FROM ordenes_trabajo ot
      JOIN companies c ON c.id = ot.empresa_id
      JOIN equipos e ON e.id = ot.equipo_id
      LEFT JOIN pm_frecuencias f ON f.id = ot.pm_frecuencia_id
      WHERE ot.id = $1 AND ot.deleted_at IS NULL
    `, [id]);

    if (!otRes.rows[0]) return null;
    const ot = otRes.rows[0];

    const tecnicosRes = await query(`
      SELECT t.*, e.full_name, e.position
      FROM ot_tecnicos t
      JOIN employees e ON e.id = t.empleado_id
      WHERE t.orden_trabajo_id = $1
    `, [id]);
    ot.tecnicos_asignados = tecnicosRes.rows;

    const repuestosRes = await query(`
      SELECT * FROM ot_repuestos_insumos WHERE orden_trabajo_id = $1
    `, [id]);
    ot.repuestos_insumos = repuestosRes.rows;

    const liqRes = await query(`SELECT * FROM ot_liquidacion WHERE orden_trabajo_id = $1`, [id]);
    ot.liquidacion = liqRes.rows[0] || null;

    // Si es preventiva, cargar las actividades del snapshot
    if (ot.tipo_mantenimiento === 'PREVENTIVO') {
      ot.pm_actividades = await pmRepo.findActividadesOT(id);
    }

    return ot;
  }

  async getEmpresaByName(name) {
    const result = await query(`SELECT * FROM companies WHERE name = $1 LIMIT 1`, [name]);
    return result.rows[0];
  }

  async generarConsecutivo(empresaNombre, client) {
    // Definimos el prefijo según el nombre exacto de la empresa o uno por defecto
    const isCargar = empresaNombre === 'CARGAR S.A.S.';
    const codigo_serie = isCargar ? 'CAR' : 'OT';

    // Usar FOR UPDATE para bloquear el registro y asegurar concurrencia sin condiciones de carrera
    const sqlSelect = `SELECT ultimo_valor FROM consecutivos WHERE id = $1 FOR UPDATE`;
    const resConsecutivo = await client.query(sqlSelect, [codigo_serie]);
    
    // Si la serie no existe por alguna razón, usar 0 y se manejará con el insert
    let current_val = 0;
    if (resConsecutivo.rows.length > 0) {
        current_val = resConsecutivo.rows[0].ultimo_valor;
    }

    const next_val = current_val + 1;
    
    const sqlUpdate = `
      INSERT INTO consecutivos (id, ultimo_valor) 
      VALUES ($1, $2) 
      ON CONFLICT (id) 
      DO UPDATE SET ultimo_valor = EXCLUDED.ultimo_valor
    `;
    await client.query(sqlUpdate, [codigo_serie, next_val]);

    const formatted = `${codigo_serie}-${String(next_val).padStart(5, '0')}`;
    return formatted;
  }

  /**
   * Crea una OT. Si es PREVENTIVO y tiene pm_frecuencia_id,
   * copia atómicamente las actividades e insumos de la plantilla
   * dentro de la misma transacción.
   */
  async createOT(data, userId) {
    const { tipo_mantenimiento, empresa_id, equipo_id, responsable, contacto_empresa, telefono_contacto, detalle_servicio, pm_frecuencia_id } = data;
    const horometro_inicial = data.horometro_inicial === '' ? null : data.horometro_inicial;
    
    return await withTransaction(async (client) => {
        // Encontrar info de empresa para determinar la serie
        const empRes = await client.query(`SELECT name FROM companies WHERE id = $1`, [empresa_id]);
        if (!empRes.rows[0]) throw new Error('Empresa no encontrada');
        
        const consecutivo = await this.generarConsecutivo(empRes.rows[0].name, client);

        // Calcular horómetro de frecuencia si es preventivo
        let horometro_frecuencia = null;
        if (tipo_mantenimiento === 'PREVENTIVO' && pm_frecuencia_id) {
          const freqRes = await client.query(`SELECT horas FROM pm_frecuencias WHERE id = $1`, [pm_frecuencia_id]);
          if (freqRes.rows[0] && horometro_inicial) {
            horometro_frecuencia = Math.round(parseFloat(horometro_inicial) + freqRes.rows[0].horas);
          }
        }

        const sqlInsert = `
            INSERT INTO ordenes_trabajo 
            (consecutivo, tipo_mantenimiento, empresa_id, equipo_id, horometro_inicial, responsable, contacto_empresa, telefono_contacto, detalle_servicio, created_by, pm_frecuencia_id, horometro_frecuencia)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `;
        const res = await client.query(sqlInsert, [
          consecutivo ?? null,
          tipo_mantenimiento ?? null,
          empresa_id ?? null,
          equipo_id ?? null,
          horometro_inicial ?? null,
          responsable ?? null,
          contacto_empresa ?? null,
          telefono_contacto ?? null,
          detalle_servicio ?? null,
          userId ?? null,
          (tipo_mantenimiento === 'PREVENTIVO' && pm_frecuencia_id) ? pm_frecuencia_id : null,
          horometro_frecuencia ?? null
        ]);
        const ot = res.rows[0];

        // Si es preventivo con frecuencia, copiar plantilla (snapshot atómico)
        if (tipo_mantenimiento === 'PREVENTIVO' && pm_frecuencia_id) {
          await pmRepo.copiarPlantillaAOT(client, ot.id, pm_frecuencia_id);
        }

        return ot;
    });
  }

  async updateOT(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const allowed = ['tipo_mantenimiento', 'horometro_inicial', 'horometro_final', 'responsable', 'contacto_empresa', 'telefono_contacto', 'detalle_servicio', 'observaciones', 'estado'];
    
    for (const key of allowed) {
      if (key in data && data[key] !== undefined) {
        let val = data[key];
        if ((key === 'horometro_inicial' || key === 'horometro_final') && val === '') {
          val = null;
        }
        fields.push(`${key} = $${i++}`);
        values.push(val);
      }
    }
    
    if (fields.length === 0) return await this.findOTById(id);
    
    values.push(id);
    const result = await query(
      `UPDATE ordenes_trabajo SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async softDeleteOT(id) {
    const result = await query(
      `UPDATE ordenes_trabajo SET deleted_at = NOW(), estado = 'CERRADA' WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0];
  }

  // ==========================================
  // TECNICOS
  // ==========================================

  async addTecnico(ot_id, data) {
    const { empleado_id, tarifa_hora } = data;
    const res = await query(
        `INSERT INTO ot_tecnicos (orden_trabajo_id, empleado_id, tarifa_hora) VALUES ($1, $2, $3) RETURNING *`,
        [ot_id, empleado_id, tarifa_hora || 0]
    );
    return res.rows[0];
  }

  async updateTecnico(ot_id, tid, data) {
      const { fecha_salida, hora_salida, fecha_regreso, hora_regreso } = data;
      
      let tiempo_total_min = null;
      let total_mano_obra = 0;

      // Buscar info del tecnico para recalcular
      const techRes = await query(`SELECT tarifa_hora FROM ot_tecnicos WHERE id = $1 AND orden_trabajo_id = $2`, [tid, ot_id]);
      if(techRes.rows.length === 0) throw new Error("Tecnico no encontrado o no pertenece a la OT");
      const tarifa_hora = techRes.rows[0].tarifa_hora;

      if(fecha_salida && hora_salida && fecha_regreso && hora_regreso) {
          const start = new Date(`${fecha_salida}T${hora_salida}`);
          const end = new Date(`${fecha_regreso}T${hora_regreso}`);
          if (end > start) {
              tiempo_total_min = Math.floor((end - start) / 60000);
              total_mano_obra = (tiempo_total_min / 60.0) * tarifa_hora;
          }
      }

      const res = await query(`
          UPDATE ot_tecnicos 
          SET fecha_salida = $1, hora_salida = $2, fecha_regreso = $3, hora_regreso = $4, tiempo_total_min = $5, total_mano_obra = $6
          WHERE id = $7 AND orden_trabajo_id = $8 RETURNING *
      `, [fecha_salida || null, hora_salida || null, fecha_regreso || null, hora_regreso || null, tiempo_total_min, total_mano_obra, tid, ot_id]);

      return res.rows[0];
  }

  async removeTecnico(ot_id, tid) {
      await query(`DELETE FROM ot_tecnicos WHERE id = $1 AND orden_trabajo_id = $2`, [tid, ot_id]);
      return true;
  }

  // ==========================================
  // REPUESTOS E INSUMOS
  // ==========================================
  async searchInventario(q) {
      const result = await query(
          `SELECT id, sku, name, description, unit, unit_price, stock_current 
           FROM inventory_items 
           WHERE (name ILIKE $1 OR sku ILIKE $1) AND is_active = true
           LIMIT 20`,
          [`%${q}%`]
      );
      return result.rows;
  }

  async addRepuesto(ot_id, data) {
      const { item_inventario_id, descripcion, cantidad, unidad, precio_unitario, origen, pm_insumo_id } = data;
      const total = cantidad * precio_unitario;

      const res = await query(
          `INSERT INTO ot_repuestos_insumos (orden_trabajo_id, item_inventario_id, descripcion, cantidad, unidad, precio_unitario, total, origen, pm_insumo_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [ot_id, item_inventario_id, descripcion, cantidad, unidad, precio_unitario, total, origen || 'MANUAL', pm_insumo_id || null]
      );
      return res.rows[0];
  }

  async updateRepuesto(ot_id, rid, data) {
      const { cantidad, precio_unitario } = data;
      
      // Get current values if not provided
      const repRes = await query(`SELECT cantidad, precio_unitario FROM ot_repuestos_insumos WHERE id = $1 AND orden_trabajo_id = $2`, [rid, ot_id]);
      if(repRes.rows.length === 0) throw new Error("Repuesto no encontrado en esta OT");
      
      const newCant = cantidad !== undefined ? cantidad : repRes.rows[0].cantidad;
      const newPrice = precio_unitario !== undefined ? precio_unitario : repRes.rows[0].precio_unitario;
      const total = newCant * newPrice;

      const res = await query(
          `UPDATE ot_repuestos_insumos 
           SET cantidad = $1, precio_unitario = $2, total = $3 
           WHERE id = $4 AND orden_trabajo_id = $5 RETURNING *`,
          [newCant, newPrice, total, rid, ot_id]
      );
      return res.rows[0];
  }

  async removeRepuesto(ot_id, rid) {
      await query(`DELETE FROM ot_repuestos_insumos WHERE id = $1 AND orden_trabajo_id = $2`, [rid, ot_id]);
      return true;
  }


  // ==========================================
  // LIQUIDACION (ATÓMICA)
  // ==========================================
  async liquidarOT(ot_id, notas_liquidacion, impuesto_pct, user_id) {
      return await withTransaction(async (client) => {
          // 1. Verificar estado actual
          const otRes = await client.query(`SELECT estado, consecutivo, tipo_mantenimiento FROM ordenes_trabajo WHERE id = $1 FOR UPDATE`, [ot_id]);
          if(otRes.rows.length === 0) throw new Error("OT no encontrada.");
          if(otRes.rows[0].estado === 'LIQUIDADA' || otRes.rows[0].estado === 'CERRADA') {
              throw new Error(`La OT ya está ${otRes.rows[0].estado}`);
          }
          const consecutivo = otRes.rows[0].consecutivo;

          // 1.5 Verificar completitud documental (OT Firmada)
          const docCheckRes = await client.query(`SELECT puede_liquidar FROM ot_puede_liquidar WHERE id = $1`, [ot_id]);
          if (docCheckRes.rows.length > 0 && !docCheckRes.rows[0].puede_liquidar) {
              const err = new Error("No se puede liquidar la OT");
              err.codigo = "OT_FIRMADA_REQUERIDA";
              err.mensaje = "Debes subir la orden de trabajo firmada por el cliente antes de liquidar. Usa el botón 'Subir OT firmada' en la sección de documentos.";
              err.ot_consecutivo = consecutivo;
              throw err;
          }

          // 2. Sumar Mano de Obra
          const moRes = await client.query(`SELECT SUM(total_mano_obra) as sum_mo FROM ot_tecnicos WHERE orden_trabajo_id = $1`, [ot_id]);
          const total_mano_obra = parseFloat(moRes.rows[0].sum_mo) || 0;

          // 3. Revisar Repuestos Múltiples e Inventario (Stock Constraint)
          //    Incluye tanto los de la plantilla PM como los manuales
          const repsReq = await client.query(`SELECT * FROM ot_repuestos_insumos WHERE orden_trabajo_id = $1 FOR UPDATE`, [ot_id]);
          
          let total_repuestos = 0;
          let insuficientes = [];

          for(const rep of repsReq.rows) {
              total_repuestos += parseFloat(rep.total);

              // Consultar el stock actual
              const invRes = await client.query(`SELECT stock_current FROM inventory_items WHERE id = $1 FOR UPDATE`, [rep.item_inventario_id]);
              if(invRes.rows.length === 0) throw new Error(`Item ${rep.descripcion} no existe en inventario.`);
              
              const currentStock = parseFloat(invRes.rows[0].stock_current);
              const requested = parseFloat(rep.cantidad);

              if(currentStock < requested) {
                  insuficientes.push(`${rep.descripcion}: requiere ${requested}, disponible ${currentStock}`);
              }
          }

          if(insuficientes.length > 0) {
              throw new Error(`Stock insuficiente para liquidar: \n${insuficientes.join('\n')}`);
          }

          // 4. Descargar de Inventario
          for(const rep of repsReq.rows) {
              const requested = parseFloat(rep.cantidad);
              await client.query(`UPDATE inventory_items SET stock_current = stock_current - $1 WHERE id = $2`, [requested, rep.item_inventario_id]);
              
              const desc = `Descargo OT: ${consecutivo}`;
              await client.query(`
                  INSERT INTO inventory_movements (item_id, type, quantity, reference, notes, created_by)
                  VALUES ($1, 'out', $2, $3, $4, $5)
              `, [rep.item_inventario_id, requested, consecutivo, desc, user_id]);

              await client.query(`UPDATE ot_repuestos_insumos SET descargado = TRUE, fecha_descargo = NOW() WHERE id = $1`, [rep.id]);
          }

          // 5. Crear Registro Liquidación
          const subtotal = total_mano_obra + total_repuestos;
          const pct = impuesto_pct || 19.0;
          const impuesto_valor = subtotal * (pct / 100);
          const total_final = subtotal + impuesto_valor;

          await client.query(`
              INSERT INTO ot_liquidacion (orden_trabajo_id, total_mano_obra, total_repuestos, subtotal, impuesto_pct, impuesto_valor, total_final, liquidado_por, notas_liquidacion)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [ot_id, total_mano_obra, total_repuestos, subtotal, pct, impuesto_valor, total_final, user_id, notas_liquidacion]);

          // 6. Cambiar estado
          await client.query(`UPDATE ordenes_trabajo SET estado = 'LIQUIDADA', updated_at = NOW() WHERE id = $1`, [ot_id]);

          return { success: true, message: 'La OT fue liquidada y el inventario descargado con éxito.' };
      });
  }

}
