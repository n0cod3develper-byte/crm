import 'dotenv/config';
import axios from 'axios';

async function run() {
  try {
    const resAuth = await axios.post('http://localhost:4000/api/v1/auth/login', {
      email: 'admin@cargarsas.com',
      password: 'admin' // I'll assume admin password is known or try to bypass
    });
    console.log("Logged in");
  } catch (err) {
    console.log("Login failed");
  }
}
run();
