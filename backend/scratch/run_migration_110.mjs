import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    // Check if already applied
    const check = await client.query(`SELECT 1 FROM _migrations WHERE filename = '110_equipos_centro_costo.sql'`);
    if (check.rows.length > 0) {
      console.log('⏭️  Migration 110 already applied');
      return;
    }

    const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '110_equipos_centro_costo.sql'), 'utf-8');
    
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(`INSERT INTO _migrations (filename) VALUES ('110_equipos_centro_costo.sql')`);
    await client.query('COMMIT');
    
    console.log('✅ Migration 110_equipos_centro_costo.sql applied successfully');
    
    // Verify
    const verCol = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'equipos' AND column_name = 'centro_costo_id'`);
    console.log(`   centro_costo_id column exists: ${verCol.rows.length > 0}`);

    const verView = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'equipos_completo' AND column_name = 'centro_costo_nombre'`);
    console.log(`   equipos_completo.centro_costo_nombre exists: ${verView.rows.length > 0}`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', e.message);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => process.exit(1));
