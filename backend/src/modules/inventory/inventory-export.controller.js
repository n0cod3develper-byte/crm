import { query } from '../../config/database.js';
import { inventoryExportService } from './inventory-export.service.js';

export const inventoryExportController = {
  /**
   * GET /api/v1/inventario/export
   * Exporta inventario filtrado por área y/o rango de fechas.
   *
   * Query params:
   *   - area: 'all' | 'MANTENIMIENTO' | 'SISTEMAS' | 'SST' | 'LOCATIVO'
   *   - fecha_desde: YYYY-MM-DD (fecha mínima de creación)
   *   - fecha_hasta: YYYY-MM-DD (fecha máxima de creación)
   *   - formato: 'excel' | 'csv' (default: 'excel')
   */
  async export(req, res, next) {
    try {
      const { area = 'all', fecha_desde, fecha_hasta, formato = 'excel' } = req.query;

      // Obtener datos filtrados
      const data = await inventoryExportService.getAllAreaData({
        area: area || 'all',
        fecha_desde: fecha_desde || undefined,
        fecha_hasta: fecha_hasta || undefined,
      });

      if (data.length === 0) {
        return res.status(404).json({
          success: false,
          error: { message: 'No hay datos de inventario que coincidan con los filtros seleccionados' },
        });
      }

      const areaLabel = area && area !== 'all' ? area : 'Todas las áreas';
      const fechaStr = new Date().toISOString().split('T')[0];
      const filename = `inventario_${area.toLowerCase()}_${fechaStr}`;

      if (formato === 'csv') {
        const csv = await inventoryExportService.generateCSV(data, { area });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        return res.send(csv);
      }

      // Generar Excel
      const workbook = await inventoryExportService.generateExcel(data, {
        area,
        fecha_desde: fecha_desde || undefined,
        fecha_hasta: fecha_hasta || undefined,
      });

      const buffer = await workbook.xlsx.writeBuffer();

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      res.setHeader('Content-Length', buffer.byteLength);
      res.send(Buffer.from(buffer));
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/inventario/export/resumen
   * Exporta solo el resumen contable del inventario locativo (CSV rápido).
   */
  async exportResumen(req, res, next) {
    try {

      const result = await query(`
        SELECT
          'MANTENIMIENTO' AS area,
          COUNT(*) AS total_items,
          COALESCE(SUM(unit_price), 0) AS valor_total
        FROM inventario WHERE area = 'MANTENIMIENTO'
        UNION ALL
        SELECT 'SISTEMAS', COUNT(*), COALESCE(SUM(unit_price), 0)
        FROM inventario WHERE area = 'SISTEMAS'
        UNION ALL
        SELECT 'SST', COUNT(*), COALESCE(SUM(unit_price), 0)
        FROM inventario WHERE area = 'SST'
        UNION ALL
        SELECT 'LOCATIVO',
          COUNT(*),
          COALESCE(SUM(costo_historico), 0)
        FROM inventario_locativo WHERE activo = TRUE
        ORDER BY area
      `);

      const csvRows = ['Área;Total Ítems;Valor Total'];
      for (const row of result.rows) {
        csvRows.push(`${row.area};${row.total_items};${parseFloat(row.valor_total).toFixed(2)}`);
      }

      const csv = '\uFEFF' + csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="resumen_inventario_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } catch (err) {
      next(err);
    }
  },
};
