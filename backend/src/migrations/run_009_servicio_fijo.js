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
      WHERE table_name = 'remision_dias_fijo'
    ) AS exists
  `);

  if (check.rows[0].exists) {
    console.log('⏭️  Tabla remision_dias_fijo ya existe, omitiendo migración 009_servicio_fijo');
    await db.end();
    return;
  }

  const sqlPath = path.join(__dirname, '009_servicio_fijo.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  try {
    await db.query(sql);
    console.log('✅ Migración 009_servicio_fijo ejecutada correctamente — tabla y columna creadas');
  } catch (err) {
    console.error('❌ Error en la migración:', err.message);
  } finally {
    await db.end();
  }
}

runMigration();
