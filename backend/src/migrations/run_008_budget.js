import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  // Verificar si la tabla ya existe antes de ejecutar
  const check = await db.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'budget_areas'
    ) AS exists
  `);

  if (check.rows[0].exists) {
    console.log('⏭️  Tabla budget_areas ya existe, omitiendo migración 008_budget');
    await db.end();
    return;
  }

  const sqlPath = path.join(__dirname, '008_budget.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  try {
    await db.query(sql);
    console.log('✅ Migración 008_budget ejecutada correctamente — tablas creadas');
  } catch (err) {
    console.error('❌ Error en la migración:', err.message);
  } finally {
    await db.end();
  }
}

runMigration();
