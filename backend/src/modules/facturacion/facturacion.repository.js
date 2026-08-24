import { query, withTransaction } from '../../config/database.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';

export class FacturacionRepository {
  /**
   * Obtener OTs pendientes de facturar
   */
  async getOtsPendientes({ empresa_id, search, limit = 50, offset = 0 }) {
    let sql = `
      SELECT
        ot.id,
        ot.consecutivo,
        ot.tipo_mantenimiento,
        ot.estado,
        ot.horometro_inicial,
        ot.horometro_final,
        e.id           AS empresa_id,
        e.name         AS empresa_nombre,
        e.nit          AS empresa_nit,
        e.condicion_pago,
        liq.total_mano_obra,
        liq.total_repuestos,
        liq.subtotal,
        liq.impuesto_valor  AS iva_valor,
        liq.total_final     AS total,
        liq.fecha_liquidacion,
        EXTRACT(DAY FROM NOW() - liq.fecha_liquidacion)::INT AS dias_desde_liquidacion
      FROM ordenes_trabajo ot
      JOIN companies e ON e.id = ot.empresa_id
      JOIN ot_liquidacion liq ON liq.orden_trabajo_id = ot.id
      WHERE ot.estado = 'LIQUIDADA'
        AND ot.factura_id IS NULL
    `;
    const params = [];

    if (empresa_id) {
      params.push(empresa_id);
      sql += ` AND ot.empresa_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (ot.consecutivo ILIKE $${params.length} OR e.name ILIKE $${params.length})`;
    }

    sql += ` ORDER BY liq.fecha_liquidacion ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Obtener remisiones pendientes de facturar
   */
  async getRemisionesPendientes({ empresa_id, search, limit = 50, offset = 0 }) {
    let sql = `
      SELECT
        r.id,
        r.numero_remision AS consecutivo,
        r.company_id AS empresa_id,
        c.name AS empresa_nombre,
        c.nit AS empresa_nit,
        r.created_at AS fecha_creacion,
        r.updated_at AS fecha_liquidacion,
        r.total_bruto AS subtotal,
        r.iva_valor,
        r.total_neto AS total,
        r.forma_pago AS condicion_pago,
        EXTRACT(DAY FROM NOW() - r.updated_at)::int AS dias_desde_liquidacion,
        r.factura_id
      FROM remisiones r
      JOIN companies c ON c.id = r.company_id
      WHERE r.estado = 'LIQUIDADA'
        AND r.factura_id IS NULL
        AND r.deleted_at IS NULL
    `;
    const params = [];

    if (empresa_id) {
      params.push(empresa_id);
      sql += ` AND r.company_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (r.numero_remision ILIKE $${params.length} OR c.name ILIKE $${params.length})`;
    }

    sql += ` ORDER BY r.updated_at ASC NULLS LAST LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Obtener resumen de cartera por empresa
   */
  async getResumenCartera() {
    const sql = `SELECT * FROM resumen_cartera_por_empresa ORDER BY valor_pendiente_facturar DESC`;
    const result = await query(sql);
    return result.rows;
  }

  /**
   * Obtener lista de facturas
   */
  async getFacturas({ estado, empresa_id, search, limit = 50, offset = 0 }) {
    let sql = `
      SELECT f.*, e.name as empresa_nombre,
             (SELECT STRING_AGG(ot_consecutivo, ', ') FROM factura_ots WHERE factura_id = f.id) as ots_list,
             (SELECT STRING_AGG(remision_numero, ', ') FROM factura_remisiones WHERE factura_id = f.id) as remisiones_list
      FROM facturas f
      JOIN companies e ON f.empresa_id = e.id
      WHERE 1=1
    `;
    const params = [];

    if (estado) {
      params.push(estado);
      sql += ` AND f.estado = $${params.length}`;
    }

    if (empresa_id) {
      params.push(empresa_id);
      sql += ` AND f.empresa_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (f.consecutivo_interno ILIKE $${params.length} OR f.numero_factura ILIKE $${params.length} OR e.name ILIKE $${params.length})`;
    }

    sql += ` ORDER BY f.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Obtener detalle de una factura
   */
  async getFacturaById(id) {
    const factSql = `
      SELECT f.*, e.name as empresa_nombre, e.nit as empresa_nit, e.address as empresa_direccion, e.phone as empresa_telefono
      FROM facturas f
      JOIN companies e ON f.empresa_id = e.id
      WHERE f.id = $1
    `;
    const factRes = await query(factSql, [id]);
    if (factRes.rows.length === 0) return null;

    const factura = factRes.rows[0];

    const otsSql = `
      SELECT fo.*, ot.tipo_mantenimiento, ot.created_at as ot_fecha
      FROM factura_ots fo
      JOIN ordenes_trabajo ot ON fo.ot_id = ot.id
      WHERE fo.factura_id = $1
    `;
    const otsRes = await query(otsSql, [id]);
    factura.ots = otsRes.rows;

    // Return proportional values from factura_remisiones (fr.*) plus original
    // remision components so frontend can compute display values that add up exactly.
    // Formula: total_neto = total_bruto + recargos - descuentos + iva
    const remSql = `
      SELECT fr.*, r.numero_remision, r.fecha_servicio,
             r.total_bruto as orig_bruto,
             COALESCE(r.horas_recargo, 0) * COALESCE(r.valor_hora_recargo, 0) as orig_recargos,
             COALESCE(r.descuentos, 0) as orig_descuentos,
             COALESCE(r.iva_valor, 0) as orig_iva,
             COALESCE(r.total_neto, 0) as orig_total
      FROM factura_remisiones fr
      JOIN remisiones r ON fr.remision_id = r.id
      WHERE fr.factura_id = $1
    `;
    const remRes = await query(remSql, [id]);
    factura.remisiones = remRes.rows;

    return factura;
  }

  /**
   * Crear una prefactura
   */
  async createPrefactura(data, createdBy) {
    const { empresa_id, ots: reqOts, ot_ids, condicion_pago, fecha_vencimiento, notas, numero_factura, fecha_factura } = data;

    if (!numero_factura) throw new BadRequestError('El número de factura es obligatorio');

    // Si viene ot_ids (antiguo), lo convertimos a formato ots
    let otsList = reqOts;
    if (!otsList && ot_ids) {
      otsList = ot_ids.map(id => ({ id }));
    }

    return await withTransaction(async (client) => {
      // 1. Validar OTs
      const otIds = otsList.map(o => o.id);
      const otSql = `
        SELECT ot.id, ot.consecutivo, ot.empresa_id, ot.estado,
               liq.subtotal as liq_subtotal, liq.impuesto_valor as liq_iva, liq.total_final as liq_total,
               liq.total_final - COALESCE((SELECT SUM(total_ot) FROM factura_ots fo WHERE fo.ot_id = ot.id), 0) AS saldo_pendiente
        FROM ordenes_trabajo ot
        JOIN ot_liquidacion liq ON ot.id = liq.orden_trabajo_id
        WHERE ot.id = ANY($1)
      `;
      const otRes = await client.query(otSql, [otIds]);
      const dbOts = otRes.rows;

      if (dbOts.length !== otIds.length) {
        throw new BadRequestError('Una o más OTs no existen o no están liquidadas');
      }

      // Rellenar valores si vinieron por ot_ids sin totales
      otsList = otsList.map(reqOt => {
        const dbOt = dbOts.find(o => o.id === reqOt.id);
        if (!reqOt.total) {
          return { id: reqOt.id, subtotal: dbOt.liq_subtotal, iva_valor: dbOt.liq_iva, total: dbOt.liq_total };
        }
        return reqOt;
      });

      for (const reqOt of otsList) {
        const dbOt = dbOts.find(o => o.id === reqOt.id);
        if (dbOt.empresa_id !== empresa_id) {
          throw new BadRequestError(`La OT ${dbOt.consecutivo} no pertenece a la empresa seleccionada`);
        }
        if (!['LIQUIDADA', 'PARCIALMENTE_FACTURADA'].includes(dbOt.estado)) {
          throw new BadRequestError(`La OT ${dbOt.consecutivo} no está disponible para facturar`);
        }
        if (parseFloat(reqOt.total) > parseFloat(dbOt.saldo_pendiente) + 0.05) {
          throw new BadRequestError(`El valor a facturar de la OT ${dbOt.consecutivo} supera su saldo pendiente`);
        }
      }

      // 2. Generar consecutivo interno para la FACTURA
      const consRes = await client.query(`
        UPDATE consecutivos SET ultimo_valor = ultimo_valor + 1 WHERE id = 'FAC' RETURNING ultimo_valor
      `);
      const nro = consRes.rows[0].ultimo_valor;
      const consecutivo_interno = `FAC-${String(nro).padStart(5, '0')}`;

      // 3. Calcular totales de la factura
      const subtotal = otsList.reduce((sum, ot) => sum + parseFloat(ot.subtotal), 0);
      const iva_valor = otsList.reduce((sum, ot) => sum + parseFloat(ot.iva_valor), 0);
      const total = otsList.reduce((sum, ot) => sum + parseFloat(ot.total), 0);

      // 4. Insertar factura FACTURADA
      const fechaFacturaVal = fecha_factura || new Date().toISOString().split('T')[0];
      const insFactSql = `
        INSERT INTO facturas (
          consecutivo_interno, numero_factura, fecha_factura, empresa_id, estado, 
          subtotal, iva_valor, total, condicion_pago, fecha_vencimiento, notas, 
          creada_por, facturada_por
        ) VALUES ($1, $2, $3, $4, 'FACTURADA', $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      const factRes = await client.query(insFactSql, [
        consecutivo_interno, numero_factura, fechaFacturaVal, empresa_id,
        subtotal, iva_valor, total,
        condicion_pago || null, fecha_vencimiento || null, notas || null,
        createdBy, createdBy
      ]);
      const factura = factRes.rows[0];

      // 5. Relacionar OTs y detectar remanentes
      const remainders = [];
      for (const reqOt of otsList) {
        const dbOt = dbOts.find(o => o.id === reqOt.id);

        await client.query(`
          INSERT INTO factura_ots (factura_id, ot_id, ot_consecutivo, subtotal_ot, iva_ot, total_ot)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [factura.id, dbOt.id, dbOt.consecutivo, reqOt.subtotal, reqOt.iva_valor, reqOt.total]);

        const nuevoSaldo = parseFloat(dbOt.saldo_pendiente) - parseFloat(reqOt.total);
        if (nuevoSaldo > 0.05) {
          // Calcular subtotal/iva proporcional del remanente
          const proporcion = nuevoSaldo / parseFloat(dbOt.liq_total);
          remainders.push({
            ot_id: dbOt.id,
            ot_consecutivo: dbOt.consecutivo,
            subtotal: parseFloat(dbOt.liq_subtotal) * proporcion,
            iva_valor: parseFloat(dbOt.liq_iva) * proporcion,
            total: nuevoSaldo
          });
          await client.query('UPDATE ordenes_trabajo SET estado = $1 WHERE id = $2', ['PARCIALMENTE_FACTURADA', dbOt.id]);
        } else {
          await client.query('UPDATE ordenes_trabajo SET estado = $1, fecha_facturada = COALESCE(fecha_facturada, NOW()) WHERE id = $2', ['FACTURADA', dbOt.id]);
        }
      }

      // 6. Si hay remanentes, crear PREFACTURA automática
      if (remainders.length > 0) {
        const consRes2 = await client.query(`
          UPDATE consecutivos SET ultimo_valor = ultimo_valor + 1 WHERE id = 'FAC' RETURNING ultimo_valor
        `);
        const nro2 = consRes2.rows[0].ultimo_valor;
        const consecutivo_prefactura = `FAC-${String(nro2).padStart(5, '0')}`;

        const prefSubtotal = remainders.reduce((s, r) => s + r.subtotal, 0);
        const prefIva = remainders.reduce((s, r) => s + r.iva_valor, 0);
        const prefTotal = remainders.reduce((s, r) => s + r.total, 0);

        const prefRes = await client.query(`
          INSERT INTO facturas (
            consecutivo_interno, numero_factura, fecha_factura, empresa_id, estado,
            subtotal, iva_valor, total, condicion_pago, fecha_vencimiento, notas,
            creada_por, facturada_por
          ) VALUES ($1, NULL, NULL, $2, 'PREFACTURA', $3, $4, $5, $6, $7, $8, $9, NULL)
          RETURNING *
        `, [
          consecutivo_prefactura, empresa_id,
          prefSubtotal, prefIva, prefTotal,
          condicion_pago || null, fecha_vencimiento || null,
          notas ? `Saldo pendiente: ${notas}` : 'Saldo pendiente de facturación anterior',
          createdBy
        ]);
        const prefactura = prefRes.rows[0];

        for (const rem of remainders) {
          await client.query(`
            INSERT INTO factura_ots (factura_id, ot_id, ot_consecutivo, subtotal_ot, iva_ot, total_ot)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [prefactura.id, rem.ot_id, rem.ot_consecutivo, rem.subtotal, rem.iva_valor, rem.total]);
        }
      }

      return factura;
    });
  }

  /**
   * Crear prefactura desde remisiones de Servicios
   */
  async createPrefacturaFromRemisiones(data, createdBy) {
    const { empresa_id, remisiones, condicion_pago, fecha_vencimiento, notas, numero_factura, fecha_factura } = data;

    if (!numero_factura) throw new BadRequestError('El número de factura es obligatorio');

    return await withTransaction(async (client) => {
      // 1. Validar remisiones (incluir total_bruto e iva original para calcular proporciones)
      const remisionIds = remisiones.map(r => r.id);
      const remSql = `
        SELECT r.id, r.numero_remision, r.company_id, r.estado,
               r.total_bruto AS orig_subtotal, r.iva_valor AS orig_iva, r.total_neto AS orig_total,
               r.total_neto - COALESCE((SELECT SUM(total_rem) FROM factura_remisiones fr WHERE fr.remision_id = r.id), 0) AS saldo_pendiente
        FROM remisiones r
        WHERE r.id = ANY($1)
      `;
      const remRes = await client.query(remSql, [remisionIds]);
      const dbRems = remRes.rows;

      if (dbRems.length !== remisionIds.length) {
        throw new BadRequestError('Una o más remisiones no existen');
      }

      for (const reqRem of remisiones) {
        const dbRem = dbRems.find(r => r.id === reqRem.id);
        if (dbRem.company_id !== empresa_id) {
          throw new BadRequestError(`La remisión ${dbRem.numero_remision} no pertenece a la empresa seleccionada`);
        }
        if (!['LIQUIDADA', 'PARCIALMENTE_FACTURADA'].includes(dbRem.estado)) {
          throw new BadRequestError(`La remisión ${dbRem.numero_remision} no está disponible para facturar`);
        }
        if (parseFloat(reqRem.total) > parseFloat(dbRem.saldo_pendiente) + 0.05) {
          throw new BadRequestError(`El valor a facturar de la remisión ${dbRem.numero_remision} supera su saldo pendiente`);
        }
      }

      // 2. Generar consecutivo para la FACTURA
      const consRes = await client.query(`
        UPDATE consecutivos SET ultimo_valor = ultimo_valor + 1 WHERE id = 'FAC' RETURNING ultimo_valor
      `);
      const nro = consRes.rows[0].ultimo_valor;
      const consecutivo_interno = `FAC-${String(nro).padStart(5, '0')}`;

      // 3. Calcular totales de la factura
      const subtotal = remisiones.reduce((sum, r) => sum + parseFloat(r.subtotal), 0);
      const iva_valor = remisiones.reduce((sum, r) => sum + parseFloat(r.iva_valor), 0);
      const total = remisiones.reduce((sum, r) => sum + parseFloat(r.total), 0);

      // 4. Insertar factura FACTURADA
      const fechaFacturaVal = fecha_factura || new Date().toISOString().split('T')[0];
      const insFactSql = `
        INSERT INTO facturas (
          consecutivo_interno, numero_factura, fecha_factura, empresa_id, estado,
          subtotal, iva_valor, total, condicion_pago, fecha_vencimiento, notas,
          creada_por, facturada_por
        ) VALUES ($1, $2, $3, $4, 'FACTURADA', $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      const factRes = await client.query(insFactSql, [
        consecutivo_interno, numero_factura, fechaFacturaVal, empresa_id,
        subtotal, iva_valor, total,
        condicion_pago || null, fecha_vencimiento || null, notas || null,
        createdBy, createdBy
      ]);
      const factura = factRes.rows[0];

      // 5. Relacionar remisiones y detectar remanentes
      const remainders = [];
      for (const reqRem of remisiones) {
        const dbRem = dbRems.find(r => r.id === reqRem.id);
        
        await client.query(`
          INSERT INTO factura_remisiones (factura_id, remision_id, remision_numero, subtotal_rem, iva_rem, total_rem)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [factura.id, dbRem.id, dbRem.numero_remision, reqRem.subtotal, reqRem.iva_valor, reqRem.total]);

        const nuevoSaldo = parseFloat(dbRem.saldo_pendiente) - parseFloat(reqRem.total);
        if (nuevoSaldo > 0.05) {
          // Calcular subtotal/iva proporcional del remanente
          const proporcion = nuevoSaldo / parseFloat(dbRem.orig_total);
          remainders.push({
            remision_id: dbRem.id,
            numero_remision: dbRem.numero_remision,
            subtotal: parseFloat(dbRem.orig_subtotal) * proporcion,
            iva_valor: parseFloat(dbRem.orig_iva) * proporcion,
            total: nuevoSaldo
          });
          await client.query('UPDATE remisiones SET estado = $1 WHERE id = $2', ['PARCIALMENTE_FACTURADA', dbRem.id]);
        } else {
          await client.query('UPDATE remisiones SET estado = $1, fecha_facturada = COALESCE(fecha_facturada, NOW()) WHERE id = $2', ['FACTURADA', dbRem.id]);
        }
      }

      // 6. Si hay remanentes, crear PREFACTURA automática para el saldo
      if (remainders.length > 0) {
        const consRes2 = await client.query(`
          UPDATE consecutivos SET ultimo_valor = ultimo_valor + 1 WHERE id = 'FAC' RETURNING ultimo_valor
        `);
        const nro2 = consRes2.rows[0].ultimo_valor;
        const consecutivo_prefactura = `FAC-${String(nro2).padStart(5, '0')}`;

        const prefSubtotal = remainders.reduce((s, r) => s + r.subtotal, 0);
        const prefIva = remainders.reduce((s, r) => s + r.iva_valor, 0);
        const prefTotal = remainders.reduce((s, r) => s + r.total, 0);

        const prefRes = await client.query(`
          INSERT INTO facturas (
            consecutivo_interno, numero_factura, fecha_factura, empresa_id, estado,
            subtotal, iva_valor, total, condicion_pago, fecha_vencimiento, notas,
            creada_por, facturada_por
          ) VALUES ($1, NULL, NULL, $2, 'PREFACTURA', $3, $4, $5, $6, $7, $8, $9, NULL)
          RETURNING *
        `, [
          consecutivo_prefactura, empresa_id,
          prefSubtotal, prefIva, prefTotal,
          condicion_pago || null, fecha_vencimiento || null,
          notas ? `Saldo pendiente: ${notas}` : 'Saldo pendiente de facturación anterior',
          createdBy
        ]);
        const prefactura = prefRes.rows[0];

        for (const rem of remainders) {
          await client.query(`
            INSERT INTO factura_remisiones (factura_id, remision_id, remision_numero, subtotal_rem, iva_rem, total_rem)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [prefactura.id, rem.remision_id, rem.numero_remision, rem.subtotal, rem.iva_valor, rem.total]);
        }
      }

      return factura;
    });
  }

  /**
   * Actualizar una prefactura (Remisiones)
   */
  async updateFactura(id, data, updatedBy) {
    const { remisiones, ots, condicion_pago, fecha_vencimiento, notas } = data;

    return await withTransaction(async (client) => {
      const factRes = await client.query('SELECT estado FROM facturas WHERE id = $1 FOR UPDATE', [id]);
      if (factRes.rows.length === 0) throw new NotFoundError('Factura');
      if (factRes.rows[0].estado !== 'PREFACTURA') throw new BadRequestError('Solo se pueden editar prefacturas');

      // Revertir estados de remisiones anteriores si las hay
      const oldRemsRes = await client.query('SELECT remision_id FROM factura_remisiones WHERE factura_id = $1', [id]);
      await client.query('DELETE FROM factura_remisiones WHERE factura_id = $1', [id]);
      for (const old of oldRemsRes.rows) {
        const checkOtros = await client.query('SELECT SUM(total_rem) as sum_rem FROM factura_remisiones WHERE remision_id = $1', [old.remision_id]);
        const sumOtros = parseFloat(checkOtros.rows[0].sum_rem || 0);
        const newState = sumOtros > 0 ? 'PARCIALMENTE_FACTURADA' : 'LIQUIDADA';
        await client.query('UPDATE remisiones SET estado = $1 WHERE id = $2', [newState, old.remision_id]);
      }

      // Revertir estados de OTs anteriores si las hay
      const oldOtsRes = await client.query('SELECT ot_id FROM factura_ots WHERE factura_id = $1', [id]);
      await client.query('DELETE FROM factura_ots WHERE factura_id = $1', [id]);
      for (const old of oldOtsRes.rows) {
        const checkOtros = await client.query('SELECT SUM(total_ot) as sum_ot FROM factura_ots WHERE ot_id = $1', [old.ot_id]);
        const sumOtros = parseFloat(checkOtros.rows[0].sum_ot || 0);
        const newState = sumOtros > 0 ? 'PARCIALMENTE_FACTURADA' : 'LIQUIDADA';
        await client.query('UPDATE ordenes_trabajo SET estado = $1 WHERE id = $2', [newState, old.ot_id]);
      }

      if ((!remisiones || remisiones.length === 0) && (!ots || ots.length === 0)) {
        throw new BadRequestError('La factura debe tener al menos un ítem (remisión u orden de trabajo)');
      }

      let subtotal = 0;
      let iva_valor = 0;
      let total = 0;

      // 2. Procesar nuevas remisiones
      if (remisiones && remisiones.length > 0) {
        const remisionIds = remisiones.map(r => r.id);
        const remSql = `
          SELECT r.id, r.numero_remision, r.company_id, r.estado,
                 r.total_neto - COALESCE((SELECT SUM(total_rem) FROM factura_remisiones fr WHERE fr.remision_id = r.id), 0) AS saldo_pendiente
          FROM remisiones r
          WHERE r.id = ANY($1)
        `;
        const remRes = await client.query(remSql, [remisionIds]);
        const dbRems = remRes.rows;

        if (dbRems.length !== remisionIds.length) throw new BadRequestError('Una o más remisiones no existen');

        for (const reqRem of remisiones) {
          const dbRem = dbRems.find(r => r.id === reqRem.id);
          if (!['LIQUIDADA', 'PARCIALMENTE_FACTURADA'].includes(dbRem.estado)) {
            throw new BadRequestError(`La remisión ${dbRem.numero_remision} no está disponible para facturar`);
          }
          if (parseFloat(reqRem.total) > parseFloat(dbRem.saldo_pendiente) + 0.05) {
            throw new BadRequestError(`El valor a facturar de la remisión ${dbRem.numero_remision} supera su saldo pendiente`);
          }
        }

        subtotal += remisiones.reduce((sum, r) => sum + parseFloat(r.subtotal), 0);
        iva_valor += remisiones.reduce((sum, r) => sum + parseFloat(r.iva_valor), 0);
        total += remisiones.reduce((sum, r) => sum + parseFloat(r.total), 0);
        
        // Guardar remisiones en BD temporalmente
        for (const reqRem of remisiones) {
          const dbRem = dbRems.find(r => r.id === reqRem.id);
          await client.query(`
            INSERT INTO factura_remisiones (factura_id, remision_id, remision_numero, subtotal_rem, iva_rem, total_rem)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [id, dbRem.id, dbRem.numero_remision, reqRem.subtotal, reqRem.iva_valor, reqRem.total]);

          const nuevoSaldo = parseFloat(dbRem.saldo_pendiente) - parseFloat(reqRem.total);
          const remEstado = nuevoSaldo <= 0.05 ? 'FACTURADA' : 'PARCIALMENTE_FACTURADA';
          await client.query('UPDATE remisiones SET estado = $1 WHERE id = $2', [remEstado, dbRem.id]);
        }
      }

      // 3. Procesar nuevas OTs
      if (ots && ots.length > 0) {
        const otIds = ots.map(o => o.id);
        const otSql = `
          SELECT ot.id, ot.consecutivo, ot.estado,
                 liq.total_final - COALESCE((SELECT SUM(total_ot) FROM factura_ots fo WHERE fo.ot_id = ot.id), 0) AS saldo_pendiente
          FROM ordenes_trabajo ot
          JOIN ot_liquidacion liq ON ot.id = liq.orden_trabajo_id
          WHERE ot.id = ANY($1)
        `;
        const otRes = await client.query(otSql, [otIds]);
        const dbOts = otRes.rows;

        if (dbOts.length !== otIds.length) throw new BadRequestError('Una o más OTs no existen');

        for (const reqOt of ots) {
          const dbOt = dbOts.find(o => o.id === reqOt.id);
          if (!['LIQUIDADA', 'PARCIALMENTE_FACTURADA'].includes(dbOt.estado)) {
            throw new BadRequestError(`La OT ${dbOt.consecutivo} no está disponible para facturar`);
          }
          if (parseFloat(reqOt.total) > parseFloat(dbOt.saldo_pendiente) + 0.05) {
            throw new BadRequestError(`El valor a facturar de la OT ${dbOt.consecutivo} supera su saldo pendiente`);
          }
        }

        subtotal += ots.reduce((sum, o) => sum + parseFloat(o.subtotal), 0);
        iva_valor += ots.reduce((sum, o) => sum + parseFloat(o.iva_valor), 0);
        total += ots.reduce((sum, o) => sum + parseFloat(o.total), 0);

        // Guardar OTs en BD
        for (const reqOt of ots) {
          const dbOt = dbOts.find(o => o.id === reqOt.id);
          await client.query(`
            INSERT INTO factura_ots (factura_id, ot_id, ot_consecutivo, subtotal_ot, iva_ot, total_ot)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [id, dbOt.id, dbOt.consecutivo, reqOt.subtotal, reqOt.iva_valor, reqOt.total]);

          const nuevoSaldo = parseFloat(dbOt.saldo_pendiente) - parseFloat(reqOt.total);
          const otEstado = nuevoSaldo <= 0.05 ? 'FACTURADA' : 'PARCIALMENTE_FACTURADA';
          await client.query('UPDATE ordenes_trabajo SET estado = $1 WHERE id = $2', [otEstado, dbOt.id]);
        }
      }

      // 4. Actualizar factura
      const updFactSql = `
        UPDATE facturas SET
          subtotal = $1, iva_valor = $2, total = $3,
          condicion_pago = COALESCE($4, condicion_pago),
          fecha_vencimiento = COALESCE($5, fecha_vencimiento),
          notas = COALESCE($6, notas),
          updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `;
      const updFactRes = await client.query(updFactSql, [
        subtotal, iva_valor, total, condicion_pago, fecha_vencimiento, notas, id
      ]);
      return updFactRes.rows[0];
    });
  }

  /**
   * Confirmar factura con número externo
   */
  async confirmarFactura(id, data, confirmedBy) {
    const { numero_factura, fecha_factura, sistema_contable, sistema_contable_id, notas } = data;

    return await withTransaction(async (client) => {
      const factRes = await client.query('SELECT estado FROM facturas WHERE id = $1 FOR UPDATE', [id]);
      if (factRes.rows.length === 0) throw new NotFoundError('Factura');
      if (factRes.rows[0].estado !== 'PREFACTURA') throw new BadRequestError('Solo se pueden confirmar prefacturas');

      // Actualizar factura a FACTURADA
      const updFactSql = `
        UPDATE facturas SET
          numero_factura = $1,
          fecha_factura = $2,
          sistema_contable = $3,
          sistema_contable_id = $4,
          notas = COALESCE($5, notas),
          estado = 'FACTURADA',
          facturada_por = $6,
          updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `;
      const updFactRes = await client.query(updFactSql, [
        numero_factura, fecha_factura, sistema_contable, sistema_contable_id, notas || null, confirmedBy, id
      ]);

      // Verificar saldo real de cada remisión vinculada
      const remsInFactura = await client.query('SELECT remision_id FROM factura_remisiones WHERE factura_id = $1', [id]);
      for (const row of remsInFactura.rows) {
        // Calcular saldo pendiente real
        const checkSql = `
          SELECT r.total_neto - COALESCE((SELECT SUM(total_rem) FROM factura_remisiones fr WHERE fr.remision_id = r.id), 0) AS saldo_pendiente
          FROM remisiones r WHERE r.id = $1
        `;
        const rCheck = await client.query(checkSql, [row.remision_id]);
        if (rCheck.rows.length > 0) {
          const saldo = parseFloat(rCheck.rows[0].saldo_pendiente);
          // Verificar si TODAS las facturas vinculadas a esta remisión son FACTURADA
          const prefCheck = await client.query(`
            SELECT COUNT(*) as cnt FROM factura_remisiones fr 
            JOIN facturas f ON f.id = fr.factura_id 
            WHERE fr.remision_id = $1 AND f.estado = 'PREFACTURA'
          `, [row.remision_id]);
          const hasPrefacturas = parseInt(prefCheck.rows[0].cnt) > 0;
          
          if (saldo <= 0.05 && !hasPrefacturas) {
            await client.query('UPDATE remisiones SET estado = $1, fecha_facturada = COALESCE(fecha_facturada, NOW()) WHERE id = $2', ['FACTURADA', row.remision_id]);
          }
        }
      }

      // Verificar saldo real de cada OT vinculada
      const otsInFactura = await client.query('SELECT ot_id FROM factura_ots WHERE factura_id = $1', [id]);
      for (const row of otsInFactura.rows) {
        const checkSql = `
          SELECT liq.total_final - COALESCE((SELECT SUM(total_ot) FROM factura_ots fo WHERE fo.ot_id = ot.id), 0) AS saldo_pendiente
          FROM ordenes_trabajo ot
          JOIN ot_liquidacion liq ON ot.id = liq.orden_trabajo_id
          WHERE ot.id = $1
        `;
        const rCheck = await client.query(checkSql, [row.ot_id]);
        if (rCheck.rows.length > 0) {
          const saldo = parseFloat(rCheck.rows[0].saldo_pendiente);
          const prefCheck = await client.query(`
            SELECT COUNT(*) as cnt FROM factura_ots fo 
            JOIN facturas f ON f.id = fo.factura_id 
            WHERE fo.ot_id = $1 AND f.estado = 'PREFACTURA'
          `, [row.ot_id]);
          const hasPrefacturas = parseInt(prefCheck.rows[0].cnt) > 0;
          
          if (saldo <= 0.05 && !hasPrefacturas) {
            await client.query('UPDATE ordenes_trabajo SET estado = $1, fecha_facturada = COALESCE(fecha_facturada, NOW()) WHERE id = $2', ['FACTURADA', row.ot_id]);
          }
        }
      }

      return updFactRes.rows[0];
    });
  }

  /**
   * Anular factura
   */
  async anularFactura(id, motivo, cancelledBy) {
    return await withTransaction(async (client) => {
      const factRes = await client.query('SELECT estado FROM facturas WHERE id = $1 FOR UPDATE', [id]);
      if (factRes.rows.length === 0) throw new NotFoundError('Factura');
      if (factRes.rows[0].estado === 'ANULADA') throw new BadRequestError('La factura ya está anulada');

      // 1. Obtener relaciones antes de eliminarlas
      const remsInFactura = await client.query('SELECT remision_id FROM factura_remisiones WHERE factura_id = $1', [id]);
      const otsInFactura = await client.query('SELECT ot_id FROM factura_ots WHERE factura_id = $1', [id]);
      
      // 2. Eliminar relaciones
      await client.query('DELETE FROM factura_remisiones WHERE factura_id = $1', [id]);
      await client.query('DELETE FROM factura_ots WHERE factura_id = $1', [id]);

      // 3. Recalcular estado de remisiones
      for (const row of remsInFactura.rows) {
        const checkOtros = await client.query('SELECT SUM(total_rem) as sum_rem FROM factura_remisiones WHERE remision_id = $1', [row.remision_id]);
        const sumOtros = parseFloat(checkOtros.rows[0].sum_rem || 0);
        const newState = sumOtros > 0 ? 'PARCIALMENTE_FACTURADA' : 'LIQUIDADA';
        await client.query('UPDATE remisiones SET estado = $1, fecha_facturada = NULL WHERE id = $2', [newState, row.remision_id]);
      }

      // 4. Recalcular estado de OTs
      for (const row of otsInFactura.rows) {
        const checkOtros = await client.query('SELECT SUM(total_ot) as sum_ot FROM factura_ots WHERE ot_id = $1', [row.ot_id]);
        const sumOtros = parseFloat(checkOtros.rows[0].sum_ot || 0);
        const newState = sumOtros > 0 ? 'PARCIALMENTE_FACTURADA' : 'LIQUIDADA';
        await client.query('UPDATE ordenes_trabajo SET estado = $1, fecha_facturada = NULL WHERE id = $2', [newState, row.ot_id]);
      }

      // 5. Anular factura
      await client.query(`
        UPDATE facturas SET
          estado = 'ANULADA',
          anulada_por = $1,
          motivo_anulacion = $2,
          updated_at = NOW()
        WHERE id = $3
      `, [cancelledBy, motivo, id]);

      return { success: true };
    });
  }

  /**
   * Actualizar campos simples de una factura (numero_factura, fecha, monto, descripción)
   * PREFACTURA: cualquier usuario con permiso editar
   * FACTURADA: solo administradores
   */
  async updateFacturaFields(id, { numero_factura, fecha_factura, total, notas }, isAdmin) {
    return await withTransaction(async (client) => {
      const factRes = await client.query('SELECT * FROM facturas WHERE id = $1 FOR UPDATE', [id]);
      if (factRes.rows.length === 0) throw new NotFoundError('Factura');

      const factura = factRes.rows[0];
      const estado = factura.estado;

      if (estado === 'ANULADA') {
        throw new BadRequestError('No se pueden editar facturas anuladas');
      }

      if (estado === 'FACTURADA' && !isAdmin) {
        throw new BadRequestError('Solo administradores pueden editar facturas ya facturadas');
      }

      if (!['PREFACTURA', 'FACTURADA'].includes(estado)) {
        throw new BadRequestError('La factura no se encuentra en un estado editable');
      }

      // Recalcular subtotal e iva proporcional al nuevo total
      const totalNum = parseFloat(total);
      if (isNaN(totalNum) || totalNum < 0) {
        throw new BadRequestError('El monto debe ser un número válido');
      }

      const subtotal = totalNum / 1.19;
      const iva_valor = totalNum - subtotal;

      const oldTotal = parseFloat(factura.total);
      const diferencia = oldTotal - totalNum;

      // 1. Actualizar la factura con el nuevo monto
      const updSql = `
        UPDATE facturas SET
          numero_factura = $1,
          fecha_factura = $2,
          subtotal = $3,
          iva_valor = $4,
          total = $5,
          notas = $6,
          updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `;
      const updRes = await client.query(updSql, [
        numero_factura || null,
        fecha_factura || null,
        subtotal,
        iva_valor,
        totalNum,
        notas || null,
        id
      ]);

      // 2. Si es FACTURADA y se redujo el monto, crear PREFACTURA complementaria con el restante
      if (estado === 'FACTURADA' && diferencia > 0.05) {
        // Obtener remisiones vinculadas
        const remsRes = await client.query(
          'SELECT fr.*, r.total_neto AS orig_total, r.total_bruto AS orig_subtotal, r.iva_valor AS orig_iva FROM factura_remisiones fr JOIN remisiones r ON r.id = fr.remision_id WHERE fr.factura_id = $1',
          [id]
        );
        // Obtener OTs vinculadas
        const otsRes = await client.query(
          'SELECT fo.*, liq.total_final AS orig_total, liq.subtotal AS orig_subtotal, liq.impuesto_valor AS orig_iva FROM factura_ots fo JOIN ordenes_trabajo ot ON ot.id = fo.ot_id JOIN ot_liquidacion liq ON liq.orden_trabajo_id = ot.id WHERE fo.factura_id = $1',
          [id]
        );

        const hasRemisiones = remsRes.rows.length > 0;
        const hasOts = otsRes.rows.length > 0;

        // Proporción del recorte respecto al total original de la factura
        const proporcionRecorte = diferencia / oldTotal;

        // Generar consecutivo para la PREFACTURA complementaria
        const consRes = await client.query(`
          UPDATE consecutivos SET ultimo_valor = ultimo_valor + 1 WHERE id = 'FAC' RETURNING ultimo_valor
        `);
        const nro = consRes.rows[0].ultimo_valor;
        const consecutivo_prefactura = `FAC-${String(nro).padStart(5, '0')}`;

        const prefSubtotal = diferencia / 1.19;
        const prefIva = diferencia - prefSubtotal;

        // Crear PREFACTURA complementaria
        const prefRes = await client.query(`
          INSERT INTO facturas (
            consecutivo_interno, numero_factura, fecha_factura, empresa_id, estado,
            subtotal, iva_valor, total, condicion_pago, fecha_vencimiento, notas,
            creada_por, facturada_por
          ) VALUES ($1, NULL, NULL, $2, 'PREFACTURA', $3, $4, $5, $6, $7, $8, $9, NULL)
          RETURNING *
        `, [
          consecutivo_prefactura, factura.empresa_id,
          prefSubtotal, prefIva, diferencia,
          factura.condicion_pago || null, factura.fecha_vencimiento || null,
          `Saldo pendiente de factura ${factura.numero_factura || factura.consecutivo_interno}`,
          factura.creada_por
        ]);
        const prefactura = prefRes.rows[0];

        // Vincular remisiones a la PREFACTURA y actualizar proporciones en factura original
        if (hasRemisiones) {
          for (const fr of remsRes.rows) {
            const oldTotalRem = parseFloat(fr.total_rem);
            const recorteRem = oldTotalRem * proporcionRecorte;
            const nuevoTotalRem = oldTotalRem - recorteRem;

            // Actualizar la factura_remisiones original con el monto reducido
            const nuevoSubRem = nuevoTotalRem / 1.19;
            const nuevoIvaRem = nuevoTotalRem - nuevoSubRem;
            await client.query(
              'UPDATE factura_remisiones SET subtotal_rem = $1, iva_rem = $2, total_rem = $3 WHERE factura_id = $4 AND remision_id = $5',
              [nuevoSubRem, nuevoIvaRem, nuevoTotalRem, id, fr.remision_id]
            );

            // Insertar remisión en la PREFACTURA con el saldo recortado
            const prefSubRem = recorteRem / 1.19;
            const prefIvaRem = recorteRem - prefSubRem;
            await client.query(`
              INSERT INTO factura_remisiones (factura_id, remision_id, remision_numero, subtotal_rem, iva_rem, total_rem)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [prefactura.id, fr.remision_id, fr.remision_numero, prefSubRem, prefIvaRem, recorteRem]);

            // Actualizar estado de la remisión a PARCIALMENTE_FACTURADA
            await client.query('UPDATE remisiones SET estado = $1 WHERE id = $2', ['PARCIALMENTE_FACTURADA', fr.remision_id]);
          }
        }

        // Vincular OTs a la PREFACTURA y actualizar proporciones en factura original
        if (hasOts) {
          for (const fo of otsRes.rows) {
            const oldTotalOt = parseFloat(fo.total_ot);
            const recorteOt = oldTotalOt * proporcionRecorte;
            const nuevoTotalOt = oldTotalOt - recorteOt;

            // Actualizar la factura_ots original con el monto reducido
            const nuevoSubOt = nuevoTotalOt / 1.19;
            const nuevoIvaOt = nuevoTotalOt - nuevoSubOt;
            await client.query(
              'UPDATE factura_ots SET subtotal_ot = $1, iva_ot = $2, total_ot = $3 WHERE factura_id = $4 AND ot_id = $5',
              [nuevoSubOt, nuevoIvaOt, nuevoTotalOt, id, fo.ot_id]
            );

            // Insertar OT en la PREFACTURA con el saldo recortado
            const prefSubOt = recorteOt / 1.19;
            const prefIvaOt = recorteOt - prefSubOt;
            await client.query(`
              INSERT INTO factura_ots (factura_id, ot_id, ot_consecutivo, subtotal_ot, iva_ot, total_ot)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [prefactura.id, fo.ot_id, fo.ot_consecutivo, prefSubOt, prefIvaOt, recorteOt]);

            // Actualizar estado de la OT a PARCIALMENTE_FACTURADA
            await client.query('UPDATE ordenes_trabajo SET estado = $1 WHERE id = $2', ['PARCIALMENTE_FACTURADA', fo.ot_id]);
          }
        }
      }

      return updRes.rows[0];
    });
  }
}
