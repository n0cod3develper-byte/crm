/**
 * useHorasCalc.js
 * Utility calculations for Colombian labor law hours (CST) and CARGAR S.A.S. specific rules.
 */

export const RECARGOS = {
  min_ord_diurna: { label: 'Ordinaria Diurna', pct: 100 },
  min_ord_nocturna: { label: 'Ordinaria Nocturna', pct: 135 },
  min_extra_diurna: { label: 'Extra Diurna', pct: 125 },
  min_extra_nocturna: { label: 'Extra Nocturna', pct: 175 },
  min_dom_diurna: { label: 'Dominical Diurna', pct: 180 },
  min_dom_nocturna: { label: 'Dominical Nocturna', pct: 215 },
  min_extra_dom_diurna: { label: 'Extra Dom. Diurna', pct: 205 },
  min_extra_dom_nocturna: { label: 'Extra Dom. Nocturna', pct: 255 },
};

const FESTIVOS = [
  // 2025
  '2025-01-01', '2025-01-06', '2025-03-24', '2025-04-17', '2025-04-18', '2025-05-01',
  '2025-06-02', '2025-06-23', '2025-06-30', '2025-07-20', '2025-08-07', '2025-08-18',
  '2025-10-13', '2025-11-03', '2025-11-17', '2025-12-08', '2025-12-25',
  // 2026
  '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01',
  '2026-05-18', '2026-06-08', '2026-06-15', '2026-07-06', '2026-07-20', '2026-08-07',
  '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-16', '2026-12-08', '2026-12-25'
];

export function isFestivoColombia(fechaStr) {
  if (!fechaStr) return false;
  const key = fechaStr.split('T')[0];
  return FESTIVOS.includes(key);
}

export function getTipoDia(fechaStr) {
  if (!fechaStr) return null;
  const [y, m, d] = fechaStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayOfWeek = date.getDay(); // 0: Sunday, 1-6: Mon-Sat
  if (dayOfWeek === 0 || isFestivoColombia(fechaStr)) {
    return 'DOM_FESTIVO';
  }
  if (dayOfWeek >= 1 && dayOfWeek <= 4) {
    return 'LUN_JUE';
  }
  if (dayOfWeek === 5) {
    return 'VIE';
  }
  if (dayOfWeek === 6) {
    return 'SAB';
  }
  return null;
}

export function calcularMinutosPorTipo(fecha, horaEntrada, horaSalida) {
  const minutos = {
    min_ord_diurna: 0,
    min_ord_nocturna: 0,
    min_extra_diurna: 0,
    min_extra_nocturna: 0,
    min_dom_diurna: 0,
    min_dom_nocturna: 0,
    min_extra_dom_diurna: 0,
    min_extra_dom_nocturna: 0,
  };

  if (!fecha || !horaEntrada || !horaSalida) return minutos;

  const [y, m, d] = fecha.split('-').map(Number);
  const tStart = new Date(y, m - 1, d, ...horaEntrada.split(':').map(Number));
  let tEnd = new Date(y, m - 1, d, ...horaSalida.split(':').map(Number));
  if (tEnd < tStart) {
    tEnd.setDate(tEnd.getDate() + 1);
  }

  let cumulativeMin = 0;
  let current = new Date(tStart);

  while (current < tEnd) {
    const curY = current.getFullYear();
    const curM = current.getMonth() + 1;
    const curD = current.getDate();
    const curFechaStr = `${curY}-${String(curM).padStart(2, '0')}-${String(curD).padStart(2, '0')}`;

    const esFestivo = isFestivoColombia(curFechaStr);
    const dayOfWeek = current.getDay();
    const esDomFest = (dayOfWeek === 0 || esFestivo);

    const hour = current.getHours();
    const min = current.getMinutes();
    const timeVal = hour * 60 + min;

    // Franja diurna: 06:00 - 18:59 (360 a 1139 minutos)
    const esDiurna = (timeVal >= 360 && timeVal < 1140);

    if (esDomFest) {
      if (cumulativeMin < 440) {
        if (esDiurna) {
          minutos.min_dom_diurna++;
        } else {
          minutos.min_dom_nocturna++;
        }
      } else {
        if (esDiurna) {
          minutos.min_extra_dom_diurna++;
        } else {
          minutos.min_extra_dom_nocturna++;
        }
      }
    } else {
      if (esDiurna) {
        let esOrdDiurna = false;
        if (dayOfWeek >= 1 && dayOfWeek <= 4) {
          if (timeVal >= 420 && timeVal < 1020) esOrdDiurna = true;
        } else if (dayOfWeek === 5) {
          if (timeVal >= 420 && timeVal < 930) esOrdDiurna = true;
        } else if (dayOfWeek === 6) {
          if (timeVal >= 420 && timeVal < 680) esOrdDiurna = true;
        }

        if (esOrdDiurna) {
          minutos.min_ord_diurna++;
        } else {
          minutos.min_extra_diurna++;
        }
      } else {
        if (cumulativeMin < 440) {
          minutos.min_ord_nocturna++;
        } else {
          minutos.min_extra_nocturna++;
        }
      }
    }

    cumulativeMin++;
    current.setMinutes(current.getMinutes() + 1);
  }

  return minutos;
}

export function calcularLiquidacion(minutos, salario) {
  const valor_hora_base = salario / 220;
  const res = {
    valor_hora_base,
    val_ord_diurna: 0,
    val_ord_nocturna: 0,
    val_extra_diurna: 0,
    val_extra_nocturna: 0,
    val_dom_diurna: 0,
    val_dom_nocturna: 0,
    val_extra_dom_diurna: 0,
    val_extra_dom_nocturna: 0,
    total_liquidado: 0,
  };

  let total = 0;
  for (const [key, minutes] of Object.entries(minutos)) {
    if (key === 'min_ord_diurna') continue;
    const recargo = RECARGOS[key];
    if (!recargo) continue;

    const horas = minutes / 60;
    const valorHoraFranja = valor_hora_base * (recargo.pct / 100);
    const subtotal = Math.round(horas * valorHoraFranja * 100) / 100;

    const valKey = key.replace('min_', 'val_');
    res[valKey] = subtotal;
    total += subtotal;
  }

  res.total_liquidado = Math.round(total * 100) / 100;
  return res;
}
