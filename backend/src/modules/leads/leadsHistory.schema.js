import z from 'zod';

/** Tipos de evento que reconoce la trazabilidad (coinciden con el CHECK de las migraciones 139 y 141). */
export const TIPOS_EVENTO = [
  'CREACION',
  'ASIGNACION',
  'CAMBIO_ESTADO',
  'MODIFICACION',
  'CIERRE',
  'ACTIVIDAD',
  'RESTAURACION',
];

/**
 * Filtros de la línea de tiempo.
 * Se reutiliza el patrón de cursor del listado de leads (fecha + id).
 */
export const historyQuerySchema = z.object({
  tipo: z.enum(TIPOS_EVENTO).optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursorFecha: z.coerce.date().optional(),
  cursorOrden: z.string().max(40).optional(),
});
