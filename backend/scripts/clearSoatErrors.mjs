import { query } from '../src/config/database.js';

const res = await query(`DELETE FROM soat_email_notifications WHERE status = 'error' RETURNING id, dedup_key, status`);
console.log(`✅ Eliminados ${res.rows.length} registros fallidos:`);
res.rows.forEach(r => console.log(` - id=${r.id} | ${r.dedup_key}`));
process.exit(0);
