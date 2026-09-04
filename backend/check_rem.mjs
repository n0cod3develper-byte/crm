import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Check tipo columns in inventario
const inv = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'inventario' AND column_name LIKE '%tipo%'`);
console.log('inventario tipo columns:', inv.rows);

// Check tipo columns in catalogo_servicios
const cs = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'catalogo_servicios' AND column_name LIKE '%tipo%'`);
console.log('catalogo_servicios tipo columns:', cs.rows);

// Sample item with tipo
const sample = await pool.query(`
  SELECT COALESCE(inv.tipo, cs.tipo_servicio) AS item_tipo, inv.tipo AS inv_tipo, cs.tipo_servicio AS cs_tipo,
         COALESCE(inv.nombre_comercial, cs.nombre) AS item_nombre
  FROM remision_servicios rs
  LEFT JOIN inventario inv ON inv.id = rs.catalogo_servicio_id
  LEFT JOIN catalogo_servicios cs ON cs.id = rs.catalogo_servicio_id
  LIMIT 5
`);
console.log('sample items:', sample.rows);

await pool.end();
