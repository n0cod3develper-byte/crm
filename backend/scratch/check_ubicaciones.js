import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({path: '.env'});

const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
const res = await c.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_name = 'ubicaciones_bodega'");
console.log(JSON.stringify(res.rows, null, 2));
process.exit(0);
