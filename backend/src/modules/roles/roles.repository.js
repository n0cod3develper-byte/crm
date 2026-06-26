import { query, withTransaction } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

/**
 * Obtiene todos los roles con conteo de usuarios asignados.
 * Ordena por nombre ascendente.
 */
export async function getAllRoles() {
  const sql = `
    SELECT 
      r.id, r.nombre, r.slug, r.descripcion, r.es_sistema, r.activo,
      r.created_at, r.updated_at,
      COUNT(u.id)::int AS total_usuarios
    FROM roles r
    LEFT JOIN users u ON u.rol_id = r.id AND u.estado = 'ACTIVO'
    GROUP BY r.id
    ORDER BY r.nombre ASC
  `;
  const result = await query(sql);
  return result.rows;
}

/**
 * Obtiene un rol por ID con todos sus permisos agrupados por módulo.
 * Hace LEFT JOIN con modulos_sistema para incluir módulos sin permiso asignado.
 */
export async function getRolById(id) {
  const rolSql = `
    SELECT 
      r.id, r.nombre, r.slug, r.descripcion, r.es_sistema, r.activo,
      r.created_at, r.updated_at,
      COUNT(u.id)::int AS total_usuarios
    FROM roles r
    LEFT JOIN users u ON u.rol_id = r.id AND u.estado = 'ACTIVO'
    WHERE r.id = $1
    GROUP BY r.id
  `;

  const permisosSql = `
    SELECT 
      ms.id AS modulo_id, 
      ms.nombre AS modulo_nombre, 
      ms.slug AS modulo_slug,
      ms.icono AS modulo_icono,
      ms.orden_menu,
      COALESCE(rp.puede_ver, false) AS puede_ver,
      COALESCE(rp.puede_crear, false) AS puede_crear,
      COALESCE(rp.puede_editar, false) AS puede_editar,
      COALESCE(rp.puede_eliminar, false) AS puede_eliminar,
      COALESCE(rp.puede_exportar, false) AS puede_exportar,
      COALESCE(rp.puede_aprobar, false) AS puede_aprobar,
      COALESCE(rp.puede_liquidar, false) AS puede_liquidar
    FROM modulos_sistema ms
    LEFT JOIN roles_permisos rp ON rp.modulo_id = ms.id AND rp.rol_id = $1
    WHERE ms.activo = true
    ORDER BY ms.orden_menu, ms.nombre
  `;

  const [rolResult, permisosResult] = await Promise.all([
    query(rolSql, [id]),
    query(permisosSql, [id])
  ]);

  if (rolResult.rows.length === 0) {
    return null;
  }

  return {
    ...rolResult.rows[0],
    permisos: permisosResult.rows
  };
}

/**
 * Obtiene la lista de módulos activos del sistema con sus acciones disponibles.
 */
export async function getModulosDisponibles() {
  const sql = `
    SELECT id, nombre, slug, icono, ruta_base, orden_menu
    FROM modulos_sistema
    WHERE activo = true
    ORDER BY orden_menu, nombre
  `;
  const result = await query(sql);
  
  // Definir las acciones estándar del sistema
  const acciones = [
    { slug: 'puede_ver', label: 'Ver' },
    { slug: 'puede_crear', label: 'Crear' },
    { slug: 'puede_editar', label: 'Editar' },
    { slug: 'puede_eliminar', label: 'Eliminar' },
    { slug: 'puede_exportar', label: 'Exportar' },
    { slug: 'puede_aprobar', label: 'Aprobar' },
    { slug: 'puede_liquidar', label: 'Liquidar' }
  ];

  return {
    modulos: result.rows,
    acciones
  };
}

/**
 * Genera un slug URL-friendly a partir del nombre.
 * Ej: "Supervisor Técnico" → "supervisor_tecnico"
 */
function generarSlug(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^a-z0-9\s_-]/g, '')   // Solo alfanuméricos
    .replace(/[\s-]+/g, '_')          // Espacios/guiones → underscore
    .replace(/^_+|_+$/g, '')          // Trim underscores
    .substring(0, 80);
}

/**
 * Crea un nuevo rol con todos sus permisos inicializados en false.
 * Usa transacción para garantizar atomicidad.
 */
export async function createRol(nombre, descripcion) {
  const slug = generarSlug(nombre);

  return await withTransaction(async (client) => {
    // 1. Verificar que no exista un rol con el mismo slug
    const existsCheck = await client.query(
      'SELECT id FROM roles WHERE slug = $1',
      [slug]
    );
    if (existsCheck.rows.length > 0) {
      const error = new Error(`Ya existe un rol con un nombre similar (slug: ${slug})`);
      error.statusCode = 409;
      throw error;
    }

    // 2. Verificar que no exista un rol con el mismo nombre exacto
    const nameCheck = await client.query(
      'SELECT id FROM roles WHERE LOWER(nombre) = LOWER($1)',
      [nombre.trim()]
    );
    if (nameCheck.rows.length > 0) {
      const error = new Error('Ya existe un rol con este nombre');
      error.statusCode = 409;
      throw error;
    }

    // 3. Insertar el rol
    const insertRolSql = `
      INSERT INTO roles (nombre, slug, descripcion, es_sistema, activo)
      VALUES ($1, $2, $3, false, true)
      RETURNING id, nombre, slug, descripcion, es_sistema, activo, created_at, updated_at
    `;
    const rolResult = await client.query(insertRolSql, [
      nombre.trim(), slug, descripcion?.trim() || null
    ]);
    const nuevoRol = rolResult.rows[0];

    // 4. Crear registros de permisos en false para TODOS los módulos activos
    const modulosSql = 'SELECT id FROM modulos_sistema WHERE activo = true';
    const modulosResult = await client.query(modulosSql);

    for (const modulo of modulosResult.rows) {
      await client.query(`
        INSERT INTO roles_permisos (
          rol_id, modulo_id,
          puede_ver, puede_crear, puede_editar, puede_eliminar,
          puede_exportar, puede_aprobar, puede_liquidar
        ) VALUES ($1, $2, false, false, false, false, false, false, false)
        ON CONFLICT (rol_id, modulo_id) DO NOTHING
      `, [nuevoRol.id, modulo.id]);
    }

    logger.info('Rol creado exitosamente', { rolId: nuevoRol.id, nombre, slug });

    return { ...nuevoRol, total_usuarios: 0 };
  });
}

/**
 * Actualiza nombre y/o descripción de un rol.
 * Si el rol es de sistema, solo permite cambiar nombre y descripción, no el slug.
 */
export async function updateRol(id, nombre, descripcion) {
  // 1. Verificar que el rol existe
  const existsResult = await query('SELECT id, es_sistema, slug FROM roles WHERE id = $1', [id]);
  if (existsResult.rows.length === 0) {
    const error = new Error('Rol no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const rolActual = existsResult.rows[0];

  // 2. Verificar nombre único (excluyendo el rol actual)
  if (nombre) {
    const nameCheck = await query(
      'SELECT id FROM roles WHERE LOWER(nombre) = LOWER($1) AND id != $2',
      [nombre.trim(), id]
    );
    if (nameCheck.rows.length > 0) {
      const error = new Error('Ya existe un rol con este nombre');
      error.statusCode = 409;
      throw error;
    }
  }

  // 3. Generar nuevo slug solo si NO es rol de sistema
  const nuevoSlug = rolActual.es_sistema ? rolActual.slug : generarSlug(nombre || rolActual.nombre);

  // 4. Si no es de sistema y se cambia nombre, verificar slug único
  if (!rolActual.es_sistema && nombre) {
    const slugCheck = await query(
      'SELECT id FROM roles WHERE slug = $1 AND id != $2',
      [nuevoSlug, id]
    );
    if (slugCheck.rows.length > 0) {
      const error = new Error('Ya existe un rol con un nombre similar');
      error.statusCode = 409;
      throw error;
    }
  }

  const sql = `
    UPDATE roles SET
      nombre = COALESCE($1, nombre),
      slug = $2,
      descripcion = COALESCE($3, descripcion),
      updated_at = NOW()
    WHERE id = $4
    RETURNING id, nombre, slug, descripcion, es_sistema, activo, created_at, updated_at
  `;
  const result = await query(sql, [
    nombre?.trim() || null,
    nuevoSlug,
    descripcion?.trim() !== undefined ? descripcion?.trim() : null,
    id
  ]);

  logger.info('Rol actualizado', { rolId: id, nombre, slug: nuevoSlug });
  return result.rows[0];
}

/**
 * Elimina un rol. Validaciones:
 * - No se puede eliminar un rol de sistema (es_sistema = true)
 * - No se puede eliminar un rol que tenga usuarios asignados
 */
export async function deleteRol(id) {
  return await withTransaction(async (client) => {
    // 1. Obtener info del rol
    const rolResult = await client.query(
      'SELECT id, nombre, es_sistema FROM roles WHERE id = $1',
      [id]
    );
    if (rolResult.rows.length === 0) {
      const error = new Error('Rol no encontrado');
      error.statusCode = 404;
      throw error;
    }

    const rol = rolResult.rows[0];

    // 2. Verificar que no sea rol de sistema
    if (rol.es_sistema) {
      const error = new Error(`El rol "${rol.nombre}" es un rol del sistema y no puede ser eliminado`);
      error.statusCode = 403;
      throw error;
    }

    // 3. Verificar que no tenga usuarios asignados
    const usersResult = await client.query(
      'SELECT COUNT(*)::int AS total FROM users WHERE rol_id = $1 AND estado = \'ACTIVO\'',
      [id]
    );
    const totalUsuarios = usersResult.rows[0].total;
    if (totalUsuarios > 0) {
      const error = new Error(
        `No se puede eliminar el rol "${rol.nombre}" porque tiene ${totalUsuarios} usuario(s) activo(s) asignado(s). Reasigna los usuarios a otro rol antes de eliminar.`
      );
      error.statusCode = 409;
      throw error;
    }

    // 4. Eliminar (los permisos se eliminan en cascada por FK)
    await client.query('DELETE FROM roles WHERE id = $1', [id]);

    logger.info('Rol eliminado', { rolId: id, nombre: rol.nombre });

    return { id, nombre: rol.nombre };
  });
}

/**
 * Actualiza TODOS los permisos de un rol (bulk update).
 * Recibe un array de objetos con modulo_id y las 7 acciones booleanas.
 * Usa transacción con DELETE + INSERT para atomicidad.
 */
export async function updatePermisos(rolId, permisos, ejecutadoPor) {
  return await withTransaction(async (client) => {
    // 1. Verificar que el rol existe
    const rolCheck = await client.query('SELECT id FROM roles WHERE id = $1', [rolId]);
    if (rolCheck.rows.length === 0) {
      const error = new Error('Rol no encontrado');
      error.statusCode = 404;
      throw error;
    }

    // 2. Eliminar permisos actuales del rol
    await client.query('DELETE FROM roles_permisos WHERE rol_id = $1', [rolId]);

    // 3. Insertar nuevos permisos
    for (const p of permisos) {
      const sql = `
        INSERT INTO roles_permisos (
          rol_id, modulo_id,
          puede_ver, puede_crear, puede_editar, puede_eliminar,
          puede_exportar, puede_aprobar, puede_liquidar
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      await client.query(sql, [
        rolId, p.modulo_id,
        p.puede_ver ?? false,
        p.puede_crear ?? false,
        p.puede_editar ?? false,
        p.puede_eliminar ?? false,
        p.puede_exportar ?? false,
        p.puede_aprobar ?? false,
        p.puede_liquidar ?? false
      ]);
    }

    // 4. Registrar en auditoría
    const auditSql = `
      INSERT INTO auditoria_permisos (accion, ejecutado_por, entidad_tipo, entidad_id, detalle)
      VALUES ('UPDATE_PERMISSIONS', $1, 'ROL', $2, $3)
    `;
    await client.query(auditSql, [
      ejecutadoPor || 'sistema',
      rolId,
      JSON.stringify({ permisos_count: permisos.length })
    ]);

    logger.info('Permisos actualizados', { rolId, totalPermisos: permisos.length });

    return { updated: permisos.length };
  });
}

/**
 * Toggle individual de un permiso específico (módulo + acción).
 */
export async function togglePermiso(rolId, moduloSlug, accionSlug) {
  // 1. Obtener el modulo_id desde el slug
  const moduloResult = await query(
    'SELECT id FROM modulos_sistema WHERE slug = $1 AND activo = true',
    [moduloSlug]
  );
  if (moduloResult.rows.length === 0) {
    const error = new Error(`Módulo "${moduloSlug}" no encontrado`);
    error.statusCode = 404;
    throw error;
  }
  const moduloId = moduloResult.rows[0].id;

  // 2. Validar que la acción es válida
  const accionesValidas = [
    'puede_ver', 'puede_crear', 'puede_editar', 'puede_eliminar',
    'puede_exportar', 'puede_aprobar', 'puede_liquidar'
  ];
  if (!accionesValidas.includes(accionSlug)) {
    const error = new Error(`Acción "${accionSlug}" no es válida`);
    error.statusCode = 400;
    throw error;
  }

  return await withTransaction(async (client) => {
    // 3. Verificar si ya existe el registro de permiso
    const existsResult = await client.query(
      'SELECT id, ' + accionSlug + ' AS valor_actual FROM roles_permisos WHERE rol_id = $1 AND modulo_id = $2',
      [rolId, moduloId]
    );

    let nuevoValor;
    if (existsResult.rows.length === 0) {
      // Crear el registro con la acción toggled
      const campos = accionesValidas.map(a => a === accionSlug ? 'true' : 'false').join(', ');
      await client.query(`
        INSERT INTO roles_permisos (rol_id, modulo_id, ${accionesValidas.join(', ')})
        VALUES ($1, $2, ${campos})
      `, [rolId, moduloId]);
      nuevoValor = true;
    } else {
      // Toggle del valor actual
      nuevoValor = !existsResult.rows[0].valor_actual;
      await client.query(
        `UPDATE roles_permisos SET ${accionSlug} = $1 WHERE rol_id = $2 AND modulo_id = $3`,
        [nuevoValor, rolId, moduloId]
      );
    }

    return { modulo: moduloSlug, accion: accionSlug, valor: nuevoValor };
  });
}
