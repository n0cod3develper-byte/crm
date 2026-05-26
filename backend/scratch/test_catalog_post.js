import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({path: '.env'});

const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();

try {
  const res = await c.query(`
    INSERT INTO inventario (
      tipo, codigo_interno, name, nombre_comercial, categoria_id, unidad_medida_id,
      costo_reposicion, unit_price, stock_actual, stock_minimum,
      precio_servicio, precio_servicio_minimo, unidad_cobro,
      aplica_iva, iva_pct, es_destacado, marca, ubicacion_id,
      tipo_repuesto, responsable_id, referencia_cruzada, equipos_compatibles,
      created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
    RETURNING *
  `, [
    'PRODUCTO',
    'TEST-ITEM-99',
    'Item de Prueba',
    'Bomba de Prueba',
    null, // categoria
    null, // unidad
    100, 200, 5, 1, // costos y stock
    0, 0, 'und', // servicio
    true, 19, false, // iva, destacado
    'MARCA TEST',
    null, // ubicacion
    'OEM',
    null, // responsable
    '[]', '[]', // jsonb
    '89019685-6188-466d-97e3-0863004b50c0' // un id de usuario cualquiera
  ]);
  console.log('SUCCESS:', res.rows[0]);
} catch (e) {
  console.error('ERROR:', e.message);
  console.error('DETAIL:', e.detail);
} finally {
  await c.end();
}
process.exit(0);
