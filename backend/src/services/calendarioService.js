/**
 * calendarioService.js
 * Gestión de festivos colombianos: algoritmo de Pascua,
 * generación de calendario, traslado Ley Emiliani.
 */
import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

// ─── Fecha helper ────────────────────────────────────────────
const toDateStr = (d) => d.toISOString().split('T')[0];

// ─── Algoritmo de Pascua (Meeus/Jones/Butcher) ──────────────
function calcularPascua(anio) {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia);
}

// ─── Trasladar al lunes siguiente (Ley Emiliani) ────────────
function trasladarLunes(fecha) {
  const diaSemana = fecha.getDay();
  if (diaSemana === 1) return new Date(fecha);
  const diasHasta = diaSemana === 0 ? 1 : (8 - diaSemana);
  const lunes = new Date(fecha);
  lunes.setDate(fecha.getDate() + diasHasta);
  return lunes;
}

function sumarDias(fecha, dias) {
  const nueva = new Date(fecha);
  nueva.setDate(fecha.getDate() + dias);
  return nueva;
}

/**
 * Genera todos los festivos colombianos para un año.
 * Fuente: Ley 51 de 1983 (Ley Emiliani) + calendario litúrgico.
 */
export function generarFestivosAnio(anio) {
  const festivos = [];
  const pascua = calcularPascua(anio);

  // Fijos
  const fijos = [
    [1, 1, 'Año Nuevo'],
    [5, 1, 'Día del Trabajo'],
    [7, 20, 'Grito de Independencia'],
    [8, 7, 'Batalla de Boyacá'],
    [12, 8, 'Inmaculada Concepción'],
    [12, 25, 'Navidad'],
  ];
  for (const [m, d, n] of fijos) {
    festivos.push({ fecha: toDateStr(new Date(anio, m - 1, d)), nombre: n, tipo: 'FECHA_FIJA' });
  }

  // Ley Emiliani (se trasladan al lunes)
  const emiliani = [
    [1, 6, 'Reyes Magos'],
    [3, 19, 'San José'],
    [6, 29, 'San Pedro y San Pablo'],
    [8, 15, 'Asunción de la Virgen'],
    [10, 12, 'Día de la Raza'],
    [11, 1, 'Todos los Santos'],
    [11, 11, 'Independencia de Cartagena'],
  ];
  for (const [m, d, n] of emiliani) {
    const fechaFinal = trasladarLunes(new Date(anio, m - 1, d));
    festivos.push({ fecha: toDateStr(fechaFinal), nombre: n, tipo: 'LEY_EMILIANI' });
  }

  // Móviles religiosos (basados en Pascua)
  const moviles = [
    [-3, 'Jueves Santo', false],
    [-2, 'Viernes Santo', false],
    [39, 'Ascensión del Señor', true],
    [60, 'Corpus Christi', true],
    [68, 'Sagrado Corazón', true],
  ];
  for (const [offset, nombre, esEmiliani] of moviles) {
    const fechaBase = sumarDias(pascua, offset);
    const fechaFinal = esEmiliani ? trasladarLunes(fechaBase) : fechaBase;
    festivos.push({ fecha: toDateStr(fechaFinal), nombre, tipo: 'MOVIL_RELIGIOSO' });
  }

  return festivos;
}

/**
 * Genera e inserta los festivos de un año en la BD.
 * Upsert: si ya existe la fecha, actualiza nombre/tipo.
 */
export async function generarYGuardarFestivos(anio) {
  const festivos = generarFestivosAnio(anio);
  for (const f of festivos) {
    await query(
      `INSERT INTO festivos_colombia (fecha, nombre, tipo, anio)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (fecha) DO UPDATE SET nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo`,
      [f.fecha, f.nombre, f.tipo, anio]
    );
  }
  logger.info(`Calendario: ${festivos.length} festivos generados para ${anio}`);
  return festivos;
}

/**
 * Verifica si una fecha es festivo o domingo.
 * Acepta string ISO (YYYY-MM-DD) o Date.
 */
export async function esDiaEspecial(fecha) {
  const fechaStr = fecha instanceof Date ? toDateStr(fecha) : fecha;
  const fechaObj = new Date(fechaStr + 'T12:00:00');
  const esDomingo = fechaObj.getDay() === 0;

  const res = await query(
    'SELECT nombre FROM festivos_colombia WHERE fecha = $1 AND activo = TRUE',
    [fechaStr]
  );

  return {
    esDomingo,
    esFestivo: res.rows.length > 0,
    nombreFestivo: res.rows[0]?.nombre || null,
    esDiaEspecial: esDomingo || res.rows.length > 0,
  };
}

/**
 * Inicializa festivos para el año actual y el siguiente
 * si no existen en la BD.
 */
export async function inicializarFestivos() {
  const anio = new Date().getFullYear();
  for (const a of [anio, anio + 1]) {
    const count = await query(
      'SELECT COUNT(*) AS cnt FROM festivos_colombia WHERE anio = $1',
      [a]
    );
    if (parseInt(count.rows[0].cnt, 10) === 0) {
      await generarYGuardarFestivos(a);
    }
  }
}
