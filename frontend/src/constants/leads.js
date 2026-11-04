// Catálogo de fuentes del módulo Leads (ítem A del diseño de la Fase 1).
//
// Se guardan y se muestran las MISMAS etiquetas, sin traducir a códigos internos:
// los leads existentes ya tienen valores como 'Facebook' y así la lista no muestra
// dos grafías distintas. La validación del catálogo vive en el backend; no se añadió
// un CHECK sobre `source` para no romper compatibilidad con la app anterior.
export const FUENTES = [
  'Web',
  'Facebook',
  'Instagram',
  'WhatsApp',
  'Referido',
  'Llamada',
  'Feria/Evento',
  'Cliente existente',
  'Otro',
];

// Estados reales permitidos del módulo (los únicos que acepta el backend).
export const STATUS_COLORS = {
  new: { bg: '#e0f2fe', color: '#0284c7', label: 'Nuevo' },
  contacted: { bg: '#fef08a', color: '#854d0e', label: 'Contactado' },
  qualified: { bg: '#dcfce3', color: '#166534', label: 'Calificado' },
  converted: { bg: '#dbeafe', color: '#1e40af', label: 'Convertido' },
  dead: { bg: '#fee2e2', color: '#991b1b', label: 'Descartado' },
};

// Tipos de gestión comercial. El orden es el del formulario; el catálogo
// coincide con el CHECK de `tasks` (call/meeting/email/follow_up) para que el
// lenguaje sea el mismo en todo el CRM. Coincide con TIPOS_GESTION del backend.
export const TIPOS_GESTION = ['llamada', 'reunion', 'correo', 'observacion', 'otro'];

// Estados seleccionables en «Cambiar estado».
// `converted` NO está aquí: se logra con la acción de conversión, que además
// crea el contacto y la empresa reales.
export const ESTADOS_LEAD = [
  { value: 'new', label: 'Nuevo' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'qualified', label: 'Calificado' },
  { value: 'dead', label: 'Descartado' },
];

/**
 * Límites de la nota de cambio de estado.
 * Deben coincidir con `leads.constants.js` del backend (fuente de verdad).
 */
export const NOTA_MIN = 5;
export const NOTA_MAX = 1000;

/**
 * Formatea una duración en segundos para la línea de tiempo.
 * Devuelve null si el dato no existe (gestiones, modificaciones).
 */
export function formatearDuracion(segundos) {
  if (segundos === null || segundos === undefined) return null;
  const total = Number(segundos);
  if (!Number.isFinite(total) || total < 0) return null;

  if (total < 60) return 'menos de 1 min';

  const dias = Math.floor(total / 86400);
  const horas = Math.floor((total % 86400) / 3600);
  const minutos = Math.floor((total % 3600) / 60);

  const partes = [];
  if (dias) partes.push(`${dias} d`);
  if (horas) partes.push(`${horas} h`);
  if (!dias && minutos) partes.push(`${minutos} min`);

  return partes.join(' ') || 'menos de 1 min';
}
