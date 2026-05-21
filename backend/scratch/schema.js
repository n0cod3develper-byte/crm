const { Client } = require('pg');
require('dotenv').config({path: '.env'});
const c = new Client({connectionString: process.env.DATABASE_URL});
c.connect()
  .then(() => c.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('inventario', 'inventory_items')"))
  .then(res => {
    console.log(res.rows);
    process.exit(0);
  });
