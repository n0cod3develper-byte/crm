import 'dotenv/config';
import axios from 'axios';

async function test() {
  try {
    const res = await axios.post('http://localhost:4000/api/v1/auth/login', {
      email: 'admin@cargar.com',
      password: 'Admin2026!'
    });
    console.log('SUCCESS:', res.data);
    console.log('HEADERS:', res.headers);
  } catch (err) {
    console.error('ERROR status:', err.response?.status);
    console.error('ERROR data:', JSON.stringify(err.response?.data, null, 2));
  }
}

test();
