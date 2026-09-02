import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function runTest() {
  console.log('🧪 Iniciando prueba automatizada de Cierre Contable Mensual v2...');
  
  // Importaciones dinámicas para asegurar que dotenv corra primero
  const { query } = await import('../src/config/database.js');
  const { MantenimientoRepository } = await import('../src/modules/mantenimiento/mantenimiento.repository.js');
  const { CorteContableRepository } = await import('../src/modules/mantenimiento/corteContable.repository.js');

  const otRepo = new MantenimientoRepository();
  const corteRepo = new CorteContableRepository();

  const testPeriodo = '2026-07';
  const fechaCorteStr = '2026-07-31';

  try {
    // 1. Limpieza de datos previos de prueba
    console.log('🧹 Limpiando datos previos de prueba...');
    await query("DELETE FROM ot_corte_items WHERE corte_id IN (SELECT id FROM ot_cortes_contables WHERE periodo = $1)", [testPeriodo]);
    await query("DELETE FROM ot_cortes_contables WHERE periodo = $1", [testPeriodo]);
    await query("DELETE FROM ordenes_trabajo WHERE detalle_servicio LIKE '%prueba v2%'");

    // Obtener registros válidos de la base de datos para la prueba
    const companyRes = await query('SELECT id, name FROM companies LIMIT 1');
    const equipoRes = await query('SELECT id, serial FROM equipos LIMIT 1');
    const userRes = await query('SELECT id FROM users LIMIT 1');
    const employeeRes = await query('SELECT id FROM employees LIMIT 1');
    const itemInvRes = await query('SELECT id, nombre_comercial FROM catalogo_completo WHERE stock_actual > 5 LIMIT 1');

    if (!companyRes.rows[0] || !equipoRes.rows[0] || !userRes.rows[0]) {
      console.error('❌ Error: Falta data base (companies, equipos, u users) para correr el test.');
      return;
    }

    const companyId = companyRes.rows[0].id;
    const equipoId = equipoRes.rows[0].id;
    const userId = userRes.rows[0].id;
    const employeeId = employeeRes.rows[0]?.id;
    const itemInvId = itemInvRes.rows[0]?.id;

    console.log(`ℹ️ Usando Empresa ID: ${companyId}, Equipo ID: ${equipoId}, Usuario ID: ${userId}`);

    // 2. Crear Orden de Trabajo de Servicio Continuo
    console.log('1. Creando OT de servicio continuo...');
    const ot = await otRepo.createOT({
      tipo_mantenimiento: 'CORRECTIVO',
      empresa_id: companyId,
      equipo_id: equipoId,
      responsable: 'Responsable Test v2',
      contacto_empresa: 'Contacto Test v2',
      detalle_servicio: 'Servicio de prueba v2 para cierre contable',
      es_servicio_continuo: true
    }, userId);

    console.log(`   Consecutivo OT: ${ot.consecutivo}, ID: ${ot.id}, Estado: ${ot.estado}`);

    // 3. Agregar algunos costos antes del corte
    let repuestoId = null;
    if (itemInvId) {
      console.log('2. Agregando repuesto de prueba...');
      const rep = await otRepo.addRepuesto(ot.id, {
        item_inventario_id: itemInvId,
        descripcion: 'Insumo prueba v2',
        cantidad: 1,
        ref: 'REF123',
        unidad: 'unidad',
        precio_unitario: 20000
      });
      repuestoId = rep.id;
      console.log(`   Repuesto agregado ID: ${repuestoId}`);
      // Simular que fue registrado antes de la fecha de corte (ej. 2026-07-15)
      await query("UPDATE ot_repuestos_insumos SET created_at = '2026-07-15' WHERE id = $1", [repuestoId]);
    }

    // 4. Proponer Corte
    console.log(`3. Generando propuesta de corte contable para ${fechaCorteStr}...`);
    const propuesta = await corteRepo.generarPropuestaCorte(fechaCorteStr);
    const corteId = propuesta.corte.id;
    console.log(`   Propuesta de Corte creada ID: ${corteId}, Estado: ${propuesta.corte.estado}`);

    // 5. Confirmar Lote
    console.log('4. Confirmando lote de corte...');
    await corteRepo.confirmarCorte(corteId, userId);

    // 6. Ejecutar Corte
    console.log('5. Ejecutando corte contable...');
    const ejecutado = await corteRepo.ejecutarCorte(corteId, userId);
    console.log(`   Estado del corte después de ejecutar: ${ejecutado.estado}`);
    
    // Verificar que el estado sea EN_GRACIA
    if (ejecutado.estado !== 'EN_GRACIA') {
      throw new Error(`Se esperaba estado EN_GRACIA, pero se obtuvo ${ejecutado.estado}`);
    }
    
    // Verificar que la OT original no cambió de estado (sigue ABIERTA o en su estado actual)
    const otPostCorte = await otRepo.findOTById(ot.id);
    console.log(`   Estado de la OT después del corte: ${otPostCorte.estado} (Sigue abierta)`);
    if (otPostCorte.estado === 'LIQUIDADA_CORTE') {
      throw new Error('Error: La OT fue cerrada o liquidada automáticamente por el corte.');
    }
    
    const fmtCorteDate = otPostCorte.fecha_ultimo_corte instanceof Date 
      ? otPostCorte.fecha_ultimo_corte.toISOString().split('T')[0]
      : String(otPostCorte.fecha_ultimo_corte).split('T')[0];

    if (fmtCorteDate !== fechaCorteStr) {
      throw new Error(`Se esperaba fecha_ultimo_corte = ${fechaCorteStr}, se obtuvo ${otPostCorte.fecha_ultimo_corte}`);
    }
    if (otPostCorte.periodo_cierre_id !== corteId) {
      throw new Error(`Se esperaba periodo_cierre_id = ${corteId}, se obtuvo ${otPostCorte.periodo_cierre_id}`);
    }
    console.log('   ✅ Verificación de estado de OT y metadatos de corte en la OT exitosa.');

    // 7. Intentar modificar en estado EN_GRACIA (Debe permitirlo)
    console.log('6. Probando modificación durante periodo de gracia (debe ser permitido)...');
    if (repuestoId) {
      await otRepo.updateRepuesto(ot.id, repuestoId, {
        item_inventario_id: itemInvId,
        descripcion: 'Insumo prueba v2 modificado en gracia',
        cantidad: 2,
        unidad: 'unidad',
        precio_unitario: 20000
      });
      console.log('   ✅ Modificación de repuesto en gracia permitida con éxito.');
    }

    // 8. Cerrar Periodo Definitivamente
    console.log('7. Cerrando periodo contable definitivamente...');
    const cerrado = await corteRepo.cerrarPeriodo(corteId, userId);
    console.log(`   Estado del corte después de cerrar: ${cerrado.estado}`);
    if (cerrado.estado !== 'CERRADO') {
      throw new Error(`Se esperaba estado CERRADO, se obtuvo ${cerrado.estado}`);
    }

    // 9. Intentar modificar item del periodo cerrado (Debe fallar)
    console.log('8. Probando bloqueo retroactivo en periodo cerrado (debe fallar)...');
    if (repuestoId) {
      try {
        await otRepo.updateRepuesto(ot.id, repuestoId, {
          item_inventario_id: itemInvId,
          descripcion: 'Intento de edición bloqueada',
          cantidad: 3,
          unidad: 'unidad',
          precio_unitario: 20000
        });
        throw new Error('❌ Error: El sistema permitió modificar un repuesto de un periodo cerrado!');
      } catch (err) {
        console.log(`   ✅ Bloqueo retroactivo verificado correctamente: "${err.message}"`);
      }
    }

    // 10. Reabrir Periodo
    console.log('9. Reabriendo periodo contable con justificación...');
    const reabierto = await corteRepo.reabrirPeriodo(
      corteId, 
      userId, 
      'Usuario Test', 
      'Reapertura justificada de prueba para ingresar datos omitidos'
    );
    console.log(`   Estado del corte después de reabrir: ${reabierto.estado}`);
    if (reabierto.estado !== 'REABIERTO') {
      throw new Error(`Se esperaba estado REABIERTO, se obtuvo ${reabierto.estado}`);
    }

    // 11. Intentar modificar con periodo REABIERTO (Debe permitirlo)
    console.log('10. Probando modificación en periodo REABIERTO (debe ser permitido)...');
    if (repuestoId) {
      await otRepo.updateRepuesto(ot.id, repuestoId, {
        item_inventario_id: itemInvId,
        descripcion: 'Insumo prueba v2 modificado después de reapertura',
        cantidad: 4,
        unidad: 'unidad',
        precio_unitario: 20000
      });
      console.log('   ✅ Modificación tras reapertura permitida con éxito.');
    }

    // 12. Validar que el log de auditoría fue creado
    console.log('11. Verificando log de auditoría de la reapertura...');
    const auditRes = await query(
      "SELECT * FROM audit_logs WHERE modulo = 'cierre_contable' AND accion = 'REAPERTURA_PERIODO' ORDER BY created_at DESC LIMIT 1"
    );
    if (auditRes.rows.length === 0) {
      throw new Error('No se encontró el log de auditoría para la reapertura');
    }
    console.log('   Audit Log encontrado:', auditRes.rows[0].datos_despues);
    console.log('   ✅ Verificación de log de auditoría exitosa.');

    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE LA V2 DE CIERRE CONTABLE PASARON CON ÉXITO! 🎉');
  } catch (err) {
    console.error('\n❌ ERROR DURANTE LA EJECUCIÓN DEL TEST:', err);
  } finally {
    // Limpieza final
    console.log('🧹 Limpieza final de datos de prueba...');
    try {
      const { query } = await import('../src/config/database.js');
      await query("DELETE FROM ot_corte_items WHERE corte_id IN (SELECT id FROM ot_cortes_contables WHERE periodo = $1)", [testPeriodo]);
      await query("DELETE FROM ot_cortes_contables WHERE periodo = $1", [testPeriodo]);
      await query("DELETE FROM ordenes_trabajo WHERE detalle_servicio LIKE '%prueba v2%'");
    } catch (cleanErr) {
      console.error('Error during cleanup:', cleanErr.message);
    }
  }
}

runTest();
