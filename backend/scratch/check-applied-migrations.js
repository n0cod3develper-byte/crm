import 'dotenv/config';
import pg from 'pg';
import { env } from '../src/config/env.js';

async function checkMigrations() {
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL
  });
  
  try {
    const res = await pool.query('SELECT filename FROM _migrations ORDER BY id ASC');
    console.log('APPLIED MIGRATIONS:', res.rows.map(r => r.filename));
    
    // Check if column tipo_servicio exists on catalogo_servicios
    const colRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'catalogo_servicios'
    `);
    console.log('catalogo_servicios COLUMNS:', colRes.rows.map(r => r.column_name));
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await pool.end();
  }
}

checkMigrations();
