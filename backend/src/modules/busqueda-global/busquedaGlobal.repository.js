import { query } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

const MAX_RESULTS_PER_MODULE = 5;

/**
 * Buscar empresas por nombre o NIT
 */
export async function buscarEmpresas(searchTerm) {
  const sql = `
    SELECT id, name AS nombre, nit
    FROM companies
    WHERE deleted_at IS NULL
      AND (name ILIKE $1 OR nit ILIKE $1)
    ORDER BY 
      CASE WHEN nit ILIKE $1 THEN 0 ELSE 1 END,
      name ASC
    LIMIT ${MAX_RESULTS_PER_MODULE}
  `;
  const result = await query(sql, [`%${searchTerm}%`]);
  return result.rows;
}

/**
 * Buscar remisiones por número de remisión
 */
export async function buscarRemisiones(searchTerm) {
  const sql = `
    SELECT r.id, r.numero_remision AS codigo, r.estado, c.name AS empresa
    FROM remisiones r
    LEFT JOIN companies c ON c.id = r.company_id
    WHERE r.deleted_at IS NULL
      AND r.numero_remision ILIKE $1
    ORDER BY r.numero_remision DESC
    LIMIT ${MAX_RESULTS_PER_MODULE}
  `;
  const result = await query(sql, [`%${searchTerm}%`]);
  return result.rows;
}

/**
 * Buscar órdenes de trabajo por consecutivo
 */
export async function buscarOTs(searchTerm) {
  const sql = `
    SELECT ot.id, ot.consecutivo AS codigo, ot.estado, c.name AS empresa
    FROM ordenes_trabajo ot
    LEFT JOIN companies c ON c.id = ot.empresa_id
    WHERE ot.deleted_at IS NULL
      AND ot.consecutivo ILIKE $1
    ORDER BY ot.consecutivo DESC
    LIMIT ${MAX_RESULTS_PER_MODULE}
  `;
  const result = await query(sql, [`%${searchTerm}%`]);
  return result.rows;
}

/**
 * Buscar productos por nombre comercial, código interno o referencia
 */
export async function buscarProductos(searchTerm) {
  const sql = `
    SELECT id, 
           COALESCE(nombre_comercial, name) AS nombre, 
           referencia_fabricante AS referencia, 
           codigo_interno
    FROM inventario
    WHERE (nombre_comercial ILIKE $1 
           OR name ILIKE $1 
           OR codigo_interno ILIKE $1 
           OR referencia_fabricante ILIKE $1
           OR sku ILIKE $1)
    ORDER BY 
      CASE WHEN codigo_interno ILIKE $1 THEN 0 
           WHEN nombre_comercial ILIKE $1 THEN 1 
           ELSE 2 END,
      nombre_comercial ASC
    LIMIT ${MAX_RESULTS_PER_MODULE}
  `;
  const result = await query(sql, [`%${searchTerm}%`]);
  return result.rows;
}

/**
 * Buscar contactos por nombre, email o teléfono
 */
export async function buscarContactos(searchTerm) {
  const sql = `
    SELECT ct.id, 
           ct.first_name || COALESCE(' ' || ct.last_name, '') AS nombre,
           ct.email,
           ct.phone,
           c.name AS empresa
    FROM contacts ct
    LEFT JOIN companies c ON c.id = ct.company_id
    WHERE ct.deleted_at IS NULL
      AND (ct.first_name ILIKE $1 
           OR ct.last_name ILIKE $1 
           OR ct.email ILIKE $1 
           OR ct.phone ILIKE $1)
    ORDER BY ct.first_name ASC
    LIMIT ${MAX_RESULTS_PER_MODULE}
  `;
  const result = await query(sql, [`%${searchTerm}%`]);
  return result.rows;
}

/**
 * Buscar empleados por nombre, documento o email
 */
export async function buscarEmpleados(searchTerm) {
  const sql = `
    SELECT e.id, 
           e.full_name AS nombre,
           e.numero_documento,
           e.email,
           e.position,
           e.departamento
    FROM employees e
    WHERE e.full_name ILIKE $1 
       OR e.numero_documento ILIKE $1 
       OR e.email ILIKE $1
    ORDER BY e.full_name ASC
    LIMIT ${MAX_RESULTS_PER_MODULE}
  `;
  const result = await query(sql, [`%${searchTerm}%`]);
  return result.rows;
}

/**
 * Buscar proveedores por razón social, nombre comercial o documento
 */
export async function buscarProveedores(searchTerm) {
  const sql = `
    SELECT p.id, 
           p.razon_social AS nombre,
           p.nombre_comercial,
           p.numero_documento,
           p.tipo_documento
    FROM proveedores p
    WHERE p.deleted_at IS NULL
      AND (p.razon_social ILIKE $1 
           OR p.nombre_comercial ILIKE $1 
           OR p.numero_documento ILIKE $1)
    ORDER BY p.razon_social ASC
    LIMIT ${MAX_RESULTS_PER_MODULE}
  `;
  const result = await query(sql, [`%${searchTerm}%`]);
  return result.rows;
}

/**
 * Registrar búsqueda anómala en auditoría
 */
export async function registrarBusquedaAnomala(userId, searchQuery, ipAddress) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, user_name, modulo, accion, ruta, metodo, datos_despues, ip_address)
       SELECT $1, COALESCE(u.nombre || ' ' || u.apellido, 'unknown'), 'busqueda_global', 'BUSQUEDA_ANOMALA', '/api/v1/busqueda-global', 'GET', $2::jsonb, $3
       FROM users u WHERE u.id = $1`,
      [userId, JSON.stringify({ query_length: searchQuery.length, suspicious_chars: /[<>{}]/.test(searchQuery) }), ipAddress]
    );
  } catch (err) {
    logger.warn('Error registering anomalous search', { error: err.message });
  }
}
