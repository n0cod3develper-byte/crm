import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { env } from './src/config/env.js';
import axios from 'axios';

async function test() {
  // Generate a valid token for an admin user
  // Let's assume user ID 1 exists or I can fetch the user ID of the admin from the DB
  import { query, checkConnection } from './src/config/database.js';
  await checkConnection();
  
  const userRes = await query('SELECT id FROM users LIMIT 1', []);
  if (userRes.rows.length === 0) {
    console.log("No users found");
    process.exit(1);
  }
  const userId = userRes.rows[0].id;
  
  const token = jwt.sign(
    { sub: userId, type: 'access' },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  try {
    const res = await axios.put('http://localhost:4000/api/v1/servicios/beda58c4-fc9a-47f1-97a2-8b0fa1d4b3ab', {
      estado: 'REALIZADA'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log("STATUS:", res.status);
    console.log("DATA:", res.data);
  } catch (err) {
    console.error("AXIOS ERROR:", err.response ? err.response.data : err.message);
  }
  process.exit();
}
test();
