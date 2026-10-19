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
