import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testUpdate() {
  const { db } = await import('../src/config/database.js');
  const { proveedoresRepository } = await import('../src/modules/proveedores/proveedores.repository.js');

  try {
    // Get a valid proveedor ID
    const provRes = await db.query('SELECT id FROM proveedores LIMIT 1');
    if (provRes.rowCount === 0) {
      console.error('No proveedores found in DB');
      process.exit(1);
    }
    const id = provRes.rows[0].id;

    const data = {
      razon_social: 'Empresa Actualizada ' + Date.now(),
      notas_internas: 'Actualización de prueba'
    };

    console.log(`Intentando actualizar proveedor ${id}...`);
    const result = await proveedoresRepository.update(id, data);
    console.log('✅ Éxito:', result.razon_social);
  } catch (error) {
    console.error('❌ Error capturado:', error);
  } finally {
    process.exit(0);
  }
}

testUpdate();
