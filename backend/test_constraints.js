import 'dotenv/config';
import { checkConnection, query } from './src/config/database.js';

async function test() {
  await checkConnection();
  try {
    const res = await query(`
      SELECT conname, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'remisiones';
    `, []);
    console.log(res.rows);
  } catch (err) {
    console.error("DB ERROR:", err.message);
  }
  process.exit();
}
test();
