import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:crm_dev_password@localhost:5434/cargar_crm' });
const res = await pool.query(`SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conname LIKE '%equipo%'`);
console.log(JSON.stringify(res.rows, null, 2));
await pool.end();
