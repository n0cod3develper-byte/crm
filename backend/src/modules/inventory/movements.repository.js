import { query } from '../../config/database.js';
import { registrarMovimiento } from '../../services/inventoryMovements.service.js';

export class MovementsRepository {
  async findAll({ itemId, type, limit = 50 }) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (itemId) {
      conditions.push(`producto_id = $${i++}`);
      params.push(itemId);
    }
    if (type) {
      conditions.push(`tipo_movimiento = $${i++}`);
      params.push(type);
    }

    const sql = `
      SELECT *
      FROM historial_movimientos_completo
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${i}
    `;
    params.push(limit);
    
    const result = await query(sql, params);
    return result.rows;
  }

  async create(data, userId) {
    const datosMapeados = {
      inventario_id: data.item_id || data.inventario_id,
      tipo_movimiento: data.tipo_movimiento || (data.type === 'in' ? 'ENTRADA_COMPRA' : (data.type === 'out' ? 'SALIDA_OT' : 'ENTRADA_AJUSTE')),
      cantidad: parseFloat(data.quantity || data.cantidad),
      precio_unitario: parseFloat(data.precio_unitario || 0),
      iva_pct: parseFloat(data.iva_pct || 0),
      numero_documento: data.reference || data.numero_documento || null,
      notas: data.notes || data.notas || null,
      registrado_por: userId,
      proveedor_id: (data.proveedor_id && data.proveedor_id !== '') ? data.proveedor_id : null,
      proveedor_nombre_libre: data.proveedor_nombre_libre || null,
      tipo_documento: data.tipo_documento || 'FACTURA',
      fecha_documento: data.fecha_documento || null,
      ubicacion_id: (data.ubicacion_id && data.ubicacion_id !== '') ? data.ubicacion_id : null,
      oc_id: (data.oc_id && data.oc_id !== '') ? data.oc_id : null,
      ot_id: (data.ot_id && data.ot_id !== '') ? data.ot_id : null
    };

    const resultado = await registrarMovimiento(datosMapeados);
    return resultado.movimiento;
  }

  async getStats() {
    const res = await query(`
      SELECT 
        COUNT(*) filter (where tipo_movimiento LIKE 'ENTRADA%') as entries,
        COUNT(*) filter (where tipo_movimiento LIKE 'SALIDA%') as exits,
        SUM(cantidad) filter (where tipo_movimiento LIKE 'ENTRADA%') as total_in,
        SUM(cantidad) filter (where tipo_movimiento LIKE 'SALIDA%') as total_out
      FROM movimientos_inventario
      WHERE created_at > NOW() - INTERVAL '30 days'
    `);
    return res.rows[0];
  }
}
