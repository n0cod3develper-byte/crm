/**
 * Límites compartidos por la validación HTTP (zod) y el dominio (repositorio).
 * Se centralizan aquí para que un cambio de regla no quede desalineado.
 */

/** Longitud mínima de la nota de un cambio de estado. */
export const NOTA_MIN = 5;

/** Longitud máxima de la nota de un cambio de estado. */
export const NOTA_MAX = 1000;
