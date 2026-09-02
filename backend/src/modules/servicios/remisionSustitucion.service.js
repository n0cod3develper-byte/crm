/**
 * RemisionSustitucionService
 * --------------------------
 * Encapsula toda la lógica de negocio para la sustitución de
 * equipo dentro de una remisión de alquiler por días.
 *
 * Reglas de negocio:
 *  - La remisión sigue siendo UNA sola de cara al cliente.
 *  - Al reemplazar, se cierra el tramo vigente y se abre uno nuevo.
 *  - El equipo anterior queda OPERATIVO (si no tiene otras remisiones activas).
 *  - El equipo nuevo queda ALQUILADO.
 *  - remisiones.equipo_id siempre apunta al equipo actualmente asignado.
 *  - El total_bruto del cliente NO cambia; la distribución es interna.
 */

import { withTransaction } from '../../config/database.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';

export class RemisionSustitucionService {

  /**
   * Ejecuta la sustitución de equipo en una remisión.
   *
   * @param {string} remisionId       UUID de la remisión
   * @param {object} payload
   *   @param {string} payload.equipo_nuevo_id   UUID del equipo entrante
   *   @param {string} payload.fecha_efectiva    'YYYY-MM-DD' — día de inicio del nuevo equipo
   *   @param {string} [payload.motivo]          Razón del reemplazo
   *   @param {string} [payload.usuario_autorizo_id] UUID del usuario que autoriza
   * @param {object}  user            Objeto usuario del request (req.user)
   * @returns {object}  { tramos, remision_actualizada }
   */
  async reemplazarEquipo(remisionId, payload, user) {
    const { equipo_nuevo_id, fecha_efectiva, motivo, usuario_autorizo_id } = payload;
    const userStr = user
      ? `${user.nombre || ''} ${user.apellido || ''}`.trim() || user.email
      : 'Sistema';
    const autorizaId = usuario_autorizo_id || user?.id || null;

    if (!equipo_nuevo_id)  throw new BadRequestError('equipo_nuevo_id es requerido');
    if (!fecha_efectiva)   throw new BadRequestError('fecha_efectiva es requerida');

    return await withTransaction(async (client) => {

      // ── 1. Cargar la remisión ────────────────────────────────────────
      const remRes = await client.query(
        `SELECT id, equipo_id, fecha_servicio, estado, tiene_sustitucion, numero_remision
         FROM remisiones WHERE id = $1 AND deleted_at IS NULL`,
        [remisionId]
      );
      const remision = remRes.rows[0];
      if (!remision) throw new NotFoundError('Remisión');

      // ── 2. Validaciones de negocio ───────────────────────────────────
      const estadosNoPermitidos = ['ANULADO', 'ANULADA', 'FACTURADA'];
      if (estadosNoPermitidos.includes(remision.estado)) {
        throw new BadRequestError(
          `No se puede reemplazar el equipo en una remisión en estado ${remision.estado}`
        );
      }

      if (equipo_nuevo_id === remision.equipo_id) {
        throw new BadRequestError('El equipo nuevo debe ser diferente al equipo actual');
      }

      const fechaEfectivaDate = new Date(fecha_efectiva + 'T00:00:00');
      const fechaServicioDate = new Date(remision.fecha_servicio + 'T00:00:00');

      if (fechaEfectivaDate < fechaServicioDate) {
        throw new BadRequestError(
          `La fecha efectiva (${fecha_efectiva}) no puede ser anterior a la fecha de inicio de la remisión (${remision.fecha_servicio})`
        );
      }

      // Validar que el equipo nuevo esté disponible
      const eqNuevoRes = await client.query(
        `SELECT id, estado, marca, modelo, serie FROM equipos WHERE id = $1 AND deleted_at IS NULL`,
        [equipo_nuevo_id]
      );
      const eqNuevo = eqNuevoRes.rows[0];
      if (!eqNuevo) throw new NotFoundError('Equipo nuevo');

      const estadosNoDisponibles = ['FUERA_DE_SERVICIO', 'RETIRADO'];
      if (estadosNoDisponibles.includes(eqNuevo.estado)) {
        throw new BadRequestError(
          `El equipo ${eqNuevo.marca} ${eqNuevo.serie || eqNuevo.modelo} está en estado ${eqNuevo.estado} y no puede ser asignado`
        );
      }

      // ── 3. Manejar tramos ────────────────────────────────────────────
      const equipoActualId = remision.equipo_id;

      if (!remision.tiene_sustitucion) {
        // Primera sustitución: crear el tramo inicial retroactivo
        const diasTramoInicial = calcularDias(remision.fecha_servicio, fecha_efectiva);

        if (diasTramoInicial <= 0) {
          throw new BadRequestError(
            'La fecha efectiva debe ser posterior al inicio de la remisión para poder crear el tramo inicial'
          );
        }

        await client.query(
          `INSERT INTO remision_tramos_equipo
             (remision_id, equipo_id, fecha_inicio, fecha_fin, dias_facturables, motivo, usuario_autorizo_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            remisionId,
            equipoActualId,
            remision.fecha_servicio,
            fechaAnterior(fecha_efectiva),
            diasTramoInicial,
            'Tramo inicial',
            autorizaId,
          ]
        );

        // Activar el flag
        await client.query(
          `UPDATE remisiones SET tiene_sustitucion = TRUE WHERE id = $1`,
          [remisionId]
        );

      } else {
        // Sustitución subsiguiente: cerrar el tramo vigente
        const tramoVigenteRes = await client.query(
          `SELECT id, fecha_inicio FROM remision_tramos_equipo
           WHERE remision_id = $1 AND fecha_fin IS NULL
           FOR UPDATE`,
          [remisionId]
        );
        const tramoVigente = tramoVigenteRes.rows[0];
        if (!tramoVigente) {
          throw new BadRequestError('No se encontró el tramo vigente de la remisión');
        }

        const tramoInicioDate = new Date(tramoVigente.fecha_inicio + 'T00:00:00');
        if (fechaEfectivaDate <= tramoInicioDate) {
          throw new BadRequestError(
            `La fecha efectiva (${fecha_efectiva}) debe ser posterior al inicio del tramo vigente (${tramoVigente.fecha_inicio})`
          );
        }

        const diasTramo = calcularDias(tramoVigente.fecha_inicio, fecha_efectiva);

        await client.query(
          `UPDATE remision_tramos_equipo
           SET fecha_fin = $1, dias_facturables = $2
           WHERE id = $3`,
          [fechaAnterior(fecha_efectiva), diasTramo, tramoVigente.id]
        );
      }

      // ── 4. Crear el nuevo tramo abierto ──────────────────────────────
      await client.query(
        `INSERT INTO remision_tramos_equipo
           (remision_id, equipo_id, fecha_inicio, fecha_fin, dias_facturables, motivo, usuario_autorizo_id)
         VALUES ($1, $2, $3, NULL, NULL, $4, $5)`,
        [remisionId, equipo_nuevo_id, fecha_efectiva, motivo || null, autorizaId]
      );

      // ── 5. Actualizar equipo_id en la remisión ───────────────────────
      await client.query(
        `UPDATE remisiones SET equipo_id = $1, updated_at = NOW() WHERE id = $2`,
        [equipo_nuevo_id, remisionId]
      );

      // ── 6. Liberar equipo anterior → OPERATIVO ───────────────────────
      if (equipoActualId) {
        await liberarEquipo(client, equipoActualId, remisionId, remision.numero_remision, userStr);
      }

      // ── 7. Marcar equipo nuevo → ALQUILADO ───────────────────────────
      const eqNuevoActualRes = await client.query(
        `SELECT estado FROM equipos WHERE id = $1`,
        [equipo_nuevo_id]
      );
      const estadoNuevoActual = eqNuevoActualRes.rows[0]?.estado;

      if (estadoNuevoActual !== 'ALQUILADO') {
        const motivoAlquiler = `Asignado por sustitución en remisión ${remision.numero_remision}`;
        await client.query(
          `UPDATE equipos SET
             estado = 'ALQUILADO',
             motivo_estado = $1,
             fecha_cambio_estado = CURRENT_DATE,
             actualizado_por = $2,
             updated_at = NOW()
           WHERE id = $3`,
          [motivoAlquiler, userStr, equipo_nuevo_id]
        );
        await client.query(
          `INSERT INTO equipos_historial_estado
             (equipo_id, estado_anterior, estado_nuevo, motivo, cambiado_por)
           VALUES ($1, $2, 'ALQUILADO', $3, $4)`,
          [equipo_nuevo_id, estadoNuevoActual, motivoAlquiler, userStr]
        );
      }

      // ── 8. Retornar tramos actualizados y datos relevantes ────────────
      const tramosRes = await client.query(
        `SELECT t.*,
                e.marca AS equipo_marca, e.modelo AS equipo_modelo,
                e.serie AS equipo_serie, e.serial AS equipo_serial
         FROM remision_tramos_equipo t
         JOIN equipos e ON e.id = t.equipo_id
         WHERE t.remision_id = $1
         ORDER BY t.fecha_inicio ASC`,
        [remisionId]
      );

      return {
        tramos: tramosRes.rows,
        equipo_nuevo: eqNuevo,
      };
    });
  }

  /**
   * Devuelve todos los tramos de una remisión con datos del equipo.
   * @param {string} remisionId
   */
  async findTramosEquipo(remisionId) {
    const { query } = await import('../../config/database.js');
    const res = await query(
      `SELECT
         t.id,
         t.remision_id,
         t.equipo_id,
         e.marca  AS equipo_marca,
         e.modelo AS equipo_modelo,
         e.serie  AS equipo_serie,
         e.serial AS equipo_serial,
         e.capacidad_carga AS equipo_capacidad,
         t.fecha_inicio,
         t.fecha_fin,
         t.dias_facturables,
         t.motivo,
         t.usuario_autorizo_id,
         u.full_name AS autorizo_nombre,
         t.created_at,
         (t.fecha_fin IS NULL) AS vigente
       FROM remision_tramos_equipo t
       JOIN equipos e ON e.id = t.equipo_id
       LEFT JOIN users u ON u.id = t.usuario_autorizo_id
       WHERE t.remision_id = $1
       ORDER BY t.fecha_inicio ASC`,
      [remisionId]
    );
    return res.rows;
  }
}

// ─── Helpers privados ──────────────────────────────────────────────────────

/**
 * Calcula días naturales entre fecha_inicio (inclusive) y fecha_fin_exclusiva (exclusive).
 * Ej: del 1 al 8 → 7 días (el día 8 ya es del nuevo tramo).
 */
function calcularDias(fechaInicioStr, fechaFinExclusivaStr) {
  const inicio = new Date(fechaInicioStr + 'T00:00:00');
  const fin    = new Date(fechaFinExclusivaStr + 'T00:00:00');
  return Math.round((fin - inicio) / (1000 * 60 * 60 * 24));
}

/**
 * Devuelve la fecha anterior a la dada en formato 'YYYY-MM-DD'.
 * Usado para fijar la fecha_fin del tramo cerrado.
 */
function fechaAnterior(fechaStr) {
  const d = new Date(fechaStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * Libera un equipo a OPERATIVO si no tiene otras remisiones activas.
 */
async function liberarEquipo(client, equipoId, remisionId, numeroRemision, userStr) {
  const eqRes = await client.query(
    `SELECT estado FROM equipos WHERE id = $1`,
    [equipoId]
  );
  const estadoActual = eqRes.rows[0]?.estado;
  if (!estadoActual || estadoActual === 'OPERATIVO') return;

  // Verificar otras remisiones activas del mismo equipo
  const otrasRes = await client.query(
    `SELECT COUNT(*) AS total FROM remisiones
     WHERE equipo_id = $1
       AND id != $2
       AND estado IN ('PENDIENTE', 'EN_PROCESO')
       AND deleted_at IS NULL`,
    [equipoId, remisionId]
  );
  if (parseInt(otrasRes.rows[0]?.total || 0) > 0) return;

  const motivo = `Liberado por sustitución en remisión ${numeroRemision}`;
  await client.query(
    `UPDATE equipos SET
       estado = 'OPERATIVO',
       motivo_estado = $1,
       fecha_cambio_estado = CURRENT_DATE,
       actualizado_por = $2,
       updated_at = NOW()
     WHERE id = $3`,
    [motivo, userStr, equipoId]
  );
  await client.query(
    `INSERT INTO equipos_historial_estado
       (equipo_id, estado_anterior, estado_nuevo, motivo, cambiado_por)
     VALUES ($1, $2, 'OPERATIVO', $3, $4)`,
    [equipoId, estadoActual, motivo, userStr]
  );
}
