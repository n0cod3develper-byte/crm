import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const r = await pool.query(`SELECT r.numero_maquina, e.numero_equipo, e.serial, e.serie FROM remisiones r JOIN equipos e ON e.id = r.equipo_id WHERE r.numero_remision IN ('33292', '33301', '33300') ORDER BY r.numero_remision DESC`);
console.log(r.rows);
await pool.end();
