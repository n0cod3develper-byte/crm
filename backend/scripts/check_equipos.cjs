const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:crm_dev_password@localhost:5434/cargar_crm' });
c.connect().then(() => {
  c.query("SELECT id, marca, modelo, serial, numero_equipo, serie FROM equipos")
    .then(res => { console.table(res.rows); c.end(); })
    .catch(console.error);
});
