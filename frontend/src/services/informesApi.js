import api from '../lib/api';

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Opciones de filtros ───────────────────────────────────────
export const getFilterOptions = () =>
  api.get('/informes/filter-options').then(r => r.data.data);

// ─── Totalizado Final ──────────────────────────────────────────
export const getTotalizadoFinal = (params) =>
  api.get('/informes/totalizado', { params }).then(r => r.data);

export const downloadTotalizadoPDF = async (params) => {
  const res = await api.get('/informes/totalizado/pdf', { params, responseType: 'blob' });
  triggerDownload(res.data, `Informe-Totalizado-${Date.now()}.pdf`);
};

export const downloadTotalizadoExcel = async (params) => {
  const res = await api.get('/informes/totalizado/excel', { params, responseType: 'blob' });
  triggerDownload(res.data, `Informe-Totalizado-${Date.now()}.xlsx`);
};

// ─── Liquidación GH ───────────────────────────────────────────
export const getLiquidacion = (params) =>
  api.get('/informes/liquidacion', { params }).then(r => r.data);

export const downloadLiquidacionPDF = async (params) => {
  const res = await api.get('/informes/liquidacion/pdf', { params, responseType: 'blob' });
  triggerDownload(res.data, `Liquidacion-GH-${Date.now()}.pdf`);
};

export const downloadLiquidacionExcel = async (params) => {
  const res = await api.get('/informes/liquidacion/excel', { params, responseType: 'blob' });
  triggerDownload(res.data, `Liquidacion-GH-${Date.now()}.xlsx`);
};

export const downloadPlantillaGH = async (params) => {
  const res = await api.get('/informes/liquidacion/plantilla', { params, responseType: 'blob' });
  triggerDownload(res.data, `Plantilla-GH-${Date.now()}.pdf`);
};

// ─── Comparativas ─────────────────────────────────────────────
export const getComparativa = (tipo) =>
  api.get(`/informes/comparativa/${tipo}`).then(r => r.data.data);

// ─── Guardar histórico ────────────────────────────────────────
export const saveHistorico = (tipo_informe, resumen, filtros_usados = {}) =>
  api.post('/informes/historico', { tipo_informe, resumen, filtros_usados }).then(r => r.data);
