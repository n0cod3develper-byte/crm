import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';
const { Pool } = pg;
const p = new Pool({connectionString: process.env.DATABASE_URL});
async function run() {
  try {
    const r1 = await p.query(`
      SELECT COUNT(*)::int AS total_remisiones, COALESCE(SUM(cantidad_horas), 0) AS horas_alquilado FROM remisiones WHERE equipo_id = $1 AND deleted_at IS NULL AND estado IN ('REALIZADA', 'LIQUIDADA', 'FACTURADA') AND cantidad_horas IS NOT NULL AND cantidad_horas > 0
    `, ['863f3f15-6a40-4987-9f1c-547bf1af0ef2']);
    console.table(r1.rows);
    const r2 = await p.query(`
      SELECT COUNT(*)::int AS total_ots_taller, COALESCE(SUM(EXTRACT(EPOCH FROM (fecha_hora_salida_taller - fecha_hora_ingreso_taller)) / 3600), 0) AS horas_taller FROM ordenes_trabajo WHERE equipo_id = $1 AND deleted_at IS NULL AND fecha_hora_ingreso_taller IS NOT NULL AND fecha_hora_salida_taller IS NOT NULL
    `, ['863f3f15-6a40-4987-9f1c-547bf1af0ef2']);
    console.table(r2.rows);
  } catch (e) {
    console.error(e);
  } finally {
    p.end();
  }
}
run();
