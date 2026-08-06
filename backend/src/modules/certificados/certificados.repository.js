import { query } from '../../config/database.js';

export class CertificadosRepository {
  /**
   * Fetch complete employee data for certificate generation.
   * Includes company info, contract details, and social security fields.
   */
  async getEmployeeForCertificate(employeeId) {
    const sql = `
      SELECT
        e.id, e.full_name, e.numero_documento, e.tipo_documento,
        e.email, e.phone, e.position, e.departamento,
        e.fecha_ingreso, e.fecha_retiro, e.tipo_contrato,
        e.salario, e.jornada, e.motivo_retiro,
        e.eps, e.arl, e.fondo_pension, e.status
      FROM employees e
      WHERE e.id = $1
    `;
    const result = await query(sql, [employeeId]);
    return result.rows[0] || null;
  }

  /**
   * Fetch employee data for certificate by user ID (for mi-certificado endpoint).
   * The logged-in user requests their own certificate.
   */
  async getEmployeeByUserId(userId) {
    const sql = `
      SELECT
        e.id, e.full_name, e.numero_documento, e.tipo_documento,
        e.email, e.phone, e.position, e.departamento,
        e.fecha_ingreso, e.fecha_retiro, e.tipo_contrato,
        e.salario, e.jornada, e.motivo_retiro,
        e.eps, e.arl, e.fondo_pension, e.status
      FROM employees e
      WHERE e.user_id = $1
    `;
    const result = await query(sql, [userId]);
    return result.rows[0] || null;
  }
}
