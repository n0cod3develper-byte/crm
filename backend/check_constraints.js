import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://crm_user:crm_dev_password@localhost:5434/cargar_crm' });
pool.query("SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='remisiones'::regclass AND contype='c';")
  .then(res => { console.log(res.rows); pool.end(); })
  .catch(console.error);
