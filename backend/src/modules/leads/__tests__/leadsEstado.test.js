import 'dotenv/config';

/**
 * Pruebas UNITARIAS de la regla de dominio de la nota del cambio de estado.
 *
 * No tocan la base: `validarNotaCambioEstado` es una función pura. Se importa
 * del repositorio porque allí vive la regla (única fuente de verdad, también
 * para llamadas internas que no pasan por HTTP).
 */

const { validarNotaCambioEstado } = await import('../leads.repository.js');
const { NOTA_MIN, NOTA_MAX } = await import('../leads.constants.js');
const { db } = await import('../../../config/database.js');

afterAll(async () => {
  // El repositorio crea el pool al importarse; se cierra para no dejar handles.
  await db.end();
});

describe('validarNotaCambioEstado', () => {

  test('no exige nota cuando el estado NO cambia', () => {
    expect(() => validarNotaCambioEstado(undefined, 'new', 'new')).not.toThrow();
    expect(() => validarNotaCambioEstado('', 'qualified', 'qualified')).not.toThrow();
  });

  test('no exige nota cuando no se envía un estado nuevo', () => {
    expect(() => validarNotaCambioEstado(undefined, 'new', undefined)).not.toThrow();
    expect(() => validarNotaCambioEstado(undefined, 'new', null)).not.toThrow();
  });

  test('exige una nota al cambiar de estado', () => {
    expect(() => validarNotaCambioEstado(undefined, 'new', 'contacted')).toThrow();
    expect(() => validarNotaCambioEstado('   ', 'new', 'contacted')).toThrow();
  });

  test(`rechaza notas de menos de ${NOTA_MIN} caracteres`, () => {
    expect(() => validarNotaCambioEstado('a'.repeat(NOTA_MIN - 1), 'new', 'contacted')).toThrow();
  });

  test('acepta una nota con el mínimo exacto', () => {
    expect(() => validarNotaCambioEstado('a'.repeat(NOTA_MIN), 'new', 'contacted')).not.toThrow();
  });

  test('acepta texto con espacios alrededor (se recorta antes de medir)', () => {
    expect(() => validarNotaCambioEstado(`   ${'a'.repeat(NOTA_MIN)}   `, 'new', 'contacted')).not.toThrow();
  });

  test(`rechaza notas de más de ${NOTA_MAX} caracteres`, () => {
    expect(() => validarNotaCambioEstado('a'.repeat(NOTA_MAX + 1), 'new', 'contacted')).toThrow();
  });

  test('acepta el máximo exacto', () => {
    expect(() => validarNotaCambioEstado('a'.repeat(NOTA_MAX), 'new', 'contacted')).not.toThrow();
  });

  test('el error es de validación (422) y apunta al campo nota', () => {
    try {
      validarNotaCambioEstado('', 'new', 'contacted');
      throw new Error('Debió lanzar');
    } catch (err) {
      expect(err.statusCode).toBe(422);
      expect(err.details[0].field).toBe('nota');
      expect(err.details[0].message).toContain('nota');
    }
  });

  test('acepta literalmente intentos de SQLi/XSS (la defensa es parametrizar y escapar)', () => {
    const sql = "'; DROP TABLE lead_history; --";
    const xss = '<script>alert("x")</script>';
    expect(() => validarNotaCambioEstado(sql, 'new', 'contacted')).not.toThrow();
    expect(() => validarNotaCambioEstado(xss, 'new', 'contacted')).not.toThrow();
  });
});
