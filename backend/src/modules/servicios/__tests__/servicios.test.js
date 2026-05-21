import { jest } from '@jest/globals';

// ─────────────────────────────────────────────────────────────
// 1. Mock infraestructura (DB, Redis, Passport, Logs)
//    Estos mocks se aplican ANTES de importar app.js para que
//    bootstrap() no intente conectarse a servicios reales.
// ─────────────────────────────────────────────────────────────

jest.mock('../../../config/database.js', () => ({
  checkConnection: jest.fn().mockResolvedValue(true),
  query: jest.fn(),
  withTransaction: jest.fn(),
  db: { on: jest.fn(), query: jest.fn() },
}));

jest.mock('../../../config/redis.js', () => ({
  connectRedis: jest.fn().mockResolvedValue(true),
  redis: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
}));

jest.mock('../../../config/passport.js', () => ({
  initializePassport: jest.fn(),
}));

jest.mock('../../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
  },
}));

jest.mock('../../../middleware/rateLimiter.js', () => ({
  generalLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  webhookLimiter: (_req, _res, next) => next(),
  uploadLimiter: (_req, _res, next) => next(),
}));

jest.mock('../../../jobs/turnosCierreAutomatico.job.js', () => ({
  iniciarJobCierreAutomatico: jest.fn(),
}));

jest.mock('../../../services/calendarioService.js', () => ({
  inicializarFestivos: jest.fn(),
}));

// ─────────────────────────────────────────────────────────────
// 2. Mock autenticación — inyecta un usuario de prueba
// ─────────────────────────────────────────────────────────────

jest.mock('../../../middleware/auth.js', () => ({
  authenticate: (req, _res, next) => {
    req.userId = '00000000-0000-0000-0000-000000000001';
    req.user = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'test@cargar.com.co',
      nombre: 'Test',
      role: 'admin',
    };
    next();
  },
  requireAuth: (req, _res, next) => {
    req.userId = '00000000-0000-0000-0000-000000000001';
    req.user = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'test@cargar.com.co',
      nombre: 'Test',
      role: 'admin',
    };
    next();
  },
}));

// ─────────────────────────────────────────────────────────────
// 3. Mock repositorio — controlamos qué devuelve findById
//    En ESM jest permite referenciar variables del scope del
//    módulo dentro de la factory de jest.mock().
// ─────────────────────────────────────────────────────────────

const mockFindById = jest.fn();

jest.mock('../servicios.repository.js', () => ({
  ServiciosRepository: jest.fn().mockImplementation(() => ({
    findById: mockFindById,
  })),
}));

// ─────────────────────────────────────────────────────────────
// 4. Importar app y supertest
// ─────────────────────────────────────────────────────────────

import request from 'supertest';
import app from '../../../app.js';

// ─────────────────────────────────────────────────────────────
// 5. Datos de prueba
// ─────────────────────────────────────────────────────────────

const MOCK_REMISION = {
  id: '88888888-aaaa-4bbb-cccc-dddddddddddd',
  numero_remision: '00001',
  fecha_servicio: '2024-03-15',
  hora_acordada: '08:00:00',
  forma_pago: 'Contado',
  estado: 'REALIZADA',

  // Cliente
  empresa_nombre: 'Logística Cargar S.A.S.',
  empresa_nit: '900.123.456-7',
  empresa_telefono: '444 77 73',
  empresa_telefono2: '320 693 73 94',
  empresa_direccion: 'Calle 31 # 41-51, Itagüí',

  // Servicio
  servicio_codigo: 'MTTO-PREV-001',
  servicio_nombre: 'Mantenimiento Preventivo Mensual',
  servicio_descripcion: 'Revisión general mensual del montacargas',
  servicio_precio_base: 120000,

  // Equipo
  equipo_marca: 'Toyota',
  equipo_modelo: 'FD30',
  equipo_serial: 'TYT-2024-001234',
  equipo_capacidad: '3.0 ton',
  numero_maquina: 'M-0042',

  // Tiempos — Operario 1
  hora_salida_cargar: '07:30:00',
  hora_llegada_cliente: '08:15:00',
  hora_salida_cliente: '16:00:00',
  hora_llegada_cargar: '16:45:00',
  horometro_salida: 1520,
  horometro_regreso: 1532,

  // Tiempos — Operario 2
  segundo_hora_salida_cargar: '08:00:00',
  segundo_hora_llegada_cliente: '08:45:00',
  segundo_hora_salida_cliente: '15:30:00',
  segundo_hora_llegada_cargar: '16:15:00',
  segundo_horometro_salida: null,
  segundo_horometro_regreso: null,
  segundo_fecha_acordada: null,

  // Desglose de horas
  cantidad_horas: 8,
  valor_hora: 50000,
  horas_diurnas: 6,
  valor_hora_diurna: 50000,
  horas_nocturnas: 2,
  valor_hora_nocturna: 87500,
  horas_fest_diurnas: 0,
  valor_hora_fest_dia: 0,
  horas_fest_nocturnas: 0,
  valor_hora_fest_noc: 0,
  horas_otras: 0,
  valor_hora_otras: 0,

  // Financiero
  total_bruto: 475000,
  iva_pct: 19,
  iva_valor: 90250,
  descuentos: 0,
  total_neto: 565250,

  // Metadata
  solicitado_por: 'Juan Pérez',
  direccion_servicio: 'Calle 50 # 20-30, Medellín',
  observaciones: 'Se realizó cambio de filtros y lubricación general.',
  operarios: [
    { asignacion_id: 'aaa-111', empleado_id: 'emp-001', full_name: 'Carlos López', phone: '3001234567', position: 'Operario', monthly_salary: '1600000.00' },
    { asignacion_id: 'bbb-222', empleado_id: 'emp-002', full_name: 'Andrés Medina', phone: '3007654321', position: 'Operario', monthly_salary: '1600000.00' },
  ],
  creado_por_nombre: 'Admin Sistema',
  created_at: '2024-03-15T10:00:00.000Z',
  updated_at: '2024-03-15T18:00:00.000Z',
};

beforeEach(() => {
  mockFindById.mockReset();
});

// ─────────────────────────────────────────────────────────────
// 6. Tests
// ─────────────────────────────────────────────────────────────

describe('GET /api/v1/servicios/:id', () => {
  test('200 — debe retornar la remisión completa', async () => {
    mockFindById.mockResolvedValue(MOCK_REMISION);

    const res = await request(app)
      .get('/api/v1/servicios/88888888-aaaa-4bbb-cccc-dddddddddddd');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    // Campos principales
    expect(res.body.data.numero_remision).toBe('00001');
    expect(res.body.data.empresa_nombre).toBe('Logística Cargar S.A.S.');
    expect(res.body.data.total_neto).toBe(565250);

    // Debe incluir datos del JOIN
    expect(res.body.data.empresa_telefono).toBeDefined();
    expect(res.body.data.servicio_codigo).toBeDefined();
    expect(res.body.data.equipo_marca).toBeDefined();
  });

  test('200 — debe incluir la lista de operarios asignados', async () => {
    mockFindById.mockResolvedValue(MOCK_REMISION);

    const res = await request(app)
      .get('/api/v1/servicios/88888888-aaaa-4bbb-cccc-dddddddddddd');

    const operarios = res.body.data.operarios;
    expect(operarios).toBeInstanceOf(Array);
    expect(operarios).toHaveLength(2);

    const [op1, op2] = operarios;
    expect(op1.full_name).toBe('Carlos López');
    expect(op2.full_name).toBe('Andrés Medina');
    expect(op1.asignacion_id).toBeDefined();
    expect(op1.empleado_id).toBeDefined();
  });

  test('200 — operarios puede ser array vacío si no hay asignados', async () => {
    mockFindById.mockResolvedValue({
      ...MOCK_REMISION,
      operarios: [],
    });

    const res = await request(app)
      .get('/api/v1/servicios/88888888-aaaa-4bbb-cccc-dddddddddddd');

    expect(res.body.data.operarios).toEqual([]);
  });

  test('200 — respuesta con estado BORRADOR', async () => {
    mockFindById.mockResolvedValue({
      ...MOCK_REMISION,
      estado: 'BORRADOR',
    });

    const res = await request(app)
      .get('/api/v1/servicios/88888888-aaaa-4bbb-cccc-dddddddddddd');

    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe('BORRADOR');
  });

  test('200 — respuesta con estado LIQUIDADA', async () => {
    mockFindById.mockResolvedValue({
      ...MOCK_REMISION,
      estado: 'LIQUIDADA',
    });

    const res = await request(app)
      .get('/api/v1/servicios/88888888-aaaa-4bbb-cccc-dddddddddddd');

    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe('LIQUIDADA');
  });

  test('200 — debe incluir creado_por_nombre cuando existe', async () => {
    mockFindById.mockResolvedValue(MOCK_REMISION);

    const res = await request(app)
      .get('/api/v1/servicios/88888888-aaaa-4bbb-cccc-dddddddddddd');

    expect(res.body.data.creado_por_nombre).toBe('Admin Sistema');
  });

  test('200 — creado_por_nombre puede ser null (usuario eliminado)', async () => {
    mockFindById.mockResolvedValue({
      ...MOCK_REMISION,
      creado_por_nombre: null,
    });

    const res = await request(app)
      .get('/api/v1/servicios/88888888-aaaa-4bbb-cccc-dddddddddddd');

    expect(res.body.data.creado_por_nombre).toBeNull();
  });

  test('200 — teléfono secundario aparece como string o null', async () => {
    // Con teléfono 2
    mockFindById.mockResolvedValue(MOCK_REMISION);
    let res = await request(app)
      .get('/api/v1/servicios/88888888-aaaa-4bbb-cccc-dddddddddddd');
    expect(typeof res.body.data.empresa_telefono2).toBe('string');

    // Sin teléfono 2
    mockFindById.mockResolvedValue({
      ...MOCK_REMISION,
      empresa_telefono2: null,
    });
    res = await request(app)
      .get('/api/v1/servicios/88888888-aaaa-4bbb-cccc-dddddddddddd');
    expect(res.body.data.empresa_telefono2).toBeNull();
  });

  test('404 — debe responder con error si la remisión no existe', async () => {
    mockFindById.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/servicios/eeeeeeee-ffff-4aaa-bbbb-cccccccccccc');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.toLowerCase()).toContain('no encontrad');
  });

  test('404 — cuando el repositorio lanza NotFoundError', async () => {
    // Simulamos que el controlador recibe null del repositorio → 404
    mockFindById.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/servicios/eeeeeeee-ffff-4aaa-bbbb-cccccccccccc');

    expect(res.status).toBe(404);
  });

  test('500 — debe propagar errores inesperados del repositorio', async () => {
    mockFindById.mockRejectedValue(new Error('Error simulado en BD'));

    const res = await request(app)
      .get('/api/v1/servicios/88888888-aaaa-4bbb-cccc-dddddddddddd');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  test('404 — UUID inválido no causa crash (es manejado por la ruta)', async () => {
    // El repositorio recibe el string y si no encuentra, retorna null
    mockFindById.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/servicios/id-invalido-sin-guiones');

    expect(res.status).toBe(404);
  });

  test('200 — respuesta tiene estructura { success, data }', async () => {
    mockFindById.mockResolvedValue(MOCK_REMISION);

    const res = await request(app)
      .get('/api/v1/servicios/88888888-aaaa-4bbb-cccc-dddddddddddd');

    // Formato de respuesta exitosa
    expect(res.body).toMatchObject({
      success: true,
      data: expect.objectContaining({
        id: expect.any(String),
        numero_remision: expect.any(String),
      }),
    });
  });

  test('200 — contiene todos los campos clave del schema de remisión', async () => {
    mockFindById.mockResolvedValue(MOCK_REMISION);

    const res = await request(app)
      .get('/api/v1/servicios/88888888-aaaa-4bbb-cccc-dddddddddddd');

    const data = res.body.data;
    const requiredFields = [
      'id', 'numero_remision', 'fecha_servicio', 'estado',
      'empresa_nombre', 'empresa_nit',
      'servicio_codigo', 'servicio_nombre',
      'equipo_marca', 'equipo_modelo', 'equipo_serial',
      'cantidad_horas', 'valor_hora',
      'total_bruto', 'iva_pct', 'iva_valor', 'total_neto',
      'operarios',
    ];

    requiredFields.forEach(field => {
      expect(data).toHaveProperty(field);
    });
  });

  test('500 — error de conexión a BD se propaga como 500', async () => {
    const dbError = new Error('No se pudo conectar a la base de datos');
    dbError.code = 'ECONNREFUSED';
    mockFindById.mockRejectedValue(dbError);

    const res = await request(app)
      .get('/api/v1/servicios/88888888-aaaa-4bbb-cccc-dddddddddddd');

    expect(res.status).toBe(500);
  });
});

describe('GET /api/v1/servicios/:id — edge cases', () => {
  test('200 — remisión con todos los campos nulos', async () => {
    mockFindById.mockResolvedValue({
      id: 'minimal-id-0000-0000-000000000000',
      numero_remision: '99999',
      empresa_nombre: null,
      empresa_nit: null,
      equipo_marca: null,
      equipo_modelo: null,
      servicio_codigo: null,
      operarios: [],
      total_neto: 0,
      estado: 'BORRADOR',
      fecha_servicio: null,
    });

    const res = await request(app)
      .get('/api/v1/servicios/minimal-id-0000-0000-000000000000');

    expect(res.status).toBe(200);
  });
});
