import { query } from '../../config/database.js';

export class InventoryRepository {
  async findAll({ area, category, search, isActive, limit = 50, cursor }) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (area && area !== 'all' && area !== 'undefined') {
      conditions.push(`area = $${i++}`);
      params.push(area);
    }

    if (category && category !== 'undefined') {
      conditions.push(`categoria_id = $${i++}`); // Se cambió a categoria_id
      params.push(category);
    }
    if (isActive !== undefined && isActive !== 'undefined' && isActive !== '') {
      conditions.push(`is_active = $${i++}`);
      params.push(isActive === 'true');
    }
    if (search && search.trim() !== '') {
      conditions.push(`(name ILIKE $${i} OR sku ILIKE $${i} OR codigo_interno ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }
    if (cursor) {
      conditions.push(`created_at < (SELECT created_at FROM inventario WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1);

    const sql = `
      SELECT i.*, 
             c.nombre as familia_nombre, 
             u.codigo_ubicacion as ubicacion_fisica,
             emp.full_name as responsable_nombre,
             emp_sst.full_name as sst_responsable_nombre
      FROM inventario i
      LEFT JOIN catalogo_categorias c ON i.categoria_id = c.id
      LEFT JOIN ubicaciones_bodega u ON i.ubicacion_id = u.id
      LEFT JOIN employees emp ON i.responsable_id = emp.id
      LEFT JOIN employees emp_sst ON i.sst_responsable_id = emp_sst.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY i.name ASC
      LIMIT $${i}
    `;

    const result = await query(sql, params);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    return {
      data: rows,
      pagination: { hasMore, nextCursor: hasMore ? rows[rows.length - 1].id : null },
    };
  }

  async findById(id) {
    const result = await query(`SELECT * FROM inventario WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  async getAvailability(id) {
    const sql = `
      SELECT 
        i.id AS inventario_id,
        COALESCE(i.stock_actual, 0) AS stock_fisico,
        COALESCE(SUM(r.cantidad_reservada), 0) AS reservas_activas,
        (COALESCE(i.stock_actual, 0) - COALESCE(SUM(r.cantidad_reservada), 0)) AS stock_disponible
      FROM inventario i
      LEFT JOIN inventario_reservas r ON i.id = r.inventario_id AND r.estado = 'activa'
      WHERE i.id = $1
      GROUP BY i.id, i.stock_actual
    `;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }

  async create(data) {
    const { sku, name, description, categoria_id, ubicacion_id, marca, unit, costo_reposicion, unit_price, stock_actual, stock_minimum, is_active, tipo, area } = data;
    const result = await query(
      `INSERT INTO inventario
        (sku, name, description, categoria_id, ubicacion_id, marca, unit, costo_reposicion, unit_price,
         stock_actual, stock_minimum, is_active, tipo, area,
         codigo_activo, numero_serie, tipo_activo,
         cpu, ram, almacenamiento, gpu, cargador_info,
         cantidad_puertos, velocidad_puertos, capa_operacion, poe, poe_watts,
         mac_lan, mac_wifi, direccion_ip, tipo_ip, hostname, vlan,
         sistema_operativo, licencia_so_key, software_critico,
         documento_empleado, departamento_area, ubicacion_fisica_detalle, fecha_asignacion,
         factura_oc, fecha_compra, costo_adquisicion, fin_garantia, modalidad,
         historial_mantenimientos, observaciones,
         proveedor, responsable_id, estado_activo,
         sst_tipo_elemento, sst_codigo_elemento, sst_marca_modelo, sst_numero_serie,
         sst_ubicacion, sst_ultima_revision, sst_proxima_revision, sst_frecuencia_dias,
         sst_fecha_vencimiento, sst_estado, sst_certificado, sst_responsable_id, sst_observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
               $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,
               $28,$29,$30,$31,$32,$33,$34,$35,$36,
               $37,$38,$39,$40,$41,$42,$43,$44,$45,$46,
               $47,$48,$49,$50,
               $51,$52,$53,$54,$55,$56,$57,$58,$59,$60,$61,$62,$63) RETURNING *`,
      [sku || null, name, description || null, categoria_id || null, ubicacion_id || null, marca || null, unit || 'unidad',
       costo_reposicion || 0, unit_price || 0, stock_actual || 0, stock_minimum || 0, is_active ?? true, tipo || 'PRODUCTO', area || 'MANTENIMIENTO',
       data.codigo_activo || null, data.numero_serie || null, data.tipo_activo || null,
       data.cpu || null, data.ram || null, data.almacenamiento || null, data.gpu || null, data.cargador_info || null,
       data.cantidad_puertos || null, data.velocidad_puertos || null, data.capa_operacion || null,
       data.poe ?? false, data.poe_watts || null,
       data.mac_lan || null, data.mac_wifi || null, data.direccion_ip || null, data.tipo_ip || null, data.hostname || null, data.vlan || null,
       data.sistema_operativo || null, data.licencia_so_key || null, JSON.stringify(data.software_critico || []),
       data.documento_empleado || null, data.departamento_area || null, data.ubicacion_fisica_detalle || null, data.fecha_asignacion || null,
       data.factura_oc || null, data.fecha_compra || null, data.costo_adquisicion || null, data.fin_garantia || null, data.modalidad || null,
       data.historial_mantenimientos || null, data.observaciones || null,
       data.proveedor || null, data.responsable_id || null, data.estado_activo || null,
       data.sst_tipo_elemento || null, data.sst_codigo_elemento || null, data.sst_marca_modelo || null, data.sst_numero_serie || null,
       data.sst_ubicacion || null, data.sst_ultima_revision || null, data.sst_proxima_revision || null, data.sst_frecuencia_dias || null,
       data.sst_fecha_vencimiento || null, data.sst_estado || 'VIGENTE', data.sst_certificado || null, data.sst_responsable_id || null, data.sst_observaciones || null]
    );
    return result.rows[0];
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;

    const allowed = ['sku', 'name', 'description', 'categoria_id', 'ubicacion_id', 'marca', 'unit', 'costo_reposicion', 'unit_price', 'stock_actual', 'stock_minimum', 'is_active', 'tipo', 'area', 'costo_promedio_ponderado', 'precio_piso', 'precio_venta_sugerido',
      'codigo_activo', 'numero_serie', 'tipo_activo',
      'cpu', 'ram', 'almacenamiento', 'gpu', 'cargador_info',
      'cantidad_puertos', 'velocidad_puertos', 'capa_operacion', 'poe', 'poe_watts',
      'mac_lan', 'mac_wifi', 'direccion_ip', 'tipo_ip', 'hostname', 'vlan',
      'sistema_operativo', 'licencia_so_key', 'software_critico',
      'documento_empleado', 'departamento_area', 'ubicacion_fisica_detalle', 'fecha_asignacion',
      'factura_oc', 'fecha_compra', 'costo_adquisicion', 'fin_garantia', 'modalidad',
      'historial_mantenimientos', 'observaciones',
      'proveedor', 'responsable_id', 'estado_activo',
      'sst_tipo_elemento', 'sst_codigo_elemento', 'sst_marca_modelo', 'sst_numero_serie',
      'sst_ubicacion', 'sst_ultima_revision', 'sst_proxima_revision', 'sst_frecuencia_dias',
      'sst_fecha_vencimiento', 'sst_estado', 'sst_certificado', 'sst_responsable_id', 'sst_observaciones'];
    const jsonFields = ['software_critico', 'referencia_cruzada', 'equipos_compatibles'];
    for (const key of allowed) {
      if (key in data && data[key] !== undefined) {
        fields.push(`${key} = $${i++}`);
        let val = data[key] === '' ? null : data[key];
        if (jsonFields.includes(key) && val !== null) {
          val = JSON.stringify(val);
        }
        values.push(val);
      }
    }

    if (fields.length === 0) return this.findById(id);
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE inventario SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await query(`DELETE FROM inventario WHERE id = $1 RETURNING id`, [id]);
    return result.rows[0] || null;
  }
}
