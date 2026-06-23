import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

// ─── Plantilla base fija del proyecto (no negociable) ───────
const PLANTILLA_BASE = `Contexto fijo del proyecto (no negociable)

Eres un desarrollador senior full-stack trabajando sobre el CRM interno de CARGAR S.A.S.

Frontend: React
Backend: Node.js + Express
Base de datos: PostgreSQL
Despliegue: VPS Hostinger, Nginx, PM2, GitHub Actions CI/CD
Autenticacion: JWT custom propio. NO usar Clerk, NO usar Auth0, NO usar NextAuth.
NO usar Docker bajo ninguna circunstancia.
Sigue la estructura de carpetas ya existente en el repo (controllers/, routes/, services/, models/ en backend; components/, pages/, hooks/ en frontend). No reestructures el proyecto.
Codigo completo y funcional. Cero placeholders, cero // TODO.
Comentarios solo donde no sea obvio.
Responde en espanol; codigo y nombres de variables en ingles.`;

/**
 * Lista de modulos existentes para el campo "relaciones"
 */
export const MODULOS_EXISTENTES = [
  'Inventario (FIFO)',
  'Facturacion',
  'Soporte',
  'Empleados',
  'Equipos',
  'Mantenimiento',
  'Turnos',
  'Catalogo Servicios',
  'Servicios / Remisiones',
  'Proveedores',
  'Compras',
  'Empresas',
  'Contactos',
  'Pipeline',
  'Tareas',
  'Cotizaciones',
  'Leads',
  'Campanas',
  'Dashboard',
  'Presupuestos',
  'Informes Dinamicos',
  'Locativo',
  'SST',
  'Mantenimientos Programados',
];

/**
 * Ensambla el prompt final a partir de los datos del formulario.
 * @param {object} data - Datos validados del formulario
 * @returns {string} Prompt completo ensamblado
 */
export function buildPrompt(data) {
  const {
    nombreModulo,
    area,
    objetivo,
    entidades,
    reglasNegocio,
    relaciones = [],
    datosSensibles = false,
    requiereUI = true,
    notasExtra = '',
  } = data;

  const parts = [PLANTILLA_BASE, ''];

  // MODULO SOLICITADO
  parts.push('---');
  parts.push('## MODULO SOLICITADO');
  parts.push(nombreModulo);
  parts.push('');

  // AREA RESPONSABLE
  parts.push('## AREA RESPONSABLE');
  parts.push(area);
  parts.push('');

  // OBJETIVO
  parts.push('## OBJETIVO');
  parts.push(objetivo);
  parts.push('');

  // ENTIDADES
  if (entidades) {
    parts.push('## ENTIDADES');
    parts.push(entidades);
    parts.push('');
  }

  // REGLAS DE NEGOCIO
  if (reglasNegocio) {
    parts.push('## REGLAS DE NEGOCIO');
    parts.push(reglasNegocio);
    parts.push('');
  }

  // INTEGRACION CON OTROS MODULOS
  if (relaciones.length > 0) {
    parts.push('## INTEGRACION CON OTROS MODULOS');
    parts.push('Este modulo se integra con los siguientes modulos existentes del CRM:');
    relaciones.forEach((mod) => {
      parts.push('- ' + mod);
    });
    parts.push('');
  }

  // ALCANCE TECNICO
  parts.push('## ALCANCE TECNICO');
  parts.push('- Backend: Nuevo modulo dentro de `backend/src/modules/<nombre>/` con rutas, controlador, servicio y repository.');
  parts.push('- Frontend: Nueva pagina en `frontend/src/pages/<Nombre>/` con componentes, hooks y servicios.');
  parts.push('- Base de datos: Migracion numerada en `backend/migrations/` con CREATE TABLE + indices.');
  parts.push('- Autenticacion: JWT custom (requiere `requireAuth` en todas las rutas protegidas).');
  parts.push('- Roles: Middleware `authorize` para control de acceso granular.');
  if (requiereUI) {
    parts.push('- UI: Componentes React con diseno responsivo, usando lucide-react y el sistema de temas existente (var(--bg-*), var(--text-*), etc.).');
    parts.push('- Paginacion: Reutilizar el patron de paginacion existente en el CRM.');
  } else {
    parts.push('- UI: Sin interfaz grafica - solo API REST.');
  }
  parts.push('');

  // DATOS SENSIBLES (bloque condicional)
  if (datosSensibles) {
    parts.push('## MANEJO DE DATOS SENSIBLES');
    parts.push('ESTE MODULO MANEJA DATOS PERSONALES O SENSIBLES.');
    parts.push('- Todo campo que contenga informacion personal debe almacenarse con los mismos estandares de seguridad que el CRM actual.');
    parts.push('- No introducir mecanismos de cifrado nuevos sin aprobacion.');
    parts.push('- Seguir el patron existente de manejo de datos sensibles del proyecto.');
    parts.push('- Validar que los logs no expongan datos personales (loguear solo IDs, no contenido).');
    parts.push('');
  }

  // NOTAS ADICIONALES
  if (notasExtra) {
    parts.push('## NOTAS ADICIONALES');
    parts.push(notasExtra);
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Crea un nuevo prompt spec en la base de datos.
 * @param {object} data - Datos del formulario (camelCase)
 * @param {number} userId - ID del usuario autenticado
 * @returns {Promise<object>} Registro creado
 */
export async function createPromptSpec(data, userId) {
  const promptGenerado = buildPrompt(data);

  const sql = `
    INSERT INTO prompt_specs (
      nombre_modulo, area, objetivo, entidades, reglas_negocio,
      relaciones, datos_sensibles, requiere_ui, notas_extra,
      prompt_generado, creado_por, clonado_de
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `;

  const values = [
    data.nombreModulo,
    data.area,
    data.objetivo,
    data.entidades || null,
    data.reglasNegocio || null,
    JSON.stringify(data.relaciones || []),
    data.datosSensibles ?? false,
    data.requiereUI ?? true,
    data.notasExtra || null,
    promptGenerado,
    userId,
    data.clonadoDe || null,
  ];

  const result = await query(sql, values);
  return result.rows[0];
}

/**
 * Lista prompt specs con paginacion y filtros opcionales.
 * Ordenado por created_at DESC.
 */
export async function listPromptSpecs({ page = 1, limit = 20, area, search } = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  const conditions = [];
  const params = [];
  let idx = 1;

  if (area) {
    conditions.push('ps.area = $' + idx++);
    params.push(area);
  }

  if (search) {
    conditions.push('ps.nombre_modulo ILIKE $' + idx++);
    params.push('%' + search + '%');
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const countSql = 'SELECT COUNT(*) FROM prompt_specs ps ' + whereClause;
  const dataSql = `
    SELECT ps.*, u.nombre || ' ' || u.apellido AS creador_nombre
    FROM prompt_specs ps
    LEFT JOIN users u ON ps.creado_por = u.id
    ${whereClause}
    ORDER BY ps.created_at DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  params.push(safeLimit, offset);

  const [countResult, dataResult] = await Promise.all([
    query(countSql, params.slice(0, conditions.length)),
    query(dataSql, params),
  ]);

  return {
    data: dataResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
    page: safePage,
    limit: safeLimit,
  };
}

/**
 * Obtiene un prompt spec por su ID, incluyendo nombre del creador.
 * @param {number} id
 * @returns {Promise<object|null>}
 */
export async function getPromptSpecById(id) {
  const sql = `
    SELECT ps.*, u.nombre || ' ' || u.apellido AS creador_nombre
    FROM prompt_specs ps
    LEFT JOIN users u ON ps.creado_por = u.id
    WHERE ps.id = $1
  `;
  const result = await query(sql, [id]);
  return result.rows[0] || null;
}

/**
 * Elimina un prompt spec.
 * Solo el creador original o un admin puede eliminar.
 * @returns {Promise<{deleted: boolean, reason?: string}>}
 */
export async function deletePromptSpec(id, userId, userRole) {
  const spec = await getPromptSpecById(id);
  if (!spec) return { deleted: false, reason: 'not_found' };

  if (userRole !== 'admin' && spec.creado_por !== userId) {
    return { deleted: false, reason: 'forbidden' };
  }

  await query('DELETE FROM prompt_specs WHERE id = $1', [id]);
  return { deleted: true };
}
