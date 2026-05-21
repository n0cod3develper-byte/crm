import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({path: '.env'});

const c = new pg.Client({connectionString: process.env.DATABASE_URL});
await c.connect();

try {
  // Datos similares a los que enviaría el frontend
  const data = {
    tipo: 'PRODUCTO',
    codigo_interno: 'PROD-LOG-TEST-001',
    name: 'Nombre Interno Test',
    nombre_comercial: 'Nombre Comercial Test',
    categoria_id: '5c641b88-f5a7-4667-b914-4a6571a3cd13',
    unidad_medida_id: '328353e2-13f7-4dfb-a761-37bc4dc11934',
    costo_reposicion: 50000,
    unit_price: 75000,
    stock_actual: 10,
    stock_minimum: 2,
    aplica_iva: true,
    iva_pct: 19,
    marca: 'TEST LOG BRAND',
    ubicacion_id: '20023858-73da-48f0-8b41-b8ad6eb08b3f',
    tipo_repuesto: 'GENERICO',
    responsable_id: 'd27f0a78-ad2e-47a9-836c-edd47c2f6020',
    referencia_cruzada: ["REF1", "REF2"],
    equipos_compatibles: ["EQUIPO1"]
  };

  const userId = 'd27f0a78-ad2e-47a9-836c-edd47c2f6020';

  console.log('Testing INSERT with data:', data);

  const sql = `
    INSERT INTO inventario (
      tipo, codigo_interno, name, nombre_comercial, categoria_id, unidad_medida_id,
      costo_reposicion, unit_price, stock_actual, stock_minimum,
      precio_servicio, precio_servicio_minimo, unidad_cobro,
      aplica_iva, iva_pct, es_destacado, marca, ubicacion_id,
      tipo_repuesto, responsable_id, referencia_cruzada, equipos_compatibles,
      created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
    RETURNING *
  `;
  
  const res = await c.query(sql, [
    data.tipo,
    data.codigo_interno,
    data.name,
    data.nombre_comercial,
    data.categoria_id,
    data.unidad_medida_id,
    data.costo_reposicion ?? 0,
    data.unit_price ?? 0,
    data.stock_actual ?? 0,
    data.stock_minimum ?? 0,
    data.precio_servicio ?? 0,
    data.precio_servicio_minimo ?? 0,
    data.unidad_cobro || null,
    data.aplica_iva ?? true,
    data.iva_pct ?? 19,
    data.es_destacado ?? false,
    data.marca || null,
    data.ubicacion_id || null,
    data.tipo_repuesto || 'N/A',
    data.responsable_id || null,
    JSON.stringify(data.referencia_cruzada || []),
    JSON.stringify(data.equipos_compatibles || []),
    userId,
  ]);
  
  console.log('SUCCESS:', res.rows[0]);
} catch (e) {
  console.error('ERROR:', e.message);
  console.error('DETAIL:', e.detail);
  console.error('STACK:', e.stack);
} finally {
  await c.end();
}
process.exit(0);
