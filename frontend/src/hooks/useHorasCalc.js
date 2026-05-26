/**
 * useHorasCalc.js
 * Motor de cálculo de horas laborales CARGAR S.A.S.
 *
 * Horario base:
 *   Lun–Vie : 07:00 – 17:00  (ordinaria diurna)
 *   Sábado  : 07:00 – 12:00  (ordinaria diurna)
 *   Dom/Fest: NO se trabajan — mínimo 5 horas con recargo 125%
 *
 * Recargos (%):
 *   Ordinaria diurna              100
 *   Extra diurna                  125
 *
 * Todo trabajo fuera del horario ordinario (después de 5pm / antes de 7am)
 * se cobra con recargo del 125% sobre el valor del servicio por hora.
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
 * Devuelve el tipo de día: 'DOM_FESTIVO' | 'SAB' | 'LUN_VIE'
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
  return 'LUN_VIE'; // Lunes a Viernes
}

// ─────────────────────────────────────────────────────────────────
// 2. Conversión de hora "HH:MM" → minutos desde medianoche
// ─────────────────────────────────────────────────────────────────
function hhmm(str) {
  if (!str) return null;
  const [hh, mm] = String(str).split(':').map(Number);
  return hh * 60 + (mm || 0);
}

// Fin de jornada ordinaria por tipo de día (minutos desde medianoche)
const FIN_ORDINARIA = {
  LUN_VIE:     17 * 60,        // 17:00 = 1020
  SAB:         12 * 60,        // 12:00 = 720
  DOM_FESTIVO: null,           // No se trabaja normalmente
};

const INICIO_ORDINARIA = 7 * 60; // 07:00 = 420

// Mínimo de minutos para domingos/festivos (5 horas)
const MIN_DOM_FESTIVO = 5 * 60; // 300 minutos

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
    min_extra_diurna: 0,
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

  if (tipoDia === 'DOM_FESTIVO') {
    // Domingos y festivos: todas las horas con recargo 125%, mínimo 5 horas
    const minutosEfectivos = Math.max(totalMin, MIN_DOM_FESTIVO);
    resultado.min_extra_diurna = minutosEfectivos;
    return resultado;
  }

  // Días laborales (LUN_VIE, SAB)
  const finOrd = FIN_ORDINARIA[tipoDia];

  for (let t = inicio; t < fin; t++) {
    const m = t % 1440; // posición en el día (0-1439)

    // ORDINARIA DIURNA: 07:00 a finOrd
    const esOrdinaria = m >= INICIO_ORDINARIA && m < finOrd;

    if (esOrdinaria) {
      resultado.min_ord_diurna++;
    } else {
      // Extra diurna: todo lo que esté fuera del horario ordinario (recargo 125%)
      resultado.min_extra_diurna++;
    }
  }

  return resultado;
}

// ─────────────────────────────────────────────────────────────────
// 4. Liquidación monetaria
// ─────────────────────────────────────────────────────────────────
export const RECARGOS = {
  min_ord_diurna:         { label: 'Ordinaria Diurna',                pct: 100 },
  min_extra_diurna:       { label: 'Extra Diurna',                    pct: 125 },
};

/**
 * Convierte minutos + valor servicio por hora → valores monetarios.
 * @param {object} minutos           - resultado de calcularMinutosPorTipo()
 * @param {number} valorServicioHora - valor del servicio por hora en COP
 * @returns {object} liquidacion con valor_hora_base y val_* por tipo + total_liquidado
 */
export function calcularLiquidacion(minutos, valorServicioHora) {
  const valorHoraBase = valorServicioHora || 0;
  const liq = { valor_hora_base: valorHoraBase };
  let total = 0;

  for (const [key, { pct }] of Object.entries(RECARGOS)) {
    const min = minutos[key] || 0;
    const horas = min / 60;
    const valorConRecargo = valorHoraBase * (pct / 100);
    const subtotal = horas * valorConRecargo;
    liq[key.replace('min_', 'val_')] = subtotal;
    // La ordinaria diurna NO se suma al total de extras
    if (key !== 'min_ord_diurna') {
      total += subtotal;
    }
  }

  liq.total_liquidado = total;
  return liq;
}

/**
 * Hook completo: dado fecha+entrada+salida+valorServicioHora devuelve minutos y liquidación.
 */
export function useHorasCalc({ fecha, horaEntrada, horaSalida, valorServicioHora }) {
  const tipoDia = getTipoDia(fecha);
  const festivo = isFestivoColombia(fecha);
  const minutos = calcularMinutosPorTipo(fecha, horaEntrada, horaSalida);
  const liquidacion = calcularLiquidacion(minutos, valorServicioHora || 0);

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
