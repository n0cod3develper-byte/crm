// Test the actual API endpoint with the same data the frontend sends
const API = 'http://localhost:3001/api/v1';

// 1. Login to get a token
const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'auxsistemas@cargar.com.co', password: 'Cargar2026*' })
});
const loginData = await loginRes.json();
console.log('Login status:', loginRes.status);

if (!loginData.token && !loginData.data?.token) {
  console.log('Login response:', JSON.stringify(loginData, null, 2));
  // Try to find token in response
  const token = loginData.accessToken || loginData.access_token;
  if (!token) {
    console.error('Cannot find token in login response');
    process.exit(1);
  }
}

const token = loginData.token || loginData.data?.token || loginData.accessToken;
console.log('Token obtained:', token ? 'YES' : 'NO');

// 2. POST to /catalogo with the EXACT same data the frontend sends (including "admin" as responsable_id)
const body = {
  tipo: 'PRODUCTO',
  codigo_interno: '',
  name: 'Test Fix UUID',
  nombre_comercial: 'Test Fix UUID Comercial',
  categoria_id: '',        // empty string - should become null
  unidad_medida_id: '',    // empty string - should become null
  unit_cost: 0,
  unit_price: 50000,
  stock_current: 5,
  stock_minimum: 1,
  precio_servicio: 0,
  precio_servicio_minimo: 0,
  unidad_cobro: 'hora',
  aplica_iva: true,
  iva_pct: 19,
  ubicacion_id: '',        // empty string - should become null
  marca: 'Test',
  imagen_url: '',
  tipo_repuesto: 'N/A',
  responsable_id: 'admin', // THIS IS THE BUG - "admin" is not a valid UUID
  referencia_cruzada: [],
  equipos_compatibles: []
};

console.log('\nSending POST /catalogo with responsable_id="admin"...');
const res = await fetch(`${API}/catalogo`, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(body)
});

const data = await res.json();
console.log('Response status:', res.status);
console.log('Response:', JSON.stringify(data, null, 2));

if (res.status === 201) {
  console.log('\n✅ FIX WORKS! Item created successfully despite "admin" as responsable_id');
  // Clean up test item
  const delRes = await fetch(`${API}/catalogo/${data.data.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Cleanup:', delRes.status);
} else {
  console.log('\n❌ FIX FAILED - still getting error');
}

process.exit(0);
