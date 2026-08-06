import { AuditLogRepository } from '../modules/admin/auditLog.repository.js';
import { logger } from '../utils/logger.js';

const MODULE_MAP = {
  '/api/v1/auth': 'auth',
  '/api/v1/companies': 'empresas',
  '/api/v1/contacts': 'contactos',
  '/api/v1/pipeline': 'pipeline',
  '/api/v1/opportunities': 'oportunidades',
  '/api/v1/tasks': 'tareas',
  '/api/v1/leads': 'leads',
  '/api/v1/campaigns': 'campanas',
  '/api/v1/inventory': 'inventario',
  '/api/v1/catalogo': 'catalogo',
  '/api/v1/ubicaciones': 'inventario',
  '/api/v1/movements': 'inventario',
  '/api/v1/support': 'soporte',
  '/api/v1/employees': 'empleados',
  '/api/v1/equipos': 'equipos',
  '/api/v1/mantenimiento': 'ordenes_trabajo',
  '/api/v1/proveedores': 'proveedores',
  '/api/v1/compras': 'ordenes_compra',
  '/api/v1/documentos': 'documentos',
  '/api/v1/facturacion': 'facturacion',
  '/api/v1/catalogo-servicios': 'servicios',
  '/api/v1/servicios': 'servicios',
  '/api/v1/turnos': 'turnos',
  '/api/v1/certificados': 'certificados',
  '/api/v1/supplier-quotes': 'cotizaciones',
  '/api/v1/quotes': 'cotizaciones',
  '/api/v1/admin': 'admin',
  '/api/v1/roles': 'roles',
  '/api/v1/centros-costos': 'centros_costos',
  '/api/v1/budget': 'presupuestos',
  '/api/v1/informes': 'informes',
  '/api/v1/dashboard': 'dashboard',
  '/api/v1/reports': 'reportes',
  '/api/v1/mantenimientos-programados': 'ordenes_trabajo'
};

const MUTATIONAL_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const EXCLUDED_PATHS = [
  '/api/v1/auth/refresh',
  '/api/v1/auth/me',
  '/api/v1/admin/permisos',
  '/api/v1/admin/auditoria',
  '/health'
];

function extractModule(routePath) {
  const sortedPrefixes = Object.keys(MODULE_MAP).sort((a, b) => b.length - a.length);
  for (const prefix of sortedPrefixes) {
    if (routePath.startsWith(prefix)) {
      return MODULE_MAP[prefix];
    }
  }
  return 'otros';
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

/**
 * Middleware de auditoria que registra operaciones de escritura (POST, PUT, PATCH, DELETE).
 * Usa el evento 'finish' de Express para registrar despues de que la respuesta se envia,
 * sin bloquear el flujo principal ni hacer monkey-patching de res.send.
 */
export function auditMiddleware(req, res, next) {
  if (!MUTATIONAL_METHODS.has(req.method)) {
    return next();
  }

  const fullPath = req.originalUrl || req.url;
  const routePath = fullPath.split('?')[0];

  if (EXCLUDED_PATHS.some(excluded => routePath.startsWith(excluded))) {
    return next();
  }

  // Capturar datos de la request antes de que los handlers la consuman
  const requestBody = (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')
    ? (req.body ? { ...req.body } : null)
    : null;

  // Usar evento 'finish' en vez de monkey-patchear res.send
  res.on('finish', () => {
    // Solo registrar si la respuesta es exitosa (2xx)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      let accion = 'CREATE';
      if (req.method === 'PUT' || req.method === 'PATCH') accion = 'UPDATE';
      if (req.method === 'DELETE') accion = 'DELETE';

      const modulo = extractModule(routePath);

      const auditData = {
        userId: req.userId || null,
        userName: req.user ? `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() : null,
        modulo,
        accion,
        ruta: routePath,
        metodo: req.method,
        datosAntes: requestBody,
        datosDespues: null,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || null
      };

      // Insertar de forma asincrona (no bloquear la respuesta)
      AuditLogRepository.insertar(auditData).catch(err => {
        logger.error('Error insertando log de auditoria', { error: err.message, ruta: routePath });
      });
    }
  });

  next();
}
