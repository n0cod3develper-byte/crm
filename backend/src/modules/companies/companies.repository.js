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
    const { name, nit, industry, website, phone, address, city, country, tags, notes, assigned_to, modelo_captacion, regimen, responsable_captacion_id, correo_facturacion, correo_rut } = data;

    if (!name || !name.trim()) {
      throw new BadRequestError('El nombre de la empresa es obligatorio');
    }
    if (!nit || !nit.trim()) {
      throw new BadRequestError('El NIT es obligatorio');
    }
    if (!address || !address.trim()) {
      throw new BadRequestError('La dirección es obligatoria');
    }

    // Normalizar nombre a MAYÚSCULAS
    const normalizedName = name.trim().toUpperCase();

    const duplicado = await this.nitYaExiste(nit.trim());
    if (duplicado) {
      throw new BadRequestError('Este NIT ya está registrado');
    }

    return await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO companies
           (name, nit, industry, website, phone, address, city, country, tags, notes, assigned_to, modelo_captacion, regimen, responsable_captacion_id, correo_facturacion, correo_rut)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING *`,
        [normalizedName, nit.trim(), industry || 'logistics', website || null, phone || null,
         address.trim(), city || null, country || 'Colombia',
         tags || [], notes || null, assigned_to || userId,
         modelo_captacion || null, regimen || 'RC', responsable_captacion_id || null,
         correo_facturacion || null, correo_rut || null]
      );
      
      const company = result.rows[0];

      if (data.service_addresses && Array.isArray(data.service_addresses)) {
        for (const addr of data.service_addresses) {
          if (addr.address && addr.address.trim()) {
            await client.query(
              `INSERT INTO company_service_addresses (company_id, address, notes) VALUES ($1, $2, $3)`,
              [company.id, addr.address.trim(), addr.notes || null]
            );
          }
        }
      }

      return company;
    });
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;

    if ('name' in data && (!data.name || !data.name.trim())) {
      throw new BadRequestError('El nombre de la empresa no puede estar vacío');
    }
    if ('nit' in data) {
      if (!data.nit || !data.nit.trim()) {
        throw new BadRequestError('El NIT no puede estar vacío');
      }
      const duplicado = await this.nitYaExiste(data.nit.trim(), id);
      if (duplicado) {
        throw new BadRequestError('Este NIT ya está registrado');
      }
      data.nit = data.nit.trim();
    }
    if ('address' in data && (!data.address || !data.address.trim())) {
      throw new BadRequestError('La dirección no puede estar vacía');
    }
    if ('regimen' in data && (!data.regimen || !data.regimen.trim())) {
      throw new BadRequestError('El régimen no puede estar vacío');
    }

    // Normalizar nombre a MAYÚSCULAS si viene en el payload
    if ('name' in data && data.name) {
      data = { ...data, name: data.name.trim().toUpperCase() };
    }

    const allowed = ['name','nit','industry','website','phone','address','city','country','tags','notes','assigned_to','modelo_captacion','regimen','responsable_captacion_id','correo_facturacion','correo_rut'];
    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${i++}`);
        values.push(data[key]);
      }
    }
    return await withTransaction(async (client) => {
      let company = null;
      if (fields.length > 0) {
        fields.push(`updated_at = NOW()`);
        values.push(id);
        const result = await client.query(
          `UPDATE companies SET ${fields.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
          values
        );
        company = result.rows[0];
      }

      if (data.service_addresses !== undefined) {
        // Borrar existentes y recrear para simplificar sync
        await client.query(`DELETE FROM company_service_addresses WHERE company_id = $1`, [id]);
        if (Array.isArray(data.service_addresses)) {
          for (const addr of data.service_addresses) {
            if (addr.address && addr.address.trim()) {
              await client.query(
                `INSERT INTO company_service_addresses (company_id, address, notes) VALUES ($1, $2, $3)`,
                [id, addr.address.trim(), addr.notes || null]
              );
            }
          }
        }
      }

      return company || this.findById(id);
    });
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

    // Helper: convierte cualquier valor a string trimmed (maneja números de Excel)
    const str = (v) => (v == null ? '' : String(v).trim());

    await withTransaction(async (client) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // +1 por header +1 porque es 0-indexed
        const rowErrors = [];

        // ─── Validaciones ────────────────────────────────────
        if (!str(row.nombre)) {
          rowErrors.push('El campo "Nombre" es obligatorio');
        }

        const nit = str(row.nit) || null;
        if (!nit) {
          rowErrors.push('El campo "NIT" es obligatorio');
        } else {
          if (nit.length > 50) rowErrors.push('NIT muy largo (máx 50 caracteres)');
          const duplicado = await this.nitYaExiste(nit);
          if (duplicado) rowErrors.push('NIT ya existe en el sistema');
        }

        const address = str(row.direccion) || null;
        if (!address) {
          rowErrors.push('El campo "Dirección" es obligatorio');
        }

        const modeloCaptacion = str(row.modelo_captacion);
        if (modeloCaptacion && modeloCaptacion.length > 100) {
          rowErrors.push('Modelo de captación muy largo (máx 100 caracteres)');
        }
        const regimen = str(row.regimen).toUpperCase() || 'RC';
        if (regimen && !['RC', 'NI'].includes(regimen)) {
          rowErrors.push('Régimen inválido (debe ser RC o NI)');
        }
        if (str(row.correo_facturacion)) {
          const email = str(row.correo_facturacion);
          if (email.length > 150) {
            rowErrors.push('Correo de facturación muy largo (máx 150 caracteres)');
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            rowErrors.push('Correo de facturación con formato inválido');
          }
        }
        if (str(row.correo_rut)) {
          const email = str(row.correo_rut);
          if (email.length > 150) {
            rowErrors.push('Correo RUT muy largo (máx 150 caracteres)');
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            rowErrors.push('Correo RUT con formato inválido');
          }
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
                tags, notes, assigned_to, modelo_captacion, regimen, responsable_captacion_id,
                correo_facturacion, correo_rut)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
             RETURNING id, name`,
            [
              str(row.nombre).toUpperCase(),
              nit,
              str(row.industry) || 'logistics',
              str(row.website) || null,
              str(row.telefono) || null,
              str(row.direccion) || null,
              str(row.ciudad) || null,
              str(row.pais) || 'Colombia',
              str(row.tags) ? str(row.tags).split(',').map(t => t.trim()) : [],
              str(row.notes) || str(row.notas) || null,
              userId,
              str(row.modelo_captacion) || null,
              regimen || null,
              str(row.responsable_captacion_id) || null,
              str(row.correo_facturacion) || null,
              str(row.correo_rut) || null,
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

  // ─── Service Addresses ──────────────────────────────────────
  async getServiceAddresses(companyId) {
    const result = await query(
      `SELECT * FROM company_service_addresses WHERE company_id = $1 ORDER BY created_at ASC`,
      [companyId]
    );
    return result.rows;
  }

  async addServiceAddress(companyId, address, notes = null) {
    const result = await query(
      `INSERT INTO company_service_addresses (company_id, address, notes)
       VALUES ($1, $2, $3) RETURNING *`,
      [companyId, address, notes]
    );
    return result.rows[0];
  }

  async deleteServiceAddress(id) {
    const result = await query(
      `DELETE FROM company_service_addresses WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  }
}
