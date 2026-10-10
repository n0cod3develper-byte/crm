import { jest } from '@jest/globals';

// ─────────────────────────────────────────────────────────────
// Mocks ANTES de importar el middleware.
// En ESM jest.mock no se eleva (hoisting), por eso se usa
// jest.unstable_mockModule + import dinámico.
// ─────────────────────────────────────────────────────────────
jest.unstable_mockModule('../../modules/admin/auditLog.repository.js', () => ({
  AuditLogRepository: {
    insertar: jest.fn().mockResolvedValue({ id: 1 }),
    listar: jest.fn(),
  },
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const { auditMiddleware, sanitizeRequestBody } = await import('../audit.middleware.js');
const { AuditLogRepository } = await import('../../modules/admin/auditLog.repository.js');

const SECRET = 'SuperSecret123!';

function runMiddleware(req) {
  let onFinish = null;
  const res = {
    statusCode: 200,
    on: (event, cb) => {
      if (event === 'finish') onFinish = cb;
    },
  };
  const next = jest.fn();
  auditMiddleware(req, res, next);
  if (onFinish) onFinish();
  return { next };
}

beforeEach(() => {
  AuditLogRepository.insertar.mockClear();
});

describe('sanitizeRequestBody', () => {
  it('elimina credenciales de forma recursiva y conserva el resto', () => {
    const out = sanitizeRequestBody({
      email: 'user@cargar.co',
      password: SECRET,
      currentPassword: SECRET,
      nested: { token: 'abc', secret: 'x', keep: 1 },
      list: [{ newPassword: SECRET, keep: 2 }],
    });

    expect(out).toEqual({
      email: 'user@cargar.co',
      nested: { keep: 1 },
      list: [{ keep: 2 }],
    });
    expect(JSON.stringify(out)).not.toContain(SECRET);
  });

  it('devuelve null cuando el body no es un objeto JSON', () => {
    expect(sanitizeRequestBody(null)).toBeNull();
    expect(sanitizeRequestBody(undefined)).toBeNull();
    expect(sanitizeRequestBody('password=abc')).toBeNull();
    expect(sanitizeRequestBody(['password'])).toBeNull();
  });
});

describe('auditMiddleware', () => {
  it('no persiste la contraseña en audit_logs en un login', () => {
    const { next } = runMiddleware({
      method: 'POST',
      originalUrl: '/api/v1/auth/login',
      body: { email: 'user@cargar.co', password: SECRET },
      headers: { 'user-agent': 'jest' },
      socket: { remoteAddress: '127.0.0.1' },
      ip: '127.0.0.1',
    });

    expect(next).toHaveBeenCalled();
    expect(AuditLogRepository.insertar).toHaveBeenCalledTimes(1);

    const payload = AuditLogRepository.insertar.mock.calls[0][0];
    expect(payload.datosAntes).toEqual({ email: 'user@cargar.co' });
    expect(payload.datosDespues).toBeNull();
    expect(JSON.stringify(payload)).not.toContain(SECRET);
    expect(payload.modulo).toBe('auth');
    expect(payload.accion).toBe('CREATE');
  });

  it('audita un DELETE sin body', () => {
    runMiddleware({
      method: 'DELETE',
      originalUrl: '/api/v1/companies/123',
      headers: {},
      socket: {},
    });

    expect(AuditLogRepository.insertar).toHaveBeenCalledTimes(1);
    const payload = AuditLogRepository.insertar.mock.calls[0][0];
    expect(payload.accion).toBe('DELETE');
    expect(payload.datosAntes).toBeNull();
    expect(payload.modulo).toBe('empresas');
  });

  it('no audita peticiones de lectura (GET)', () => {
    runMiddleware({
      method: 'GET',
      originalUrl: '/api/v1/companies',
      headers: {},
      socket: {},
    });
    expect(AuditLogRepository.insertar).not.toHaveBeenCalled();
  });

  it('no audita respuestas con error (5xx)', () => {
    let onFinish = null;
    const res = {
      statusCode: 500,
      on: (event, cb) => {
        if (event === 'finish') onFinish = cb;
      },
    };
    auditMiddleware(
      { method: 'POST', originalUrl: '/api/v1/companies', body: { a: 1 }, headers: {}, socket: {} },
      res,
      () => {}
    );
    onFinish();
    expect(AuditLogRepository.insertar).not.toHaveBeenCalled();
  });

  it('no audita rutas excluidas', () => {
    runMiddleware({
      method: 'POST',
      originalUrl: '/api/v1/auth/refresh',
      body: { token: SECRET },
      headers: {},
      socket: {},
    });
    expect(AuditLogRepository.insertar).not.toHaveBeenCalled();
  });
});
