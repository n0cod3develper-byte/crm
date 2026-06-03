import 'dotenv/config';
import pg from 'pg';
import { env } from '../src/config/env.js';

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

// Check roles_permisos columns
const cols = await pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'roles_permisos' 
  ORDER BY ordinal_position
`);
console.log('=== ROLES_PERMISOS COLUMNS ===');
cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

// Check admin role permisos data
const permisos = await pool.query(`
  SELECT rp.*, ms.slug as modulo_slug, ms.nombre as modulo_nombre
  FROM roles_permisos rp 
  JOIN roles r ON r.id = rp.rol_id 
  JOIN modulos_sistema ms ON ms.id = rp.modulo_id
  WHERE r.slug = 'admin'
  ORDER BY ms.slug
`);
console.log('\n=== ADMIN PERMISOS DATA ===');
permisos.rows.forEach(r => console.log(`  ${r.modulo_slug}:`, JSON.stringify(r)));

await pool.end();
