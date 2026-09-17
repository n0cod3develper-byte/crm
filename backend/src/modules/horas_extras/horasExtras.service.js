/**
 * horasExtras.service.js
 * Capa de orquestación para el cálculo de Horas Extras.
 * Integra el motor puro (horasExtras.motor.js) con la base de datos (horasExtras.repository.js).
 */

import { logger } from '../../utils/logger.js';
import { calcularHorasExtrasMotor, toDateStr } from './horasExtras.motor.js';
import { HorasExtrasRepository } from './horasExtras.repository.js';
import { EmployeesRepository } from '../employees/employees.repository.js';

const repo = new HorasExtrasRepository();
const employeesRepo = new EmployeesRepository(); // Asumiendo que existe o se puede instanciar

// ─── Helpers ──────────────────────────────────────────────────

export async function getConfiguracion() {
  return await repo.getConfiguracion();
}

export async function getFestivosSet() {
  const festivosDb = await repo.getFestivos();
  const set = new Set();
  for (const row of festivosDb) {
    const f = row.fecha instanceof Date
      ? toDateStr(row.fecha)
      : String(row.fecha).split('T')[0];
    set.add(f);
  }
  return set;
}

// ─── Función Principal ────────────────────────────────────────

/**
 * Calcula y guarda una Jornada Laboral, de forma independiente a la remisión.
 * @param {Object} data 
 * @param {string} data.empleado_id
 * @param {string} data.fecha_trabajo "YYYY-MM-DD"
 * @param {string} data.hora_entrada "HH:MM"
 * @param {string} data.hora_salida "HH:MM"
 * @param {string} [data.remision_id] Opcional
 * @param {string} [data.observacion] Opcional
 * @param {number} [data.minutos_descuento] Opcional, por defecto 50
 */
export async function calcularYGuardarJornada(data) {
  // 1. Obtener salario del empleado
  // Idealmente se lee de employeesRepo, aquí hacemos la consulta directa si no está inyectado
  const { query } = await import('../../config/database.js');
  const empRes = await query(`SELECT monthly_salary, full_name FROM employees WHERE id = $1`, [data.empleado_id]);
  if (!empRes.rows[0]) throw new Error(`Empleado ${data.empleado_id} no encontrado`);
  
  const salarioMensual = parseFloat(empRes.rows[0].monthly_salary) || 0;

  // 2. Obtener config y festivos
  const configuracion = await getConfiguracion();
  const festivos = await getFestivosSet();

  // 3. Ejecutar Motor
  const minutosDescuento = data.minutos_descuento !== undefined ? Number(data.minutos_descuento) : 50;
  
  const resultado = calcularHorasExtrasMotor(
    data.fecha_trabajo,
    data.hora_entrada,
    data.hora_salida,
    salarioMensual,
    configuracion,
    festivos,
    minutosDescuento
  );

  // 4. Preparar payload para la BD
  const jornadaPayload = {
    empleado_id: data.empleado_id,
    remision_id: data.remision_id || null,
    fecha_trabajo: data.fecha_trabajo,
    hora_entrada: data.hora_entrada,
    hora_salida: data.hora_salida,
    observacion: data.observacion || null,
    salario_mensual: salarioMensual,
    valor_hora_base: resultado.valorHoraBase,
    horas_trabajadas: resultado.horasTrabajadas,
    total_horas_ordinarias: resultado.totalHorasOrdinarias,
    total_horas_extras: resultado.totalHorasExtras,
    total_rno: resultado.totalRno,
    total_liquidado: resultado.totalLiquidado,
    minutos_descuento: minutosDescuento
  };

  // 5. Guardar mediante repositorio (Upsert)
  const jornadaId = await repo.upsertJornada(jornadaPayload, resultado.segmentos);

  logger.info(`Jornada calculada y guardada para ${empRes.rows[0].full_name} el ${data.fecha_trabajo}. ID: ${jornadaId}`);

  return {
    jornadaId,
    resultado
  };
}

// ─── Migración / Integración con Remisiones (Opcional) ─────────

/**
 * Permite calcular jornadas masivamente basándose en remisiones existentes,
 * extrayendo la hora de entrada y salida de allí.
 */
export async function calcularDesdeRemision(remisionId) {
  const { query } = await import('../../config/database.js');
  
  const remRes = await query(
    `SELECT r.id, r.fecha_servicio, r.hora_salida_cargar, r.hora_llegada_cargar, r.segundo_hora_salida_cargar, r.segundo_hora_llegada_cargar
     FROM remisiones r WHERE r.id = $1 AND r.deleted_at IS NULL`,
    [remisionId]
  );

  if (!remRes.rows[0]) throw new Error(`Remisión ${remisionId} no encontrada`);
  const rem = remRes.rows[0];
  const fechaStr = rem.fecha_servicio instanceof Date ? toDateStr(rem.fecha_servicio) : String(rem.fecha_servicio).split('T')[0];

  const resultados = [];

  // 1. Intentar obtener desde remision_horas_laborales (nuevo flujo)
  const hlRes = await query(
    `SELECT empleado_id, fecha_trabajo, hora_entrada, hora_salida 
     FROM remision_horas_laborales 
     WHERE remision_id = $1`,
    [remisionId]
  );

  if (hlRes.rows.length > 0) {
    for (const hl of hlRes.rows) {
      if (hl.hora_entrada && hl.hora_salida) {
        try {
          const res = await calcularYGuardarJornada({
            empleado_id: hl.empleado_id,
            fecha_trabajo: hl.fecha_trabajo instanceof Date ? toDateStr(hl.fecha_trabajo) : String(hl.fecha_trabajo).split('T')[0],
            hora_entrada: String(hl.hora_entrada).substring(0, 5),
            hora_salida: String(hl.hora_salida).substring(0, 5),
            remision_id: remisionId,
            observacion: 'Generado automáticamente desde horas laborales de remisión',
            minutos_descuento: 50
          });
          resultados.push(res);
        } catch (err) {
          logger.error(`Error calculando desde hl para empleado ${hl.empleado_id}: ${err.message}`);
        }
      }
    }
  } else {
    // 2. Fallback a remision_operarios y hora_salida_cargar (flujo legacy)
    const opRes = await query(
      `SELECT ro.empleado_id FROM remision_operarios ro WHERE ro.remision_id = $1`,
      [remisionId]
    );

    for (let idx = 0; idx < opRes.rows.length; idx++) {
      const op = opRes.rows[idx];
      const horaInicio = idx === 0
        ? (rem.hora_salida_cargar ? String(rem.hora_salida_cargar).substring(0, 5) : null)
        : (rem.segundo_hora_salida_cargar ? String(rem.segundo_hora_salida_cargar).substring(0, 5) : null);
      
      const horaFin = idx === 0
        ? (rem.hora_llegada_cargar ? String(rem.hora_llegada_cargar).substring(0, 5) : null)
        : (rem.segundo_hora_llegada_cargar ? String(rem.segundo_hora_llegada_cargar).substring(0, 5) : null);

      if (horaInicio && horaFin) {
        try {
          const res = await calcularYGuardarJornada({
            empleado_id: op.empleado_id,
            fecha_trabajo: fechaStr,
            hora_entrada: horaInicio,
            hora_salida: horaFin,
            remision_id: remisionId,
            observacion: 'Generado automáticamente desde remisión legacy',
            minutos_descuento: 50
          });
          resultados.push(res);
        } catch (err) {
          logger.error(`Error calculando desde remisión legacy para empleado ${op.empleado_id}: ${err.message}`);
        }
      }
    }
  }

  return resultados;
}
