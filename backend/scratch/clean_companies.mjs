import 'dotenv/config';
import { query } from '../src/config/database.js';

async function run() {
  try {
    const result = await query('DELETE FROM companies WHERE deleted_at IS NOT NULL RETURNING name, nit');
    console.log('Deleted companies:', result.rows);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
run();
