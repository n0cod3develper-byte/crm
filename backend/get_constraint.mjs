import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';
const { Pool } = pg;
const p = new Pool({connectionString: process.env.DATABASE_URL});
p.query("SELECT conname FROM pg_constraint WHERE conrelid = 'factura_remisiones'::regclass AND contype = 'u'").then(r => { console.table(r.rows); p.end(); }).catch(console.error);
