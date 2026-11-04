import api from './api';

/**
 * Normaliza la respuesta de `/leads/asignables` a un array.
 *
 * El backend responde `{ success: true, data: [...] }`. Todos los consumidores
 * de la clave `['leads-asignables']` deben guardar la MISMA forma en la caché
 * de React Query: si uno guarda el sobre completo y otro espera un array,
 * aparece `empleados.map is not a function`.
 */
export function normalizarAsignables(payload) {
  const lista = payload?.data ?? payload;
  return Array.isArray(lista) ? lista : [];
}

/** Query function compartida para los selectores de responsable. */
export async function fetchAsignables() {
  const { data } = await api.get('/leads/asignables');
  return normalizarAsignables(data);
}
