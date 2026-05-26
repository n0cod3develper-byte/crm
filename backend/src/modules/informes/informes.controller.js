import { InformesRepository } from './informes.repository.js';
import { generateInformePdf, generatePlantillaGH } from '../../utils/informesPdfGenerator.js';
import { generateInformeExcel } from '../../utils/informesExcelGenerator.js';

const repo = new InformesRepository();

export const informesController = {

  // ─── Totalizado Final ─────────────────────────────────────────
  async getTotalizadoFinal(req, res, next) {
    try {
      const result = await repo.getTotalizadoFinal(req.query);
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async exportTotalizadoPDF(req, res, next) {
    try {
      const { data, kpis } = await repo.getTotalizadoFinal({ ...req.query, limit: 5000, offset: 0 });
      const buffer = await generateInformePdf({
        tipo: 'TOTALIZADO',
        titulo: 'Informe Totalizado Final',
        data,
        kpis,
        generadoPor: req.user?.full_name || req.user?.email || 'Sistema',
        filtros: req.query,
      });
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Informe-Totalizado-${Date.now()}.pdf"`,
        'Content-Length': buffer.length,
      });
      res.send(buffer);
    } catch (err) { next(err); }
  },

  async exportTotalizadoExcel(req, res, next) {
    try {
      const { data, kpis } = await repo.getTotalizadoFinal({ ...req.query, limit: 5000, offset: 0 });
      const buffer = await generateInformeExcel({
        tipo: 'TOTALIZADO',
        titulo: 'Informe Totalizado Final',
        data,
        kpis,
        generadoPor: req.user?.full_name || req.user?.email || 'Sistema',
        filtros: req.query,
      });
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Informe-Totalizado-${Date.now()}.xlsx"`,
        'Content-Length': buffer.length,
      });
      res.send(buffer);
    } catch (err) { next(err); }
  },

  // ─── Liquidación Gestión Humana ───────────────────────────────
  async getLiquidacion(req, res, next) {
    try {
      const result = await repo.getLiquidacionGestionHumana(req.query);
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  },

  async exportLiquidacionPDF(req, res, next) {
    try {
      const result = await repo.getLiquidacionGestionHumana({ ...req.query, limit: 5000 });
      // Guardar histórico al generar
      await repo.saveHistorico('LIQUIDACION', req.user?.id, req.query, {
        total_horas:            result.totales.total_horas,
        total_comision:         result.totales.total_comision,
        total_operarios:        result.totales.total_operarios,
        productividad_promedio: result.totales.productividad_promedio,
      });
      const buffer = await generateInformePdf({
        tipo: 'LIQUIDACION',
        titulo: 'Liquidación Horas — Gestión Humana',
        data: result.data,
        subtotales: result.subtotalesPorOperario,
        totales: result.totales,
        generadoPor: req.user?.full_name || req.user?.email || 'Sistema',
        filtros: req.query,
      });
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Liquidacion-GH-${Date.now()}.pdf"`,
        'Content-Length': buffer.length,
      });
      res.send(buffer);
    } catch (err) { next(err); }
  },

  async exportLiquidacionExcel(req, res, next) {
    try {
      const result = await repo.getLiquidacionGestionHumana({ ...req.query, limit: 5000 });
      await repo.saveHistorico('LIQUIDACION', req.user?.id, req.query, {
        total_horas:            result.totales.total_horas,
        total_comision:         result.totales.total_comision,
        total_operarios:        result.totales.total_operarios,
        productividad_promedio: result.totales.productividad_promedio,
      });
      const buffer = await generateInformeExcel({
        tipo: 'LIQUIDACION',
        titulo: 'Liquidación Horas — Gestión Humana',
        data: result.data,
        subtotales: result.subtotalesPorOperario,
        totales: result.totales,
        generadoPor: req.user?.full_name || req.user?.email || 'Sistema',
        filtros: req.query,
      });
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Liquidacion-GH-${Date.now()}.xlsx"`,
        'Content-Length': buffer.length,
      });
      res.send(buffer);
    } catch (err) { next(err); }
  },

  async exportPlantillaGH(req, res, next) {
    try {
      const result = await repo.getLiquidacionGestionHumana({ ...req.query, limit: 5000 });
      const buffer = await generatePlantillaGH({
        data: result.data,
        subtotales: result.subtotalesPorOperario,
        totales: result.totales,
        generadoPor: req.user?.full_name || req.user?.email || 'Sistema',
        filtros: req.query,
      });
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Plantilla-GH-${Date.now()}.pdf"`,
        'Content-Length': buffer.length,
      });
      res.send(buffer);
    } catch (err) { next(err); }
  },

  // ─── Comparativas ─────────────────────────────────────────────
  async getComparativa(req, res, next) {
    try {
      const { tipo } = req.params;
      if (!['TOTALIZADO', 'LIQUIDACION'].includes(tipo)) {
        return res.status(400).json({ success: false, message: 'Tipo debe ser TOTALIZADO o LIQUIDACION' });
      }
      const result = await repo.getComparativa(tipo);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  // ─── Opciones de filtros ──────────────────────────────────────
  async getFilterOptions(req, res, next) {
    try {
      const result = await repo.getFilterOptions();
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  // ─── Guardar histórico manualmente ────────────────────────────
  async saveHistorico(req, res, next) {
    try {
      const { tipo_informe, resumen, filtros_usados } = req.body;
      if (!tipo_informe || !resumen) {
        return res.status(400).json({ success: false, message: 'tipo_informe y resumen son requeridos' });
      }
      const saved = await repo.saveHistorico(tipo_informe, req.user?.id, filtros_usados || {}, resumen);
      res.status(201).json({ success: true, data: saved });
    } catch (err) { next(err); }
  },
};
