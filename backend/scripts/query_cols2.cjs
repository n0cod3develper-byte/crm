const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:crm_dev_password@localhost:5434/cargar_crm' });
c.connect().then(() => {
  c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'equipos'")
    .then(res => { console.log(res.rows); c.end(); })
    .catch(console.error);
});
