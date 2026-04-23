import { query, withTransaction } from '../../config/database.js';

/**
 * Repository para el catálogo de plantillas de Mantenimiento Preventivo.
 * Gestiona frecuencias, actividades e insumos estándar configurables
 * desde el panel de administración.
 */
export class PMRepository {

  // ==========================================
  // FRECUENCIAS
  // ==========================================

  /**
   * Lista todas las frecuencias activas con conteo de actividades e insumos.
   */
  async findAllFrecuencias({ includeInactive = false } = {}) {
    const where = includeInactive ? '' : 'WHERE f.activo = TRUE';
    const sql = `
      SELECT f.*,
        (SELECT COUNT(*) FROM pm_actividades a WHERE a.frecuencia_id = f.id AND a.activo = TRUE) AS total_actividades,
        (SELECT COUNT(*) FROM pm_insumos_plantilla i WHERE i.frecuencia_id = f.id AND i.activo = TRUE) AS total_insumos
      FROM pm_frecuencias f
      ${where}
      ORDER BY f.orden_display ASC, f.horas ASC
    `;
    const result = await query(sql);
    return result.rows;
  }

  /**
   * Retorna la plantilla completa de una frecuencia: actividades + insumos
   * con stock actual del inventario. Usado para precargar en el formulario de OT.
   */
  async getPlantillaCompleta(frecuenciaId) {
    // Frecuencia
    const freqRes = await query(
      `SELECT * FROM pm_frecuencias WHERE id = $1`,
      [frecuenciaId]
    );
    if (!freqRes.rows[0]) return null;

    // Actividades activas ordenadas
    const actRes = await query(
      `SELECT id, orden, nombre, descripcion, requiere_firma
       FROM pm_actividades
       WHERE frecuencia_id = $1 AND activo = TRUE
       ORDER BY orden ASC`,
      [frecuenciaId]
    );

    // Insumos activos con stock actual del inventario
    const insRes = await query(
      `SELECT ip.id, ip.item_inventario_id, ip.descripcion_display,
              ip.cantidad_sugerida, ip.unidad, ip.es_obligatorio,
              COALESCE(inv.stock_current, 0) AS stock_actual,
              COALESCE(inv.unit_price, 0) AS precio_unitario,
              inv.name AS nombre_inventario
       FROM pm_insumos_plantilla ip
       LEFT JOIN inventory_items inv ON inv.id = ip.item_inventario_id
       WHERE ip.frecuencia_id = $1 AND ip.activo = TRUE
       ORDER BY ip.descripcion_display ASC`,
      [frecuenciaId]
    );

    return {
      frecuencia: freqRes.rows[0],
      actividades: actRes.rows,
      insumos: insRes.rows,
    };
  }

  /**
   * Crear una nueva frecuencia de mantenimiento preventivo.
   */
  async createFrecuencia(data) {
    const { nombre, horas, descripcion, orden_display } = data;
    const res = await query(
      `INSERT INTO pm_frecuencias (nombre, horas, descripcion, orden_display)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nombre, horas, descripcion || null, orden_display || 0]
    );
    return res.rows[0];
  }

  /**
   * Actualizar frecuencia. Incrementa la versión para auditoría.
   */
  async updateFrecuencia(id, data) {
    const { nombre, horas, descripcion, orden_display, activo } = data;
    const res = await query(
      `UPDATE pm_frecuencias
       SET nombre = COALESCE($1, nombre),
           horas = COALESCE($2, horas),
           descripcion = COALESCE($3, descripcion),
           orden_display = COALESCE($4, orden_display),
           activo = COALESCE($5, activo),
           version = version + 1
       WHERE id = $6 RETURNING *`,
      [nombre, horas, descripcion, orden_display, activo, id]
    );
    return res.rows[0];
  }

  // ==========================================
  // ACTIVIDADES DE PLANTILLA
  // ==========================================

  async addActividad(frecuenciaId, data) {
    const { nombre, descripcion, requiere_firma, orden } = data;
    // Si no se especifica orden, obtener el siguiente
    let nextOrden = orden;
    if (nextOrden === undefined || nextOrden === null) {
      const maxRes = await query(
        `SELECT COALESCE(MAX(orden), 0) + 1 AS next FROM pm_actividades WHERE frecuencia_id = $1`,
        [frecuenciaId]
      );
      nextOrden = maxRes.rows[0].next;
    }

    const res = await query(
      `INSERT INTO pm_actividades (frecuencia_id, orden, nombre, descripcion, requiere_firma)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [frecuenciaId, nextOrden, nombre, descripcion || null, requiere_firma || false]
    );
    return res.rows[0];
  }

  async updateActividad(id, data) {
    const { nombre, descripcion, requiere_firma, orden, activo } = data;
    const res = await query(
      `UPDATE pm_actividades
       SET nombre = COALESCE($1, nombre),
           descripcion = COALESCE($2, descripcion),
           requiere_firma = COALESCE($3, requiere_firma),
           orden = COALESCE($4, orden),
           activo = COALESCE($5, activo)
       WHERE id = $6 RETURNING *`,
      [nombre, descripcion, requiere_firma, orden, activo, id]
    );
    return res.rows[0];
  }

  // ==========================================
  // INSUMOS DE PLANTILLA
  // ==========================================

  async addInsumo(frecuenciaId, data) {
    const { item_inventario_id, descripcion_display, cantidad_sugerida, unidad, es_obligatorio } = data;
    const res = await query(
      `INSERT INTO pm_insumos_plantilla (frecuencia_id, item_inventario_id, descripcion_display, cantidad_sugerida, unidad, es_obligatorio)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [frecuenciaId, item_inventario_id || null, descripcion_display, cantidad_sugerida || 0, unidad || 'unidad', es_obligatorio || false]
    );
    return res.rows[0];
  }

  async updateInsumo(id, data) {
    const { item_inventario_id, descripcion_display, cantidad_sugerida, unidad, es_obligatorio, activo } = data;
    const res = await query(
      `UPDATE pm_insumos_plantilla
       SET item_inventario_id = COALESCE($1, item_inventario_id),
           descripcion_display = COALESCE($2, descripcion_display),
           cantidad_sugerida = COALESCE($3, cantidad_sugerida),
           unidad = COALESCE($4, unidad),
           es_obligatorio = COALESCE($5, es_obligatorio),
           activo = COALESCE($6, activo)
       WHERE id = $7 RETURNING *`,
      [item_inventario_id, descripcion_display, cantidad_sugerida, unidad, es_obligatorio, activo, id]
    );
    return res.rows[0];
  }

  async removeInsumo(id) {
    await query(`UPDATE pm_insumos_plantilla SET activo = FALSE WHERE id = $1`, [id]);
    return true;
  }

  // ==========================================
  // SNAPSHOT: Copiar plantilla a OT
  // ==========================================

  /**
   * Copia atómicamente las actividades e insumos de la plantilla
   * a las tablas de la OT (snapshot). Esto preserva el historial
   * aunque la plantilla cambie en el futuro.
   *
   * @param {pg.Client} client - Cliente de transacción activa
   * @param {string} otId - ID de la orden de trabajo
   * @param {string} frecuenciaId - ID de la frecuencia seleccionada
   */
  async copiarPlantillaAOT(client, otId, frecuenciaId) {
    if (!frecuenciaId) return;
    // 1. Copiar actividades como snapshot
    await client.query(`
      INSERT INTO ot_pm_actividades (orden_trabajo_id, pm_actividad_id, orden, nombre, descripcion)
      SELECT $1, id, orden, nombre, descripcion
      FROM pm_actividades
      WHERE frecuencia_id = $2 AND activo = TRUE
      ORDER BY orden ASC
    `, [otId, frecuenciaId]);

    // 2. Copiar insumos de la plantilla a ot_repuestos_insumos
    //    Solo si tienen item_inventario_id vinculado (para poder descargar stock)
    await client.query(`
      INSERT INTO ot_repuestos_insumos
        (orden_trabajo_id, item_inventario_id, descripcion, cantidad, unidad, precio_unitario, total, origen, pm_insumo_id)
      SELECT
        $1,
        ip.item_inventario_id,
        ip.descripcion_display,
        ip.cantidad_sugerida,
        ip.unidad,
        COALESCE(inv.unit_price, 0),
        ip.cantidad_sugerida * COALESCE(inv.unit_price, 0),
        'PLANTILLA_PM',
        ip.id
      FROM pm_insumos_plantilla ip
      LEFT JOIN inventory_items inv ON inv.id = ip.item_inventario_id
      WHERE ip.frecuencia_id = $2
        AND ip.activo = TRUE
        AND ip.item_inventario_id IS NOT NULL
    `, [otId, frecuenciaId]);
  }

  // ==========================================
  // ACTIVIDADES DE LA OT (ot_pm_actividades)
  // ==========================================

  async findActividadesOT(otId) {
    const res = await query(
      `SELECT a.*, e.full_name AS completada_por_nombre
       FROM ot_pm_actividades a
       LEFT JOIN employees e ON e.id = a.completada_por
       WHERE a.orden_trabajo_id = $1
       ORDER BY a.orden ASC`,
      [otId]
    );
    return res.rows;
  }

  /**
   * Actualiza el estado de una actividad en la OT.
   * Registra quién la completó u omitió y cuándo.
   */
  async updateActividadOT(otId, actividadId, data) {
    const { estado, completada_por, observacion } = data;
    const fecha = (estado === 'COMPLETADA' || estado === 'OMITIDA') ? 'NOW()' : 'NULL';

    const res = await query(
      `UPDATE ot_pm_actividades
       SET estado = $1,
           completada_por = $2,
           fecha_completado = ${fecha},
           observacion = $3
       WHERE id = $4 AND orden_trabajo_id = $5
       RETURNING *`,
      [estado, completada_por || null, observacion || null, actividadId, otId]
    );
    return res.rows[0];
  }
}
