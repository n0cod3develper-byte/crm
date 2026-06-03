import 'dotenv/config';
import pg from 'pg';
import { env } from '../src/config/env.js';

async function listUsers() {
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL
  });
  
  try {
    const res = await pool.query('SELECT id, email, full_name, role, is_active FROM users');
    console.log('USERS:', res.rows);
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await pool.end();
  }
}

listUsers();
