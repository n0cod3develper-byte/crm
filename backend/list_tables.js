import 'dotenv/config';
import { query } from './src/config/database.js';

async function listTables() {
  try {
    const res = await query(`
      SELECT tablename 
      FROM pg_catalog.pg_tables 
      WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';
    `);
    console.log("TABLES:", res.rows.map(r => r.tablename).join(', '));
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    process.exit(0);
  }
}

listTables();
