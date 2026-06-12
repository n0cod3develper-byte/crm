import pg from 'pg';
const pool = new pg.Pool({connectionString: 'postgresql://postgres:crm_dev_password@localhost:5434/cargar_crm'});

try {
  const users = await pool.query(`SELECT id, email, nombre, apellido, estado, password_hash IS NOT NULL as has_password, rol_id FROM users`);
  console.log('=== USERS ===');
  users.rows.forEach(u => console.log(`  ${u.email} | nombre=${u.nombre} | estado=${u.estado} | has_password=${u.has_password} | rol_id=${u.rol_id}`));
  
  if (users.rows.length === 0) {
    console.log('\n⚠️  No hay usuarios en la tabla users!');
  }
} catch(e) {
  console.error('Error:', e.message);
} finally {
  await pool.end();
}
