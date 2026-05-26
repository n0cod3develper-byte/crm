import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const toUuid = (v) => {
  if (!v || typeof v !== 'string') return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null;
};

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

// Exact same data the frontend sends
const data = {
  tipo: 'PRODUCTO',
  responsable_id: 'admin',      // ← invalid UUID
  categoria_id: '',              // ← empty string
  unidad_medida_id: '',          // ← empty string
  ubicacion_id: '',              // ← empty string
};

console.log('=== toUuid() validation ===');
console.log('responsable_id "admin" →', toUuid(data.responsable_id));
console.log('categoria_id ""       →', toUuid(data.categoria_id));
console.log('ubicacion_id ""       →', toUuid(data.ubicacion_id));
console.log('valid UUID             →', toUuid('cd87f065-25d7-40c3-bbdb-9db840e1bb70'));

// Now test the actual INSERT with sanitized values
try {
  const sql = `
    INSERT INTO inventario (
      tipo, codigo_interno, name, nombre_comercial, categoria_id, unidad_medida_id,
      costo_reposicion, unit_price, stock_actual, stock_minimum,
      precio_servicio, precio_servicio_minimo, unidad_cobro,
      aplica_iva, iva_pct, es_destacado, marca, ubicacion_id,
      tipo_repuesto, responsable_id, referencia_cruzada, equipos_compatibles,
      created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
    RETURNING id, codigo_interno, responsable_id, categoria_id
  `;
  const res = await c.query(sql, [
    'PRODUCTO',
    'TEST-UUID-FIX-001',
    'Test UUID Fix',
    'Test UUID Fix',
    toUuid(data.categoria_id),       // null
    toUuid(data.unidad_medida_id),   // null
    0, 50000, 5, 1, 0, 0, 'hora',
    true, 19, false, 'Test', 
    toUuid(data.ubicacion_id),       // null
    'N/A',
    toUuid(data.responsable_id),     // null (was "admin")
    '[]', '[]',
    'cd87f065-25d7-40c3-bbdb-9db840e1bb70'
  ]);
  console.log('\n✅ INSERT SUCCESS:', res.rows[0]);
  
  // Cleanup
  await c.query('DELETE FROM inventario WHERE id = $1', [res.rows[0].id]);
  console.log('✅ Cleanup done');
} catch (e) {
  console.error('\n❌ INSERT FAILED:', e.message);
}

await c.end();
process.exit(0);
