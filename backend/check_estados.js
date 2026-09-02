import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const res = await pool.query('SELECT id, consecutivo, estado FROM ordenes_trabajo');
  console.log('Estados encontrados:', [...new Set(res.rows.map(r => r.estado))]);
  console.log('Filas totales:', res.rows.length);
  for (const row of res.rows) {
    if (!['ABIERTA', 'EN_PROCESO', 'LIQUIDADA', 'CERRADA', 'LIQUIDADA_CORTE'].includes(row.estado)) {
      console.log('Fila con estado no permitido:', row);
    }
  }
} catch (err) {
  console.error(err);
} finally {
  await pool.end();
}
