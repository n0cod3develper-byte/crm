const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  
  // Check if there are any duplicate numero_remision values
  const dupRes = await client.query(`
    SELECT numero_remision, COUNT(*) as cnt 
    FROM remisiones 
    GROUP BY numero_remision 
    HAVING COUNT(*) > 1
  `);
  console.log('Duplicate numero_remision:', dupRes.rows);
  
  // Check the next number that would be generated
  const consRes = await client.query(`SELECT ultimo_valor FROM consecutivos WHERE id = 'REM'`);
  const nextNum = consRes.rows[0].ultimo_valor + 1;
  console.log('Next number to be generated:', nextNum);
  
  // Check if that number already exists
  const existsRes = await client.query(
    `SELECT id, numero_remision FROM remisiones WHERE numero_remision = $1`,
    [String(nextNum)]
  );
  console.log('Does next number exist?', existsRes.rows);
  
  // Also check padded version
  const existsPaddedRes = await client.query(
    `SELECT id, numero_remision FROM remisiones WHERE numero_remision = $1`,
    [String(nextNum).padStart(5, '0')]
  );
  console.log('Does next number (padded) exist?', existsPaddedRes.rows);
  
  // Check last 5 remisiones
  const lastRes = await client.query(`
    SELECT numero_remision, fecha_servicio, created_at 
    FROM remisiones 
    ORDER BY created_at DESC 
    LIMIT 5
  `);
  console.log('Last 5 remisiones:');
  console.table(lastRes.rows);
  
  await client.end();
}

main().catch(console.error);
