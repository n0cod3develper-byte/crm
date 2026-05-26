import { query, withTransaction } from '../../config/database.js';
import { env } from '../../config/env.js';
import { PMRepository } from './pm.repository.js';
import { registrarMovimiento } from '../../services/inventoryMovements.service.js';

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
        SELECT t.orden_trabajo_id, t.empleado_id, em.full_name
        FROM ot_tecnicos t
        JOIN employees em ON em.id = t.empleado_id
        WHERE t.orden_trabajo_id IN (${tecnicosStr})
      `, otIds);

      rows.forEach(r => {
        const tecs = tecnicosRes.rows.filter(t => t.orden_trabajo_id === r.id);
        r.tecnicos = tecs.map(t => t.full_name);
        r.tecnicos_asignados = tecs.map(t => ({ empleado_id: t.empleado_id, full_name: t.full_name }));
      });
    }

    return { data: rows, pagination: { hasMore, nextCursor: hasMore ? rows[rows.length - 1].id : null } };
  }

  async findOTById(id) {
    const otRes = await query(`
      SELECT ot.*, 
             c.name AS empresa_nombre, c.nit AS empresa_nit, c.phone as empresa_telefono, c.address as empresa_direccion,
             e.marca AS equipo_marca, e.modelo AS equipo_modelo, e.serial AS equipo_serial,
             f.nombre AS frecuencia_nombre, f.horas AS frecuencia_horas, f.version AS frecuencia_version,
             fac.consecutivo_interno AS factura_consecutivo, fac.numero_factura AS factura_numero_externo
      FROM ordenes_trabajo ot
      JOIN companies c ON c.id = ot.empresa_id
      JOIN equipos e ON e.id = ot.equipo_id
      LEFT JOIN pm_frecuencias f ON f.id = ot.pm_frecuencia_id
      LEFT JOIN facturas fac ON fac.id = ot.factura_id
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
    const {
      tipo_mantenimiento, empresa_id, equipo_id, responsable, contacto_empresa,
      telefono_contacto, detalle_servicio, pm_frecuencia_id,
      // Campos de historial del equipo
      fallas_encontradas, nivel_criticidad, causa_raiz,
      trabajos_detalle, observaciones_seguridad, repuestos_mantenimiento,
      fecha_hora_ingreso_taller, fecha_hora_salida_taller,
      fecha_inicio_bodega, fecha_fin_bodega,
      estado_equipo_al_cierre, proxima_fecha_mantenimiento, costo_total_mantenimiento
    } = data;
    const horometro_inicial = data.horometro_inicial === '' ? null : data.horometro_inicial;
    
    const otCreado = await withTransaction(async (client) => {
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
            (consecutivo, tipo_mantenimiento, empresa_id, equipo_id, horometro_inicial, responsable, contacto_empresa, telefono_contacto, detalle_servicio, created_by, pm_frecuencia_id, horometro_frecuencia,
             fallas_encontradas, nivel_criticidad, causa_raiz, trabajos_detalle, observaciones_seguridad, repuestos_mantenimiento,
             fecha_hora_ingreso_taller, fecha_hora_salida_taller, fecha_inicio_bodega, fecha_fin_bodega,
             estado_equipo_al_cierre, proxima_fecha_mantenimiento, costo_total_mantenimiento)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                    $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
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
          horometro_frecuencia ?? null,
          fallas_encontradas || null,
          nivel_criticidad || null,
          causa_raiz || null,
          trabajos_detalle ? JSON.stringify(trabajos_detalle) : '[]',
          observaciones_seguridad || null,
          repuestos_mantenimiento ? JSON.stringify(repuestos_mantenimiento) : '[]',
          fecha_hora_ingreso_taller || null,
          fecha_hora_salida_taller || null,
          fecha_inicio_bodega || null,
          fecha_fin_bodega || null,
          estado_equipo_al_cierre || null,
          proxima_fecha_mantenimiento || null,
          costo_total_mantenimiento || null,
        ]);
        const ot = res.rows[0];

        // Si es preventivo con frecuencia, copiar plantilla (snapshot atómico)
        if (tipo_mantenimiento === 'PREVENTIVO' && pm_frecuencia_id) {
          await pmRepo.copiarPlantillaAOT(client, ot.id, pm_frecuencia_id);
        }

        return ot;
    });
    // Sync historial equipo después de que la transacción haya completado
    setImmediate(() => this.syncHistorialFromOT(otCreado.id).catch(e => console.error('[OT] Error sync historial create:', e.message)));
    return otCreado;
  }

  async updateOT(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const allowed = [
      'tipo_mantenimiento', 'horometro_inicial', 'horometro_final', 'responsable', 'contacto_empresa', 'telefono_contacto', 'detalle_servicio', 'observaciones', 'estado',
      'fallas_encontradas', 'nivel_criticidad', 'causa_raiz', 'observaciones_seguridad',
      'trabajos_detalle', 'repuestos_mantenimiento',
      'fecha_hora_ingreso_taller', 'fecha_hora_salida_taller', 'fecha_inicio_bodega', 'fecha_fin_bodega',
      'estado_equipo_al_cierre', 'proxima_fecha_mantenimiento', 'costo_total_mantenimiento',
    ];
    
    const jsonFields = ['trabajos_detalle', 'repuestos_mantenimiento'];
    const emptyToNullFields = [
      'horometro_inicial', 'horometro_final',
      'fecha_hora_ingreso_taller', 'fecha_hora_salida_taller',
      'fecha_inicio_bodega', 'fecha_fin_bodega',
      'proxima_fecha_mantenimiento', 'costo_total_mantenimiento',
      'estado_equipo_al_cierre', 'nivel_criticidad',
    ];
    
    for (const key of allowed) {
      if (key in data && data[key] !== undefined) {
        let val = data[key];
        // Convertir string vacío a null para campos que no admiten ""
        if (emptyToNullFields.includes(key) && val === '') {
          val = null;
        }
        // Serializar campos JSONB
        if (jsonFields.includes(key) && typeof val !== 'string') {
          val = JSON.stringify(val);
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
    const ot = result.rows[0] || null;
    // Sincronizar con historial_equipo de forma no bloqueante
    if (ot) {
      setImmediate(() => this.syncHistorialFromOT(id).catch(e => console.error('[OT] Error sync historial update:', e.message)));
    }
    return ot;
  }

  /**
   * Sincroniza automáticamente los datos de mantenimiento de la OT hacia historial_equipo.
   * Hace UPSERT basado en orden_trabajo_id.
   */
  async syncHistorialFromOT(otId) {
    // Obtener datos completos de la OT
    const otRes = await query(`
      SELECT ot.*, pf.horas AS pm_horas
      FROM ordenes_trabajo ot
      LEFT JOIN pm_frecuencias pf ON pf.id = ot.pm_frecuencia_id
      WHERE ot.id = $1 AND ot.deleted_at IS NULL
    `, [otId]);
    if (!otRes.rows[0]) return;
    const ot = otRes.rows[0];

    // Mapear tipo de OT a tipo de historial
    let tipoHistorial = 'correctivo';
    if (ot.tipo_mantenimiento === 'PREVENTIVO') {
      const h = parseFloat(ot.pm_horas) || 0;
      if (h <= 250)       tipoHistorial = 'preventivo_250h';
      else if (h <= 500)  tipoHistorial = 'preventivo_500h';
      else if (h <= 1000) tipoHistorial = 'preventivo_1000h';
      else                tipoHistorial = 'otro';
    }

    // Técnicos de la OT
    const tecRes = await query(`SELECT empleado_id FROM ot_tecnicos WHERE orden_trabajo_id = $1`, [otId]);
    const tecnicosIds = tecRes.rows.map(r => r.empleado_id);

    // Repuestos de mantenimiento (JSONB)
    const repuestosArr = Array.isArray(ot.repuestos_mantenimiento) ? ot.repuestos_mantenimiento : [];
    const trabajosArr  = Array.isArray(ot.trabajos_detalle) ? ot.trabajos_detalle : [];

    // Nivel criticidad — verificar que sea valor válido para el CHECK constraint
    const criticidadValida = ['leve', 'moderado', 'critico'];
    const nivelCriticidad = criticidadValida.includes(ot.nivel_criticidad) ? ot.nivel_criticidad : null;

    // Estado equipo — verificar que sea valor válido
    const estadosValidos = ['operativo', 'operativo_con_restricciones', 'en_espera_repuestos', 'fuera_de_servicio'];
    const estadoEquipo = estadosValidos.includes(ot.estado_equipo_al_cierre) ? ot.estado_equipo_al_cierre : null;

    // UPSERT en historial_equipo
    const existsRes = await query(
      `SELECT id, ot_cerrada FROM historial_equipo WHERE orden_trabajo_id = $1`,
      [otId]
    );

    let historialId;
    if (existsRes.rows[0]) {
      if (existsRes.rows[0].ot_cerrada) return; // No modificar si está cerrado
      historialId = existsRes.rows[0].id;
      await query(`
        UPDATE historial_equipo SET
          tipo_mantenimiento          = $1,
          horometro_al_ingreso        = $2,
          fallas_encontradas          = $3,
          nivel_criticidad            = $4,
          causa_raiz                  = $5,
          trabajos_detalle            = $6,
          observaciones_seguridad     = $7,
          fecha_hora_ingreso_taller   = $8,
          fecha_hora_salida_taller    = $9,
          fecha_inicio_bodega         = $10,
          fecha_fin_bodega            = $11,
          estado_equipo_al_cierre     = $12,
          proxima_fecha_mantenimiento = $13,
          costo_total_mantenimiento   = $14,
          numero_ot                   = $15,
          updated_at                  = NOW()
        WHERE id = $16
      `, [
        tipoHistorial,
        ot.horometro_inicial || 0,
        ot.fallas_encontradas || null,
        nivelCriticidad,
        ot.causa_raiz || null,
        JSON.stringify(trabajosArr),
        ot.observaciones_seguridad || null,
        ot.fecha_hora_ingreso_taller || null,
        ot.fecha_hora_salida_taller || null,
        ot.fecha_inicio_bodega || null,
        ot.fecha_fin_bodega || null,
        estadoEquipo,
        ot.proxima_fecha_mantenimiento || null,
        ot.costo_total_mantenimiento || 0,
        ot.consecutivo || null,
        historialId,
      ]);
    } else {
      const insRes = await query(`
        INSERT INTO historial_equipo (
          equipo_id, orden_trabajo_id, numero_ot, tipo_mantenimiento, horometro_al_ingreso,
          fallas_encontradas, nivel_criticidad, causa_raiz,
          trabajos_detalle, observaciones_seguridad,
          fecha_hora_ingreso_taller, fecha_hora_salida_taller,
          fecha_inicio_bodega, fecha_fin_bodega,
          estado_equipo_al_cierre, proxima_fecha_mantenimiento,
          costo_total_mantenimiento
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING id
      `, [
        ot.equipo_id,
        otId,
        ot.consecutivo || null,
        tipoHistorial,
        ot.horometro_inicial || 0,
        ot.fallas_encontradas || null,
        nivelCriticidad,
        ot.causa_raiz || null,
        JSON.stringify(trabajosArr),
        ot.observaciones_seguridad || null,
        ot.fecha_hora_ingreso_taller || null,
        ot.fecha_hora_salida_taller || null,
        ot.fecha_inicio_bodega || null,
        ot.fecha_fin_bodega || null,
        estadoEquipo,
        ot.proxima_fecha_mantenimiento || null,
        ot.costo_total_mantenimiento || 0,
      ]);
      historialId = insRes.rows[0].id;
    }

    // Sincronizar técnicos
    await query(`DELETE FROM historial_tecnicos WHERE historial_id = $1`, [historialId]);
    for (const tecId of tecnicosIds) {
      await query(
        `INSERT INTO historial_tecnicos (historial_id, empleado_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [historialId, tecId]
      );
    }

    // Sincronizar repuestos de mantenimiento
    await query(`DELETE FROM historial_repuestos WHERE historial_id = $1`, [historialId]);
    for (const rep of repuestosArr) {
      await query(`
        INSERT INTO historial_repuestos (
          historial_id,
          retirado_nombre, retirado_codigo, retirado_numero_serie, retirado_motivo, retirado_estado,
          instalado_nombre, instalado_codigo, instalado_numero_serie,
          instalado_procedencia, instalado_garantia_hasta, instalado_costo_unitario
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, [
        historialId,
        rep.retirado_nombre || null, rep.retirado_codigo || null, rep.retirado_numero_serie || null,
        rep.retirado_motivo || null, rep.retirado_estado || null,
        rep.instalado_nombre || null, rep.instalado_codigo || null, rep.instalado_numero_serie || null,
        rep.instalado_procedencia || null,
        rep.instalado_garantia_hasta || null,
        parseFloat(rep.instalado_costo_unitario) || 0,
      ]);
    }
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
  // ==========================================
  // KPIs (Dashboard)
  // ==========================================

  async getKpis(meses = 12, fecha_desde = null, fecha_hasta = null) {
    // Helper para construir filtro de fecha por created_at
    const dateFilter = (alias = 'ot') => {
      const clauses = [];
      const params = [];
      if (fecha_desde) { clauses.push(`${alias}.created_at >= $${params.length + 1}`); params.push(fecha_desde); }
      if (fecha_hasta) { clauses.push(`${alias}.created_at <= $${params.length + 1}::date + interval '1 day'`); params.push(fecha_hasta); }
      return { sql: clauses.length ? ' AND ' + clauses.join(' AND ') : '', params };
    };

    const dateFilterLiq = () => {
      const clauses = [];
      const params = [];
      if (fecha_desde) { clauses.push(`l.fecha_liquidacion >= $${params.length + 1}`); params.push(fecha_desde); }
      if (fecha_hasta) { clauses.push(`l.fecha_liquidacion <= $${params.length + 1}::date + interval '1 day'`); params.push(fecha_hasta); }
      return { sql: clauses.length ? ' AND ' + clauses.join(' AND ') : '', params };
    };

    const df = dateFilter();
    const dfLiq = dateFilterLiq();

    const totalOT = await query(`SELECT COUNT(*)::int AS total FROM ordenes_trabajo ot WHERE ot.deleted_at IS NULL${df.sql}`, df.params);

    const porEstado = await query(`
      SELECT ot.estado, COUNT(*)::int AS count
      FROM ordenes_trabajo ot
      WHERE ot.deleted_at IS NULL${df.sql}
      GROUP BY ot.estado
    `, df.params);

    const porTipo = await query(`
      SELECT ot.tipo_mantenimiento, COUNT(*)::int AS count
      FROM ordenes_trabajo ot
      WHERE ot.deleted_at IS NULL${df.sql}
      GROUP BY ot.tipo_mantenimiento
    `, df.params);

    const esteMes = await query(`
      SELECT COUNT(*)::int AS count
      FROM ordenes_trabajo
      WHERE deleted_at IS NULL
        AND created_at >= date_trunc('month', NOW())
    `);

    const liquidadoLiqTotal = await query(`
      SELECT COALESCE(SUM(l.total_final), 0)::numeric(12,2) AS total
      FROM ot_liquidacion l
      JOIN ordenes_trabajo ot ON ot.id = l.orden_trabajo_id
      WHERE ot.deleted_at IS NULL${dfLiq.sql}
    `, dfLiq.params);

    const equiposConOT = await query(`
      SELECT COUNT(DISTINCT ot.equipo_id)::int AS total
      FROM ordenes_trabajo ot
      WHERE ot.deleted_at IS NULL${df.sql}
    `, df.params);

    const tecnicosActivos = await query(`
      SELECT COUNT(DISTINCT t.empleado_id)::int AS total
      FROM ot_tecnicos t
      JOIN ordenes_trabajo ot ON ot.id = t.orden_trabajo_id
      WHERE ot.deleted_at IS NULL
        AND ot.estado IN ('ABIERTA', 'EN_PROCESO')
    `);

    const proxPreventivos = await query(`
      SELECT COUNT(*)::int AS total
      FROM ordenes_trabajo
      WHERE deleted_at IS NULL
        AND tipo_mantenimiento = 'PREVENTIVO'
        AND estado IN ('ABIERTA', 'EN_PROCESO')
    `);

    // ─── Tendencias mensuales ────────────────────────────────
    const intervalMonths = meses - 1;
    const tendenciasCreadas = await query(`
      SELECT
        to_char(date_trunc('month', created_at), 'YYYY-MM') AS mes,
        COUNT(*)::int AS creadas
      FROM ordenes_trabajo
      WHERE deleted_at IS NULL
        AND created_at >= date_trunc('month', NOW()) - $1::INTERVAL
      GROUP BY date_trunc('month', created_at)
      ORDER BY mes
    `, [`${intervalMonths} months`]);

    const tendenciasLiquidadas = await query(`
      SELECT
        to_char(date_trunc('month', l.fecha_liquidacion), 'YYYY-MM') AS mes,
        COUNT(*)::int AS liquidadas
      FROM ot_liquidacion l
      JOIN ordenes_trabajo ot ON ot.id = l.orden_trabajo_id
      WHERE ot.deleted_at IS NULL
        AND l.fecha_liquidacion >= date_trunc('month', NOW()) - $1::INTERVAL
      GROUP BY date_trunc('month', l.fecha_liquidacion)
      ORDER BY mes
    `, [`${intervalMonths} months`]);

    // Combinar en un array de `meses` meses (completando con 0 los que falten)
    const trendMap = new Map();
    const lastIndex = meses - 1;
    for (let i = lastIndex; i >= 0; i--) {
      const m = new Date();
      m.setMonth(m.getMonth() - i);
      const key = m.toISOString().slice(0, 7); // 'YYYY-MM'
      const label = m.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
      trendMap.set(key, { mes: key, label, creadas: 0, liquidadas: 0 });
    }

    for (const row of tendenciasCreadas.rows) {
      if (trendMap.has(row.mes)) trendMap.get(row.mes).creadas = row.creadas;
    }
    for (const row of tendenciasLiquidadas.rows) {
      if (trendMap.has(row.mes)) trendMap.get(row.mes).liquidadas = row.liquidadas;
    }

    return {
      total: totalOT.rows[0].total,
      por_estado: porEstado.rows,
      por_tipo: porTipo.rows,
      este_mes: esteMes.rows[0].count,
      liquidado_total: liquidadoLiqTotal.rows[0].total,
      equipos_con_ot: equiposConOT.rows[0].total,
      tecnicos_activos: tecnicosActivos.rows[0].total,
      preventivos_pendientes: proxPreventivos.rows[0].total,
      tendencias: Array.from(trendMap.values()),
    };
  }

  async searchInventario(q) {
      const result = await query(
          `SELECT 
            id, 
            referencia_sistema as sku, 
            codigo_interno, 
            nombre_interno as name, 
            nombre_comercial, 
            unidad_medida as unit, 
            precio_venta as unit_price, 
            stock_actual 
           FROM catalogo_completo 
           WHERE (nombre_comercial ILIKE $1 OR nombre_interno ILIKE $1 OR referencia_sistema ILIKE $1 OR codigo_interno ILIKE $1)
             AND activo_catalogo = true
           LIMIT 25`,
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
              const invRes = await client.query(`SELECT stock_actual FROM inventario WHERE id = $1 FOR UPDATE`, [rep.item_inventario_id]);
              if(invRes.rows.length === 0) throw new Error(`Item ${rep.descripcion} no existe en inventario.`);
              
              const currentStock = parseFloat(invRes.rows[0].stock_actual);
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
              
              await registrarMovimiento({
                  inventario_id: rep.item_inventario_id,
                  tipo_movimiento: 'SALIDA_OT',
                  cantidad: requested,
                  numero_documento: consecutivo,
                  ot_id: ot_id,
                  notas: `Descargo automático por liquidación de OT ${consecutivo}`,
                  registrado_por: user_id
              }, client);

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
