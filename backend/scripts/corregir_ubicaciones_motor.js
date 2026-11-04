import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const isApply = process.argv.includes('--apply');
const isDryRun = !isApply || process.argv.includes('--dry-run');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log(`\n======================================================`);
    console.log(` SCRIPT DE CORRECCIÓN DE UBICACIONES: SISTEMA MOTOR`);
    console.log(` MODO: ${isApply ? '⚠️  APPLY (ESCRITURA REAL EN BD)' : '🔍 DRY-RUN (SIMULACIÓN - SOLO LECTURA)'}`);
    console.log(`======================================================\n`);

    // 1. Obtener la categoría Sistema Motor
    const catRes = await client.query(`
      SELECT id, nombre, slug, ubicacion_default_id, ultimo_consecutivo_ubicacion
      FROM catalogo_categorias
      WHERE id = '26432c9e-7208-48b7-a366-47faf09b6339' 
         OR slug = 'sistema-motor' 
         OR nombre ILIKE '%motor%'
      LIMIT 1
    `);

    if (catRes.rows.length === 0) {
      throw new Error('Categoría Sistema Motor no encontrada en catalogo_categorias');
    }

    const categoria = catRes.rows[0];
    console.log(`Categoría encontrada: ${categoria.nombre} (ID: ${categoria.id})`);
    console.log(`Contador actual en categoría: ${categoria.ultimo_consecutivo_ubicacion ?? 0}\n`);

    // 2. Obtener los productos de Sistema Motor ordenados por fecha de creación e ID
    const itemsRes = await client.query(`
      SELECT i.id, i.codigo_interno, i.name, i.nombre_comercial, i.created_at,
             i.ubicacion_id, ub.codigo_ubicacion AS ubi_actual_codigo, ub.descripcion AS ubi_actual_desc
      FROM inventario i
      LEFT JOIN ubicaciones_bodega ub ON ub.id = i.ubicacion_id
      WHERE i.categoria_id = $1 AND i.tipo = 'PRODUCTO'
      ORDER BY i.created_at ASC, i.id ASC
    `, [categoria.id]);

    const items = itemsRes.rows;
    console.log(`Total de productos encontrados en Sistema Motor: ${items.length}`);

    if (items.length === 0) {
      console.log('No hay productos para corregir.');
      return;
    }

    // 3. Simulación o Aplicación
    const preview = [];
    await client.query('BEGIN');

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const seq = idx + 1;
      const newCode = String(seq).padStart(3, '0');
      const newDesc = `Posición ${newCode} - ${categoria.nombre}`;

      preview.push({
        num: seq,
        id: item.id,
        codigo_interno: item.codigo_interno || 'S/C',
        nombre: (item.nombre_comercial || item.name || '').substring(0, 30),
        ubi_antes: `${item.ubi_actual_codigo || 'NULL'} (${item.ubi_actual_desc || 'Sin desc'})`,
        ubi_despues: `${newCode} (${newDesc})`
      });

      if (isApply) {
        // Verificar si la ubicación ya existe en ubicaciones_bodega para esta categoría
        let ubiId;
        const existUbi = await client.query(`
          SELECT id FROM ubicaciones_bodega 
          WHERE codigo_ubicacion = $1 AND descripcion = $2 AND bodega = 'Principal'
          LIMIT 1
        `, [newCode, newDesc]);

        if (existUbi.rows.length > 0) {
          ubiId = existUbi.rows[0].id;
        } else {
          const insertUbi = await client.query(`
            INSERT INTO ubicaciones_bodega (codigo_ubicacion, descripcion, activo, bodega)
            VALUES ($1, $2, true, 'Principal')
            RETURNING id
          `, [newCode, newDesc]);
          ubiId = insertUbi.rows[0].id;
        }

        // Actualizar el producto en inventario
        await client.query(`
          UPDATE inventario 
          SET ubicacion_id = $1 
          WHERE id = $2
        `, [ubiId, item.id]);
      }
    }

    if (isApply) {
      // Actualizar el contador en catalogo_categorias
      await client.query(`
        UPDATE catalogo_categorias
        SET ultimo_consecutivo_ubicacion = $1
        WHERE id = $2
      `, [items.length, categoria.id]);

      await client.query('COMMIT');
      console.log(`\n✅ Corrección aplicada exitosamente. ${items.length} productos actualizados a ubicaciones 001..${String(items.length).padStart(3, '0')}.`);
      console.log(`✅ Contador de categoría actualizado a ${items.length}.`);
    } else {
      await client.query('ROLLBACK');
      console.log('\n--- MUESTRA DEL PLAN DE REASIGNACIÓN (Primeros 15 ítems) ---');
      console.table(preview.slice(0, 15));
      console.log(`... y ${items.length - 15} ítems más que recibirán de forma correlativa hasta ${String(items.length).padStart(3, '0')}.`);
      console.log('\n--- MUESTRA DEL PLAN DE REASIGNACIÓN (Últimos 5 ítems) ---');
      console.table(preview.slice(-5));
      console.log(`\n🔒 MODO DRY-RUN: Ningún cambio fue persistido en la base de datos.`);
    }

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Error en ejecución del script:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
