import { jest } from '@jest/globals';

// ─────────────────────────────────────────────────────────────
// 1. Mock infraestructura (DB, Redis, Passport, Logs)
//    Estos mocks se aplican ANTES de importar app.js para que
//    bootstrap() no intente conectarse a servicios reales.
// ─────────────────────────────────────────────────────────────

import * as realCp from 'child_process';
const cpMock = { ...realCp, execSync: jest.fn().mockReturnValue('') };
jest.unstable_mockModule('child_process', () => ({
  ...realCp,
  default: cpMock,
  execSync: cpMock.execSync,
}));

import * as realHttp from 'http';
jest.unstable_mockModule('http', () => ({
  ...realHttp,
  default: realHttp,
  createServer: jest.fn(() => ({
    listen: jest.fn((port, cb) => { if (typeof port === 'function') port(); else if (cb) cb(); }),
    close: jest.fn((cb) => { if (cb) cb(); }),
    on: jest.fn(),
  })),
}));

jest.unstable_mockModule('../../../config/database.js', () => ({
  checkConnection: jest.fn().mockResolvedValue(true),
  query: jest.fn(),
  withTransaction: jest.fn(),
  db: { on: jest.fn(), query: jest.fn() },
}));

jest.unstable_mockModule('../../../config/redis.js', () => ({
  connectRedis: jest.fn().mockResolvedValue(true),
  isRedisAvailable: jest.fn().mockReturnValue(false),
  redis: { get: jest.fn(), set: jest.fn(), del: jest.fn(), on: jest.fn() },
  redisConnection: { on: jest.fn() },
}));

jest.unstable_mockModule('../../../config/passport.js', () => ({
  initializePassport: jest.fn(),
}));

jest.unstable_mockModule('../../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
  },
}));

jest.unstable_mockModule('../../../middleware/rateLimiter.js', () => ({
  generalLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  webhookLimiter: (_req, _res, next) => next(),
  uploadLimiter: (_req, _res, next) => next(),
  certificadoLimiter: (_req, _res, next) => next(),
  searchLimiter: (_req, _res, next) => next(),
  resetPasswordLimiter: (_req, _res, next) => next(),
  dashboardGerenciaLimiter: (_req, _res, next) => next(),
}));

jest.unstable_mockModule('../../../jobs/turnosCierreAutomatico.job.js', () => ({
  iniciarJobCierreAutomatico: jest.fn(),
}));

jest.unstable_mockModule('../../../jobs/soatEmailNotifier.js', () => ({
  iniciarJobSoatEmail: jest.fn(),
}));

jest.unstable_mockModule('../../../jobs/cierreContableOT.job.js', () => ({
  iniciarJobCierreContableOT: jest.fn(),
}));

jest.unstable_mockModule('../../../jobs/emailCampanaJob.js', () => ({
  iniciarJobEnvioCampanas: jest.fn(),
}));

jest.unstable_mockModule('../../../jobs/emailRebotesJob.js', () => ({
  iniciarJobRebotes: jest.fn(),
}));

jest.unstable_mockModule('../../../services/calendarioService.js', () => ({
  inicializarFestivos: jest.fn().mockResolvedValue(),
  generarYGuardarFestivos: jest.fn().mockResolvedValue([]),
  calcularFechaVencimientoGracia: jest.fn().mockResolvedValue('2026-03-18'),
  esDiaEspecial: jest.fn().mockResolvedValue({ esFestivo: false }),
  generarFestivosAnio: jest.fn().mockReturnValue([]),
}));

jest.unstable_mockModule('../../../services/backupService.js', () => ({
  initBackupCronJob: jest.fn(),
}));

// ─────────────────────────────────────────────────────────────
// 2. Mock autenticación — inyecta un usuario de prueba
// ─────────────────────────────────────────────────────────────

jest.unstable_mockModule('../../../middleware/auth.js', () => ({
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
  authorize: () => (_req, _res, next) => next(),
  verificarPermiso: () => (_req, _res, next) => next(),
  soloAdmin: (_req, _res, next) => next(),
  obtenerPermisosUsuario: jest.fn().mockResolvedValue({ rol: { slug: 'admin' }, permisos: {} }),
  invalidarCacheUsuario: jest.fn(),
  invalidarTodoElCache: jest.fn(),
}));

// ─────────────────────────────────────────────────────────────
// 3. Mock repositorio — controlamos qué devuelve findById
// ─────────────────────────────────────────────────────────────

const mockFindById = jest.fn();
const mockUpdate = jest.fn();
const mockSoftDelete = jest.fn();

jest.unstable_mockModule('../servicios.repository.js', () => ({
  ServiciosRepository: jest.fn().mockImplementation(() => ({
    findById: mockFindById,
    update: mockUpdate,
    softDelete: mockSoftDelete,
  })),
}));

// ─────────────────────────────────────────────────────────────
// 4. Importar app y supertest (dinámico para Jest ESM)
// ─────────────────────────────────────────────────────────────

const { default: request } = await import('supertest');
const { default: app } = await import('../../../app.js');
const { buildRemisionHtml } = await import('../../../utils/remisionPdfGenerator.js');

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
  mockUpdate.mockReset();
  mockSoftDelete.mockReset();
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
    const errMsg = typeof res.body.error === 'string' ? res.body.error : res.body.error?.message;
    expect(errMsg.toLowerCase()).toContain('no encontrad');
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

// ─────────────────────────────────────────────────────────────
// 7. Pruebas de Invariante Matemático de Redondeo (Lógica CRM01)
// ─────────────────────────────────────────────────────────────
describe('Validación Invariante Matemático de Redondeo (Totales)', () => {
  // Replicamos la lógica exacta aprobada en Fase 3 para probar los límites
  const calcularFase3 = (ordMin, recMin, tarifaBase, recargoPct = 0.25) => {
    const totalMin = ordMin + recMin;
    const hTotal = Math.ceil((totalMin / 60) * 100) / 100;
    let hRec = Math.ceil((recMin / 60) * 100) / 100;
    let hOrd = parseFloat((hTotal - hRec).toFixed(2));
    if (hOrd < 0) hOrd = 0;

    // Cálculos Tabla (Top-Down)
    const valorHoraRecargo = tarifaBase * (1 + recargoPct);
    const subtotalOrd = Math.round(hOrd * tarifaBase);
    const subtotalRec = Math.round(hRec * valorHoraRecargo);
    const totalTabla = subtotalOrd + subtotalRec;

    // Cálculos Panel (Bottom-Up Financiero)
    const totalBrutoItems = Math.round(hTotal * tarifaBase);
    const recargoExtras = Math.round(hRec * (tarifaBase * recargoPct));
    const totalNetoPanel = totalBrutoItems + recargoExtras;

    return { hTotal, hOrd, hRec, totalTabla, totalNetoPanel };
  };

  test('Caso de referencia: 9,5h (570 min) exactas vs 6,4167 + 3,0833 — debe dar totales iguales', () => {
    // 385 min ordinarios, 185 min recargo = 570 min (9.5h exactas)
    const { totalTabla, totalNetoPanel, hOrd, hRec, hTotal } = calcularFase3(385, 185, 71000);
    expect(hTotal).toBe(9.50);
    expect(hOrd).toBe(6.41); // 9.50 - 3.09
    expect(hRec).toBe(3.09);
    
    expect(totalTabla).toBe(729348);
    expect(totalNetoPanel).toBe(729348);
    expect(totalTabla).toBe(totalNetoPanel); // El invariante se cumple
  });

  test('Varios operarios: horas sumadas sin recargo', () => {
    const { totalTabla, totalNetoPanel } = calcularFase3(480 * 2, 0, 50000); // 16 horas ordinarias
    expect(totalTabla).toBe(800000);
    expect(totalNetoPanel).toBe(800000);
  });

  test('Solo recargo: 0 ordinarias, 100% recargadas', () => {
    const { totalTabla, totalNetoPanel } = calcularFase3(0, 120, 71000); // 2h de recargo
    expect(totalTabla).toBe(177500); // 2 * (71000 * 1.25)
    expect(totalNetoPanel).toBe(177500);
  });

  test('Con IVA 19% y descuentos (Invariante completo)', () => {
    const res = calcularFase3(385, 185, 71000); // Caso referencia
    const iva = Math.round(res.totalNetoPanel * 0.19);
    const descuento = 50000;
    
    const totalFinalTabla = res.totalTabla + iva - descuento;
    const totalFinalPanel = res.totalNetoPanel + iva - descuento;
    
    expect(totalFinalTabla).toBe(totalFinalPanel);
    expect(totalFinalTabla).toBe(817924); // 729348 + 138576 - 50000
  });

  test('Límites de redondeo: suma de techos excediendo decimales', () => {
    // Escenario crítico: ord = 61 min (1.016 -> 1.02h), rec = 61 min (1.016 -> 1.02h)
    // total = 122 min (2.033 -> 2.04h)
    // Sin parche: 1.02 + 1.02 = 2.04 (coincide por suerte)
    // Escenario de desfase: ord = 40 (0.666 -> 0.67), rec = 40 (0.666 -> 0.67), total = 80 (1.333 -> 1.34)
    // 0.67 + 0.67 = 1.34h. 
    const { totalTabla, totalNetoPanel, hOrd, hRec, hTotal } = calcularFase3(40, 40, 50000);
    expect(hTotal).toBe(1.34);
    expect(hRec).toBe(0.67);
    expect(hOrd).toBe(0.67); // 1.34 - 0.67
    expect(totalTabla).toBe(totalNetoPanel);
  });
});

// ─────────────────────────────────────────────────────────────
// 8. Pruebas de Generación de PDF (buildRemisionHtml)
//    Garantiza que el PDF coincida al peso con la pantalla
// ─────────────────────────────────────────────────────────────
describe('Generación de PDF Remisión (buildRemisionHtml) — Valores y Totales', () => {
  test('Caso de referencia: $729.348 en tabla horario y TOTAL NETO coinciden exactamente', () => {
    const remisionRef = {
      numero_remision: '00123',
      fecha_servicio: '2026-03-15',
      empresa_nombre: 'Cliente Prueba S.A.S.',
      horas_ordinarias: 6.41,
      valor_hora_ordinaria: 71000,
      horas_recargo: 3.09,
      valor_hora_recargo: 88750,
      total_bruto: 674500,
      iva_valor: 0,
      descuentos: 0,
      total_neto: 729348,
      items: [
        { servicio_codigo: 'SERV-01', servicio_nombre: 'Servicio Montacargas', cantidad: 9.5, valor_unitario: 71000, unidad: 'hora' }
      ],
      operarios: [{ full_name: 'Operario 1', empleado_id: 'op-1' }]
    };

    const html = buildRemisionHtml(remisionRef, [], []);

    // 1. Debe incluir el subtotal ordinario redondeado: 6.41 * 71000 = 455.110
    expect(html).toContain('CO$ 455.110');
    // 2. Debe incluir el subtotal recargo redondeado: Math.round(3.09 * 88750) = 274.238 (NO 274.237,5)
    expect(html).toContain('CO$ 274.238');
    expect(html).not.toContain('274.237,5');
    // 3. El total de la tabla de horario debe ser 729.348 (NO 729.347,5)
    expect(html).toContain('CO$ 729.348');
    expect(html).not.toContain('729.347,5');
    // 4. El TOTAL NETO debe ser exactamente 729.348
    expect(html).toMatch(/TOTAL NETO[\s\S]*?CO\$ 729\.348/);
  });

  test('Liquidación de operarios no debe inflar el TOTAL NETO del cliente', () => {
    const remisionConLiq = {
      numero_remision: '00124',
      fecha_servicio: '2026-03-15',
      empresa_nombre: 'Cliente Con Liquidacion',
      horas_ordinarias: 8,
      valor_hora_ordinaria: 50000,
      horas_recargo: 0,
      valor_hora_recargo: 0,
      total_bruto: 400000,
      iva_valor: 0,
      descuentos: 0,
      total_neto: 400000,
      items: [
        { servicio_codigo: 'SERV-02', servicio_nombre: 'Servicio 8h', cantidad: 8, valor_unitario: 50000, unidad: 'hora' }
      ],
      operarios: [{ full_name: 'Operario 1', empleado_id: 'op-1' }]
    };

    const horasLaborales = [
      { total_liquidado: 65000 }
    ];

    const html = buildRemisionHtml(remisionConLiq, horasLaborales, []);

    // Debe mostrar la fila informativa de liquidación operarios
    expect(html).toContain('TOTAL LIQUIDAR OPERARIOS');
    expect(html).toContain('CO$ 65.000');
    // Pero el TOTAL NETO debe mantenerse idéntico a rem.total_neto ($400.000, NO $465.000)
    expect(html).toMatch(/TOTAL NETO[\s\S]*?CO\$ 400\.000/);
    expect(html).not.toMatch(/TOTAL NETO[\s\S]*?CO\$ 465\.000/);
  });

  test('Remisión con ítems adicionales (no-hora), IVA y descuentos', () => {
    const remisionCompleta = {
      numero_remision: '00125',
      fecha_servicio: '2026-03-15',
      empresa_nombre: 'Cliente Items Completo',
      horas_ordinarias: 6.41,
      valor_hora_ordinaria: 71000,
      horas_recargo: 3.09,
      valor_hora_recargo: 88750,
      total_bruto: 824500, // 674.500 horas + 150.000 combustible
      iva_valor: 138576,
      descuentos: 50000,
      total_neto: 913076,
      items: [
        { servicio_codigo: 'SERV-01', servicio_nombre: 'Servicio Montacargas', cantidad: 9.5, valor_unitario: 71000, unidad: 'hora' },
        { servicio_codigo: 'COMB-01', servicio_nombre: 'Combustible', cantidad: 1, valor_unitario: 150000, unidad: 'galon' }
      ],
      operarios: [{ full_name: 'Operario 1', empleado_id: 'op-1' }]
    };

    const html = buildRemisionHtml(remisionCompleta, [], []);

    // Debe incluir el ítem de combustible en la tabla horario
    expect(html).toContain('Combustible');
    expect(html).toContain('CO$ 150.000');
    // El total parcial desglose debe incluir horas + combustible = 729.348 + 150.000 = 879.348
    expect(html).toContain('CO$ 879.348');
    // Totales del resumen financiero
    expect(html).toContain('CO$ 824.500'); // Total Bruto
    expect(html).toContain('CO$ 138.576'); // IVA
    expect(html).toContain('CO$ 50.000');  // Descuentos
    expect(html).toMatch(/TOTAL NETO[\s\S]*?CO\$ 913\.076/);
  });
});

describe('Validación de motivo de anulación de remisiones', () => {
  const remisionId = '88888888-aaaa-4bbb-cccc-dddddddddddd';

  describe('PUT /api/v1/servicios/:id', () => {
    test('400 — rechaza cambiar a ANULADO sin motivo_anulacion', async () => {
      mockFindById.mockResolvedValue(MOCK_REMISION);

      const res = await request(app)
        .put(`/api/v1/servicios/${remisionId}`)
        .send({ estado: 'ANULADA' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/El motivo de anulación es obligatorio/i);
    });

    test('400 — rechaza cambiar a ANULADO con motivo menor a 5 caracteres o solo espacios', async () => {
      mockFindById.mockResolvedValue(MOCK_REMISION);

      const res = await request(app)
        .put(`/api/v1/servicios/${remisionId}`)
        .send({ estado: 'ANULADO', motivo_anulacion: '   abc  ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/El motivo de anulación es obligatorio/i);
    });

    test('200 — permite cambiar a ANULADO con motivo válido y normaliza estado a ANULADO', async () => {
      mockFindById.mockResolvedValue(MOCK_REMISION);
      mockUpdate.mockResolvedValue({
        ...MOCK_REMISION,
        estado: 'ANULADO',
        motivo_anulacion: 'Cliente canceló el servicio por lluvia torrencial',
      });

      const res = await request(app)
        .put(`/api/v1/servicios/${remisionId}`)
        .send({
          estado: 'ANULADA',
          motivo_anulacion: '  Cliente canceló el servicio por lluvia torrencial  ',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        remisionId,
        expect.objectContaining({
          estado: 'ANULADO',
          motivo_anulacion: 'Cliente canceló el servicio por lluvia torrencial',
        }),
        expect.anything()
      );
    });

    test('200 — al cambiar de estado fuera de ANULADO, limpia motivo_anulacion a null', async () => {
      mockFindById.mockResolvedValue({
        ...MOCK_REMISION,
        estado: 'ANULADO',
        motivo_anulacion: 'Motivo previo',
      });
      mockUpdate.mockResolvedValue({
        ...MOCK_REMISION,
        estado: 'LIQUIDADA',
        motivo_anulacion: null,
      });

      const res = await request(app)
        .put(`/api/v1/servicios/${remisionId}`)
        .send({ estado: 'LIQUIDADA' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        remisionId,
        expect.objectContaining({
          estado: 'LIQUIDADA',
          motivo_anulacion: null,
        }),
        expect.anything()
      );
    });
  });

  describe('DELETE /api/v1/servicios/:id', () => {
    test('400 — rechaza anulación rápida (DELETE) sin motivo_anulacion', async () => {
      const res = await request(app)
        .delete(`/api/v1/servicios/${remisionId}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/El motivo de anulación es obligatorio/i);
    });

    test('400 — rechaza anulación rápida con motivo menor a 5 caracteres', async () => {
      const res = await request(app)
        .delete(`/api/v1/servicios/${remisionId}`)
        .send({ motivo_anulacion: '1234' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/El motivo de anulación es obligatorio/i);
    });

    test('200 — anula exitosamente con motivo válido y registra en softDelete', async () => {
      mockFindById.mockResolvedValue(MOCK_REMISION);
      mockSoftDelete.mockResolvedValue({ rowCount: 1 });

      const res = await request(app)
        .delete(`/api/v1/servicios/${remisionId}`)
        .send({ motivo_anulacion: 'Equipo presentó falla mecánica antes del inicio' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockSoftDelete).toHaveBeenCalledWith(
        remisionId,
        expect.anything(),
        'Equipo presentó falla mecánica antes del inicio'
      );
    });
  });
});


