import { jest } from '@jest/globals';

const mockClient = {
  query: jest.fn(),
};

// En Jest ESM se debe usar la ruta relativa desde el archivo de test
jest.unstable_mockModule('../../../config/database.js', () => ({
  query: jest.fn(),
  withTransaction: jest.fn(async (callback) => callback(mockClient)),
}));

// Dynamic import post-mocking
const { RemisionSustitucionService } = await import('../remisionSustitucion.service.js');
const { BadRequestError, NotFoundError } = await import('../../../utils/errors.js');

describe('RemisionSustitucionService', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RemisionSustitucionService();
  });

  it('debe rechazar si falta equipo_nuevo_id o fecha_efectiva', async () => {
    await expect(
      service.reemplazarEquipo('rem-1', { fecha_efectiva: '2026-08-10' }, null)
    ).rejects.toThrow(BadRequestError);

    await expect(
      service.reemplazarEquipo('rem-1', { equipo_nuevo_id: 'eq-2' }, null)
    ).rejects.toThrow(BadRequestError);
  });

  it('debe rechazar si la remisión está FACTURADA o ANULADA', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 'rem-1', equipo_id: 'eq-1', fecha_servicio: '2026-08-01', estado: 'FACTURADA', tiene_sustitucion: false }],
    });

    await expect(
      service.reemplazarEquipo('rem-1', { equipo_nuevo_id: 'eq-2', fecha_efectiva: '2026-08-10' }, null)
    ).rejects.toThrow('No se puede reemplazar el equipo en una remisión en estado FACTURADA');
  });

  it('debe rechazar si el equipo nuevo es igual al equipo actual', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 'rem-1', equipo_id: 'eq-1', fecha_servicio: '2026-08-01', estado: 'EN_PROCESO', tiene_sustitucion: false }],
    });

    await expect(
      service.reemplazarEquipo('rem-1', { equipo_nuevo_id: 'eq-1', fecha_efectiva: '2026-08-10' }, null)
    ).rejects.toThrow('El equipo nuevo debe ser diferente al equipo actual');
  });

  it('debe rechazar si la fecha efectiva es anterior a la fecha de servicio', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 'rem-1', equipo_id: 'eq-1', fecha_servicio: '2026-08-05', estado: 'EN_PROCESO', tiene_sustitucion: false }],
    });

    await expect(
      service.reemplazarEquipo('rem-1', { equipo_nuevo_id: 'eq-2', fecha_efectiva: '2026-08-01' }, null)
    ).rejects.toThrow('La fecha efectiva (2026-08-01) no puede ser anterior a la fecha de inicio');
  });

  it('debe rechazar si el equipo nuevo está FUERA_DE_SERVICIO', async () => {
    // 1. SELECT remision
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 'rem-1', equipo_id: 'eq-1', fecha_servicio: '2026-08-01', estado: 'EN_PROCESO', tiene_sustitucion: false }],
    });
    // 2. SELECT equipo nuevo
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 'eq-2', estado: 'FUERA_DE_SERVICIO', marca: 'CAT', modelo: '320', serie: 'S-99' }],
    });

    await expect(
      service.reemplazarEquipo('rem-1', { equipo_nuevo_id: 'eq-2', fecha_efectiva: '2026-08-05' }, null)
    ).rejects.toThrow('está en estado FUERA_DE_SERVICIO y no puede ser asignado');
  });

  it('debe crear el tramo inicial retroactivo y el nuevo tramo correctamente en la primera sustitución', async () => {
    // 1. SELECT remision
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 'rem-1', equipo_id: 'eq-1', fecha_servicio: '2026-08-01', estado: 'EN_PROCESO', tiene_sustitucion: false, numero_remision: '33511' }],
    });
    // 2. SELECT equipo nuevo
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 'eq-2', estado: 'OPERATIVO', marca: 'CAT', modelo: '320', serie: 'S-99' }],
    });
    // 3. INSERT tramo inicial
    mockClient.query.mockResolvedValueOnce({ rows: [] });
    // 4. UPDATE remisiones tiene_sustitucion
    mockClient.query.mockResolvedValueOnce({ rows: [] });
    // 5. INSERT tramo nuevo
    mockClient.query.mockResolvedValueOnce({ rows: [] });
    // 6. UPDATE remisiones equipo_id
    mockClient.query.mockResolvedValueOnce({ rows: [] });
    // 7. SELECT estado eq-1 (liberación)
    mockClient.query.mockResolvedValueOnce({ rows: [{ estado: 'ALQUILADO' }] });
    // 8. COUNT otras remisiones de eq-1
    mockClient.query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
    // 9. UPDATE eq-1 -> OPERATIVO
    mockClient.query.mockResolvedValueOnce({ rows: [] });
    // 10. INSERT eq-1 historial
    mockClient.query.mockResolvedValueOnce({ rows: [] });
    // 11. SELECT eq-2 estado
    mockClient.query.mockResolvedValueOnce({ rows: [{ estado: 'OPERATIVO' }] });
    // 12. UPDATE eq-2 -> ALQUILADO
    mockClient.query.mockResolvedValueOnce({ rows: [] });
    // 13. INSERT eq-2 historial
    mockClient.query.mockResolvedValueOnce({ rows: [] });
    // 14. SELECT tramos finales
    mockClient.query.mockResolvedValueOnce({
      rows: [
        { id: 't-1', equipo_id: 'eq-1', fecha_inicio: '2026-08-01', fecha_fin: '2026-08-04', dias_facturables: 4 },
        { id: 't-2', equipo_id: 'eq-2', fecha_inicio: '2026-08-05', fecha_fin: null, dias_facturables: null }
      ],
    });

    const result = await service.reemplazarEquipo('rem-1', {
      equipo_nuevo_id: 'eq-2',
      fecha_efectiva: '2026-08-05',
      motivo: 'Avería de manguera'
    }, { nombre: 'Juan', apellido: 'Pérez' });

    expect(result.tramos).toHaveLength(2);
    expect(result.equipo_nuevo.id).toBe('eq-2');
  });
});
