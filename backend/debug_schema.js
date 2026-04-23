import { query, checkConnection } from './src/config/database.js';

async function main() {
  await checkConnection();
  
  // 1. Check ordenes_trabajo columns
  const cols = await query(
    `SELECT column_name, data_type, is_nullable, column_default 
     FROM information_schema.columns 
     WHERE table_name = 'ordenes_trabajo' 
     ORDER BY ordinal_position`
  );
  console.log('=== ordenes_trabajo columns ===');
  console.log(JSON.stringify(cols.rows, null, 2));
  
  // 2. Check ot_repuestos_insumos columns
  const repCols = await query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns 
     WHERE table_name = 'ot_repuestos_insumos' 
     ORDER BY ordinal_position`
  );
  console.log('\n=== ot_repuestos_insumos columns ===');
  console.log(JSON.stringify(repCols.rows, null, 2));
  
  // 3. Check ot_pm_actividades columns
  const pmCols = await query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns 
     WHERE table_name = 'ot_pm_actividades'
     ORDER BY ordinal_position`
  );
  console.log('\n=== ot_pm_actividades columns ===');
  console.log(JSON.stringify(pmCols.rows, null, 2));
  
  // 4. Try a test insert (will rollback)
  console.log('\n=== Test insert (dry run) ===');
  try {
    const userRes = await query('SELECT id FROM users LIMIT 1');
    const empRes = await query('SELECT id FROM companies LIMIT 1');
    const eqRes = await query('SELECT id FROM equipos LIMIT 1');
    
    const testData = {
      tipo_mantenimiento: 'CORRECTIVO',
      pm_frecuencia_id: '',
      empresa_id: empRes.rows[0].id,
      equipo_id: eqRes.rows[0].id,
      horometro_inicial: '',
      horometro_final: '',
      responsable: '',
      contacto_empresa: '',
      telefono_contacto: '',
      detalle_servicio: '',
      observaciones: '',
    };
    
    console.log('Payload from frontend would be:', JSON.stringify(testData, null, 2));
    
    // Import and test
    const { MantenimientoRepository } = await import('./src/modules/mantenimiento/mantenimiento.repository.js');
    const repo = new MantenimientoRepository();
    const result = await repo.createOT(testData, userRes.rows[0].id);
    console.log('SUCCESS:', result.id, result.consecutivo);
  } catch(err) {
    console.error('ERROR:', err.message);
    console.error('STACK:', err.stack);
  }
  
  process.exit(0);
}

main();
