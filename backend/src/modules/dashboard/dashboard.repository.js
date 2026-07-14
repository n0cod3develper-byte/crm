import { query } from '../../config/database.js';

export class DashboardRepository {
  /**
   * Retorna KPIs globales del dashboard:
   * - oportunidades_activas: oportunidades en etapas NO cerradas
   * - empresas_registradas: companies activas
   * - pipeline_total: suma de valores de oportunidades activas
   * - tareas_vencidas: tareas no completadas con due_date vencido
   * - pipeline_por_etapa: resumen por pipeline_stages
   * - actividad_reciente: últimas 5 comunicaciones
   */
  async getKpis(userId, userRole) {
    let tareasVencidasQuery = `
      SELECT COUNT(*)::int AS count
      FROM tasks t
      WHERE t.status != 'completed'
        AND t.due_date <= (NOW() + INTERVAL '24 hours')
    `;
    const tareasParams = [];
    if (userRole && userRole !== 'admin') {
      tareasVencidasQuery += ` AND (t.assigned_to = $1 OR t.created_by = $1 OR t.supervisor_id = $1)`;
      tareasParams.push(userId);
    }

    const [oportunidades, empresas, pipelineTotal, tareasVencidas, pipelineEtapas, actividad, soatAlertas, sstAlertas] =
      await Promise.all([
        // 1. Oportunidades activas (en etapas NO cerradas)
        query(`
          SELECT COUNT(*)::int AS count
          FROM opportunities o
          JOIN pipeline_stages s ON s.id = o.stage_id
          WHERE o.deleted_at IS NULL
            AND s.is_closed_won = FALSE
            AND s.is_closed_lost = FALSE
        `),

        // 2. Empresas registradas activas
        query(`
          SELECT COUNT(*)::int AS count
          FROM companies
          WHERE deleted_at IS NULL
        `),

        // 3. Pipeline total (suma de valores de oportunidades activas no perdidas)
        query(`
          SELECT COALESCE(SUM(o.value), 0)::numeric(15,2) AS total
          FROM opportunities o
          JOIN pipeline_stages s ON s.id = o.stage_id
          WHERE o.deleted_at IS NULL
            AND s.is_closed_lost = FALSE
        `),

        // 4. Tareas vencidas (no completadas, fecha vencida)
        query(tareasVencidasQuery, tareasParams),

        // 5. Pipeline por etapa
        query(`
          SELECT s.id, s.name, s.color, s.order_index,
            COUNT(o.id)::int AS count,
            COALESCE(SUM(o.value), 0)::numeric(15,2) AS total_value
          FROM pipeline_stages s
          LEFT JOIN opportunities o ON o.stage_id = s.id AND o.deleted_at IS NULL
          GROUP BY s.id, s.name, s.color, s.order_index
          ORDER BY s.order_index
        `),

        // 6. Actividad reciente (desde activity_log, unificada)
        query(`
          SELECT
            a.id,
            a.modulo,
            a.accion,
            a.descripcion,
            COALESCE(a.user_name, CONCAT_WS(' ', u.nombre, u.apellido)) AS user_name,
            a.user_id,
            a.created_at
          FROM activity_log a
          LEFT JOIN users u ON u.id = a.user_id
          ORDER BY a.created_at DESC
          LIMIT 15
        `),

        // 7. SOAT próximos a vencer (próximos 30 días o ya vencidos)
        query(`
          SELECT
            COUNT(*)::int AS total_alertas,
            COUNT(*) FILTER (
              WHERE soat_vencimiento < NOW()
            )::int AS vencidos,
            COUNT(*) FILTER (
              WHERE soat_vencimiento >= NOW()
                AND soat_vencimiento <= (NOW() + INTERVAL '30 days')
            )::int AS por_vencer,
            COUNT(*) FILTER (
              WHERE soat_vencimiento >= NOW()
                AND soat_vencimiento <= (NOW() + INTERVAL '7 days')
            )::int AS por_vencer_7d
          FROM equipos
          WHERE deleted_at IS NULL
            AND soat_vigente = TRUE
            AND soat_vencimiento IS NOT NULL
            AND soat_vencimiento <= (NOW() + INTERVAL '30 days')
        `),

        // 8. SST próximos a vencer (próximos 30 días o ya vencidos)
        query(`
          SELECT
            COUNT(*)::int AS total_alertas,
            COUNT(*) FILTER (
              WHERE sst_proxima_revision < CURRENT_DATE
                OR sst_fecha_vencimiento < CURRENT_DATE
            )::int AS vencidos,
            COUNT(*) FILTER (
              WHERE (sst_proxima_revision >= CURRENT_DATE
                AND sst_proxima_revision <= (CURRENT_DATE + INTERVAL '30 days'))
                OR (sst_fecha_vencimiento >= CURRENT_DATE
                AND sst_fecha_vencimiento <= (CURRENT_DATE + INTERVAL '30 days'))
            )::int AS por_vencer,
            COUNT(*) FILTER (
              WHERE (sst_proxima_revision >= CURRENT_DATE
                AND sst_proxima_revision <= (CURRENT_DATE + INTERVAL '7 days'))
                OR (sst_fecha_vencimiento >= CURRENT_DATE
                AND sst_fecha_vencimiento <= (CURRENT_DATE + INTERVAL '7 days'))
            )::int AS por_vencer_7d
          FROM inventario
          WHERE area = 'SST'
            AND (sst_proxima_revision IS NOT NULL OR sst_fecha_vencimiento IS NOT NULL)
        `),
      ]);

    return {
      oportunidades_activas: oportunidades.rows[0]?.count || 0,
      empresas_registradas: empresas.rows[0]?.count || 0,
      pipeline_total: parseFloat(pipelineTotal.rows[0]?.total || 0),
      tareas_vencidas: tareasVencidas.rows[0]?.count || 0,
      pipeline_por_etapa: pipelineEtapas.rows,
      actividad_reciente: actividad.rows,
      soat_alertas: {
        total: soatAlertas.rows[0]?.total_alertas || 0,
        vencidos: soatAlertas.rows[0]?.vencidos || 0,
        por_vencer: soatAlertas.rows[0]?.por_vencer || 0,
        por_vencer_7d: soatAlertas.rows[0]?.por_vencer_7d || 0,
      },
      sst_alertas: {
        total: sstAlertas.rows[0]?.total_alertas || 0,
        vencidos: sstAlertas.rows[0]?.vencidos || 0,
        por_vencer: sstAlertas.rows[0]?.por_vencer || 0,
        por_vencer_7d: sstAlertas.rows[0]?.por_vencer_7d || 0,
      },
    };
  }
}
