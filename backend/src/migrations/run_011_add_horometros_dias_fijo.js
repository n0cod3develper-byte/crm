import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  // Verificar si las columnas ya existen antes de ejecutar
  const check = await db.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'remision_dias_fijo' AND column_name = 'horometro_inicial'
    ) AS exists
  `);

  if (check.rows[0].exists) {
    console.log('⏭️  Columna horometro_inicial ya existe en remision_dias_fijo, omitiendo migración 011_add_horometros_dias_fijo');
    await db.end();
    return;
  }

  const sqlPath = path.join(__dirname, '011_add_horometros_dias_fijo.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  try {
    await db.query(sql);
    console.log('✅ Migración 011_add_horometros_dias_fijo ejecutada correctamente — columnas agregadas');
  } catch (err) {
    console.error('❌ Error en la migración:', err.message);
  } finally {
    await db.end();
  }
}

runMigration();
