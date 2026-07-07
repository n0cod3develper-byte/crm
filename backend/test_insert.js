import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { config } from 'dotenv';
config({ path: path.join(__dirname, '.env') });

import { query } from './src/config/database.js';

async function main() {
  try {
    const res = await query(`
      INSERT INTO inventario (
        tipo, codigo_interno, name, nombre_comercial, categoria_id, unidad_medida_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      'PRODUCTO', 'TEST-01', '', 'Test', null, null
    ]);
    console.log("Success:", res.rows[0]);
  } catch (err) {
    console.log("DB ERROR:", err.message);
    console.log("Constraint:", err.constraint);
    console.log("Code:", err.code);
    console.log("Detail:", err.detail);
  }
  process.exit(0);
}

main().catch(console.error);
