import pg from 'pg';
import bcrypt from 'bcryptjs';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres:crm_dev_password@localhost:5432/cargar_crm' });
async function main() {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('admin123', salt);
  await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'sistemas@cargar.com.co']);
  console.log('Password set to: admin123');
  const r = await pool.query('SELECT email, password_hash IS NOT NULL as has_password FROM users WHERE email = $1', ['sistemas@cargar.com.co']);
  console.log('User:', r.rows[0].email, 'Has password:', r.rows[0].has_password);
  await pool.end();
}
main().catch(err => { console.error(err); process.exit(1); });
