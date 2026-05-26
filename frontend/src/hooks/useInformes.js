import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  getTotalizadoFinal, getLiquidacion, getFilterOptions, getComparativa,
  downloadTotalizadoPDF, downloadTotalizadoExcel,
  downloadLiquidacionPDF, downloadLiquidacionExcel, downloadPlantillaGH,
  saveHistorico,
} from '../services/informesApi';

// ─── Hook: Opciones de filtros ─────────────────────────────────
export function useFilterOptions() {
  return useQuery({
    queryKey: ['informes-filter-options'],
    queryFn: getFilterOptions,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Hook: Totalizado Final ────────────────────────────────────
export function useTotalizadoFinal(filters) {
  return useQuery({
    queryKey: ['informe-totalizado', filters],
    queryFn: () => getTotalizadoFinal(filters),
    enabled: true,
    keepPreviousData: true,
  });
}

// ─── Hook: Liquidación GH ──────────────────────────────────────
export function useLiquidacion(filters) {
  return useQuery({
    queryKey: ['informe-liquidacion', filters],
    queryFn: () => getLiquidacion(filters),
    enabled: true,
    keepPreviousData: true,
  });
}

// ─── Hook: Comparativa ─────────────────────────────────────────
export function useComparativa(tipo) {
  return useQuery({
    queryKey: ['informe-comparativa', tipo],
    queryFn: () => getComparativa(tipo),
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
}

// ─── Hook: Acciones de exportación (Totalizado) ────────────────
export function useTotalizadoExports(filters) {
  const [downloading, setDownloading] = React.useState(null);

  const handleDownload = async (type) => {
    setDownloading(type);
    try {
      if (type === 'pdf')   await downloadTotalizadoPDF(filters);
      if (type === 'excel') await downloadTotalizadoExcel(filters);
      toast.success('Descarga iniciada');
    } catch {
      toast.error('Error al generar el archivo');
    } finally {
      setDownloading(null);
    }
  };

  return { handleDownload, downloading };
}

// ─── Hook: Acciones de exportación (Liquidación) ───────────────
export function useLiquidacionExports(filters, totales) {
  const [downloading, setDownloading] = React.useState(null);

  const handleDownload = async (type) => {
    setDownloading(type);
    try {
      if (type === 'pdf')      await downloadLiquidacionPDF(filters);
      if (type === 'excel')    await downloadLiquidacionExcel(filters);
      if (type === 'plantilla') await downloadPlantillaGH(filters);
      toast.success('Descarga iniciada');

      // Guardar histórico al generar reporte
      if (['pdf', 'excel', 'plantilla'].includes(type) && totales) {
        await saveHistorico('LIQUIDACION', {
          total_horas:            totales.total_horas,
          total_comision:         totales.total_comision,
          total_operarios:        totales.total_operarios,
          productividad_promedio: totales.productividad_promedio,
        }, filters).catch(() => {});
      }
    } catch {
      toast.error('Error al generar el archivo');
    } finally {
      setDownloading(null);
    }
  };

  return { handleDownload, downloading };
}
