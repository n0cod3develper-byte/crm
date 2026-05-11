/**
 * Formatea un número como moneda COP
 * @param {number} val 
 * @returns {string}
 */
export function formatCurrency(val) {
  if (val === undefined || val === null) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(val);
}

/**
 * Formatea una fecha en formato legible
 * @param {string|Date} date 
 * @returns {string}
 */
export function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
