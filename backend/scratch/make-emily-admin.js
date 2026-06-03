import 'dotenv/config';
import pg from 'pg';
import { env } from '../src/config/env.js';

async function makeAdmin() {
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL
  });
  
  try {
    const res = await pool.query(
      "UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, email, role",
      ['emilylobo14@gmail.com']
    );
    console.log('UPDATED:', res.rows[0]);
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await pool.end();
  }
}

makeAdmin();
