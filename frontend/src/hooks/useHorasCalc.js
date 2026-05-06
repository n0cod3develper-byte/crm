/**
 * useHorasCalc.js
 * Motor de cálculo de horas laborales CARGAR S.A.S.
 *
 * Horario base:
 *   Lun–Jue : 07:00 – 17:00  (ordinaria diurna)
 *   Viernes : 07:00 – 15:30
 *   Sábado  : 07:00 – 11:20
 *   Dom/Fest: primeros 440 min trabajados = dominical; resto = extra dominical
 *
 * Franjas:
 *   Diurna   : 06:00 – 18:59
 *   Nocturna : 19:00 – 05:59
 *
 * Recargos (%):
 *   Ordinaria diurna              100
 *   Ordinaria nocturna            135
 *   Extra diurna                  125
 *   Extra nocturna                175
 *   Dominical/festiva diurna      180
 *   Dominical/festiva nocturna    215
 *   Extra dominical/festiva diurna   205
 *   Extra dominical/festiva nocturna 255
 */

// ─────────────────────────────────────────────────────────────────
// 1. Festivos Colombia 2026
// ─────────────────────────────────────────────────────────────────
const FESTIVOS_2026 = new Set([
  '2026-01-01', // Año Nuevo
  '2026-01-12', // Reyes Magos
  '2026-03-23', // Día de San José
  '2026-04-02', // Jueves Santo
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Día del Trabajo
  '2026-05-18', // Ascensión del Señor
  '2026-06-08', // Corpus Christi
  '2026-06-15', // Sagrado Corazón
  '2026-06-29', // San Pedro y San Pablo
  '2026-07-20', // Día de la Independencia
  '2026-08-07', // Batalla de Boyacá
  '2026-08-17', // Asunción de la Virgen
  '2026-10-12', // Día de la Raza
  '2026-11-02', // Todos los Santos
  '2026-11-16', // Independencia de Cartagena
  '2026-12-08', // Inmaculada Concepción
  '2026-12-25', // Navidad
]);

/**
 * Convierte una fecha (Date o string 'YYYY-MM-DD') a clave 'YYYY-MM-DD'.
 */
function toKey(fecha) {
  if (!fecha) return '';
  if (typeof fecha === 'string') {
    // Soporta 'YYYY-MM-DD' o 'DD/MM/YYYY'
    if (fecha.includes('/')) {
      const [d, m, y] = fecha.split('/');
      return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    return fecha.substring(0, 10);
  }
  const d = new Date(fecha);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Devuelve true si la fecha (YYYY-MM-DD o Date) es festivo en Colombia 2026. */
export function isFestivoColombia(fecha) {
  return FESTIVOS_2026.has(toKey(fecha));
}

/**
 * Devuelve el tipo de día: 'DOM_FESTIVO' | 'SAB' | 'VIE' | 'LUN_JUE'
 * Tiene en cuenta festivos primero.
 */
export function getTipoDia(fecha) {
  if (!fecha) return null;
  if (isFestivoColombia(fecha)) return 'DOM_FESTIVO';

  // getDay(): 0=Dom,1=Lun,...,6=Sáb
  const key = toKey(fecha);
  const [y, m, d] = key.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();

  if (dow === 0) return 'DOM_FESTIVO'; // Domingo
  if (dow === 6) return 'SAB';
  if (dow === 5) return 'VIE';
  return 'LUN_JUE'; // Lunes a Jueves
}

// ─────────────────────────────────────────────────────────────────
// 2. Conversión de hora "HH:MM" → minutos desde medianoche
// ─────────────────────────────────────────────────────────────────
function hhmm(str) {
  if (!str) return null;
  const [hh, mm] = String(str).split(':').map(Number);
  return hh * 60 + (mm || 0);
}

// Límites de franja (en minutos desde medianoche)
const DIURNA_INICIO  = 6 * 60;       // 06:00 = 360
const DIURNA_FIN     = 18 * 60 + 59; // 18:59 = 1139
// Nocturna = lo que no es diurna: 19:00–05:59

/** Retorna true si el minuto absoluto (puede ser > 1440 para días siguientes) es franja diurna */
function esDiurno(minAbs) {
  const m = minAbs % 1440; // normalizar a 0-1439
  return m >= DIURNA_INICIO && m <= DIURNA_FIN;
}

// Fin de jornada ordinaria por tipo de día (minutos desde medianoche)
const FIN_ORDINARIA = {
  LUN_JUE:     17 * 60,        // 17:00 = 1020
  VIE:         15 * 60 + 30,   // 15:30 = 930
  SAB:         11 * 60 + 20,   // 11:20 = 680
  DOM_FESTIVO: null,            // No tiene fin fijo; se controla por minutos acumulados (440)
};

const INICIO_ORDINARIA = 7 * 60; // 07:00 = 420

// ─────────────────────────────────────────────────────────────────
// 3. Motor principal: clasifica minuto a minuto
// ─────────────────────────────────────────────────────────────────
/**
 * Calcula el desglose de minutos por tipo de hora.
 *
 * @param {string} fecha       - 'YYYY-MM-DD'
 * @param {string} horaInicio  - 'HH:MM' - cuando el operario SALE de CARGAR (inicio del trabajo)
 * @param {string} horaFin     - 'HH:MM' - cuando el operario LLEGA a CARGAR (fin del trabajo)
 * @returns {object} minutos por categoría
 */
export function calcularMinutosPorTipo(fecha, horaInicio, horaFin) {
  const resultado = {
    min_ord_diurna: 0,
    min_ord_nocturna: 0,
    min_extra_diurna: 0,
    min_extra_nocturna: 0,
    min_dom_diurna: 0,
    min_dom_nocturna: 0,
    min_extra_dom_diurna: 0,
    min_extra_dom_nocturna: 0,
  };

  if (!fecha || !horaInicio || !horaFin) return resultado;

  const tipoDia = getTipoDia(fecha);
  if (!tipoDia) return resultado;

  let inicio = hhmm(horaInicio);
  let fin    = hhmm(horaFin);
  if (inicio === null || fin === null) return resultado;
  if (fin <= inicio) fin += 1440; // cruza medianoche

  const totalMin = fin - inicio;
  if (totalMin <= 0) return resultado;

  const NOCHE_INICIO = 19 * 60; // 19:00 = 1140
  const NOCHE_FIN    = 6  * 60; // 06:00 = 360
  const NOCHE_CAP    = 440;     // 7h 20min

  // Para días regulares: horas antes de las 7am NO se cuentan.
  // Para DOM_FESTIVO: no hay horario fijo, se cuenta desde la hora real de inicio.
  const inicioEfectivo = (tipoDia !== 'DOM_FESTIVO' && inicio < INICIO_ORDINARIA)
    ? INICIO_ORDINARIA
    : inicio;

  let minNocturnos = 0;
  let minDomAcum   = 0;

  for (let t = inicioEfectivo; t < fin; t++) {
    const m = t % 1440; // posición en el día (0-1439)

    if (tipoDia === 'DOM_FESTIVO') {
      const diurno = m >= 360 && m <= 1139;
      if (minDomAcum < 440) {
        resultado[diurno ? 'min_dom_diurna' : 'min_dom_nocturna']++;
      } else {
        resultado[diurno ? 'min_extra_dom_diurna' : 'min_extra_dom_nocturna']++;
      }
      minDomAcum++;
      continue;
    }

    const finOrd = FIN_ORDINARIA[tipoDia];
    // NOCTURNA: 19:00-23:59 ó 00:00-05:59
    const esNocturna = m >= NOCHE_INICIO || m < NOCHE_FIN;
    // ORDINARIA DIURNA: 07:00 a finOrd
    const esOrdinaria = m >= INICIO_ORDINARIA && m < finOrd;

    if (esNocturna) {
      if (minNocturnos < NOCHE_CAP) {
        resultado['min_ord_nocturna']++;
      } else {
        resultado['min_extra_nocturna']++;
      }
      minNocturnos++;
    } else if (esOrdinaria) {
      resultado['min_ord_diurna']++;
    } else {
      // Extra diurna: finOrd-18:59 (y 06:00-06:59 si el turno nocturno cruza a la mañana)
      resultado['min_extra_diurna']++;
    }
  }

  return resultado;
}

// ─────────────────────────────────────────────────────────────────
// 4. Liquidación monetaria
// ─────────────────────────────────────────────────────────────────
export const RECARGOS = {
  min_ord_diurna:         { label: 'Ordinaria Diurna',                pct: 100 },
  min_ord_nocturna:       { label: 'Ordinaria Nocturna',              pct: 135 },
  min_extra_diurna:       { label: 'Extra Diurna',                    pct: 125 },
  min_extra_nocturna:     { label: 'Extra Nocturna',                  pct: 175 },
  min_dom_diurna:         { label: 'Ordinaria Dominical Diurna',      pct: 180 },
  min_dom_nocturna:       { label: 'Ordinaria Dominical Nocturna',    pct: 215 },
  min_extra_dom_diurna:   { label: 'Extra Dom. Diurna',               pct: 205 },
  min_extra_dom_nocturna: { label: 'Extra Dom. Nocturna',             pct: 255 },
};

/**
 * Convierte minutos + salario → valores monetarios.
 * @param {object} minutos    - resultado de calcularMinutosPorTipo()
 * @param {number} salario    - salario mensual en COP
 * @returns {object} liquidacion con valor_hora_base y val_* por tipo + total_liquidado
 */
export function calcularLiquidacion(minutos, salario) {
  const valorHoraBase = (salario || 0) / 220;
  const liq = { valor_hora_base: valorHoraBase };
  let total = 0;

  for (const [key, { pct }] of Object.entries(RECARGOS)) {
    const min = minutos[key] || 0;
    const horas = min / 60;
    const valorConRecargo = valorHoraBase * (pct / 100);
    const subtotal = horas * valorConRecargo;
    liq[key.replace('min_', 'val_')] = subtotal;
    // La ordinaria diurna NO se suma al total (ya está cubierta por el salario base)
    if (key !== 'min_ord_diurna') {
      total += subtotal;
    }
  }

  liq.total_liquidado = total;
  return liq;
}

/**
 * Hook completo: dado fecha+entrada+salida+salario devuelve minutos y liquidación.
 */
export function useHorasCalc({ fecha, horaEntrada, horaSalida, salarioMensual }) {
  const tipoDia = getTipoDia(fecha);
  const festivo = isFestivoColombia(fecha);
  const minutos = calcularMinutosPorTipo(fecha, horaEntrada, horaSalida);
  const liquidacion = calcularLiquidacion(minutos, salarioMensual || 0);

  // Total de minutos sin ordinaria diurna (para el resumen de pago)
  const minSinOrdDiurna = Object.entries(minutos)
    .filter(([k]) => k !== 'min_ord_diurna')
    .reduce((s, [, v]) => s + v, 0);

  return {
    tipoDia,
    festivo,
    minutos,
    liquidacion,
    minSinOrdDiurna,
    totalMinutos: Object.values(minutos).reduce((s, v) => s + v, 0),
  };
}
