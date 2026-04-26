import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { query } from '../config/database.js';
import { detectarTipoReal } from '../services/fileTypeService.js';

const BASE_PATH = process.env.UPLOADS_BASE_PATH || './uploads';

async function corregirMimeTypes() {
  console.log('Iniciando corrección de Mime Types y extensiones...\n');
  
  let corregidos = 0;
  let errores = 0;
  let no_encontrados = 0;

  try {
    const result = await query("SELECT * FROM documentos WHERE estado = 'ACTIVO'");
    const documentos = result.rows;

    for (const doc of documentos) {
      try {
        const absolutaOld = path.resolve(BASE_PATH, doc.ruta_relativa);
        
        if (!fs.existsSync(absolutaOld)) {
          console.log(`[WARN] Archivo no existe en disco: ${doc.id} - ${doc.ruta_relativa}`);
          no_encontrados++;
          continue;
        }

        // Leer buffer y detectar tipo real
        const buffer = fs.readFileSync(absolutaOld);
        const tipoDetectado = await detectarTipoReal(buffer);

        if (!tipoDetectado.valido) {
          console.log(`[ERROR] Archivo inválido o corrupto: ${doc.id} - ${doc.ruta_relativa} - ${tipoDetectado.error}`);
          errores++;
          continue;
        }

        // Renombrar archivo si la extensión es incorrecta
        const parsedPath = path.parse(doc.ruta_relativa);
        let nuevaRutaRelativa = doc.ruta_relativa;
        let nuevoNombreDisco = doc.nombre_disco;

        // Limpiar puntos y verificar la extensión
        const currentExt = parsedPath.ext.replace('.', '').toLowerCase();
        const expectedExt = tipoDetectado.ext.toLowerCase();

        if (currentExt !== expectedExt) {
          nuevoNombreDisco = `${parsedPath.name}.${expectedExt}`;
          nuevaRutaRelativa = path.join(parsedPath.dir, nuevoNombreDisco).replace(/\\/g, '/');
          const absolutaNew = path.resolve(BASE_PATH, nuevaRutaRelativa);
          
          fs.renameSync(absolutaOld, absolutaNew);
          console.log(`[INFO] Renombrado: ${doc.ruta_relativa} -> ${nuevaRutaRelativa}`);
        }

        // Actualizar base de datos
        await query(`
          UPDATE documentos 
          SET 
            mime_type = $1, 
            es_visualizable_inline = $2,
            ruta_relativa = $3,
            nombre_disco = $4,
            formato = $5
          WHERE id = $6
        `, [
          tipoDetectado.mime,
          tipoDetectado.config.esVisualizableInline,
          nuevaRutaRelativa,
          nuevoNombreDisco,
          tipoDetectado.ext.toUpperCase(),
          doc.id
        ]);

        console.log(`[OK] Actualizado: ${doc.id} - MIME: ${tipoDetectado.mime}`);
        corregidos++;

      } catch (err) {
        console.error(`[ERROR] Fallo al procesar documento ${doc.id}: ${err.message}`);
        errores++;
      }
    }

    console.log('\n=== Resumen de Corrección ===');
    console.log(`Total revisados: ${documentos.length}`);
    console.log(`Corregidos OK: ${corregidos}`);
    console.log(`No encontrados en disco: ${no_encontrados}`);
    console.log(`Errores: ${errores}`);
    
    process.exit(0);

  } catch (err) {
    console.error('Error fatal ejecutando script:', err);
    process.exit(1);
  }
}

corregirMimeTypes();
