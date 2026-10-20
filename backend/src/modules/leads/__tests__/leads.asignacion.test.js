import { jest } from '@jest/globals';

// ─────────────────────────────────────────────────────────────
// 1. Mock infraestructura (DB, Redis, Passport, Logs, Límites)
//    Se aplican ANTES de importar app.js.
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
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), http: jest.fn() },
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
// 2. Autenticación y RBAC — el permiso se puede denegar a voluntad
// ─────────────────────────────────────────────────────────────

let permisoDenegado = false;

jest.unstable_mockModule('../../../middleware/auth.js', () => {
  const inyectar = (req, _res, next) => {
    req.userId = '00000000-0000-0000-0000-000000000001';
    req.user = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'test@cargar.com.co',
      nombre: 'Tester',
      apellido: 'Automatizado',
      role: 'admin',
    };
    next();
  };
  return {
    authenticate: inyectar,
    requireAuth: inyectar,
    authorize: () => (_req, _res, next) => next(),
    verificarPermiso: () => (req, res, next) => {
      if (permisoDenegado) return res.status(403).json({ error: 'Sin permiso para realizar esta acción' });
      return next();
    },
    soloAdmin: (_req, _res, next) => next(),
    obtenerPermisosUsuario: jest.fn().mockResolvedValue({ rol: { slug: 'admin' }, permisos: {} }),
    invalidarCacheUsuario: jest.fn(),
    invalidarTodoElCache: jest.fn(),
  };
});

// ─────────────────────────────────────────────────────────────
// 3. Mock del repositorio de Leads y del servicio de correo
// ─────────────────────────────────────────────────────────────

const mockFindAll = jest.fn();
const mockFindById = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockFindAsignables = jest.fn();
const mockFindEmpleadoAsignable = jest.fn();
const mockRegistrarNotificacion = jest.fn();
const mockMarcarEnviada = jest.fn();
const mockMarcarError = jest.fn();
const mockDelete = jest.fn();
const mockConvert = jest.fn();
const mockRestaurar = jest.fn();

// Gestiones comerciales (módulo leadGestiones)
const mockGestionesFind = jest.fn();
const mockGestionesCreate = jest.fn();

// Los métodos transaccionales delegan en los mocks de siempre, de modo que las
// aserciones existentes sobre create/update siguen valiendo.
const mockCreateConHistorial = jest.fn(async (data) => ({
  lead: await mockCreate(data),
  eventoCreacionId: 1,
  eventoAsignacionId: 2,
}));
const mockUpdateConHistorial = jest.fn(async (id, data) => ({
  lead: await mockUpdate(id, data),
  cambios: [],
  eventoAsignacionId: 3,
}));

jest.unstable_mockModule('../leads.repository.js', () => ({
  LeadsRepository: jest.fn().mockImplementation(() => ({
    findAll: mockFindAll,
    findById: mockFindById,
    // Rutas de lectura (detalle, historial, resumen) incluyen archivados; por
    // eso reenvía a la MISMA configuración que usa cada prueba con mockFindById.
    findByIdIncluyendoArchivado: (id) => mockFindById(id),
    create: mockCreate,
    update: mockUpdate,
    createConHistorial: mockCreateConHistorial,
    updateConHistorial: mockUpdateConHistorial,
    findAsignables: mockFindAsignables,
    findEmpleadoAsignable: mockFindEmpleadoAsignable,
    registrarNotificacion: mockRegistrarNotificacion,
    marcarNotificacionEnviada: mockMarcarEnviada,
    marcarNotificacionError: mockMarcarError,
    delete: mockDelete,
    restaurar: mockRestaurar,
    convertToContact: mockConvert,
  })),
}));

// El módulo de gestiones comerciales tiene su propio repositorio.
// El mock debe exportar TAMBIÉN las constantes, porque leadGestiones.schema.js
// importa TIPOS_GESTION de aquí.
jest.unstable_mockModule('../leadGestiones.repository.js', () => ({
  LeadGestionesRepository: jest.fn().mockImplementation(() => ({
    findByLead: mockGestionesFind,
    create: mockGestionesCreate,
  })),
  TIPOS_GESTION: ['llamada', 'reunion', 'correo', 'observacion', 'otro'],
  ETIQUETAS_TIPO_GESTION: {
    llamada: 'Llamada', reunion: 'Reunión', correo: 'Correo de seguimiento',
    observacion: 'Observación', otro: 'Otra gestión',
  },
}));

// El controlador anota el resultado del correo sobre el evento de historial.
const mockRegistrarResultado = jest.fn();
const mockFindEvents = jest.fn();
const mockFindSummary = jest.fn();

jest.unstable_mockModule('../leadsHistory.repository.js', () => ({
  LeadsHistoryRepository: jest.fn().mockImplementation(() => ({
    registrarResultadoNotificacion: mockRegistrarResultado,
    findEvents: mockFindEvents,
    findSummary: mockFindSummary,
  })),
  diffLead: jest.fn(() => []),
  ETIQUETAS_CAMPO: {},
  ESTADOS_CIERRE: ['dead', 'converted'],
  CAMPOS_AUDITABLES: [],
}));

const mockSendMailWithRetry = jest.fn();

jest.unstable_mockModule('../../../services/email/emailService.js', () => ({
  sendMail: jest.fn(),
  sendMailWithRetry: mockSendMailWithRetry,
}));

// ─────────────────────────────────────────────────────────────
// 4. Importar app y supertest (dinámico para Jest ESM)
// ─────────────────────────────────────────────────────────────

const { default: request } = await import('supertest');
const { default: app } = await import('../../../app.js');

// ─────────────────────────────────────────────────────────────
// 5. Datos de prueba
// ─────────────────────────────────────────────────────────────

const LEAD_ID = '11111111-1111-4111-8111-111111111111';
const EMP_ACTIVO = '22222222-2222-4222-8222-222222222222';
const EMP_INACTIVO = '33333333-3333-4333-8333-333333333333';
const EMP_INEXISTENTE = '44444444-4444-4444-8444-444444444444';
const EMP_SIN_CORREO = '55555555-5555-4555-8555-555555555555';

const EMPLEADO_ACTIVO = { id: EMP_ACTIVO, full_name: 'ANA VENDEDORA', email: 'ana@cargar.com.co', status: 'Activo' };
const EMPLEADO_INACTIVO = { id: EMP_INACTIVO, full_name: 'ROBERTO RETIRADO', email: 'roberto@cargar.com.co', status: 'Inactivo' };
const EMPLEADO_SIN_CORREO = { id: EMP_SIN_CORREO, full_name: 'MARIA SIN CORREO', email: '', status: 'Activo' };

const leadBase = (extra = {}) => ({
  id: LEAD_ID,
  first_name: 'Carlos',
  last_name: 'Gómez',
  email: 'carlos@ejemplo.com',
  phone: '3001112233',
  company_name: 'Transportes Andes',
  source: 'Web',
  status: 'new',
  score: 0,
  notes: 'Necesita flota de 5 camiones',
  assigned_employee_id: null,
  created_at: '2026-10-19T12:00:00.000Z',
  updated_at: '2026-10-19T12:00:00.000Z',
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  permisoDenegado = false;
  mockSendMailWithRetry.mockResolvedValue({ success: true });
  mockRegistrarNotificacion.mockResolvedValue({ id: 99 });
  mockMarcarEnviada.mockResolvedValue(undefined);
  mockMarcarError.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────
// Pruebas
// ─────────────────────────────────────────────────────────────

describe('Leads — asignación a empleados y notificación por correo', () => {

  test('1. Crear Lead sin asignación: sin correo y sin registro de notificación', async () => {
    mockCreate.mockResolvedValue(leadBase());

    const res = await request(app).post('/api/v1/leads').send({ first_name: 'Carlos' });

    expect(res.status).toBe(201);
    expect(mockFindEmpleadoAsignable).not.toHaveBeenCalled();
    expect(mockSendMailWithRetry).not.toHaveBeenCalled();
    expect(mockRegistrarNotificacion).not.toHaveBeenCalled();
  });

  test('2. Crear Lead con empleado activo: envía el correo', async () => {
    mockFindEmpleadoAsignable.mockResolvedValue(EMPLEADO_ACTIVO);
    mockCreate.mockResolvedValue(leadBase({ assigned_employee_id: EMP_ACTIVO }));

    const res = await request(app)
      .post('/api/v1/leads')
      .send({ first_name: 'Carlos', assigned_employee_id: EMP_ACTIVO });

    expect(res.status).toBe(201);
    expect(mockSendMailWithRetry).toHaveBeenCalledTimes(1);

    const args = mockSendMailWithRetry.mock.calls[0][0];
    expect(args.to).toEqual(['ana@cargar.com.co']);
    expect(args.subject).toBe('Nuevo Lead asignado — CARGAR S.A.S.');
    expect(args.htmlBody).toContain('ANA VENDEDORA');
    expect(mockMarcarEnviada).toHaveBeenCalledWith(99);
  });

  test('3. Asignar un Lead que no tenía responsable: envía el correo', async () => {
    mockFindById.mockResolvedValue(leadBase({ assigned_employee_id: null }));
    mockFindEmpleadoAsignable.mockResolvedValue(EMPLEADO_ACTIVO);
    mockUpdate.mockResolvedValue(leadBase({ assigned_employee_id: EMP_ACTIVO }));

    const res = await request(app)
      .patch(`/api/v1/leads/${LEAD_ID}`)
      .send({ assigned_employee_id: EMP_ACTIVO });

    expect(res.status).toBe(200);
    expect(mockSendMailWithRetry).toHaveBeenCalledTimes(1);
    expect(mockSendMailWithRetry.mock.calls[0][0].subject).toBe('Nuevo Lead asignado — CARGAR S.A.S.');
  });

  test('4. Reasignar a otro empleado: envía el correo con asunto de reasignación', async () => {
    // El lead ya estaba asignado a EMP_ACTIVO y pasa a OTRO
    const OTRO = { ...EMPLEADO_ACTIVO, id: EMP_SIN_CORREO, full_name: 'OTRA PERSONA', email: 'otra@cargar.com.co' };

    mockFindById.mockResolvedValue(leadBase({ assigned_employee_id: EMP_ACTIVO }));
    mockFindEmpleadoAsignable.mockResolvedValue(OTRO);
    mockUpdate.mockResolvedValue(leadBase({ assigned_employee_id: EMP_SIN_CORREO }));

    const res = await request(app)
      .patch(`/api/v1/leads/${LEAD_ID}`)
      .send({ assigned_employee_id: EMP_SIN_CORREO });

    expect(res.status).toBe(200);
    expect(mockSendMailWithRetry).toHaveBeenCalledTimes(1);
    expect(mockSendMailWithRetry.mock.calls[0][0].subject).toBe('Lead reasignado — CARGAR S.A.S.');
    expect(mockSendMailWithRetry.mock.calls[0][0].to).toEqual(['otra@cargar.com.co']);
  });

  test('5. Editar un Lead sin cambiar el responsable: NO envía correo', async () => {
    mockFindById.mockResolvedValue(leadBase({ assigned_employee_id: EMP_ACTIVO }));
    mockUpdate.mockResolvedValue(leadBase({ assigned_employee_id: EMP_ACTIVO, phone: '3009998877' }));

    const res = await request(app)
      .patch(`/api/v1/leads/${LEAD_ID}`)
      .send({ phone: '3009998877' });

    expect(res.status).toBe(200);
    expect(mockSendMailWithRetry).not.toHaveBeenCalled();
    expect(mockFindEmpleadoAsignable).not.toHaveBeenCalled();
  });

  test('6. Intentar asignar un empleado INACTIVO: rechaza con 422 y no persiste', async () => {
    mockFindById.mockResolvedValue(leadBase({ assigned_employee_id: null }));
    mockFindEmpleadoAsignable.mockResolvedValue(EMPLEADO_INACTIVO);

    const res = await request(app)
      .patch(`/api/v1/leads/${LEAD_ID}`)
      .send({ assigned_employee_id: EMP_INACTIVO });

    expect(res.status).toBe(422);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSendMailWithRetry).not.toHaveBeenCalled();
  });

  test('7. Intentar asignar un empleado INEXISTENTE: rechaza con 404', async () => {
    mockFindById.mockResolvedValue(leadBase({ assigned_employee_id: null }));
    mockFindEmpleadoAsignable.mockResolvedValue(null);

    const res = await request(app)
      .patch(`/api/v1/leads/${LEAD_ID}`)
      .send({ assigned_employee_id: EMP_INEXISTENTE });

    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSendMailWithRetry).not.toHaveBeenCalled();
  });

  test('8. Empleado sin correo válido: el Lead se guarda y se registra el aviso', async () => {
    mockFindById.mockResolvedValue(leadBase({ assigned_employee_id: null }));
    mockFindEmpleadoAsignable.mockResolvedValue(EMPLEADO_SIN_CORREO);
    mockUpdate.mockResolvedValue(leadBase({ assigned_employee_id: EMP_SIN_CORREO }));

    const res = await request(app)
      .patch(`/api/v1/leads/${LEAD_ID}`)
      .send({ assigned_employee_id: EMP_SIN_CORREO });

    // El lead no se pierde por falta de correo
    expect(res.status).toBe(200);
    expect(res.body.data.assigned_employee_id).toBe(EMP_SIN_CORREO);
    // No se intenta enviar
    expect(mockSendMailWithRetry).not.toHaveBeenCalled();
    // Se registra el evento con error
    expect(mockRegistrarNotificacion).toHaveBeenCalled();
    expect(mockMarcarError).toHaveBeenCalled();
  });

  test('9. Fallo del servicio de correo: el Lead persiste y el error queda registrado', async () => {
    mockFindById.mockResolvedValue(leadBase({ assigned_employee_id: null }));
    mockFindEmpleadoAsignable.mockResolvedValue(EMPLEADO_ACTIVO);
    mockUpdate.mockResolvedValue(leadBase({ assigned_employee_id: EMP_ACTIVO }));
    mockSendMailWithRetry.mockResolvedValue({ success: false, errorCode: 'GRAPH_API_ERROR', errorMessage: 'Servidor no disponible' });

    const res = await request(app)
      .patch(`/api/v1/leads/${LEAD_ID}`)
      .send({ assigned_employee_id: EMP_ACTIVO });

    // 200: la operación principal tuvo éxito aunque el correo fallara
    expect(res.status).toBe(200);
    expect(res.body.data.assigned_employee_id).toBe(EMP_ACTIVO);
    expect(mockMarcarError).toHaveBeenCalledWith(99, 'Servidor no disponible');
  });

  test('10. Repetir la misma petición de actualización: solo un correo', async () => {
    mockFindEmpleadoAsignable.mockResolvedValue(EMPLEADO_ACTIVO);

    // 1ª vez: estaba sin asignar
    mockFindById.mockResolvedValue(leadBase({ assigned_employee_id: null }));
    mockUpdate.mockResolvedValue(leadBase({ assigned_employee_id: EMP_ACTIVO }));
    await request(app).patch(`/api/v1/leads/${LEAD_ID}`).send({ assigned_employee_id: EMP_ACTIVO });

    // 2ª vez: idéntica, ya está asignado al mismo empleado
    mockFindById.mockResolvedValue(leadBase({ assigned_employee_id: EMP_ACTIVO }));
    await request(app).patch(`/api/v1/leads/${LEAD_ID}`).send({ assigned_employee_id: EMP_ACTIVO });

    expect(mockSendMailWithRetry).toHaveBeenCalledTimes(1);
  });

  test('11. Lead asignado a un empleado hoy inactivo: el nombre sigue mostrándose', async () => {
    // El repositorio hace LEFT JOIN employees, así que el nombre no desaparece
    mockFindAll.mockResolvedValue({
      data: [leadBase({ assigned_employee_id: EMP_INACTIVO, assigned_employee_name: 'ROBERTO RETIRADO' })],
      pagination: { hasMore: false, nextCursor: null },
    });

    const res = await request(app).get('/api/v1/leads');

    expect(res.status).toBe(200);
    const lead = res.body.data[0];
    expect(lead.assigned_employee_id).toBe(EMP_INACTIVO);
    expect(lead.assigned_employee_name).toBe('ROBERTO RETIRADO');
  });

  test('12. Usuario sin permisos: no puede modificar la asignación (403)', async () => {
    permisoDenegado = true;

    const res = await request(app)
      .patch(`/api/v1/leads/${LEAD_ID}`)
      .send({ assigned_employee_id: EMP_ACTIVO });

    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSendMailWithRetry).not.toHaveBeenCalled();
  });
});

describe('Leads — validación y endpoint de empleados', () => {

  test('el endpoint de asignables expone SOLO id y nombre', async () => {
    mockFindAsignables.mockResolvedValue([{ id: EMP_ACTIVO, full_name: 'ANA VENDEDORA' }]);

    const res = await request(app).get('/api/v1/leads/asignables');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ id: EMP_ACTIVO, full_name: 'ANA VENDEDORA' }]);
    // Nunca debe filtrar datos sensibles del empleado
    expect(res.body.data[0]).not.toHaveProperty('salario');
    expect(res.body.data[0]).not.toHaveProperty('eps');
    expect(res.body.data[0]).not.toHaveProperty('numero_documento');
  });

  test('rechaza un assigned_employee_id que no sea UUID', async () => {
    const res = await request(app)
      .post('/api/v1/leads')
      .send({ first_name: 'Carlos', assigned_employee_id: 'no-es-uuid' });

    expect(res.status).toBe(422);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('el filtro "Sin asignar" (none) llega al repositorio', async () => {
    mockFindAll.mockResolvedValue({ data: [], pagination: { hasMore: false, nextCursor: null } });

    const res = await request(app).get('/api/v1/leads?assignedTo=none');

    expect(res.status).toBe(200);
    expect(mockFindAll).toHaveBeenCalledWith(expect.objectContaining({ assignedTo: 'none' }));
  });

  test('crear un lead exige nombre', async () => {
    const res = await request(app).post('/api/v1/leads').send({ first_name: '' });

    expect(res.status).toBe(422);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('Leads — API de historial / trazabilidad', () => {
  const LEAD_OK = '11111111-1111-4111-8111-111111111111';

  const evento = (extra = {}) => ({
    id: '1',
    fecha: '2026-10-19T12:00:00.000Z',
    fuente: 'HISTORIAL',
    tipo: 'CAMBIO_ESTADO',
    campo: 'status',
    etiquetaCampo: 'Estado',
    valorAnterior: 'new',
    valorNuevo: 'contacted',
    descripcion: 'Estado cambiado de "new" a "contacted"',
    usuario: 'Tester Automatizado',
    empleado: null,
    metadata: null,
    ...extra,
  });

  beforeEach(() => {
    mockFindById.mockResolvedValue(leadBase());
  });

  test('devuelve los eventos con paginación', async () => {
    mockFindEvents.mockResolvedValue({
      data: [evento()],
      pagination: { hasMore: true, nextCursor: { fecha: '2026-10-19T11:00:00.000Z', orden: '000000000000001' } },
    });

    const res = await request(app).get(`/api/v1/leads/${LEAD_OK}/history?limit=10`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].etiquetaCampo).toBe('Estado');
    expect(res.body.pagination.hasMore).toBe(true);
    expect(mockFindEvents).toHaveBeenCalledWith(expect.objectContaining({ leadId: LEAD_OK, limit: 10 }));
  });

  test('permite filtrar por tipo de evento y rango de fechas', async () => {
    mockFindEvents.mockResolvedValue({ data: [], pagination: { hasMore: false, nextCursor: null } });

    const res = await request(app)
      .get(`/api/v1/leads/${LEAD_OK}/history?tipo=ASIGNACION&desde=2026-01-01&hasta=2026-12-31`);

    expect(res.status).toBe(200);
    const args = mockFindEvents.mock.calls[0][0];
    expect(args.eventType).toBe('ASIGNACION');
    expect(args.desde).toContain('2026-01-01');
    expect(args.hasta).toContain('2026-12-31');
  });

  test('rechaza un tipo de evento no permitido', async () => {
    const res = await request(app).get(`/api/v1/leads/${LEAD_OK}/history?tipo=INVENTADO`);
    expect(res.status).toBe(422);
    expect(mockFindEvents).not.toHaveBeenCalled();
  });

  test('devuelve 404 si el lead no existe', async () => {
    mockFindById.mockResolvedValue(null);
    const res = await request(app).get(`/api/v1/leads/${LEAD_OK}/history`);
    expect(res.status).toBe(404);
    expect(mockFindEvents).not.toHaveBeenCalled();
  });

  test('el resumen distingue un lead SIN historial', async () => {
    mockFindSummary.mockResolvedValue({
      fecha_creacion: '2026-07-22T05:00:00.000Z',
      estado_actual: 'new',
      ultima_modificacion: '2026-07-22T05:00:00.000Z',
      responsable_actual: null,
      fecha_primera_asignacion: null,
      ultima_gestion: null,
      total_eventos: 0,
    });

    const res = await request(app).get(`/api/v1/leads/${LEAD_OK}/summary`);

    expect(res.status).toBe(200);
    expect(res.body.data.tieneHistorial).toBe(false);
    expect(res.body.data.responsable_actual).toBeNull();
    expect(res.body.data.fechaCreacionOriginal).toBeTruthy();
  });

  test('sin permisos no se puede consultar el historial', async () => {
    permisoDenegado = true;
    mockFindEvents.mockResolvedValue({ data: [], pagination: { hasMore: false, nextCursor: null } });

    const res = await request(app).get(`/api/v1/leads/${LEAD_OK}/history`);

    expect(res.status).toBe(403);
    expect(mockFindEvents).not.toHaveBeenCalled();
  });

  // El historial debe ser de SOLO LECTURA para usuarios comunes: no puede haber
  // endpoints de escritura o borrado.
  test('no existen endpoints de escritura o borrado del historial', async () => {
    const rutas = [
      ['post', `/api/v1/leads/${LEAD_OK}/history`],
      ['patch', `/api/v1/leads/${LEAD_OK}/history/1`],
      ['put', `/api/v1/leads/${LEAD_OK}/history/1`],
      ['delete', `/api/v1/leads/${LEAD_OK}/history/1`],
    ];

    for (const [metodo, ruta] of rutas) {
      const res = await request(app)[metodo](ruta).send({ event_type: 'MODIFICACION' });
      // Ninguna de esas rutas está definida: Express responde 404
      expect(res.status).toBe(404);
    }
  });

  test('al asignar se anota el resultado del correo sobre el evento', async () => {
    mockFindById.mockResolvedValue(leadBase({ assigned_employee_id: null }));
    mockFindEmpleadoAsignable.mockResolvedValue(EMPLEADO_ACTIVO);
    mockUpdate.mockResolvedValue(leadBase({ assigned_employee_id: EMP_ACTIVO }));

    await request(app)
      .patch(`/api/v1/leads/${LEAD_OK}`)
      .send({ assigned_employee_id: EMP_ACTIVO });

    expect(mockRegistrarResultado).toHaveBeenCalledWith(3, { enviado: true });
  });
});

// ─────────────────────────────────────────────────────────────
// Archivado lógico (borrado físico eliminado en la migración 140)
// ─────────────────────────────────────────────────────────────
describe('Leads — archivado lógico y conservación de la trazabilidad', () => {
  const LEAD_ARCH = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    mockFindById.mockResolvedValue(leadBase({ id: LEAD_ARCH }));
    mockDelete.mockResolvedValue({ id: LEAD_ARCH, deleted_at: new Date('2026-10-19T12:00:00Z') });
  });

  test('DELETE archiva el lead y responde «Lead archivado»', async () => {
    const res = await request(app).delete(`/api/v1/leads/${LEAD_ARCH}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Lead archivado');
  });

  test('el archivado recibe el usuario autenticado para la trazabilidad', async () => {
    await request(app).delete(`/api/v1/leads/${LEAD_ARCH}`);

    expect(mockDelete).toHaveBeenCalledTimes(1);
    const [id, ctx] = mockDelete.mock.calls[0];
    expect(id).toBe(LEAD_ARCH);
    expect(ctx.userId).toBe('00000000-0000-0000-0000-000000000001');
    expect(ctx.userName).toBe('Tester Automatizado');
  });

  test('archivar dos veces responde 404 (no hay doble archivado)', async () => {
    mockDelete.mockResolvedValue(null);
    const res = await request(app).delete(`/api/v1/leads/${LEAD_ARCH}`);

    expect(res.status).toBe(404);
  });

  test('el detalle, el historial y el resumen siguen respondiendo de un lead archivado', async () => {
    mockFindById.mockResolvedValue(leadBase({ id: LEAD_ARCH, deleted_at: '2026-10-19T12:00:00.000Z' }));
    mockFindEvents.mockResolvedValue({ data: [], pagination: { hasMore: false, nextCursor: null } });
    mockFindSummary.mockResolvedValue({
      fecha_creacion: '2026-07-22T05:00:00.000Z',
      estado_actual: 'new',
      ultima_modificacion: '2026-07-22T05:00:00.000Z',
      responsable_actual: null,
      fecha_primera_asignacion: null,
      ultima_gestion: null,
      total_eventos: 1,
    });

    const detalle = await request(app).get(`/api/v1/leads/${LEAD_ARCH}`);
    const historial = await request(app).get(`/api/v1/leads/${LEAD_ARCH}/history`);
    const resumen = await request(app).get(`/api/v1/leads/${LEAD_ARCH}/summary`);

    expect(detalle.status).toBe(200);
    expect(detalle.body.data.deleted_at).toBe('2026-10-19T12:00:00.000Z');
    expect(historial.status).toBe(200);
    expect(resumen.status).toBe(200);
  });

  // Punto 4 del encargo: la última gestión NO es "última modificación"
  test('la última gestión comercial queda en NULL si no hay actividad comercial real', async () => {
    mockFindSummary.mockResolvedValue({
      fecha_creacion: '2026-07-22T05:00:00.000Z',
      estado_actual: 'contacted',
      ultima_modificacion: '2026-10-19T12:00:00.000Z',
      responsable_actual: 'ROBINSON ALVEIRO ALVAREZ',
      fecha_primera_asignacion: '2026-07-23T12:00:00.000Z',
      ultima_gestion: null,           // hubo cambios, pero NINGUNA actividad comercial
      total_eventos: 4,
    });

    const res = await request(app).get(`/api/v1/leads/${LEAD_ARCH}/summary`);

    expect(res.status).toBe(200);
    expect(res.body.data.ultima_gestion).toBeNull();
    // Sí hay trazabilidad (4 eventos), pero distingue "con historial" de "con gestión"
    expect(res.body.data.tieneHistorial).toBe(true);
    expect(res.body.data.ultima_modificacion).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
// Restauración de leads archivados
// ─────────────────────────────────────────────────────────────
describe('Leads — restauración de archivados', () => {
  const LEAD_ARCH = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    mockRestaurar.mockResolvedValue({
      id: LEAD_ARCH, status: 'qualified', deleted_at: null,
      assigned_employee_id: EMP_ACTIVO,
    });
  });

  test('restaura y pasa el usuario autenticado para la trazabilidad', async () => {
    const res = await request(app).post(`/api/v1/leads/${LEAD_ARCH}/restaurar`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('restaurado');
    const [id, ctx] = mockRestaurar.mock.calls[0];
    expect(id).toBe(LEAD_ARCH);
    expect(ctx.userId).toBe('00000000-0000-0000-0000-000000000001');
    expect(ctx.userName).toBe('Tester Automatizado');
  });

  // Garantía del encargo: restaurar NO vuelve a enviar el correo de asignación
  test('restaurar NO envía correo de asignación ni registra notificación', async () => {
    const res = await request(app).post(`/api/v1/leads/${LEAD_ARCH}/restaurar`);

    expect(res.status).toBe(200);
    expect(mockSendMailWithRetry).not.toHaveBeenCalled();
    expect(mockRegistrarNotificacion).not.toHaveBeenCalled();
    // Tampoco toca el empleado asignado: eso es lo que dispararía el correo
    expect(mockUpdateConHistorial).not.toHaveBeenCalled();
  });

  test('un lead que no está archivado responde 404', async () => {
    mockRestaurar.mockResolvedValue(null);
    const res = await request(app).post(`/api/v1/leads/${LEAD_ARCH}/restaurar`);

    expect(res.status).toBe(404);
  });

  test('sin permiso responde 403', async () => {
    permisoDenegado = true;
    const res = await request(app).post(`/api/v1/leads/${LEAD_ARCH}/restaurar`);

    expect(res.status).toBe(403);
    expect(mockRestaurar).not.toHaveBeenCalled();
  });

  test('la vista de archivados llega al repositorio con el flag activado', async () => {
    mockFindAll.mockResolvedValue({ data: [], pagination: { hasMore: false, nextCursor: null } });

    await request(app).get('/api/v1/leads?archivados=true');

    expect(mockFindAll).toHaveBeenCalledWith(expect.objectContaining({ archivados: true }));
  });

  test('el listado normal NO incluye archivados', async () => {
    mockFindAll.mockResolvedValue({ data: [], pagination: { hasMore: false, nextCursor: null } });

    await request(app).get('/api/v1/leads');

    expect(mockFindAll).toHaveBeenCalledWith(expect.objectContaining({ archivados: false }));
  });
});

// ─────────────────────────────────────────────────────────────
// Gestiones comerciales
// ─────────────────────────────────────────────────────────────
describe('Leads — gestiones comerciales', () => {
  const LEAD_G = '44444444-4444-4444-8444-444444444444';

  beforeEach(() => {
    mockFindById.mockResolvedValue(leadBase({ id: LEAD_G }));
    mockGestionesCreate.mockResolvedValue({ id: 1, tipo: 'llamada' });
    mockGestionesFind.mockResolvedValue({
      data: [], pagination: { hasMore: false, nextCursor: null },
    });
  });

  test('registrar una gestión resuelve el empleado en el BACKEND', async () => {
    mockFindEmpleadoAsignable.mockResolvedValue(EMPLEADO_ACTIVO);

    const res = await request(app)
      .post(`/api/v1/leads/${LEAD_G}/gestiones`)
      .send({ tipo: 'llamada', employee_id: EMP_ACTIVO, resultado: 'Pidió cotización' });

    expect(res.status).toBe(201);
    // El nombre NO viene del cliente: se consulta en el servidor
    expect(mockGestionesCreate).toHaveBeenCalledWith(
      LEAD_G,
      expect.objectContaining({
        tipo: 'llamada',
        resultado: 'Pidió cotización',
        employee_id: EMP_ACTIVO,
        employee_name: 'ANA VENDEDORA',
      }),
      expect.objectContaining({ userName: 'Tester Automatizado' }),
    );
  });

  // Garantía del encargo: registrar gestión NO cambia el responsable
  test('registrar una gestión NO envía correo de asignación', async () => {
    mockFindEmpleadoAsignable.mockResolvedValue(EMPLEADO_ACTIVO);

    await request(app)
      .post(`/api/v1/leads/${LEAD_G}/gestiones`)
      .send({ tipo: 'reunion' });

    expect(mockSendMailWithRetry).not.toHaveBeenCalled();
    expect(mockRegistrarNotificacion).not.toHaveBeenCalled();
    expect(mockUpdateConHistorial).not.toHaveBeenCalled();
  });

  test('un lead ARCHIVADO no admite gestiones nuevas', async () => {
    mockFindById.mockResolvedValue(leadBase({ id: LEAD_G, deleted_at: '2026-10-19T12:00:00Z' }));

    const res = await request(app)
      .post(`/api/v1/leads/${LEAD_G}/gestiones`)
      .send({ tipo: 'llamada' });

    expect(res.status).toBe(422);
    // errorHandler responde { success:false, error:{ message, details } }
    expect(res.body.error.details[0].message).toContain('archivado');
    expect(mockGestionesCreate).not.toHaveBeenCalled();
  });

  test('tipo de gestión inválido responde 422', async () => {
    const res = await request(app)
      .post(`/api/v1/leads/${LEAD_G}/gestiones`)
      .send({ tipo: 'baile' });

    expect(res.status).toBe(422);
    expect(mockGestionesCreate).not.toHaveBeenCalled();
  });

  test('un empleado INACTIVO no puede quedar registrado en una gestión nueva', async () => {
    mockFindEmpleadoAsignable.mockResolvedValue(EMPLEADO_INACTIVO);

    const res = await request(app)
      .post(`/api/v1/leads/${LEAD_G}/gestiones`)
      .send({ tipo: 'llamada', employee_id: EMP_INACTIVO });

    expect(res.status).toBe(422);
    expect(mockGestionesCreate).not.toHaveBeenCalled();
  });

  test('sin permiso de creación responde 403', async () => {
    permisoDenegado = true;
    const res = await request(app)
      .post(`/api/v1/leads/${LEAD_G}/gestiones`)
      .send({ tipo: 'llamada' });

    expect(res.status).toBe(403);
    expect(mockGestionesCreate).not.toHaveBeenCalled();
  });

  test('el listado de gestiones pasa los filtros al repositorio', async () => {
    const res = await request(app)
      .get(`/api/v1/leads/${LEAD_G}/gestiones?tipo=llamada&desde=2026-01-01&hasta=2026-02-01&limit=5`);

    expect(res.status).toBe(200);
    expect(mockGestionesFind).toHaveBeenCalledWith(
      LEAD_G,
      expect.objectContaining({ tipo: 'llamada', limit: 5 }),
    );
  });

  test('los endpoints de escritura de gestiones exigen permiso', async () => {
    const rutas = [
      ['get', `/api/v1/leads/${LEAD_G}/gestiones`],
      ['post', `/api/v1/leads/${LEAD_G}/gestiones`],
    ];

    for (const [metodo, ruta] of rutas) {
      permisoDenegado = true;
      const res = await request(app)[metodo](ruta).send({ tipo: 'llamada' });
      expect(res.status).toBe(403);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Nota del cambio de estado y conversión (migración 142)
// ─────────────────────────────────────────────────────────────
describe('Leads — nota del cambio de estado y conversión', () => {

  const NOTA = 'Llamé y confirmó interés en el plan anual';

  test('PATCH con cambio de estado propaga la nota al repositorio', async () => {
    mockFindById.mockResolvedValue(leadBase({ status: 'new' }));
    mockUpdateConHistorial.mockResolvedValue({
      lead: leadBase({ status: 'contacted' }), cambios: [],
    });

    const res = await request(app)
      .patch(`/api/v1/leads/${LEAD_ID}`)
      .send({ status: 'contacted', nota: NOTA });

    expect(res.status).toBe(200);
    expect(mockUpdateConHistorial).toHaveBeenCalledWith(
      LEAD_ID,
      expect.objectContaining({ status: 'contacted', nota: NOTA }),
      expect.any(Object),
    );
  });

  test('PATCH que reenvía el MISMO estado no exige nota', async () => {
    mockFindById.mockResolvedValue(leadBase({ status: 'new' }));
    mockUpdateConHistorial.mockResolvedValue({ lead: leadBase({ status: 'new' }), cambios: [] });

    const res = await request(app)
      .patch(`/api/v1/leads/${LEAD_ID}`)
      .send({ status: 'new' });

    expect(res.status).toBe(200);
  });

  test('convertir SIN nota responde 422 y no toca el repositorio', async () => {
    const res = await request(app).patch(`/api/v1/leads/${LEAD_ID}/convert`).send({});

    expect(res.status).toBe(422);
    expect(res.body.details[0].field).toBe('nota');
    expect(mockConvert).not.toHaveBeenCalled();
  });

  test('convertir con una nota demasiado corta responde 422', async () => {
    const res = await request(app)
      .patch(`/api/v1/leads/${LEAD_ID}/convert`)
      .send({ nota: 'ok' });

    expect(res.status).toBe(422);
    expect(mockConvert).not.toHaveBeenCalled();
  });

  test('convertir con nota la propaga al repositorio', async () => {
    mockConvert.mockResolvedValue({
      lead: leadBase({ status: 'converted' }),
      contact: { id: 'c1' },
    });

    const res = await request(app)
      .patch(`/api/v1/leads/${LEAD_ID}/convert`)
      .send({ nota: NOTA });

    expect(res.status).toBe(200);
    expect(mockConvert).toHaveBeenCalledWith(
      LEAD_ID,
      expect.objectContaining({ nota: NOTA }),
    );
  });

  test('sin permiso, convertir responde 403', async () => {
    permisoDenegado = true;

    const res = await request(app)
      .patch(`/api/v1/leads/${LEAD_ID}/convert`)
      .send({ nota: NOTA });

    expect(res.status).toBe(403);
    expect(mockConvert).not.toHaveBeenCalled();
  });

  test('sin permiso, cambiar de estado responde 403', async () => {
    permisoDenegado = true;

    const res = await request(app)
      .patch(`/api/v1/leads/${LEAD_ID}`)
      .send({ status: 'contacted', nota: NOTA });

    expect(res.status).toBe(403);
    expect(mockUpdateConHistorial).not.toHaveBeenCalled();
  });
});
