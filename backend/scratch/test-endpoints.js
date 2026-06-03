import 'dotenv/config';
import axios from 'axios';

async function test() {
  // 1. Login
  const loginRes = await axios.post('http://localhost:4000/api/v1/auth/login', {
    email: 'admin@cargar.com',
    password: 'Admin2026!'
  }, { withCredentials: true });
  
  const cookies = loginRes.headers['set-cookie'];
  const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
  
  // 2. /auth/me
  const meRes = await axios.get('http://localhost:4000/api/v1/auth/me', {
    headers: { Cookie: cookieHeader }
  });
  console.log('=== /auth/me ===');
  console.log(JSON.stringify(meRes.data, null, 2));
  
  // 3. /me/permisos
  const permisosRes = await axios.get('http://localhost:4000/api/v1/me/permisos', {
    headers: { Cookie: cookieHeader }
  });
  console.log('\n=== /me/permisos ===');
  console.log(JSON.stringify(permisosRes.data, null, 2));
}

test().catch(err => {
  console.error('ERROR:', err.response?.status, err.response?.data);
});
