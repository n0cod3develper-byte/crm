import { query, withTransaction } from '../../config/database.js';

/**
 * Repository para actividades de OTs CORRECTIVAS.
 * Las OTs PREVENTIVAS tienen su propia tabla ot_pm_actividades (pm.repository.js).
 */
export class OtActividadesRepository {
  /**
   * Devuelve las actividades de una OT correctiva, con nombre del técnico.
   */
  async findByOT(otId) {
    const res = await query(
      `SELECT a.*,
              e.full_name AS tecnico_nombre
       FROM ot_actividades a
       LEFT JOIN employees e ON e.id = a.tecnico_id
       WHERE a.orden_trabajo_id = $1
       ORDER BY a.orden ASC`,
      [otId]
    );
    return res.rows;
  }

  /**
   * Reemplaza TODAS las actividades de una OT correctiva en una sola operación.
   * Borra las existentes e inserta las nuevas dentro de una transacción.
   * @param {string} otId - UUID de la OT
   * @param {Array}  actividades - Array de objetos { orden, codigo, descripcion, estado, tecnico_id, observaciones }
   */
  async upsertMany(otId, actividades) {
    return withTransaction(async (client) => {
      // Borrar las existentes
      await client.query(
        `DELETE FROM ot_actividades WHERE orden_trabajo_id = $1`,
        [otId]
      );

      if (!actividades || actividades.length === 0) return [];

      // Insertar las nuevas en orden
      const inserted = [];
      for (let i = 0; i < actividades.length; i++) {
        const { codigo, descripcion, estado, tecnico_id, observaciones } = actividades[i];
        const res = await client.query(
          `INSERT INTO ot_actividades
             (orden_trabajo_id, orden, codigo, descripcion, estado, tecnico_id, observaciones)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            otId,
            i + 1,
            codigo || null,
            descripcion || '',
            estado || 'PENDIENTE',
            tecnico_id || null,
            observaciones || null,
          ]
        );
        inserted.push(res.rows[0]);
      }
      return inserted;
    });
  }
}
