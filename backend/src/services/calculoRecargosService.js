/**
 * calculoRecargosService.js
 * Algoritmo de cálculo de recargos según el CST colombiano.
 * Clasifica cada bloque del turno en las 7 categorías de recargo.
 */

const HORA_DIURNO_INICIO = 6;
const HORA_DIURNO_FIN    = 21;
const JORNADA_DEFAULT_MIN = 440; // 7h 20min

// ─── Determinar el recargo aplicable ─────────────────────────
function determinarRecargo(esDomFestivo, esDiurno, esExtra) {
  if (esDomFestivo) {
    if (esExtra) {
      return esDiurno
        ? { codigo: 'DOM_FEST_EXTRA_DIURNA',  porcentaje: 100, total: 200 }
        : { codigo: 'DOM_FEST_EXTRA_NOCTURNA', porcentaje: 150, total: 250 };
    }
    return { codigo: 'DOM_FEST_ORDINARIA', porcentaje: 75, total: 175 };
  }
  if (esExtra) {
    return esDiurno
      ? { codigo: 'EXTRA_DIURNA',   porcentaje: 25, total: 125 }
      : { codigo: 'EXTRA_NOCTURNA', porcentaje: 75, total: 175 };
  }
  return esDiurno
    ? { codigo: 'ORD_DIURNA',   porcentaje: 0,  total: 100 }
    : { codigo: 'ORD_NOCTURNA', porcentaje: 35, total: 135 };
}

// ─── Dividir en bloques por horario diurno/nocturno ──────────
function dividirEnBloques(inicio, fin) {
  const bloques = [];
  let cursor = new Date(inicio);

  while (cursor < fin) {
    const hora = cursor.getHours();
    let finBloque;

    if (hora < HORA_DIURNO_INICIO) {
      finBloque = new Date(cursor);
      finBloque.setHours(HORA_DIURNO_INICIO, 0, 0, 0);
    } else if (hora < HORA_DIURNO_FIN) {
      finBloque = new Date(cursor);
      finBloque.setHours(HORA_DIURNO_FIN, 0, 0, 0);
    } else {
      finBloque = new Date(cursor);
      finBloque.setDate(finBloque.getDate() + 1);
      finBloque.setHours(0, 0, 0, 0);
    }

    if (finBloque > fin) finBloque = fin;
    if (finBloque > cursor) {
      bloques.push({ inicio: new Date(cursor), fin: finBloque });
    }
    cursor = finBloque;
  }

  return bloques;
}

/**
 * Calcula el desglose completo de recargos para un turno.
 *
 * @param {Date|string} inicioTurno
 * @param {Date|string} finTurno
 * @param {number} jornadaNormalMin - Minutos de jornada normal (440)
 * @param {boolean} esDomFestivo - Si el día es domingo o festivo
 * @returns {Object} desglose completo con minutos por categoría
 */
export function calcularRecargos(
  inicioTurno,
  finTurno,
  jornadaNormalMin = JORNADA_DEFAULT_MIN,
  esDomFestivo = false
) {
  const inicio = new Date(inicioTurno);
  const fin = new Date(finTurno);

  const resultado = {
    min_ord_diurnos:      0,
    min_ord_nocturnos:    0,
    min_extra_diurnos:    0,
    min_extra_nocturnos:  0,
    min_dom_fest_ord:     0,
    min_dom_fest_extra_d: 0,
    min_dom_fest_extra_n: 0,
    total_minutos:        0,
    minutos_extras:       0,
    // Desglose por categoría
    desglose: {},
    // Bloques para auditoría
    bloques: [],
  };

  const totalMin = Math.max(0, Math.round((fin - inicio) / 60000));
  resultado.total_minutos = totalMin;
  resultado.minutos_extras = Math.max(0, totalMin - jornadaNormalMin);

  // Dividir en bloques por horario
  const bloques = dividirEnBloques(inicio, fin);
  let minutosAcumulados = 0;

  for (const bloque of bloques) {
    const minBloque = Math.max(0, Math.round((bloque.fin - bloque.inicio) / 60000));
    if (minBloque === 0) continue;

    const hora = bloque.inicio.getHours();
    const esDiurno = hora >= HORA_DIURNO_INICIO && hora < HORA_DIURNO_FIN;

    // Separar ordinario vs extra dentro del bloque
    const minutosOrd = Math.max(0, Math.min(minBloque, jornadaNormalMin - minutosAcumulados));
    const minutosExtra = minBloque - minutosOrd;

    if (minutosOrd > 0) {
      const recargo = determinarRecargo(esDomFestivo, esDiurno, false);
      const key = recargo.codigo;
      const mapKey = mapearCampo(key);
      if (mapKey) resultado[mapKey] += minutosOrd;
      if (!resultado.desglose[key]) resultado.desglose[key] = 0;
      resultado.desglose[key] += minutosOrd;
      resultado.bloques.push({
        inicio: bloque.inicio.toISOString(),
        fin: finDelBloque(bloque.inicio, minutosOrd).toISOString(),
        minutos: minutosOrd,
        recargo_codigo: key,
        porcentaje_recargo: recargo.porcentaje,
        total_pct: recargo.total,
        es_extra: false,
        es_dominical_festivo: esDomFestivo,
      });
    }

    if (minutosExtra > 0) {
      const recargo = determinarRecargo(esDomFestivo, esDiurno, true);
      const key = recargo.codigo;
      const mapKey = mapearCampo(key);
      if (mapKey) resultado[mapKey] += minutosExtra;
      if (!resultado.desglose[key]) resultado.desglose[key] = 0;
      resultado.desglose[key] += minutosExtra;

      const inicioExtra = new Date(bloque.inicio.getTime() + minutosOrd * 60000);
      resultado.bloques.push({
        inicio: inicioExtra.toISOString(),
        fin: finDelBloque(inicioExtra, minutosExtra).toISOString(),
        minutos: minutosExtra,
        recargo_codigo: key,
        porcentaje_recargo: recargo.porcentaje,
        total_pct: recargo.total,
        es_extra: true,
        es_dominical_festivo: esDomFestivo,
      });
    }

    minutosAcumulados += minBloque;
  }

  return resultado;
}

function finDelBloque(inicio, minutos) {
  return new Date(inicio.getTime() + minutos * 60000);
}

function mapearCampo(codigo) {
  const mapa = {
    'ORD_DIURNA':            'min_ord_diurnos',
    'ORD_NOCTURNA':          'min_ord_nocturnos',
    'EXTRA_DIURNA':          'min_extra_diurnos',
    'EXTRA_NOCTURNA':        'min_extra_nocturnos',
    'DOM_FEST_ORDINARIA':    'min_dom_fest_ord',
    'DOM_FEST_EXTRA_DIURNA':  'min_dom_fest_extra_d',
    'DOM_FEST_EXTRA_NOCTURNA':'min_dom_fest_extra_n',
  };
  return mapa[codigo] || null;
}

export { dividirEnBloques, determinarRecargo };
