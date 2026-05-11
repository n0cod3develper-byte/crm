import 'dotenv/config';
import { checkConnection, query } from './src/config/database.js';

async function test() {
  await checkConnection();
  try {
    const remision = await query("SELECT id FROM remisiones WHERE numero_remision = '32973'", []);
    if (remision.rows.length === 0) {
      console.log("No remision found");
      process.exit();
    }
    const id = remision.rows[0].id;
    console.log("Found ID:", id);
    const res = await query("UPDATE remisiones SET estado = 'REALIZADA' WHERE id = $1 RETURNING *", [id]);
    console.log(res.rows[0]);
  } catch (err) {
    console.error("DB ERROR:", err.message);
  }
  process.exit();
}
test();
