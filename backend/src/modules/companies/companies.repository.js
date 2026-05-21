import { query, withTransaction } from '../../config/database.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';

export class CompaniesRepository {
  async findAll({ search, assignedTo, tags, limit = 20, cursor }) {
    const conditions = ['c.deleted_at IS NULL'];
    const params = [];
    let i = 1;

    if (search) {
      conditions.push(`(c.name ILIKE $${i} OR c.nit ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }
    if (assignedTo) {
      conditions.push(`c.assigned_to = $${i++}`);
      params.push(assignedTo);
    }
    if (tags?.length) {
      conditions.push(`c.tags && $${i++}`);
      params.push(tags);
    }
    if (cursor) {
      conditions.push(`c.id < $${i++}`);
      params.push(cursor);
    }

    params.push(limit + 1);  // +1 para detectar si hay más páginas

    const sql = `
      SELECT c.*,
        (u.nombre || ' ' || u.apellido) AS assigned_to_name,
        e.full_name AS responsable_captacion_nombre,
        COUNT(DISTINCT ct.id)::INT AS contacts_count,
        COUNT(DISTINCT o.id) FILTER (WHERE o.stage_id NOT IN (
          SELECT id FROM pipeline_stages WHERE is_closed_won OR is_closed_lost
        ))::INT AS open_opportunities_count,
        (SELECT COUNT(*)::INT FROM equipos eq WHERE eq.empresa_id = c.id AND eq.deleted_at IS NULL) AS equipment_count
      FROM companies c
      LEFT JOIN users u ON u.id = c.assigned_to
      LEFT JOIN employees e ON e.id = c.responsable_captacion_id
      LEFT JOIN contacts ct ON ct.company_id = c.id AND ct.deleted_at IS NULL
      LEFT JOIN opportunities o ON o.company_id = c.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY c.id, (u.nombre || ' ' || u.apellido), e.full_name
      ORDER BY c.id DESC
      LIMIT $${i}
    `;

    const result = await query(sql, params);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    return {
      data: rows,
      pagination: {
        hasMore,
        nextCursor: hasMore ? rows[rows.length - 1].id : null,
      },
    };
  }

  async findById(id) {
    const result = await query(
      `SELECT c.*,
              (u.nombre || ' ' || u.apellido) AS assigned_to_name,
              e.full_name AS responsable_captacion_nombre
       FROM companies c
       LEFT JOIN users u ON u.id = c.assigned_to
       LEFT JOIN employees e ON e.id = c.responsable_captacion_id
       WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }

  async nitYaExiste(nit, excludeId) {
    if (!nit) return false;
    const result = await query(
      `SELECT id FROM companies WHERE nit = $1 AND deleted_at IS NULL${excludeId ? ' AND id != $2' : ''} LIMIT 1`,
      excludeId ? [nit, excludeId] : [nit]
    );
    return result.rows.length > 0;
  }

  async create(data, userId) {
    const { name, nit, industry, website, phone, address, city, country, tags, notes, assigned_to, modelo_captacion, regimen, responsable_captacion_id } = data;

    if (nit) {
      const duplicado = await this.nitYaExiste(nit);
      if (duplicado) {
        throw new BadRequestError('Este NIT ya está registrado');
      }
    }

    const result = await query(
      `INSERT INTO companies
         (name, nit, industry, website, phone, address, city, country, tags, notes, assigned_to, modelo_captacion, regimen, responsable_captacion_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [name, nit || null, industry || 'logistics', website || null, phone || null,
       address || null, city || null, country || 'Colombia',
       tags || [], notes || null, assigned_to || userId,
       modelo_captacion || null, regimen || null, responsable_captacion_id || null]
    );
    return result.rows[0];
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;

    if ('nit' in data && data.nit) {
      const duplicado = await this.nitYaExiste(data.nit, id);
      if (duplicado) {
        throw new BadRequestError('Este NIT ya está registrado');
      }
    }

    const allowed = ['name','nit','industry','website','phone','address','city','country','tags','notes','assigned_to','modelo_captacion','regimen','responsable_captacion_id'];
    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${i++}`);
        values.push(data[key]);
      }
    }
    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE companies SET ${fields.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async softDelete(id) {
    const result = await query(
      `UPDATE companies SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  }

  async importCompanies(rows, userId) {
    const results = { success: 0, errors: [] };

    await withTransaction(async (client) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // +1 por header +1 porque es 0-indexed
        const rowErrors = [];

        // ─── Validaciones ────────────────────────────────────
        if (!row.nombre || !row.nombre.trim()) {
          rowErrors.push('El campo "Nombre" es obligatorio');
        }

        const nit = row.nit ? row.nit.trim() : null;
        if (nit) {
          if (nit.length > 50) rowErrors.push('NIT muy largo (máx 50 caracteres)');
          const duplicado = await this.nitYaExiste(nit);
          if (duplicado) rowErrors.push('NIT ya existe en el sistema');
        }

        if (row.modelo_captacion && row.modelo_captacion.length > 100) {
          rowErrors.push('Modelo de captación muy largo (máx 100 caracteres)');
        }
        if (row.regimen && !['RC', 'NI'].includes(row.regimen.toUpperCase())) {
          rowErrors.push('Régimen inválido (debe ser RC o NI)');
        }

        // ─── Si hay errores en esta fila ──────────────────────
        if (rowErrors.length > 0) {
          results.errors.push({
            fila: rowNum,
            nombre: row.nombre || '(sin nombre)',
            nit: nit || '—',
            errores: rowErrors,
          });
          continue;
        }

        // ─── Insertar ────────────────────────────────────────
        try {
          const insertResult = await client.query(
            `INSERT INTO companies
               (name, nit, industry, website, phone, address, city, country,
                tags, notes, assigned_to, modelo_captacion, regimen, responsable_captacion_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
             RETURNING id, name`,
            [
              row.nombre.trim(),
              nit,
              row.industry || 'logistics',
              row.website || null,
              row.telefono || null,
              row.direccion || null,
              row.ciudad || null,
              row.pais || 'Colombia',
              row.tags ? row.tags.split(',').map(t => t.trim()) : [],
              row.notas || null,
              userId,
              row.modelo_captacion || null,
              row.regimen ? row.regimen.toUpperCase() : null,
              row.responsable_captacion_id || null,
            ]
          );
          results.success++;
        } catch (err) {
          results.errors.push({
            fila: rowNum,
            nombre: row.nombre || '(sin nombre)',
            nit: nit || '—',
            errores: [err.message.includes('unique') || err.code === '23505'
              ? 'NIT duplicado detectado al insertar'
              : `Error de base de datos: ${err.message}`],
          });
        }
      }
    });

    return results;
  }

  async getTimeline(companyId, limit = 30) {
    const result = await query(
      `SELECT
        'communication' AS item_type,
        c.id, c.type, c.subject, c.body, c.direction, c.occurred_at AS date,
        (u.nombre || ' ' || u.apellido) AS created_by_name
       FROM communications c
       LEFT JOIN users u ON u.id = c.created_by
       WHERE c.company_id = $1
       UNION ALL
       SELECT
        'task' AS item_type,
        t.id, t.type, t.title AS subject, t.description AS body,
        NULL AS direction, t.created_at AS date,
        (u.nombre || ' ' || u.apellido) AS created_by_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.created_by
       WHERE t.related_type = 'company' AND t.related_id = $1
       ORDER BY date DESC
       LIMIT $2`,
      [companyId, limit]
    );
    return result.rows;
  }
}
