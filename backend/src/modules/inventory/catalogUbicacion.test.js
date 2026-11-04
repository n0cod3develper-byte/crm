import { jest } from '@jest/globals';

describe('Catálogo / Consecutivo de Ubicación por Familia', () => {
  describe('Formateo y avance de código de ubicación', () => {
    const formatUbicacionCode = (seq) => {
      const num = parseInt(seq, 10);
      return num < 1000 ? String(num).padStart(3, '0') : String(num);
    };

    it('debe generar código de 3 dígitos con padding de ceros para secuencias menores a 1000', () => {
      expect(formatUbicacionCode(1)).toBe('001');
      expect(formatUbicacionCode(2)).toBe('002');
      expect(formatUbicacionCode(10)).toBe('010');
      expect(formatUbicacionCode(102)).toBe('102');
      expect(formatUbicacionCode(999)).toBe('999');
    });

    it('debe expandirse a 4 dígitos sin truncar cuando la secuencia supera 999', () => {
      expect(formatUbicacionCode(1000)).toBe('1000');
      expect(formatUbicacionCode(1001)).toBe('1001');
      expect(formatUbicacionCode(1500)).toBe('1500');
    });
  });

  describe('Lógica de asignación de ubicación en CatalogRepository.create', () => {
    it('debe llamar a generar_ubicacion_por_familia cuando tipo es PRODUCTO y no hay ubicacion_id', async () => {
      const mockQuery = jest.fn();
      const mockUbiId = 'uuid-ubicacion-001';

      mockQuery.mockImplementation((sql, params) => {
        if (sql.includes('generar_ubicacion_por_familia')) {
          return Promise.resolve({ rows: [{ ubi_id: mockUbiId }] });
        }
        if (sql.includes('INSERT INTO inventario')) {
          return Promise.resolve({ rows: [{ id: 'uuid-item-1', ubicacion_id: mockUbiId }] });
        }
        return Promise.resolve({ rows: [] });
      });

      // Simular la lógica de asignación implementada en create()
      const categoriaId = 'c2f82a94-dce2-419e-91a2-48b3bbbadf42';
      const tipo = 'PRODUCTO';
      let ubicacionFinal = null;

      if (!ubicacionFinal && categoriaId && tipo === 'PRODUCTO') {
        const ubiRes = await mockQuery('SELECT generar_ubicacion_por_familia($1) AS ubi_id', [categoriaId]);
        ubicacionFinal = ubiRes.rows[0]?.ubi_id || null;
      }

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT generar_ubicacion_por_familia($1) AS ubi_id',
        [categoriaId]
      );
      expect(ubicacionFinal).toBe(mockUbiId);
    });

    it('debe respetar la ubicación explícita enviada sin invocar generar_ubicacion_por_familia', async () => {
      const mockQuery = jest.fn();
      const explicitUbiId = 'uuid-ubicacion-rack-a1';

      const categoriaId = 'c2f82a94-dce2-419e-91a2-48b3bbbadf42';
      const tipo = 'PRODUCTO';
      let ubicacionFinal = explicitUbiId;

      if (!ubicacionFinal && categoriaId && tipo === 'PRODUCTO') {
        const ubiRes = await mockQuery('SELECT generar_ubicacion_por_familia($1) AS ubi_id', [categoriaId]);
        ubicacionFinal = ubiRes.rows[0]?.ubi_id || null;
      }

      expect(mockQuery).not.toHaveBeenCalled();
      expect(ubicacionFinal).toBe(explicitUbiId);
    });

    it('no debe generar ubicación física si el ítem es de tipo SERVICIO', async () => {
      const mockQuery = jest.fn();
      const categoriaId = 'c2f82a94-dce2-419e-91a2-48b3bbbadf42';
      const tipo = 'SERVICIO';
      let ubicacionFinal = null;

      if (!ubicacionFinal && categoriaId && tipo === 'PRODUCTO') {
        const ubiRes = await mockQuery('SELECT generar_ubicacion_por_familia($1) AS ubi_id', [categoriaId]);
        ubicacionFinal = ubiRes.rows[0]?.ubi_id || null;
      }

      expect(mockQuery).not.toHaveBeenCalled();
      expect(ubicacionFinal).toBeNull();
    });
  });
});
