import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  // Verificar si el constraint ya fue eliminado antes de ejecutar
  const check = await db.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'facturas_numero_factura_key'
    ) AS exists
  `);

  if (!check.rows[0].exists) {
    console.log('⏭️  Constraint facturas_numero_factura_key ya no existe, omitiendo migración 010_drop_unique_numero_factura');
    await db.end();
    return;
  }

  const sqlPath = path.join(__dirname, '010_drop_unique_numero_factura.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  try {
    await db.query(sql);
    console.log('✅ Migración 010_drop_unique_numero_factura ejecutada correctamente — constraint eliminado');
  } catch (err) {
    console.error('❌ Error en la migración:', err.message);
  } finally {
    await db.end();
  }
}

runMigration();
