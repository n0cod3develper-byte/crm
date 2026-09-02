import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { query, withTransaction } from '../src/config/database.js';
import { MantenimientoRepository } from '../src/modules/mantenimiento/mantenimiento.repository.js';
import { CorteContableRepository } from '../src/modules/mantenimiento/corteContable.repository.js';

const otRepo = new MantenimientoRepository();
const corteRepo = new CorteContableRepository();

async function runTest() {
  console.log('🧪 Iniciando prueba de Cierre Contable Mensual...');

  try {
    // 1. Obtener una empresa y un equipo reales para asociar la OT
    // Limpiar cortes previos del periodo de prueba
    await query("DELETE FROM ot_cortes_contables WHERE periodo = '2026-07'");
    await query("DELETE FROM ordenes_trabajo WHERE detalle_servicio LIKE '%prueba%' OR detalle_servicio LIKE '%sujeta a corte%'");

    const companyRes = await query('SELECT id, name FROM companies LIMIT 1');
    const equipoRes = await query('SELECT id, serial FROM equipos LIMIT 1');
    const userRes = await query('SELECT id FROM users LIMIT 1');
    const employeeRes = await query('SELECT id, hourly_rate FROM employees LIMIT 1');
    const itemInvRes = await query('SELECT id, nombre_comercial FROM catalogo_completo WHERE stock_actual > 5 LIMIT 1');

    if (!companyRes.rows[0] || !equipoRes.rows[0] || !userRes.rows[0]) {
      console.error('❌ Falta data base (companies, equipos, o users) en la base de datos para correr el test.');
      return;
    }

    const companyId = companyRes.rows[0].id;
    const equipoId = equipoRes.rows[0].id;
    const userId = userRes.rows[0].id;
    const employeeId = employeeRes.rows[0]?.id;
    const itemInvId = itemInvRes.rows[0]?.id;

    console.log(`Empresa: ${companyRes.rows[0].name}, Equipo: ${equipoRes.rows[0].serial}`);

    // 2. Crear OT de Servicio Continuo
    console.log('1. Creando OT de servicio continuo...');
    const otContinuo = await otRepo.createOT({
      tipo_mantenimiento: 'CORRECTIVO',
      empresa_id: companyId,
      equipo_id: equipoId,
      responsable: 'Responsable Test',
      contacto_empresa: 'Contacto Test',
      detalle_servicio: 'Servicio Continuo Mantenimiento de prueba',
      es_servicio_continuo: true
    }, userId);

    console.log(`OT continua creada: Consecutivo: ${otContinuo.consecutivo}, ID: ${otContinuo.id}`);

    // 3. Crear OT Puntual (no continua) para verificar que no se corta
    console.log('2. Creando OT puntual (no continua)...');
    const otPuntual = await otRepo.createOT({
      tipo_mantenimiento: 'CORRECTIVO',
      empresa_id: companyId,
      equipo_id: equipoId,
      responsable: 'Responsable Test 2',
      contacto_empresa: 'Contacto Test 2',
      detalle_servicio: 'OT puntual no sujeta a corte',
      es_servicio_continuo: false
    }, userId);

    console.log(`OT puntual creada: Consecutivo: ${otPuntual.consecutivo}, ID: ${otPuntual.id}`);

    // 4. Agregar items de costo a la OT Continua
    const fechaCorteStr = '2026-07-31';

    if (employeeId) {
      console.log('3. Asignando técnico a la OT continua...');
      const tech = await otRepo.addTecnico(otContinuo.id, { empleado_id: employeeId, tarifa_hora: 50000 });
      // Simular horas trabajadas dentro del periodo
      await otRepo.updateTecnico(otContinuo.id, tech.id, {
        fecha_salida: '2026-07-15',
        hora_salida: '08:00:00',
        fecha_regreso: '2026-07-15',
        hora_regreso: '12:00:00',
        hora_llegada_cliente: '08:15:00',
        hora_salida_cliente: '11:45:00'
      });
      console.log('Técnico asignado y horas actualizadas.');
    }

    if (itemInvId) {
      console.log('4. Agregando repuesto a la OT continua...');
      await otRepo.addRepuesto(otContinuo.id, {
        item_inventario_id: itemInvId,
        descripcion: 'Filtro de prueba',
        cantidad: 2,
        unidad: 'unidad',
        precio_unitario: 15000
      });
    }

    console.log('5. Agregando Mano de Obra Adicional a la OT continua...');
    await otRepo.addManoObraAdicional(otContinuo.id, {
      descripcion: 'Traslado de emergencia',
      precio: 80000
    }, userId);

    // 5. Generar propuesta de corte contable
    console.log(`6. Generando propuesta de corte contable para el periodo de ${fechaCorteStr}...`);
    const propuesta = await corteRepo.generarPropuestaCorte(fechaCorteStr);
    console.log('Propuesta creada:', propuesta.corte);

    const corteDetalle = await corteRepo.getCorteById(propuesta.corte.id);
    console.log('Items en la propuesta de corte:', corteDetalle.items);

    if (corteDetalle.items.length !== 1 || corteDetalle.items[0].orden_trabajo_id !== otContinuo.id) {
      throw new Error('Validación fallida: La propuesta de corte debió incluir únicamente la OT continua.');
    }
    console.log('✅ Validación de candidatos exitosa: sólo se incluyó la OT continua.');

    // 6. Confirmar la propuesta
    console.log('7. Confirmando propuesta de corte...');
    await corteRepo.confirmarCorte(propuesta.corte.id, userId);

    // 7. Ejecutar el corte
    console.log('8. Ejecutando corte contable...');
    const ejecutado = await corteRepo.ejecutarCorte(propuesta.corte.id, userId);
    console.log('Resultado ejecución:', ejecutado);

    // 8. Validar OT antigua y nueva
    console.log('9. Validando estados y traspaso de información...');
    const otOriginalPost = await otRepo.findOTById(otContinuo.id);
    console.log(`Estado OT original después del corte: ${otOriginalPost.estado} (Esperado: LIQUIDADA_CORTE)`);
    if (otOriginalPost.estado !== 'LIQUIDADA_CORTE') {
      throw new Error('La OT original no cambió al estado LIQUIDADA_CORTE');
    }

    const itemCortePost = ejecutado.items[0];
    const nuevaOtId = itemCortePost.nueva_ot_id;
    console.log(`Nueva OT creada con ID: ${nuevaOtId}`);

    const nuevaOt = await otRepo.findOTById(nuevaOtId);
    console.log('Nueva OT consecutivo:', nuevaOt.consecutivo);
    console.log('Nueva OT origen ID:', nuevaOt.orden_origen_id);
    console.log('Nueva OT cadena servicio ID:', nuevaOt.cadena_servicio_id);
    console.log('Nueva OT costos acumulados:', nuevaOt.repuestos_insumos.length, 'repuestos (Esperado: 0)');

    if (nuevaOt.orden_origen_id !== otContinuo.id) {
      throw new Error('La nueva OT no tiene correctamente asignado el orden_origen_id');
    }
    if (nuevaOt.cadena_servicio_id !== otOriginalPost.cadena_servicio_id) {
      throw new Error('La nueva OT no tiene el mismo cadena_servicio_id');
    }
    if (nuevaOt.repuestos_insumos.length !== 0) {
      throw new Error('La nueva OT heredó costos de repuestos, debió iniciar en ceros.');
    }

    // 9. Validar historial de cadena
    console.log('10. Validando historial de trazabilidad...');
    const historial = await corteRepo.getHistorialCadena(nuevaOt.cadena_servicio_id);
    console.log('Historial de la cadena de servicio:', historial);

    console.log('🎉 ¡Todas las pruebas de integración backend pasaron con éxito!');
  } catch (err) {
    console.error('❌ Error ejecutando la prueba:', err);
  }
}

runTest();
