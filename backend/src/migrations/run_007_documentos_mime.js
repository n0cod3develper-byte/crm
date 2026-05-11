import dotenv from 'dotenv';
dotenv.config();

import { query } from '../config/database.js';

async function runMigration() {
  try {
    console.log('Agregando columnas mime_type y es_visualizable_inline a tabla documentos...');
    await query(`
      ALTER TABLE documentos
      ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120),
      ADD COLUMN IF NOT EXISTS es_visualizable_inline BOOLEAN DEFAULT FALSE;
    `);

    console.log('Actualizando registros existentes...');
    await query(`
      UPDATE documentos SET
        mime_type = CASE UPPER(formato)
          WHEN 'PDF'  THEN 'application/pdf'
          WHEN 'JPG'  THEN 'image/jpeg'
          WHEN 'PNG'  THEN 'image/png'
          WHEN 'DOCX' THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          WHEN 'XLSX' THEN 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          ELSE 'application/octet-stream'
        END,
        es_visualizable_inline = CASE UPPER(formato)
          WHEN 'PDF' THEN TRUE
          WHEN 'JPG' THEN TRUE
          WHEN 'PNG' THEN TRUE
          ELSE FALSE
        END
      WHERE mime_type IS NULL;
    `);
    
    console.log('Migración completada con éxito.');
    process.exit(0);
  } catch (err) {
    console.error('Error ejecutando migración:', err);
    process.exit(1);
  }
}

runMigration();
