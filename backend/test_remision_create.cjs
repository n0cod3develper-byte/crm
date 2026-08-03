const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const { ServiciosRepository } = require('./src/modules/servicios/servicios.repository');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function testCreate() {
  await client.connect();
  const repo = new ServiciosRepository();
  repo.pool = client; // Hack to use the client as pool for the test

  try {
    await client.query('BEGIN');
    
    // Attempt to create a remision
    const data = {
      company_id: '944b4748-7fee-4e77-859f-f5664ae1bb3d', // From previous test
      catalogo_servicio_id: '12f3ec0b-68d8-4f80-ab96-3c07223bdf70', // Try to get one
      equipo_id: 'c802613f-dbb3-46fb-9759-4d2d41b066cf', // Need valid equipment
      fecha_servicio: new Date(),
      operario_id: null,
      items: [{
        catalogo_servicio_id: '12f3ec0b-68d8-4f80-ab96-3c07223bdf70',
        cantidad: 1,
        valor_unitario: 1000,
        aplica_iva: false
      }]
    };
    
    // First, let's get valid IDs
    const compRes = await client.query('SELECT id FROM companies LIMIT 1');
    data.company_id = compRes.rows[0].id;
    
    const catRes = await client.query('SELECT id FROM catalogo_servicios LIMIT 1');
    data.catalogo_servicio_id = catRes.rows[0].id;
    data.items[0].catalogo_servicio_id = catRes.rows[0].id;
    
    const eqRes = await client.query('SELECT id FROM equipos LIMIT 1');
    data.equipo_id = eqRes.rows[0].id;

    console.log('Attempting to create with:', data);
    
    const rem = await repo.create(data, { id: null, nombre: 'Test' });
    console.log('Created successfully:', rem);
    
    await client.query('ROLLBACK');
  } catch (err) {
    console.error('ERROR CREATING:');
    console.error(err);
    await client.query('ROLLBACK');
  } finally {
    await client.end();
  }
}

testCreate().catch(console.error);
