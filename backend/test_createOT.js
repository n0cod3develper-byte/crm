import { MantenimientoRepository } from './src/modules/mantenimiento/mantenimiento.repository.js';
import { checkConnection } from './src/config/database.js';

async function test() {
  await checkConnection();
  const repo = new MantenimientoRepository();
  const { query } = await import('./src/config/database.js');
  
  const empRes = await query('SELECT id FROM companies LIMIT 1');
  const eqRes = await query('SELECT id FROM equipos LIMIT 1');
  const freqRes = await query('SELECT id FROM pm_frecuencias LIMIT 1');
  
  const data = {
    tipo_mantenimiento: 'PREVENTIVO',
    pm_frecuencia_id: freqRes.rows[0].id,
    empresa_id: empRes.rows[0].id,
    equipo_id: eqRes.rows[0].id,
    horometro_inicial: '200',
    horometro_final: '',
    responsable: '',
    contacto_empresa: '',
    telefono_contacto: '',
    detalle_servicio: '',
    observaciones: '',
  };
    
  const userRes = await query('SELECT id FROM users LIMIT 1');
  const userId = userRes.rows[0].id;
  
  console.log('Testing createOT (PREVENTIVO)...');
  try {
    const res = await repo.createOT(data, userId);
    console.log('Exito:', res);
  } catch(err) {
    console.error('Error in createOT:', err.message, err.stack);
  }
  process.exit(0);
}

test();
