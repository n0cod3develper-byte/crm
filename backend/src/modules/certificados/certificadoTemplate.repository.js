import { query } from '../../config/database.js';

export class CertificadoTemplateRepository {
  /**
   * Get all active templates (or all for admin).
   */
  async findAll(includeInactive = false) {
    const sql = `
      SELECT ct.*, u.nombre AS creado_por_nombre, u.apellido AS creado_por_apellido
      FROM certificado_templates ct
      LEFT JOIN users u ON u.id = ct.creado_por
      ${includeInactive ? '' : 'WHERE ct.activa = TRUE'}
      ORDER BY ct.es_predeterminada DESC, ct.nombre ASC
    `;
    return (await query(sql)).rows;
  }

  /**
   * Get a single template by ID.
   */
  async findById(id) {
    const sql = `
      SELECT ct.*, u.nombre AS creado_por_nombre, u.apellido AS creado_por_apellido
      FROM certificado_templates ct
      LEFT JOIN users u ON u.id = ct.creado_por
      WHERE ct.id = $1
    `;
    return (await query(sql, [id])).rows[0] || null;
  }

  /**
   * Get the default template.
   */
  async findDefault() {
    const sql = `SELECT * FROM certificado_templates WHERE es_predeterminada = TRUE AND activa = TRUE LIMIT 1`;
    return (await query(sql)).rows[0] || null;
  }

  /**
   * Create a new template.
   */
  async create(data) {
    const { nombre, descripcion, contenido, variables_disponibles, es_predeterminada, creado_por } = data;
    
    // If this is set as default, unset other defaults
    if (es_predeterminada) {
      await query('UPDATE certificado_templates SET es_predeterminada = FALSE');
    }
    
    const sql = `
      INSERT INTO certificado_templates (nombre, descripcion, contenido, variables_disponibles, es_predeterminada, creado_por)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await query(sql, [nombre, descripcion || null, contenido, variables_disponibles || '[]', es_predeterminada || false, creado_por || null]);
    const template = result.rows[0];

    // Create initial version
    await this.createVersion(template.id, 1, contenido, variables_disponibles, creado_por, 'Creación inicial');

    return template;
  }

  /**
   * Update an existing template and create a new version.
   */
  async update(id, data, userId) {
    const { nombre, descripcion, contenido, variables_disponibles, es_predeterminada, motivo } = data;

    // If this is set as default, unset other defaults
    if (es_predeterminada) {
      await query('UPDATE certificado_templates SET es_predeterminada = FALSE WHERE id != $1', [id]);
    }

    // Get current version number
    const versionSql = `SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM certificado_template_versiones WHERE template_id = $1`;
    const versionResult = await query(versionSql, [id]);
    const nextVersion = versionResult.rows[0].next_version;

    const sql = `
      UPDATE certificado_templates
      SET nombre = COALESCE($1, nombre),
          descripcion = COALESCE($2, descripcion),
          contenido = COALESCE($3, contenido),
          variables_disponibles = COALESCE($4, variables_disponibles),
          es_predeterminada = COALESCE($5, es_predeterminada),
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;
    const result = await query(sql, [nombre || null, descripcion !== undefined ? descripcion : null, contenido || null, variables_disponibles || null, es_predeterminada, id]);
    
    // Create version record
    if (contenido) {
      await this.createVersion(id, nextVersion, contenido, variables_disponibles, userId, motivo || null);
    }

    return result.rows[0] || null;
  }

  /**
   * Soft-delete a template (set activa = FALSE).
   */
  async deactivate(id) {
    const sql = `UPDATE certificado_templates SET activa = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *`;
    return (await query(sql, [id])).rows[0] || null;
  }

  /**
   * Get version history for a template.
   */
  async getVersions(templateId) {
    const sql = `
      SELECT v.*, u.nombre AS modificado_por_nombre, u.apellido AS modificado_por_apellido
      FROM certificado_template_versiones v
      LEFT JOIN users u ON u.id = v.modificado_por
      WHERE v.template_id = $1
      ORDER BY v.version DESC
    `;
    return (await query(sql, [templateId])).rows;
  }

  /**
   * Create a version record.
   */
  async createVersion(templateId, version, contenido, variables_disponibles, modificadoPor, motivo) {
    const sql = `
      INSERT INTO certificado_template_versiones (template_id, version, contenido, variables_disponibles, modificado_por, motivo)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    return (await query(sql, [templateId, version, contenido, variables_disponibles || '[]', modificadoPor || null, motivo || null])).rows[0];
  }

  /**
   * Get the available variables with their labels.
   */
  getAvailableVariables() {
    return [
      { key: 'nombre_completo', label: 'Nombre completo del empleado' },
      { key: 'tipo_documento', label: 'Tipo de documento (CC, TI, etc.)' },
      { key: 'numero_documento', label: 'Número de documento' },
      { key: 'cargo', label: 'Cargo / posición' },
      { key: 'departamento', label: 'Departamento' },
      { key: 'fecha_ingreso', label: 'Fecha de ingreso' },
      { key: 'fecha_retiro', label: 'Fecha de retiro (si aplica)' },
      { key: 'tipo_contrato', label: 'Tipo de contrato' },
      { key: 'salario', label: 'Salario base mensual' },
      { key: 'jornada', label: 'Jornada laboral' },
      { key: 'antiguedad', label: 'Antigüedad calculada' },
      { key: 'motivo_retiro', label: 'Motivo de retiro (si aplica)' },
      { key: 'fecha_expedicion', label: 'Fecha de expedición del certificado' },
      { key: 'firma_nombre', label: 'Nombre de quien firma' },
      { key: 'firma_cargo', label: 'Cargo de quien firma' },
      { key: 'mostrar_salario', label: 'Mostrar salario (variable booleana)' },
    ];
  }
}
