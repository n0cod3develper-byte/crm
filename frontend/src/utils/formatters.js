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

/**
 * Formatea una fecha ignorando la zona horaria para evitar desfases de 1 día
 * Útil para campos tipo DATE de PostgreSQL
 * @param {string} dateString 
 * @returns {string}
 */
export function formatDateLocal(dateString) {
  if (!dateString) return '—';
  if (typeof dateString === 'string' && dateString.includes('T')) {
    const [year, month, day] = dateString.split('T')[0].split('-');
    if (year && month && day) {
      return `${parseInt(day)}/${parseInt(month)}/${year}`;
    }
  }
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO');
}
