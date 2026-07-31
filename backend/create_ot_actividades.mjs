import 'dotenv/config';
import { query } from './src/config/database.js';

async function createTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS ot_actividades (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        orden_trabajo_id UUID REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
        orden INTEGER NOT NULL,
        codigo VARCHAR(50),
        descripcion TEXT NOT NULL,
        estado VARCHAR(50) DEFAULT 'PENDIENTE',
        tecnico_id UUID,
        observaciones TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('Tabla ot_actividades creada con éxito');
  } catch(e) {
    console.error('Error:', e);
  }
  process.exit(0);
}
createTable();
