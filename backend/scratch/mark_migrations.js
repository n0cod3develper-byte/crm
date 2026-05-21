import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({path: '.env'});

const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();
try {
  await c.query("INSERT INTO _migrations (filename) VALUES ('019_inventory_movement_upgrade.sql') ON CONFLICT DO NOTHING");
  await c.query("INSERT INTO _migrations (filename) VALUES ('020_clerk_user_id_nullable.sql') ON CONFLICT DO NOTHING");
  console.log('019 and 020 marked as applied');
} catch (e) {
  console.error(e);
}
process.exit(0);
