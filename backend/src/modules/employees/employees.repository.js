import { query } from '../../config/database.js';

export class EmployeesRepository {
  async findAll({ position, status, search, limit = 50, cursor }) {
    const conditions = ['1=1'];
    const params = [];
    let i = 1;

    if (position && position !== 'all') {
      conditions.push(`position = $${i++}`);
      params.push(position);
    }
    if (status && status !== 'all') {
      conditions.push(`status = $${i++}`);
      params.push(status);
    }
    if (search && search.trim() !== '') {
      conditions.push(`(full_name ILIKE $${i} OR numero_documento ILIKE $${i})`);
      params.push(`%${search.trim()}%`);
      i++;
    }
    if (cursor) {
      conditions.push(`created_at < (SELECT created_at FROM employees WHERE id = $${i++})`);
      params.push(cursor);
    }

    params.push(limit + 1);

    const sql = `
      SELECT e.*,
             u.nombre AS user_nombre,
             u.apellido AS user_apellido,
             u.email AS user_email
      FROM employees e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY e.created_at DESC
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
    const result = await query(
      `SELECT e.*,
              u.nombre AS user_nombre,
              u.apellido AS user_apellido,
              u.email AS user_email
       FROM employees e
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.id = $1`, [id]
    );
    return result.rows[0] || null;
  }

  async create(data) {
    const { 
      full_name, phone, email, position, status, user_id, 
      hourly_rate, tipo_documento, numero_documento, departamento,
      fecha_nacimiento, direccion, contacto_emergencia_nombre, contacto_emergencia_telefono,
      eps, arl, fondo_pension, tipo_sangre, tipo_contrato, salario,
      jornada, fecha_ingreso, fecha_retiro, motivo_retiro
    } = data;

    const result = await query(
      `INSERT INTO employees (
         full_name, phone, email, position, status, user_id, hourly_rate, tipo_documento, numero_documento, departamento,
         fecha_nacimiento, direccion, contacto_emergencia_nombre, contacto_emergencia_telefono,
         eps, arl, fondo_pension, tipo_sangre, tipo_contrato, salario,
         jornada, fecha_ingreso, fecha_retiro, motivo_retiro
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24) RETURNING *`,
      [
        full_name, phone, email, position, status || 'Activo', user_id || null, hourly_rate || 0, tipo_documento || null, numero_documento || null, departamento || null,
        fecha_nacimiento || null, direccion || null, contacto_emergencia_nombre || null, contacto_emergencia_telefono || null,
        eps || null, arl || null, fondo_pension || null, tipo_sangre || null, tipo_contrato || null, salario || 0,
        jornada || null, fecha_ingreso || null, fecha_retiro || null, motivo_retiro || null
      ]
    );
    return result.rows[0];
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let i = 1;
    const allowed = [
      'full_name', 'phone', 'email', 'position', 'status', 'user_id', 
      'hourly_rate', 'tipo_documento', 'numero_documento', 'departamento',
      'fecha_nacimiento', 'direccion', 'contacto_emergencia_nombre', 'contacto_emergencia_telefono',
      'eps', 'arl', 'fondo_pension', 'tipo_sangre', 'tipo_contrato', 'salario',
      'jornada', 'fecha_ingreso', 'fecha_retiro', 'motivo_retiro'
    ];

    for (const key of allowed) {
      if (key in data) {
        fields.push(`${key} = $${i++}`);
        values.push(data[key] === '' ? null : data[key]);
      }
    }
    
    if (fields.length === 0) return this.findById(id);
    
    values.push(id);
    const result = await query(
      `UPDATE employees SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await query(`DELETE FROM employees WHERE id = $1 RETURNING id`, [id]);
    return result.rows[0] || null;
  }

  // ─── Historial Laboral ────────────────────────────────────────

  async getHistorial(empleadoId) {
    const result = await query(
      `SELECT * FROM employees_historial_laboral WHERE empleado_id = $1 ORDER BY fecha_inicio DESC`,
      [empleadoId]
    );
    return result.rows;
  }

  async addHistorial(empleadoId, data) {
    const { empresa, cargo, fecha_inicio, fecha_fin, descripcion } = data;
    const result = await query(
      `INSERT INTO employees_historial_laboral (empleado_id, empresa, cargo, fecha_inicio, fecha_fin, descripcion)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [empleadoId, empresa, cargo, fecha_inicio, fecha_fin || null, descripcion || null]
    );
    return result.rows[0];
  }

  async removeHistorial(id) {
    const result = await query(`DELETE FROM employees_historial_laboral WHERE id = $1 RETURNING id`, [id]);
    return result.rows[0] || null;
  }

  // ─── Documentos ───────────────────────────────────────────────

  async getDocumentos(empleadoId) {
    const result = await query(
      `SELECT d.*, u.nombre as subido_por_nombre, u.apellido as subido_por_apellido 
       FROM employees_documentos d
       LEFT JOIN users u ON u.id = d.subido_por
       WHERE d.empleado_id = $1 ORDER BY d.created_at DESC`,
      [empleadoId]
    );
    return result.rows;
  }

  async addDocumento(empleadoId, data) {
    const { tipo_documento, nombre_archivo, url_archivo, subido_por } = data;
    const result = await query(
      `INSERT INTO employees_documentos (empleado_id, tipo_documento, nombre_archivo, url_archivo, subido_por)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [empleadoId, tipo_documento, nombre_archivo, url_archivo, subido_por || null]
    );
    return result.rows[0];
  }

  async removeDocumento(id) {
    const result = await query(`DELETE FROM employees_documentos WHERE id = $1 RETURNING *`, [id]);
    return result.rows[0] || null;
  }
}

