import { query } from './src/config/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  try {
    const res = await query('SELECT * FROM equipos_repuestos_compatibles ORDER BY created_at DESC LIMIT 5');
    console.log(res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
check();
