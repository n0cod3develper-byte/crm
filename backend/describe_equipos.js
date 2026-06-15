import 'dotenv/config';
import { query } from './src/config/database.js';

async function describeTable() {
  try {
    const res = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'equipos';
    `);
    console.log("EQUIPOS COLUMNS:");
    res.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    process.exit(0);
  }
}

describeTable();
