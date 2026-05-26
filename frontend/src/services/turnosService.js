/**
 * turnosService.js
 * Capa de comunicación con la API REST del módulo de Turnos.
 */
import api from '../lib/api';

const BASE = '/turnos';

// ─── Técnico ────────────────────────────────────────────────
export const turnosService = {
  /** Turno activo del técnico autenticado */
  getTurnoActivo: () =>
    api.get(`${BASE}/activo`).then(r => r.data?.turno || null),

  /** OTs disponibles para iniciar servicio */
  getOTsDisponibles: (q = '') =>
    api.get(`${BASE}/servicios/ots-disponibles`, { params: { q } }).then(r => r.data?.data || []),

  /** EVENTO 1: Salir hacia una OT */
  iniciarServicio: (data) =>
    api.post(`${BASE}/servicios/iniciar`, data).then(r => r.data?.data || null),

  /** EVENTO 2: Llegué donde el cliente */
  registrarInicioServicio: (servicioId, data) =>
    api.patch(`${BASE}/servicios/${servicioId}/inicio-servicio`, data).then(r => r.data?.data || null),

  /** EVENTO 3: Terminé el servicio */
  registrarFinServicio: (servicioId, data) =>
    api.patch(`${BASE}/servicios/${servicioId}/fin-servicio`, data).then(r => r.data?.data || null),

  /** EVENTO 4: Llegué a CARGAR */
  registrarIngresoCargar: (servicioId, data) =>
    api.patch(`${BASE}/servicios/${servicioId}/ingreso-cargar`, data).then(r => r.data?.data || null),

  /** EVENTO 5: Cerrar turno del día */
  cerrarTurno: (turnoId, data) =>
    api.post(`${BASE}/${turnoId}/cerrar`, data).then(r => r.data?.data || null),

  // ─── Supervisor ─────────────────────────────────────────
  listarTurnos: (params) =>
    api.get(BASE, { params }).then(r => {
      const data = r.data?.data || [];
      // Normalizar: la vista resumen_turnos_tecnicos podría devolver
      // 'turno_id' en vez de 'id' si no se ha aplicado la migración 031
      return data.map(t => ({ ...t, id: t.id ?? t.turno_id }));
    }),

  resumenSemana: () =>
    api.get(`${BASE}/resumen-semana`).then(r => r.data?.data || null),

  aprobarExtras: (turnoId, data) =>
    api.patch(`${BASE}/${turnoId}/aprobar-extras`, data).then(r => r.data?.data || null),

  // ─── Reabrir turno ───────────────────────────────────────
  reabrirTurno: (turnoId) =>
    api.patch(`${BASE}/${turnoId}/reabrir`).then(r => r.data?.data || null),

  // ─── Desglose recargos CST ──────────────────────────────
  getDesgloseRecargos: (turnoId) =>
    api.get(`${BASE}/${turnoId}/desglose-recargos`).then(r => r.data?.data || null),

  // ─── Festivos ────────────────────────────────────────────
  listarFestivos: (anio) =>
    api.get(`${BASE}/festivos/${anio}`).then(r => r.data?.data || []),
};

export default turnosService;
