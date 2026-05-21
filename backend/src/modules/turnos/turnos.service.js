/**
 * turnos.service.js
 * Lógica de negocio del módulo de Control de Turnos.
 * Cálculos puros y coordinación de desglose CST.
 */

import { calcularRecargos } from '../../services/calculoRecargosService.js';
import { esDiaEspecial } from '../../services/calendarioService.js';

const JORNADA_DEFAULT_MIN = 440; // 7h 20min
const HORA_INICIO_DIURNO  = 6;   // 06:00
const HORA_FIN_DIURNO     = 21;  // 21:00

// ──────────────────────────────────────────────────────────────
// Utilidades de tiempo
// ──────────────────────────────────────────────────────────────

/**
 * Calcula la intersección en minutos entre dos intervalos de tiempo.
 * @param {number} aStart - Inicio intervalo A (ms epoch)
 * @param {number} aEnd   - Fin intervalo A (ms epoch)
 * @param {number} bStart - Inicio intervalo B (ms epoch)
 * @param {number} bEnd   - Fin intervalo B (ms epoch)
 * @returns {number} Minutos de intersección (>= 0)
 */
function interseccionMinutos(aStart, aEnd, bStart, bEnd) {
  const start = Math.max(aStart, bStart);
  const end   = Math.min(aEnd,   bEnd);
  if (end <= start) return 0;
  return Math.round((end - start) / 60000);
}

/**
 * Construye un timestamp en el mismo día que `fechaBase` con la hora dada.
 * @param {Date} fechaBase 
 * @param {number} hora - Hora del día (0-23)
 * @param {number} dia  - Offset de día (0 = mismo día, 1 = siguiente)
 */
function tsDelDia(fechaBase, hora, dia = 0) {
  const d = new Date(fechaBase);
  d.setDate(d.getDate() + dia);
  d.setHours(hora, 0, 0, 0);
  return d.getTime();
}

// ──────────────────────────────────────────────────────────────
// ALGORITMO DE RANGOS — O(1), sin bucle minuto a minuto
// ──────────────────────────────────────────────────────────────

/**
 * Clasifica los minutos extras en diurnos y nocturnos usando
 * intersección de intervalos (O(1) por segmento, no O(n) por minuto).
 *
 * El horario diurno es 06:00–21:00 del mismo día.
 * El horario nocturno cubre 00:00–06:00 y 21:00–24:00.
 *
 * @param {Date|string} inicioExtras - Cuando empiezan las horas extras
 * @param {Date|string} finExtras    - Cuando terminan
 * @returns {{ minutosExtrasDiurnos: number, minutosExtrasNocturno: number }}
 */
export function calcularHorasExtrasPorRango(inicioExtras, finExtras) {
  const ini = new Date(inicioExtras).getTime();
  const fin = new Date(finExtras).getTime();

  if (fin <= ini) return { minutosExtrasDiurnos: 0, minutosExtrasNocturno: 0 };

  // El intervalo de extras puede cruzar varios días.
  // Iteramos por cada día natural involucrado (normalmente 1 o 2 días).
  let minutosExtrasDiurnos  = 0;
  let minutosExtrasNocturno = 0;

  // Determinar el primer y el último día
  const fechaIni = new Date(inicioExtras);
  const fechaFin = new Date(finExtras);

  // Número de días a iterar (máximo protección: 3 días)
  const diasAIterar = Math.min(
    Math.ceil((fin - ini) / 86400000) + 1,
    3
  );

  for (let d = 0; d < diasAIterar; d++) {
    // Franja diurna de este día: 06:00 – 21:00
    const diurnoStart = tsDelDia(fechaIni, HORA_INICIO_DIURNO, d);
    const diurnoEnd   = tsDelDia(fechaIni, HORA_FIN_DIURNO,    d);

    // Franja nocturna parte 1: 00:00 – 06:00 de este día
    const noct1Start  = tsDelDia(fechaIni, 0,  d);
    const noct1End    = tsDelDia(fechaIni, HORA_INICIO_DIURNO, d);

    // Franja nocturna parte 2: 21:00 – 00:00 del día siguiente
    const noct2Start  = tsDelDia(fechaIni, HORA_FIN_DIURNO, d);
    const noct2End    = tsDelDia(fechaIni, 0, d + 1);

    minutosExtrasDiurnos  += interseccionMinutos(ini, fin, diurnoStart, diurnoEnd);
    minutosExtrasNocturno += interseccionMinutos(ini, fin, noct1Start,  noct1End);
    minutosExtrasNocturno += interseccionMinutos(ini, fin, noct2Start,  noct2End);
  }

  return { minutosExtrasDiurnos, minutosExtrasNocturno };
}

// ──────────────────────────────────────────────────────────────
// CÁLCULO DEL TURNO COMPLETO
// ──────────────────────────────────────────────────────────────

/**
 * Calcula todos los tiempos y horas extras de un turno.
 * Se llama al registrar el Evento 5 (cierre de turno).
 *
 * @param {{ inicio_turno: string|Date, fin_turno: string|Date }} turno
 * @param {{ jornada_normal_min?: number, limite_extras_diarias_min?: number }} config
 * @returns {Object} tiempos calculados
 */
/**
 * Calcula el desglose completo de recargos CST para un turno.
 * Es async porque consulta la BD para determinar si el día es festivo.
 *
 * @param {{ inicio_turno, fin_turno, fecha_turno }} turno
 * @param {{ jornada_normal_min?, limite_extras_diarias_min? }} config
 * @returns {Promise<Object>} tiempos + desglose CST completo
 */
export async function calcularDesgloseCompleto(turno, config = {}) {
  // 1. Calcular tiempos base
  const base = calcularTiemposTurno(turno, config);
  if (!base.completo) return base;

  // 2. Determinar si el día es domingo/festivo
  const fechaTurno = turno.fecha_turno
    ? new Date(turno.fecha_turno).toISOString().split('T')[0]
    : new Date(turno.inicio_turno).toISOString().split('T')[0];

  let esDomingo = false;
  let esFestivo = false;
  let nombreFestivo = null;

  try {
    const diaEsp = await esDiaEspecial(fechaTurno);
    esDomingo = diaEsp.esDomingo;
    esFestivo = diaEsp.esFestivo;
    nombreFestivo = diaEsp.nombreFestivo;
  } catch (err) {
    // Si falla la BD, continuar sin datos de festivos
    esDomingo = new Date(fechaTurno).getDay() === 0;
  }

  const esDomFestivo = esDomingo || esFestivo;

  // 3. Calcular desglose de recargos por categorías CST
  const recargos = calcularRecargos(
    turno.inicio_turno,
    turno.fin_turno,
    base.jornadaNormalMin,
    esDomFestivo
  );

  // 4. Combinar resultados
  return {
    ...base,
    esDomingo,
    esFestivo,
    nombreFestivo,
    // Desglose detallado CST en minutos
    min_ord_diurnos:      recargos.min_ord_diurnos,
    min_ord_nocturnos:    recargos.min_ord_nocturnos,
    min_extra_diurnos:    recargos.min_extra_diurnos,
    min_extra_nocturnos:  recargos.min_extra_nocturnos,
    min_dom_fest_ord:     recargos.min_dom_fest_ord,
    min_dom_fest_extra_d: recargos.min_dom_fest_extra_d,
    min_dom_fest_extra_n: recargos.min_dom_fest_extra_n,
    // Bloques de auditoría
    desgloseBloques: recargos.bloques,
    desgloseResumen: recargos.desglose,
  };
}

export function calcularTiemposTurno(turno, config = {}) {
  const JORNADA_NORMAL       = config.jornada_normal_min      || JORNADA_DEFAULT_MIN;
  const LIMITE_EXTRAS_DIARIO = config.limite_extras_diarias_min || 120;

  if (!turno.inicio_turno || !turno.fin_turno) {
    return { completo: false };
  }

  const inicio = new Date(turno.inicio_turno);
  const fin    = new Date(turno.fin_turno);

  if (fin < inicio) return { completo: false, error: 'fin_turno debe ser posterior o igual a inicio_turno' };

  const tiempoTotalMin = Math.round((fin - inicio) / 60000);
  const minutosExtras  = Math.max(0, tiempoTotalMin - JORNADA_NORMAL);
  const horasExtras    = Math.round((minutosExtras / 60) * 100) / 100;

  let minutosExtrasDiurnos  = 0;
  let minutosExtrasNocturno = 0;

  if (minutosExtras > 0) {
    // El tiempo extra empieza justo después de cumplir la jornada normal
    const inicioExtras = new Date(inicio.getTime() + JORNADA_NORMAL * 60000);
    const { minutosExtrasDiurnos: d, minutosExtrasNocturno: n } =
      calcularHorasExtrasPorRango(inicioExtras, fin);
    minutosExtrasDiurnos  = d;
    minutosExtrasNocturno = n;
  }

  const horasExtrasDiurnas   = Math.round((minutosExtrasDiurnos  / 60) * 100) / 100;
  const horasExtrasNocturnas = Math.round((minutosExtrasNocturno / 60) * 100) / 100;
  const alertaLimiteLegal    = minutosExtras > LIMITE_EXTRAS_DIARIO;

  return {
    completo:              true,
    tiempoTotalMin,
    horasTotales:          Math.round((tiempoTotalMin / 60) * 100) / 100,
    jornadaNormalMin:      JORNADA_NORMAL,
    minutosExtras,
    horasExtras,
    horasExtrasDiurnas,
    horasExtrasNocturnas,
    minutosExtrasDiurnos,
    minutosExtrasNocturno,
    alertaLimiteLegal,
  };
}

// ──────────────────────────────────────────────────────────────
// CÁLCULO DE TIEMPOS DE UN SERVICIO INDIVIDUAL
// ──────────────────────────────────────────────────────────────

/**
 * Calcula los 4 tiempos de un servicio (una OT).
 * @param {{ salida_cargar, inicio_servicio, fin_servicio, ingreso_cargar }} servicio
 * @returns {Object}
 */
export function calcularTiemposServicio(servicio) {
  const result = {
    tiempoDesplazamientoIdaMin:     null,
    tiempoServicioEfectivoMin:      null,
    tiempoDesplazamientoVueltaMin:  null,
    tiempoTotalServicioMin:         null,
  };

  if (servicio.salida_cargar && servicio.inicio_servicio) {
    const v = Math.round(
      (new Date(servicio.inicio_servicio) - new Date(servicio.salida_cargar)) / 60000
    );
    result.tiempoDesplazamientoIdaMin = v >= 0 ? v : null;
  }

  if (servicio.inicio_servicio && servicio.fin_servicio) {
    const v = Math.round(
      (new Date(servicio.fin_servicio) - new Date(servicio.inicio_servicio)) / 60000
    );
    result.tiempoServicioEfectivoMin = v >= 0 ? v : null;
  }

  if (servicio.fin_servicio && servicio.ingreso_cargar) {
    const v = Math.round(
      (new Date(servicio.ingreso_cargar) - new Date(servicio.fin_servicio)) / 60000
    );
    result.tiempoDesplazamientoVueltaMin = v >= 0 ? v : null;
  }

  if (servicio.salida_cargar && servicio.ingreso_cargar) {
    const v = Math.round(
      (new Date(servicio.ingreso_cargar) - new Date(servicio.salida_cargar)) / 60000
    );
    result.tiempoTotalServicioMin = v >= 0 ? v : null;
  }

  return result;
}

// ──────────────────────────────────────────────────────────────
// CÁLCULO DE HORAS EXTRAS EN TIEMPO REAL (para el cronómetro)
// ──────────────────────────────────────────────────────────────

/**
 * Calcula las horas extras acumuladas hasta "ahora" dado un inicio de turno.
 * Se usa en el cronómetro del frontend (también en el endpoint GET /activo).
 * @param {Date|string} inicioTurno
 * @param {number} jornadaNormalMin
 */
export function calcularExtrasAhora(inicioTurno, jornadaNormalMin = JORNADA_DEFAULT_MIN) {
  const inicio = new Date(inicioTurno);
  const ahora  = new Date();
  const tiempoActualMin = Math.round((ahora - inicio) / 60000);
  const minutosExtras   = Math.max(0, tiempoActualMin - jornadaNormalMin);
  return {
    tiempoActualMin,
    minutosExtras,
    horasExtras: Math.round((minutosExtras / 60) * 100) / 100,
    enExtras:    minutosExtras > 0,
    alertaLimite: minutosExtras > 120,
  };
}
