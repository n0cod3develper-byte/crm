import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:crm_dev_password@localhost:5434/cargar_crm' });
async function update() {
  const res = await pool.query("UPDATE equipos SET tipo_equipo = 'MONTACARGAS' WHERE tipo_equipo = 'Montacargas contrabalanceo'");
  console.log(res.rowCount);
  pool.end();
}
update().catch(console.error);
