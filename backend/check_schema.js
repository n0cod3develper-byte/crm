import 'dotenv/config';
import { query } from './src/config/database.js';

const res = await query(
  `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`
);
res.rows.forEach(c => console.log(c.column_name, '-', c.data_type));

// Also check if 'roles' table exists
try {
  const roles = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'roles' ORDER BY ordinal_position`);
  console.log('\n--- roles table ---');
  roles.rows.forEach(c => console.log(c.column_name));
} catch(e) {
  console.log('roles table error:', e.message);
}

process.exit(0);
