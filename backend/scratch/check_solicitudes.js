import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkSolicitudes() {
  const { db } = await import('../src/config/database.js');

  try {
    const res = await db.query('SELECT * FROM solicitudes_compra');
    console.log('Solicitudes found in DB:', res.rowCount);
    if (res.rowCount > 0) {
      console.log('Latest SC:', res.rows[0].consecutivo, res.rows[0].estado);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkSolicitudes();
