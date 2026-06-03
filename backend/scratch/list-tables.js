import 'dotenv/config';
import pg from 'pg';
import { env } from '../src/config/env.js';

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

const r = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
r.rows.forEach(x => console.log(x.tablename));

await pool.end();
