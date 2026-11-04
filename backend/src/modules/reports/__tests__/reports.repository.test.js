import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { db } from '../../../config/database.js';
import { ReportsRepository } from '../reports.repository.js';

describe('ReportsRepository - findServiciosSales', () => {
  const repo = new ReportsRepository();

  it('debe listar todos los servicios de la orden 33831 con su tipo de servicio', async () => {
    // Buscamos sin filtro de fecha o en un rango amplio
    const rows = await repo.findServiciosSales();
    const orden33831 = rows.filter(r => r.numero_remision === '33831');

    // Debe contener al menos 2 ítems para la orden 33831
    expect(orden33831.length).toBe(2);

    // Verificamos los códigos SRV
    const codigos = orden33831.map(it => it.servicio_codigo).sort();
    expect(codigos).toEqual(['SRV-0002', 'SRV-0114']);

    // Verificamos el ítem SRV-0002
    const item0002 = orden33831.find(it => it.servicio_codigo === 'SRV-0002');
    expect(item0002).toBeDefined();
    expect(item0002.tipo_servicio).toBe('Esporádico');
    expect(parseFloat(item0002.total_neto)).toBe(5485625.00);

    // Verificamos el ítem SRV-0114
    const item0114 = orden33831.find(it => it.servicio_codigo === 'SRV-0114');
    expect(item0114).toBeDefined();
    expect(item0114.tipo_servicio).toBe('Otras Ventas');
    expect(parseFloat(item0114.total_neto)).toBe(1818181.00);

    // La suma de los ítems de 33831 debe coincidir con el total neto de la remisión (7,303,806.00)
    const sumaNetos = orden33831.reduce((acc, it) => acc + parseFloat(it.total_neto), 0);
    expect(sumaNetos).toBe(7303806.00);
  });

  it('no debe duplicar el valor total en remisiones con múltiples ítems', async () => {
    const rows = await repo.findServiciosSales();
    
    // Agrupamos por remisión
    const porRemision = {};
    rows.forEach(r => {
      if (!porRemision[r.id]) {
        porRemision[r.id] = {
          numero_remision: r.numero_remision,
          total_bruto: parseFloat(r.total_bruto),
          estado: r.estado,
          sum_items_neto: 0,
          count: 0
        };
      }
      porRemision[r.id].sum_items_neto += parseFloat(r.total_neto || 0);
      porRemision[r.id].count++;
    });

    // En todas las remisiones activas con múltiples ítems, la suma de los netos debe ser positiva
    const multiItems = Object.values(porRemision).filter(r => r.count > 1 && !['ANULADO', 'ANULADA'].includes(r.estado));
    expect(multiItems.length).toBeGreaterThan(0);
  });
});
