import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// All catalogo_servicios names
const r1 = await pool.query("SELECT id, codigo, nombre, tipo_servicio FROM catalogo_servicios ORDER BY nombre");
console.log('--- catalogo_servicios ---');
r1.rows.forEach(r => console.log(`${r.codigo} | ${r.nombre} | tipo: ${r.tipo_servicio}`));

// Check remisiones with their catalogo_servicio nombre
const r2 = await pool.query(`
  SELECT r.numero_remision, cs.nombre as servicio_nombre, cs.codigo,
         r.cantidad_horas, r.estado, 
         COALESCE(e.marca || ' - ' || e.serie, 'Sin Equipo') as equipo
  FROM remisiones r
  LEFT JOIN catalogo_servicios cs ON cs.id = r.catalogo_servicio_id
  LEFT JOIN equipos e ON e.id = r.equipo_id
  WHERE r.deleted_at IS NULL AND r.estado = 'FACTURADA'
  ORDER BY cs.nombre
`);
console.log('\n--- Remisiones FACTURADAS con tipo servicio ---');
r2.rows.forEach(r => console.log(`Rem: ${r.numero_remision} | equipo: ${r.equipo} | servicio: ${r.servicio_nombre} | horas: ${r.cantidad_horas}`));

// Check if nombre contains "COMBUSTIBLE" pattern
const r3 = await pool.query(`
  SELECT cs.nombre, 
         CASE WHEN cs.nombre ILIKE '%CON COMBUSTIBLE%' THEN 'CON COMBUSTIBLE' ELSE 'SIN COMBUSTIBLE' END as tipo_comb,
         COUNT(r.id) as total
  FROM remisiones r
  JOIN catalogo_servicios cs ON cs.id = r.catalogo_servicio_id
  WHERE r.deleted_at IS NULL AND r.estado = 'FACTURADA'
  GROUP BY cs.nombre
  ORDER BY cs.nombre
`);
console.log('\n--- Agrupado por servicio con flag combustible ---');
r3.rows.forEach(r => console.log(`${r.tipo_comb} | ${r.nombre} | total: ${r.total}`));

await pool.end();
