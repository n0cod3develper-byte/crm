/**
 * horasExtras.motor.js
 * Motor de cálculo PURO de horas extras — SIN dependencias de BD.
 * Recibe configuración y festivos como parámetros.
 * Puede importarse en tests sin mocks adicionales.
 */

// ─── Helpers ──────────────────────────────────────────────────

/** Convierte TIME string "HH:MM:SS" o "HH:MM" a minutos desde medianoche */
export function timeToMin(timeStr) {
  if (!timeStr) return null;
  const parts = String(timeStr).split(':').map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}

/** Formatea fecha Date → "YYYY-MM-DD" */
export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Determina el tipo de día: 'DOM_FESTIVO' | 'SAB' | 'VIE' | 'LUN_JUE'
 */
export function getTipoDia(fechaStr, festivos) {
  const [y, m, d] = fechaStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay(); // 0=Dom, 6=Sab

  if (dow === 0 || festivos.has(fechaStr)) return 'DOM_FESTIVO';
  if (dow === 6) return 'SAB';
  if (dow === 5) return 'VIE';
  return 'LUN_JUE';
}

// ─── Clasificación de minutos ─────────────────────────────────

function clasificarMinuto(minDelDia, tipoDia, yaCompletoJornada, franjas) {
  // Horario nocturno: 19:00 a 05:59 (>= 1140 o < 360)
  const esNocturno = minDelDia >= 1140 || minDelDia < 360;

  let tipoRequerido = '';

  if (tipoDia === 'DOM_FESTIVO') {
    if (yaCompletoJornada) {
      tipoRequerido = esNocturno ? 'EXTRA_DOMINICAL_FESTIVA_NOCTURNA' : 'EXTRA_DOMINICAL_FESTIVA_DIURNA';
    } else {
      tipoRequerido = esNocturno ? 'DOMINICAL_FESTIVA_NOCTURNA' : 'DOMINICAL_FESTIVA_DIURNA';
    }
  } else {
    // LUN_JUE, VIE, SAB
    if (yaCompletoJornada) {
      tipoRequerido = esNocturno ? 'EXTRA_NOCTURNA' : 'EXTRA_DIURNA';
    } else {
      tipoRequerido = esNocturno ? 'ORDINARIA_NOCTURNA' : 'ORDINARIA_DIURNA';
    }
  }

  // Buscar el porcentaje en la configuración de franjas
  const franja = franjas.find(f => f.tipo_hora === tipoRequerido);
  
  // Porcentajes por defecto de la regla de negocio por si falta configuración en BD
  const defaults = {
    'ORDINARIA_DIURNA': 100,
    'ORDINARIA_NOCTURNA': 135,
    'EXTRA_DIURNA': 125,
    'EXTRA_NOCTURNA': 175,
    'DOMINICAL_FESTIVA_DIURNA': 190,
    'DOMINICAL_FESTIVA_NOCTURNA': 225,
    'EXTRA_DOMINICAL_FESTIVA_DIURNA': 215,
    'EXTRA_DOMINICAL_FESTIVA_NOCTURNA': 265
  };

  const porcentaje = franja ? parseFloat(franja.porcentaje) : defaults[tipoRequerido];
  
  // ORDINARIA_DIURNA no se liquida monetariamente adicional al salario mensual (es_liquidable = false)
  const esLiquidable = tipoRequerido === 'ORDINARIA_DIURNA' ? false : true;

  let porcentajeLiquidar = porcentaje;
  if (!tipoRequerido.startsWith('EXTRA_') && tipoRequerido !== 'ORDINARIA_DIURNA') {
    // Si es hora ordinaria con recargo, el salario básico ya cubre el 100%.
    // Solo liquidamos el excedente (el recargo). Ej: 135% -> 35%
    if (porcentajeLiquidar >= 100) {
      porcentajeLiquidar -= 100;
    }
  }

  return {
    tipo_hora: tipoRequerido,
    porcentaje: porcentaje, // Guardamos el original para mostrarlo si es necesario
    porcentaje_liquidar: porcentajeLiquidar,
    es_liquidable: esLiquidable
  };
}

// ─── Motor principal ──────────────────────────────────────────

/**
 * Función PURA. Sin acceso a BD.
 * @param {string} fechaStr "YYYY-MM-DD"
 * @param {string|null} horaInicio "HH:MM"
 * @param {string|null} horaFin    "HH:MM"
 * @param {number} salarioMensual
 * @param {Array} configuracion   filas de horas_extras_configuracion
 * @param {Set} festivos          Set de strings "YYYY-MM-DD"
 * @returns {Object}
 */
export function calcularHorasExtrasMotor(
  fechaStr, horaInicio, horaFin, salarioMensual, configuracion, festivos, minutosDescuento = 50
) {
  const resultado = {
    fecha: fechaStr,
    tipoDia: null,
    horasTrabajadas: 0,
    totalHorasOrdinarias: 0,
    totalHorasExtras: 0,
    totalRno: 0, // Recargo Nocturno Ordinario
    totalLiquidado: 0,
    valorHoraBase: 0,
    segmentos: [],
    minutosPorTipo: {},
    alerta: null,
    alertaTipo: null,
  };

  if (!horaInicio || !horaFin) {
    resultado.alerta = 'Sin hora de salida o llegada registrada';
    resultado.alertaTipo = 'SIN_TIEMPOS';
    return resultado;
  }

  const tipoDia = getTipoDia(fechaStr, festivos);
  resultado.tipoDia = tipoDia;

  const configDia = configuracion.filter(c => c.dia_aplicacion === tipoDia);
  
  // Obtener jornada ordinaria decimal (Ej. 8.42 para LUN_JUE, 8.33 para VIE, 7 para SAB y DOM_FESTIVO)
  let jornadaDecimalConfig = null;
  if (configDia.length > 0 && configDia[0].jornada_ordinaria_decimal != null) {
    jornadaDecimalConfig = parseFloat(configDia[0].jornada_ordinaria_decimal);
  }
  // Si no hay config o la BD dice 0, usar fallbacks
  if (jornadaDecimalConfig === null || jornadaDecimalConfig === 0) {
    if (tipoDia === 'LUN_JUE') jornadaDecimalConfig = 8.42;
    else if (tipoDia === 'VIE') jornadaDecimalConfig = 8.33;
    else jornadaDecimalConfig = 7; // SAB o DOM_FESTIVO: primeras 7h son ordinarias
  }

  // REGLA CRITICA: 8.42 no es 8h42m. Es un decimal directo.
  // Lo convertimos a minutos exactos matemáticamente:
  const maxMinutosOrdinarios = Math.round(jornadaDecimalConfig * 60);

  let inicioMin = timeToMin(horaInicio);
  let finMin = timeToMin(horaFin);

  if (inicioMin === finMin) {
    resultado.alerta = 'Hora de llegada igual a hora de salida';
    resultado.alertaTipo = 'TIEMPOS_INVALIDOS';
    return resultado;
  }

  if (finMin < inicioMin) finMin += 1440; // Soporte cruce de medianoche

  const totalMinTrabajadosBruto = finMin - inicioMin;
  
  // Limitar descuento a las horas trabajadas si es menor
  const descuentoAplicable = Math.min(minutosDescuento, totalMinTrabajadosBruto);
  const minutoInicioDescanso = inicioMin + Math.floor(totalMinTrabajadosBruto / 2) - Math.floor(descuentoAplicable / 2);
  const minutoFinDescanso = minutoInicioDescanso + descuentoAplicable;

  const totalMinTrabajados = totalMinTrabajadosBruto - descuentoAplicable;
  resultado.horasTrabajadas = Math.round((totalMinTrabajados / 60) * 100) / 100;

  const valorHoraBase = salarioMensual > 0 ? Math.round((salarioMensual / 210) * 10000) / 10000 : 0;
  resultado.valorHoraBase = valorHoraBase;

  const acumulado = {};
  let minutosOrdinariosAcumulados = 0;

  // Iterar minuto a minuto
  for (let m = inicioMin; m < finMin; m++) {
    // Si estamos en la franja del descanso, ignorar
    if (m >= minutoInicioDescanso && m < minutoFinDescanso) {
      continue;
    }

    const minDelDia = ((m % 1440) + 1440) % 1440;
    
    // REGLA FUNDAMENTAL: ¿Ya se cumplió la jornada ordinaria?
    const yaCompletoJornada = minutosOrdinariosAcumulados >= maxMinutosOrdinarios;

    const tipo = clasificarMinuto(minDelDia, tipoDia, yaCompletoJornada, configDia);

    if (!acumulado[tipo.tipo_hora]) {
      acumulado[tipo.tipo_hora] = { 
        minutos: 0, 
        es_liquidable: tipo.es_liquidable, 
        porcentaje: tipo.porcentaje,
        porcentaje_liquidar: tipo.porcentaje_liquidar
      };
    }
    
    acumulado[tipo.tipo_hora].minutos++;

    // Solo acumula minutos ordinarios si el tipo NO es EXTRA y el día no es Domingo/Festivo
    // (Para Domingo/Festivo, las primeras X horas se consideran DOMINICAL_FESTIVA, y deben contar para el límite de 7h/420m si existiera, pero generalmente maxMinutosOrdinarios = 0)
    // Wait: si DOM_FESTIVO tiene jornada_ordinaria_decimal = 7, entonces debemos contar.
    if (!tipo.tipo_hora.startsWith('EXTRA')) {
      minutosOrdinariosAcumulados++;
    }
  }

  let totalLiquidado = 0;
  let totalMinExtrasReales = 0;
  let totalMinOrdinariosReales = 0;
  let totalMinRno = 0;

  for (const [tipoHora, data] of Object.entries(acumulado)) {
    const horasDecimal = Math.round((data.minutos / 60) * 10000) / 10000;
    // Cálculo: (Valor Hora Base) * (Porcentaje a Liquidar / 100) * (Horas Decimales)
    // Se usa porcentaje_liquidar para no pagar doble la hora base si ya está en el salario.
    const valorHoraClasificada = Math.round(valorHoraBase * (data.porcentaje_liquidar / 100) * 10000) / 10000;
    const subtotal = Math.round(horasDecimal * valorHoraClasificada * 100) / 100;

    resultado.segmentos.push({
      tipo_hora: tipoHora,
      porcentaje: data.porcentaje,
      hora_inicio: horaInicio, // En una versión avanzada aquí se calcularía el corte exacto de hora_inicio y hora_fin del segmento
      hora_fin: horaFin,
      minutos: data.minutos,
      horas_decimal: horasDecimal,
      valor_hora: valorHoraClasificada,
      subtotal: data.es_liquidable ? subtotal : 0,
      es_liquidable: data.es_liquidable,
    });

    resultado.minutosPorTipo[tipoHora] = data.minutos;

    if (data.es_liquidable) {
      totalLiquidado += subtotal;
    }

    if (tipoHora.startsWith('EXTRA_') && !tipoHora.includes('DOMINICAL')) {
      totalMinExtrasReales += data.minutos;
    } else if (tipoHora.includes('DOMINICAL_FESTIVA') && tipoHora.startsWith('EXTRA_')) {
      totalMinExtrasReales += data.minutos;
    }
    
    if (tipoHora === 'ORDINARIA_DIURNA' || tipoHora === 'ORDINARIA_NOCTURNA' || tipoHora === 'DOMINICAL_FESTIVA_DIURNA' || tipoHora === 'DOMINICAL_FESTIVA_NOCTURNA') {
      totalMinOrdinariosReales += data.minutos;
    }

    if (tipoHora === 'ORDINARIA_NOCTURNA') {
      totalMinRno += data.minutos;
    }
  }

  resultado.totalHorasExtras = Math.round((totalMinExtrasReales / 60) * 100) / 100;
  resultado.totalHorasOrdinarias = Math.round((totalMinOrdinariosReales / 60) * 100) / 100;
  resultado.totalRno = Math.round((totalMinRno / 60) * 100) / 100;
  resultado.totalLiquidado = totalLiquidado;

  return resultado;
}
