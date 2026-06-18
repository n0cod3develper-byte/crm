import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:crm_dev_password@localhost:5434/cargar_crm' });
async function check() {
  const res = await pool.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('inventario', 'catalogo_servicios')");
  console.log(res.rows);
  pool.end();
}
check().catch(console.error);
