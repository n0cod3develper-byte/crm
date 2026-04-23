import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkSequences() {
  const { db } = await import('../src/config/database.js');

  try {
    const res = await db.query(`
      SELECT relname FROM pg_class WHERE relkind = 'S' AND relname LIKE 'seq_%'
    `);
    console.log('Sequences found:', res.rows.map(r => r.relname));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkSequences();
