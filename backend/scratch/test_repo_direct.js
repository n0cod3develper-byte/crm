import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { CatalogRepository } from '../src/modules/inventory/catalog.repository.js';

const repo = new CatalogRepository();

const frontendData = {
  tipo: 'PRODUCTO',
  codigo_interno: '',
  name: 'TEST-UUID-FIX',
  nombre_comercial: 'Test Fix UUID',
  categoria_id: '',
  unidad_medida_id: '',
  costo_reposicion: 0,
  unit_price: 50000,
  stock_actual: 5,
  stock_minimum: 1,
  precio_servicio: 0,
  precio_servicio_minimo: 0,
  unidad_cobro: 'hora',
  aplica_iva: true,
  iva_pct: 19,
  ubicacion_id: '',
  marca: 'TestBrand',
  tipo_repuesto: 'N/A',
  responsable_id: 'admin',   // ← THE BUG
  referencia_cruzada: [],
  equipos_compatibles: []
};

const userId = 'cd87f065-25d7-40c3-bbdb-9db840e1bb70';

try {
  console.log('Testing with responsable_id="admin"...');
  const result = await repo.create(frontendData, userId);
  console.log('✅ SUCCESS! Created:', result.id, result.codigo_interno);
  const { query } = await import('../src/config/database.js');
  await query('DELETE FROM inventario WHERE id = $1', [result.id]);
  console.log('✅ Cleanup done');
} catch (err) {
  console.error('❌ FAILED:', err.message);
}
process.exit(0);
