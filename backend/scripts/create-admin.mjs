import bcrypt from 'bcryptjs';
import pg from 'pg';
import { readFileSync } from 'fs';

// Leer .env manualmente
const envContent = readFileSync('.env', 'utf8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx > 0) {
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    envVars[key] = val;
  }
}

const DATABASE_URL = envVars.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL no encontrada'); process.exit(1); }

const pool = new pg.Pool({ connectionString: DATABASE_URL });

const EMAIL    = 'admin@cargar.com';
const PASSWORD = 'Admin2026!';
const FULL_NAME = 'Administrador CARGAR';

const hash = await bcrypt.hash(PASSWORD, 10);

// Verificar si ya existe
const existing = await pool.query('SELECT id FROM users WHERE email = $1', [EMAIL]);

if (existing.rows.length > 0) {
  await pool.query(
    'UPDATE users SET password_hash = $1, role = $2, is_active = true, full_name = $3 WHERE email = $4',
    [hash, 'admin', FULL_NAME, EMAIL]
  );
  console.log('✅ Usuario admin actualizado');
} else {
  await pool.query(
    'INSERT INTO users (email, full_name, role, is_active, password_hash) VALUES ($1, $2, $3, true, $4)',
    [EMAIL, FULL_NAME, 'admin', hash]
  );
  console.log('✅ Usuario admin creado');
}

// También actualizar test@test.com a admin
await pool.query(
  'UPDATE users SET role = $1, is_active = true WHERE email = $2',
  ['admin', 'test@test.com']
);
console.log('✅ test@test.com actualizado a admin');

console.log('\n📋 Credenciales:');
console.log('   Email:    ' + EMAIL);
console.log('   Password: ' + PASSWORD);
console.log('\n   Alternativo:');
console.log('   Email:    test@test.com');
console.log('   Password: (la que ya tenía configurada)');

await pool.end();
process.exit(0);
