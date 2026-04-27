import { query, withTransaction } from '../../config/database.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';

export class FacturacionRepository {
  /**
   * Obtener OTs pendientes de facturar
   */
  async getOtsPendientes({ empresa_id, search, limit = 50, offset = 0 }) {
    let sql = `SELECT * FROM ots_pendientes_facturar WHERE 1=1`;
    const params = [];

    if (empresa_id) {
      params.push(empresa_id);
      sql += ` AND empresa_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (consecutivo ILIKE $${params.length} OR empresa_nombre ILIKE $${params.length})`;
    }

    sql += ` ORDER BY fecha_liquidacion ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
      SELECT f.*, e.name as empresa_nombre 
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

    return factura;
  }

  /**
   * Crear una prefactura
   */
  async createPrefactura(data, createdBy) {
    const { empresa_id, ot_ids, condicion_pago, fecha_vencimiento, notas, numero_factura } = data;

    return await withTransaction(async (client) => {
      // 1. Validar OTs
      const otSql = `
        SELECT ot.id, ot.consecutivo, ot.empresa_id, ot.estado, ot.factura_id,
               liq.subtotal, liq.impuesto_valor as iva_valor, liq.total_final as total
        FROM ordenes_trabajo ot
        JOIN ot_liquidacion liq ON ot.id = liq.orden_trabajo_id
        WHERE ot.id = ANY($1)
      `;
      const otRes = await client.query(otSql, [ot_ids]);
      const ots = otRes.rows;

      if (ots.length !== ot_ids.length) {
        throw new BadRequestError('Una o más OTs no existen o no están liquidadas');
      }

      for (const ot of ots) {
        if (ot.empresa_id !== empresa_id) {
          throw new BadRequestError(`La OT ${ot.consecutivo} no pertenece a la empresa seleccionada`);
        }
        if (ot.estado !== 'LIQUIDADA' || ot.factura_id !== null) {
          throw new BadRequestError(`La OT ${ot.consecutivo} no está disponible para facturar`);
        }
      }

      // 2. Generar consecutivo interno
      const consRes = await client.query(`
        UPDATE consecutivos SET ultimo_valor = ultimo_valor + 1 WHERE id = 'FAC' RETURNING ultimo_valor
      `);
      const nro = consRes.rows[0].ultimo_valor;
      const consecutivo_interno = `FAC-${String(nro).padStart(5, '0')}`;

      // 3. Calcular totales
      const subtotal = ots.reduce((sum, ot) => sum + parseFloat(ot.subtotal), 0);
      const iva_valor = ots.reduce((sum, ot) => sum + parseFloat(ot.iva_valor), 0);
      const total = ots.reduce((sum, ot) => sum + parseFloat(ot.total), 0);

      // 4. Insertar factura
      const estado = numero_factura ? 'FACTURADA' : 'PREFACTURA';
      const insFactSql = `
        INSERT INTO facturas (
          consecutivo_interno, numero_factura, fecha_factura, empresa_id, estado, 
          subtotal, iva_valor, total, condicion_pago, fecha_vencimiento, notas, 
          creada_por, facturada_por
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;
      const factRes = await client.query(insFactSql, [
        consecutivo_interno, 
        numero_factura || null, 
        numero_factura ? new Date() : null,
        empresa_id, 
        estado, 
        subtotal, iva_valor, total,
        condicion_pago, fecha_vencimiento, notas, 
        createdBy,
        numero_factura ? createdBy : null
      ]);
      const factura = factRes.rows[0];

      // 5. Relacionar OTs y snapshot financiero
      for (const ot of ots) {
        await client.query(`
          INSERT INTO factura_ots (factura_id, ot_id, ot_consecutivo, subtotal_ot, iva_ot, total_ot)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [factura.id, ot.id, ot.consecutivo, ot.subtotal, ot.iva_valor, ot.total]);

        // Actualizar OT
        const otEstado = numero_factura ? 'FACTURADA' : 'LIQUIDADA';
        const fechaFacturada = numero_factura ? 'NOW()' : 'NULL';
        
        await client.query(`
          UPDATE ordenes_trabajo SET 
            factura_id = $1,
            estado = $2,
            fecha_facturada = ${fechaFacturada}
          WHERE id = $3
        `, [factura.id, otEstado, ot.id]);
      }

      return factura;
    });
  }

  /**
   * Confirmar factura con número externo
   */
  async confirmarFactura(id, data, confirmedBy) {
    const { numero_factura, fecha_factura, sistema_contable, sistema_contable_id } = data;

    return await withTransaction(async (client) => {
      // 1. Validar estado factura
      const factRes = await client.query('SELECT estado FROM facturas WHERE id = $1 FOR UPDATE', [id]);
      if (factRes.rows.length === 0) throw new NotFoundError('Factura');
      if (factRes.rows[0].estado !== 'PREFACTURA') throw new BadRequestError('Solo se pueden confirmar prefacturas');

      // 2. Validar unicidad de numero_factura
      const dupRes = await client.query('SELECT id FROM facturas WHERE numero_factura = $1 AND id <> $2', [numero_factura, id]);
      if (dupRes.rows.length > 0) throw new BadRequestError('El número de factura ya existe');

      // 3. Actualizar factura
      const updFactSql = `
        UPDATE facturas SET
          numero_factura = $1,
          fecha_factura = $2,
          sistema_contable = $3,
          sistema_contable_id = $4,
          estado = 'FACTURADA',
          facturada_por = $5,
          updated_at = NOW()
        WHERE id = $6
        RETURNING *
      `;
      const updFactRes = await client.query(updFactSql, [
        numero_factura, fecha_factura, sistema_contable, sistema_contable_id, confirmedBy, id
      ]);

      // 4. Actualizar OTs
      await client.query(`
        UPDATE ordenes_trabajo SET
          estado = 'FACTURADA',
          fecha_facturada = NOW()
        WHERE factura_id = $1
      `, [id]);

      return updFactRes.rows[0];
    });
  }

  /**
   * Anular factura
   */
  async anularFactura(id, motivo, cancelledBy) {
    return await withTransaction(async (client) => {
      // 1. Validar estado
      const factRes = await client.query('SELECT estado FROM facturas WHERE id = $1 FOR UPDATE', [id]);
      if (factRes.rows.length === 0) throw new NotFoundError('Factura');
      if (factRes.rows[0].estado === 'ANULADA') throw new BadRequestError('La factura ya está anulada');

      // 2. Actualizar factura
      await client.query(`
        UPDATE facturas SET
          estado = 'ANULADA',
          anulada_por = $1,
          motivo_anulacion = $2,
          updated_at = NOW()
        WHERE id = $3
      `, [cancelledBy, motivo, id]);

      // 3. Revertir OTs
      await client.query(`
        UPDATE ordenes_trabajo SET
          estado = 'LIQUIDADA',
          factura_id = NULL,
          fecha_facturada = NULL
        WHERE factura_id = $1
      `, [id]);

      return { success: true };
    });
  }
}
