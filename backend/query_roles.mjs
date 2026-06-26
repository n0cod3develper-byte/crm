import 'dotenv/config';
import { query } from './src/config/database.js';

async function main() {
  try {
    const r = await query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_name ILIKE '%rol%'`
    );
    r.rows.forEach(row => console.log(row.table_name));
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

main();
