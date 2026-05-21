import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({path: '.env'});

const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();

try {
  const res = await c.query(`
    INSERT INTO ubicaciones_bodega 
    (prefijo_id, nivel_id, orientacion, nueva_posicion, descripcion) 
    VALUES ($1, $2, $3, $4, $5) 
    RETURNING *
  `, [
    'd908883c-77f4-4f29-b24c-9cb57b6af1e5', // EST
    'ae0e4794-0b9d-431b-b93b-8435fc2e5fb5', // N1
    'TEST',
    '99',
    'Prueba Manual'
  ]);
  console.log('SUCCESS:', res.rows[0]);
} catch (e) {
  console.error('ERROR:', e.message);
  console.error('DETAIL:', e.detail);
} finally {
  await c.end();
}
process.exit(0);
