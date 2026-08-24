const { Client } = require('pg');
const client = new Client('postgresql://postgres:crm_dev_password@localhost:5434/cargar_crm');

async function run() {
  await client.connect();
  const eq = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'equipos'");
  console.log("Equipos:", eq.rows.map(r => r.column_name));
  
  const rem = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'remisiones'");
  console.log("Remisiones:", rem.rows.map(r => r.column_name));
  
  await client.end();
}
run().catch(console.error);
