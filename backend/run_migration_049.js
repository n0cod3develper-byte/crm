import pg from 'pg';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:crm_dev_password@localhost:5432/cargar_crm',
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id        SERIAL PRIMARY KEY,
        filename  TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const sql = fs.readFileSync(
      path.join(__dirname, 'migrations', '049_activity_log.sql'),
      'utf8'
    );
    console.log('⚙️  Aplicando 049_activity_log.sql...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      `INSERT INTO _migrations (filename) VALUES ($1)
       ON CONFLICT (filename) DO NOTHING`,
      ['049_activity_log.sql']
    );
    await client.query('COMMIT');
    console.log('✅ Migración 049 aplicada correctamente');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
