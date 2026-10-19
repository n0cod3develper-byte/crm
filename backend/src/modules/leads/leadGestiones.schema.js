import z from 'zod';
import { TIPOS_GESTION } from './leadGestiones.repository.js';

/**
 * Creación de una gestión comercial.
 *
 * `fecha_gestion` es OPCIONAL: si no se envía, se registra con la hora actual.
 * Se permite valor pasado porque las gestiones se anotan muchas veces después
 * de haber ocurrido.
 */
export const createGestionSchema = z.object({
  tipo: z.enum(TIPOS_GESTION, {
    errorMap: () => ({ message: `El tipo debe ser uno de: ${TIPOS_GESTION.join(', ')}` }),
  }),
  observaciones: z.string().trim().max(2000).optional(),
  resultado: z.string().trim().max(120).optional(),
  fecha_gestion: z.coerce.date().optional(),
  proxima_seguimiento: z.coerce.date().optional(),
  employee_id: z.string().uuid('Identificador de empleado inválido').optional(),
}).refine(
  (d) => !(d.fecha_gestion && d.proxima_seguimiento) ||
          d.proxima_seguimiento > d.fecha_gestion,
  {
    path: ['proxima_seguimiento'],
    message: 'La próxima fecha de seguimiento debe ser posterior a la fecha de la gestión',
  }
);

/** Filtros y paginación del listado de gestiones de un lead. */
export const gestionesQuerySchema = z.object({
  tipo: z.enum(TIPOS_GESTION).optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursorFecha: z.coerce.date().optional(),
  cursorId: z.coerce.number().int().optional(),
});

/**
 * Restauración de un lead archivado.
 * No lleva cuerpo: el id del lead viene en la ruta y el usuario en el token.
 * Se declara igual para que `validate` rechace cuerpos inesperados.
 */
export const restoreLeadSchema = z.object({}).strict();
