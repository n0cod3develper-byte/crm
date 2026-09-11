import { obtenerPermisosUsuario } from '../../middleware/auth.js';
import { 
  buscarEmpresas, 
  buscarRemisiones, 
  buscarOTs, 
  buscarProductos,
  buscarContactos,
  buscarEmpleados,
  buscarProveedores,
  registrarBusquedaAnomala 
} from './busquedaGlobal.repository.js';
import { logger } from '../../utils/logger.js';

const EMPTY_RESULT = { 
  empresas: [], remisiones: [], ordenes_trabajo: [], productos: [],
  contactos: [], empleados: [], proveedores: [] 
};

/**
 * GET /api/v1/busqueda-global?q=texto
 * Búsqueda global en Empresas, Remisiones, OTs, Productos, Contactos, Empleados y Proveedores
 */
export const busquedaGlobal = async (req, res, next) => {
  try {
    const { q } = req.query;

    // 1. Validar entrada
    if (!q || q.trim().length < 2) {
      return res.json({ 
        success: true, 
        data: EMPTY_RESULT, 
        meta: { query: q || '', total_resultados: 0 } 
      });
    }

    if (q.length > 100) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Término de búsqueda demasiado largo (máx. 100 caracteres)' } 
      });
    }

    // 2. Sanitizar: escapar caracteres especiales de ILIKE (% y _)
    const sanitized = q.replace(/[%_]/g, '\\$&');

    // 3. Obtener permisos del usuario
    const { permisos } = await obtenerPermisosUsuario(req.userId);

    // 4. Determinar módulos permitidos
    const modulosPermitidos = [];
    if (permisos.empresas?.ver) modulosPermitidos.push('empresas');
    if (permisos.servicios?.ver) modulosPermitidos.push('remisiones');
    if (permisos.ordenes_trabajo?.ver) modulosPermitidos.push('ordenes_trabajo');
    if (permisos.inventario?.ver) modulosPermitidos.push('productos');
    if (permisos.contactos?.ver) modulosPermitidos.push('contactos');
    if (permisos.empleados?.ver) modulosPermitidos.push('empleados');
    if (permisos.proveedores?.ver) modulosPermitidos.push('proveedores');

    // 5. Ejecutar búsquedas en paralelo (solo módulos permitidos)
    const [empresas, remisiones, ordenesTrabajo, productos, contactos, empleados, proveedores] = await Promise.all([
      modulosPermitidos.includes('empresas') ? buscarEmpresas(sanitized) : Promise.resolve([]),
      modulosPermitidos.includes('remisiones') ? buscarRemisiones(sanitized) : Promise.resolve([]),
      modulosPermitidos.includes('ordenes_trabajo') ? buscarOTs(sanitized) : Promise.resolve([]),
      modulosPermitidos.includes('productos') ? buscarProductos(sanitized) : Promise.resolve([]),
      modulosPermitidos.includes('contactos') ? buscarContactos(sanitized) : Promise.resolve([]),
      modulosPermitidos.includes('empleados') ? buscarEmpleados(sanitized) : Promise.resolve([]),
      modulosPermitidos.includes('proveedores') ? buscarProveedores(sanitized) : Promise.resolve([]),
    ]);

    // 6. Registrar en auditoría si el término es sospechoso
    if (q.length > 50 || /[<>{}]/.test(q)) {
      registrarBusquedaAnomala(req.userId, q, req.ip).catch(() => {});
    }

    const totalResultados = empresas.length + remisiones.length + ordenesTrabajo.length + 
                           productos.length + contactos.length + empleados.length + proveedores.length;

    res.json({
      success: true,
      data: { empresas, remisiones, ordenes_trabajo: ordenesTrabajo, productos, contactos, empleados, proveedores },
      meta: { query: q, total_resultados: totalResultados }
    });
  } catch (err) {
    logger.error('[BusquedaGlobal] Error', { error: err.message, userId: req.userId });
    next(err);
  }
};
