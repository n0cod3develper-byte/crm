const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  const res = await client.query(`SELECT numero_remision FROM remisiones ORDER BY numero_remision DESC LIMIT 10`);
  console.table(res.rows);
  await client.end();
}
main().catch(console.error);
