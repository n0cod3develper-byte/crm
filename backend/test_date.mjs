import 'dotenv/config';
import { query } from './src/config/database.js';

async function test() {
  const sql = "UPDATE facturas SET fecha_factura = $1 WHERE id = '623c98f5-ce7c-4390-8cd0-c894b04b688f' RETURNING fecha_factura, fecha_factura::text";
  
  const res = await query(sql, ['2026-08-18']);
  console.log('Saved with string:', res.rows[0]);

  const res2 = await query(sql, [new Date('2026-08-18')]);
  console.log('Saved with Date UTC:', res2.rows[0]);
  
  process.exit(0);
}

test();
