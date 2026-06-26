import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users, FileText, FileSpreadsheet, AlertCircle, AlertTriangle,
  RefreshCw, Clock, DollarSign, TrendingUp, TrendingDown, ChevronDown, Filter
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Layout } from '../../components/Layout';
import api from '../../lib/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// ─── Utilidades ────────────────────────────────────────────────────────────────

const HORAS_ESPERADAS_QUINCENA = 88; // 7.33h × 6 días × 2 semanas

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0
  }).format(v || 0);
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`;
}

function formatHoras(h) {
  const num = parseFloat(h);
  if (isNaN(num)) return '—';
  const hh = Math.floor(num);
  const mm = Math.round((num - hh) * 60);
  return `${hh}h ${String(mm).padStart(2, '0')}m`;
}

/** Calcula el rango de la quincena seleccionada */
function calcularRangoQuincena(quincena) {
  // quincena: "Q1-YYYY-MM" o "Q2-YYYY-MM"
  const [tipo, year, month] = quincena.split('-');
  const y = parseInt(year);
  const m = parseInt(month) - 1;
  if (tipo === 'Q1') {
    const inicio = new Date(y, m, 1);
    const fin    = new Date(y, m, 15);
    return { inicio: fmtDate(inicio), fin: fmtDate(fin) };
  } else {
    const inicio = new Date(y, m, 16);
    const fin    = new Date(y, m + 1, 0); // último día del mes
    return { inicio: fmtDate(inicio), fin: fmtDate(fin) };
  }
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nombreMes(m) {
  return ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m];
}

/** Genera todas las quincenas completadas del año en curso, más reciente primero.
 *
 * Regla:
 *  - Si hoy es día 1-15: estamos en Q1 → última quincena PAGABLE = Q2 del mes anterior.
 *  - Si hoy es día 16-31: estamos en Q2 → última quincena PAGABLE = Q1 del mes actual.
 *
 * Ejemplo: 26/06 → está en Q2 de junio → la quincena a liquidar es Q1 de junio (01-15/06).
 */
function generarOpcionesQuincena() {
  const hoy  = new Date();
  const año  = hoy.getFullYear();
  const mesHoy = hoy.getMonth();   // 0-indexed
  const diaHoy = hoy.getDate();

  // Determinar la quincena completada más reciente
  let curMes, curQ;
  if (diaHoy <= 15) {
    // Estamos en Q1 del mes actual → última completada = Q2 del mes anterior
    curMes = mesHoy - 1;
    curQ   = 2;
    if (curMes < 0) curMes = 0; // protección enero
  } else {
    // Estamos en Q2 del mes actual → última completada = Q1 del mes actual
    curMes = mesHoy;
    curQ   = 1;
  }

  const opciones = [];

  // Recorrer hacia atrás desde la quincena más reciente hasta enero Q1
  while (curMes >= 0) {
    const mStr     = String(curMes + 1).padStart(2, '0');
    const ultimoDia = new Date(año, curMes + 1, 0).getDate();

    if (curQ === 2) {
      opciones.push({
        value: `Q2-${año}-${mStr}`,
        label: `2ª quincena – ${nombreMes(curMes)} ${año} (16 al ${ultimoDia})`,
      });
      curQ = 1; // siguiente: Q1 del mismo mes
    } else {
      opciones.push({
        value: `Q1-${año}-${mStr}`,
        label: `1ª quincena – ${nombreMes(curMes)} ${año} (01 al 15)`,
      });
      curMes--; // mes anterior, Q2
      curQ = 2;
    }
  }

  return opciones;
}

/** Genera observación automática para el resumen de productividad */
function generarObservacion(horasActual, horasAnterior, productividad) {
  const variacion = horasActual - horasAnterior;
  const pct = horasAnterior > 0 ? ((variacion / horasAnterior) * 100).toFixed(1) : null;
  if (horasAnterior === 0) {
    return productividad >= 80 ? 'Primer registro. Productividad dentro del rango esperado.' : 'Primer registro. Productividad por debajo del objetivo.';
  }
  if (variacion > 2) return `Aumentó ${formatHoras(Math.abs(variacion))} (${pct}%) respecto a la quincena anterior.`;
  if (variacion < -2) return `Bajó ${formatHoras(Math.abs(variacion))} (${Math.abs(pct)}%) respecto a la quincena anterior.`;
  return 'Se mantuvo estable respecto a la quincena anterior.';
}

// ─── Componente Principal ──────────────────────────────────────────────────────

export function InformesGestionHumanaPage() {
  const opciones = useMemo(() => generarOpcionesQuincena(), []);
  const [quincenaSeleccionada, setQuincenaSeleccionada] = useState(opciones[0]?.value || '');
  const [quincenaAplicada, setQuincenaAplicada] = useState(opciones[0]?.value || '');

  const rango = useMemo(() => quincenaAplicada ? calcularRangoQuincena(quincenaAplicada) : null, [quincenaAplicada]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['liquidacionBonificacion', rango?.inicio, rango?.fin],
    queryFn: async () => {
      const res = await api.get('/informes/gestion-humana/liquidacion-bonificacion', {
        params: { fecha_inicio: rango.inicio, fecha_fin: rango.fin }
      });
      return res.data;
    },
    enabled: !!rango,
  });

  // ── Agrupación por operario ────────────────────────────────────────────────
  const gruposOperario = useMemo(() => {
    if (!data?.detalle) return [];
    const mapa = new Map();
    for (const row of data.detalle) {
      if (!mapa.has(row.operario_id)) {
        mapa.set(row.operario_id, { operario_id: row.operario_id, operario_nombre: row.operario_nombre, filas: [] });
      }
      mapa.get(row.operario_id).filas.push(row);
    }
    return Array.from(mapa.values()).map(g => ({
      ...g,
      cedula: g.filas[0]?.cedula || '—',
      subtotal_horas: g.filas.reduce((s, f) => s + f.horas_efectivas, 0),
      subtotal_comision: g.filas.reduce((s, f) => s + f.comision, 0),
    }));
  }, [data]);

  const totalGeneral = useMemo(() => ({
    registros: data?.detalle?.length || 0,
    horas: gruposOperario.reduce((s, g) => s + g.subtotal_horas, 0),
    comision: gruposOperario.reduce((s, g) => s + g.subtotal_comision, 0),
  }), [gruposOperario, data]);

  // ── Resumen de productividad ────────────────────────────────────────────────
  const resumenProductividad = useMemo(() => {
    if (!data) return [];
    const anteriorMap = new Map(
      (data.quincena_anterior?.por_operario || []).map(r => [r.operario_id, r])
    );
    return gruposOperario.map(g => {
      const anterior = anteriorMap.get(g.operario_id);
      const horasAnt = anterior?.horas_total || 0;
      const variacion = g.subtotal_horas - horasAnt;
      const variacionPct = horasAnt > 0 ? (variacion / horasAnt) * 100 : null;
      const productividad = (g.subtotal_horas / HORAS_ESPERADAS_QUINCENA) * 100;
      return {
        operario_nombre: g.operario_nombre,
        cedula: g.cedula,
        maquina_nombre: g.filas[0]?.maquina_nombre || '—',
        horas_actual: g.subtotal_horas,
        horas_anterior: horasAnt,
        variacion,
        variacion_pct: variacionPct,
        productividad,
        observacion: generarObservacion(g.subtotal_horas, horasAnt, productividad),
      };
    });
  }, [gruposOperario, data]);

  const alertas = data?.alertas || {};
  const totalAlertas = (alertas.sin_operario?.length || 0) +
    (alertas.sin_horas?.length || 0) +
    (alertas.bonificacion_cero?.length || 0) +
    (alertas.horas_invalidas?.length || 0);

  // ── Etiqueta de quincena aplicada ──────────────────────────────────────────
  const etiquetaQuincena = useMemo(() => {
    const op = opciones.find(o => o.value === quincenaAplicada);
    return op?.label || '';
  }, [quincenaAplicada, opciones]);

  // ── Exportar PDF ───────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    if (!data?.detalle?.length) { toast.error('No hay datos para exportar'); return; }
    try {
      const doc = new jsPDF('l', 'mm', 'a4');

      // Header
      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text('LIQUIDACIÓN DE BONIFICACIÓN POR HORAS', 14, 18);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`Gestión Humana — ${etiquetaQuincena}`, 14, 25);
      doc.text(`Período: ${formatDate(rango.inicio)} al ${formatDate(rango.fin)}`, 14, 30);
      doc.text(`Generado el: ${new Date().toLocaleString('es-CO')}`, 14, 35);
      doc.setFont('helvetica', 'bold'); doc.text('CARGAR SAS', 230, 20);
      doc.setFont('helvetica', 'normal'); doc.text('Dpto. Gestión Humana', 230, 26);
      doc.line(14, 39, 282, 39);

      // Sección 1 – Detalle
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('SECCIÓN 1 — DETALLE POR OPERARIO', 14, 46);

      const bodyDetalle = [];
      for (const g of gruposOperario) {
        for (const f of g.filas) {
          bodyDetalle.push([
            g.operario_nombre, f.numero_remision, f.maquina_nombre,
            formatDate(f.fecha_servicio), f.estado || '—', formatCOP(f.bonificacion_hora),
            formatHoras(f.horas_efectivas), formatCOP(f.comision)
          ]);
        }
        bodyDetalle.push([
          { content: `Subtotal ${g.operario_nombre}`, colSpan: 6, styles: { fontStyle: 'bold', fillColor: [243,244,246] } },
          { content: formatHoras(g.subtotal_horas), styles: { fontStyle: 'bold', halign: 'right', fillColor: [243,244,246] } },
          { content: formatCOP(g.subtotal_comision), styles: { fontStyle: 'bold', halign: 'right', fillColor: [243,244,246] } },
        ]);
      }
      bodyDetalle.push([
        { content: `TOTALES GENERALES — ${totalGeneral.registros} registros`, colSpan: 6, styles: { fontStyle: 'bold', fillColor: [99,102,241], textColor: [255,255,255] } },
        { content: formatHoras(totalGeneral.horas), styles: { fontStyle: 'bold', halign: 'right', fillColor: [99,102,241], textColor: [255,255,255] } },
        { content: formatCOP(totalGeneral.comision), styles: { fontStyle: 'bold', halign: 'right', fillColor: [99,102,241], textColor: [255,255,255] } },
      ]);

      autoTable(doc, {
        startY: 50,
        head: [['Operario', 'N° Orden', 'Máquina', 'Fecha', 'Estado', 'Bonif x Hora', 'Horas Liq.', 'Comisión $']],
        body: bodyDetalle,
        theme: 'grid',
        headStyles: { fillColor: [99,102,241], textColor: [255,255,255], fontStyle: 'bold', halign: 'center', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 42 }, 1: { cellWidth: 18, halign: 'center' },
          2: { cellWidth: 38 }, 3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 20, halign: 'center' },
          5: { cellWidth: 22, halign: 'right' }, 6: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
          7: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
        },
      });

      // Sección 2 – Productividad
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('SECCIÓN 2 — RESUMEN DE PRODUCTIVIDAD', 14, finalY);

      const bodyProd = resumenProductividad.map(r => [
        r.cedula || '—', r.operario_nombre, r.maquina_nombre,
        formatHoras(r.horas_actual), formatHoras(r.horas_anterior),
        (r.variacion >= 0 ? '+' : '') + formatHoras(Math.abs(r.variacion)),
        r.variacion_pct !== null ? `${r.variacion >= 0 ? '+' : ''}${r.variacion_pct.toFixed(1)}%` : 'N/A',
        `${r.productividad.toFixed(1)}%`,
        r.observacion
      ]);

      autoTable(doc, {
        startY: finalY + 4,
        head: [['Cédula','Operario','Máquina','Hrs Actual','Hrs Anterior','Variación','Var %','Productividad','Observación']],
        body: bodyProd,
        theme: 'grid',
        headStyles: { fillColor: [16,185,129], textColor: [255,255,255], fontStyle: 'bold', halign: 'center', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 22, halign: 'center', fontFamily: 'courier' },
          1: { cellWidth: 38 }, 2: { cellWidth: 30 },
          3: { cellWidth: 18, halign: 'right' }, 4: { cellWidth: 18, halign: 'right' },
          5: { cellWidth: 18, halign: 'right' }, 6: { cellWidth: 12, halign: 'center' },
          7: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
          8: { cellWidth: 50 },
        },
        didParseCell: (hookData) => {
          if (hookData.section === 'body' && hookData.column.index === 7) {
            const pct = parseFloat(hookData.cell.raw);
            if (pct >= 90) hookData.cell.styles.textColor = [16,185,129];
            else if (pct >= 70) hookData.cell.styles.textColor = [245,158,11];
            else hookData.cell.styles.textColor = [239,68,68];
          }
        }
      });

      doc.save(`Liquidacion_Bonificacion_${rango.inicio}_${rango.fin}.pdf`);
      toast.success('PDF descargado con éxito');
    } catch (err) {
      console.error(err); toast.error('Error al generar el PDF');
    }
  };

  // ── Exportar Excel ─────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (!data?.detalle?.length) { toast.error('No hay datos para exportar'); return; }
    try {
      const wb = XLSX.utils.book_new();
      const ahora = new Date();
      const fechaGen = `${String(ahora.getDate()).padStart(2,'0')}/${String(ahora.getMonth()+1).padStart(2,'0')}/${ahora.getFullYear()} ${String(ahora.getHours()).padStart(2,'0')}:${String(ahora.getMinutes()).padStart(2,'0')} AM`;

      // ── HOJA 1: INFORME BONIFICACIÓN (estilo foto) ──────────────────
      // Construir resumen por operario (un solo renglón por operario)
      const resumenMap = new Map(resumenProductividad.map(r => [r.operario_nombre, r]));

      const aoa1 = [];
      // Fila 1: Título principal
      aoa1.push([`INFORME GESTIÓN HUMANA. LIQUIDACIÓN DE BONIFICACIÓN POR HORAS  ${etiquetaQuincena.toUpperCase()}`]);
      aoa1.push([]); // espacio
      // Fila 3: Encabezados de tabla
      aoa1.push([
        'Cédula', 'Operario', 'Productividad (%)',
        'Horas Liquidadas', 'Horas Anteriores', 'Variación (hrs)', 'Variación (%)',
        'Comisión en Pesos', 'Observación',
      ]);
      // Filas de datos: una por operario
      for (const g of gruposOperario) {
        const prod = resumenMap.get(g.operario_nombre);
        aoa1.push([
          g.cedula || '—',
          g.operario_nombre,
          prod ? `${prod.productividad.toFixed(2)}%` : '—',
          `Suma ${g.subtotal_horas.toFixed(2)}`,
          prod ? `Suma ${prod.horas_anterior.toFixed(2)}` : '—',
          prod
            ? `${prod.variacion >= 0 ? '+' : ''}${prod.variacion.toFixed(2)}`
            : '—',
          prod && prod.variacion_pct !== null
            ? `${prod.variacion >= 0 ? '+' : ''}${prod.variacion_pct.toFixed(1)}%`
            : 'N/A',
          `Suma ${g.subtotal_comision.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`,
          prod ? prod.observacion : '—',
        ]);
      }
      // Fila Grand Total
      const prodPromedio1 = resumenProductividad.length > 0
        ? resumenProductividad.reduce((s, r) => s + r.productividad, 0) / resumenProductividad.length
        : 0;
      aoa1.push([
        '', 'Grand Total',
        `${prodPromedio1.toFixed(2)}%`,
        `Suma ${totalGeneral.horas.toFixed(2)}`,
        '', '', '',
        `Suma ${totalGeneral.comision.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`,
        '',
      ]);
      aoa1.push([]); // espacio
      // Pie de página
      aoa1.push([`Generado por ${fechaGen} en Mercadeo Cargar`]);
      aoa1.push([
        `Cantidad de registros : ${totalGeneral.registros}`,
        '',
        `Suma de Horas liquidadas : ${totalGeneral.horas.toFixed(2)}`,
        '', '', '', '',
        `Suma de Comisión en pesos horas : ${totalGeneral.comision.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`,
        '',
      ]);

      const ws1 = XLSX.utils.aoa_to_sheet(aoa1);
      ws1['!cols'] = [
        { wch: 18 }, // Cédula
        { wch: 35 }, // Operario
        { wch: 18 }, // Productividad
        { wch: 22 }, // Horas actuales
        { wch: 22 }, // Horas anteriores
        { wch: 18 }, // Variación hrs
        { wch: 14 }, // Variación %
        { wch: 30 }, // Comisión
        { wch: 60 }, // Observación
      ];
      // Merge título (fila 1, columnas A-I)
      ws1['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      ];
      XLSX.utils.book_append_sheet(wb, ws1, 'Informe Bonificación');

      // ── HOJA 2: RESUMEN PRODUCTIVIDAD ───────────────────────────────
      const aoa2 = [];
      aoa2.push([`RESUMEN DE PRODUCTIVIDAD — ${etiquetaQuincena.toUpperCase()}`]);
      aoa2.push([`Comparado con: ${data.quincena_anterior?.fecha_inicio || ''} al ${data.quincena_anterior?.fecha_fin || ''}`]);
      aoa2.push([]);
      aoa2.push([
        'Cédula', 'Operario', 'Máquina',
        'Horas Actual', 'Horas Anterior', 'Variación (hrs)', 'Variación (%)',
        'Productividad (%)', 'Observación',
      ]);
      for (const r of resumenProductividad) {
        // Get cedula from gruposOperario
        const grupo = gruposOperario.find(g => g.operario_nombre === r.operario_nombre);
        const cedula = grupo?.filas[0]?.cedula || '—';
        aoa2.push([
          cedula,
          r.operario_nombre,
          r.maquina_nombre,
          parseFloat(r.horas_actual.toFixed(2)),
          parseFloat(r.horas_anterior.toFixed(2)),
          parseFloat(r.variacion.toFixed(2)),
          r.variacion_pct !== null ? parseFloat(r.variacion_pct.toFixed(1)) : null,
          parseFloat(r.productividad.toFixed(2)),
          r.observacion,
        ]);
      }
      // Totales productividad
      const prodPromedio = resumenProductividad.length > 0
        ? resumenProductividad.reduce((s, r) => s + r.productividad, 0) / resumenProductividad.length
        : 0;
      aoa2.push([]);
      aoa2.push(['', 'PROMEDIO PRODUCTIVIDAD', '', '', '', '', '', parseFloat(prodPromedio.toFixed(2)), '']);
      aoa2.push([]);
      aoa2.push([`Generado por ${fechaGen} en Mercadeo Cargar`]);

      const ws2 = XLSX.utils.aoa_to_sheet(aoa2);
      ws2['!cols'] = [
        { wch: 18 }, { wch: 35 }, { wch: 30 }, { wch: 16 }, { wch: 16 },
        { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 55 },
      ];
      ws2['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
      ];
      XLSX.utils.book_append_sheet(wb, ws2, 'Resumen Productividad');

      XLSX.writeFile(wb, `Liquidacion_Bonificacion_${rango.inicio}_${rango.fin}.xlsx`);
      toast.success('Excel descargado con éxito');
    } catch (err) {
      console.error(err); toast.error('Error al generar el Excel');
    }
  };


  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout
      title="Liquidación de Bonificación por Horas"
      subtitle="Gestión Humana — Informe Quincenal de Comisiones de Operarios"
      rightContent={
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn--secondary" onClick={handleExportPDF} disabled={isLoading || !data?.detalle?.length}>
            <FileText size={16} /> Exportar PDF
          </button>
          <button className="btn btn--secondary" onClick={handleExportExcel} disabled={isLoading || !data?.detalle?.length}>
            <FileSpreadsheet size={16} /> Exportar Excel
          </button>
        </div>
      }
    >
      {/* ── Selector de Quincena ─────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}>
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.35rem' }}>
              <Clock size={14} className="text-muted" /> Quincena a liquidar
            </label>
            <div style={{ position: 'relative' }}>
              <select
                className="input"
                value={quincenaSeleccionada}
                onChange={e => setQuincenaSeleccionada(e.target.value)}
                style={{ paddingRight: '2.5rem', appearance: 'none' }}
              >
                {opciones.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown size={16} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            </div>
          </div>

          {rango && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingBottom: '0.35rem' }}>
              Período: <strong style={{ color: 'var(--text-secondary)' }}>{formatDate(rango.inicio)}</strong> al <strong style={{ color: 'var(--text-secondary)' }}>{formatDate(rango.fin)}</strong>
            </div>
          )}

          <button
            className="btn btn--primary"
            onClick={() => setQuincenaAplicada(quincenaSeleccionada)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '140px' }}
          >
            <Filter size={15} /> Generar Informe
          </button>
        </div>
      </div>

      {/* ── Estados de carga / error ─────────────────────────────────── */}
      {isLoading ? (
        <div className="empty-state" style={{ minHeight: '300px' }}>
          <div className="spinner" />
          <p className="text-muted" style={{ marginTop: '1rem' }}>Calculando liquidación de bonificaciones...</p>
        </div>
      ) : error ? (
        <div className="card" style={{ border: '1px solid var(--clr-danger-500)', background: 'var(--clr-danger-500)0b', padding: '2rem', textAlign: 'center' }}>
          <AlertCircle size={40} style={{ color: 'var(--clr-danger-500)', marginBottom: '1rem' }} />
          <h3 style={{ color: 'var(--clr-danger-400)', marginBottom: '0.5rem' }}>Error en consulta</h3>
          <p className="text-muted">{error.response?.data?.message || error.message}</p>
          <button className="btn btn--secondary" onClick={() => refetch()} style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      ) : !data ? null : (
        <>
          {/* ── Panel de Alertas ─────────────────────────────────────── */}
          {totalAlertas > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {alertas.sin_operario?.length > 0 && (
                <AlertaBanner
                  tipo="warning"
                  icono={<AlertTriangle size={16} />}
                  titulo={`${alertas.sin_operario.length} servicio(s) LIQUIDADO(s) sin operario asignado — No aplican bonificación`}
                  items={alertas.sin_operario.map(a => `OS ${a.numero_remision} · ${formatDate(a.fecha_servicio)} · Máq: ${a.numero_maquina}`)}
                />
              )}
              {alertas.sin_horas?.length > 0 && (
                <AlertaBanner
                  tipo="danger"
                  icono={<AlertCircle size={16} />}
                  titulo={`${alertas.sin_horas.length} servicio(s) con operario pero sin Hora Salida/Llegada CARGAR registradas`}
                  items={alertas.sin_horas.map(a => `OS ${a.numero_remision} · ${formatDate(a.fecha_servicio)}`)}
                />
              )}
              {alertas.bonificacion_cero?.length > 0 && (
                <AlertaBanner
                  tipo="danger"
                  icono={<AlertCircle size={16} />}
                  titulo={`${alertas.bonificacion_cero.length} servicio(s) con Bonificación x Hora = $0 — Revisar configuración del equipo`}
                  items={alertas.bonificacion_cero.map(a => `OS ${a.numero_remision} · ${formatDate(a.fecha_servicio)} · Máq: ${a.numero_maquina}`)}
                />
              )}
              {alertas.horas_invalidas?.length > 0 && (
                <AlertaBanner
                  tipo="warning"
                  icono={<AlertTriangle size={16} />}
                  titulo={`${alertas.horas_invalidas.length} servicio(s) con horas calculadas = 0 o negativas (posible error en registro)`}
                  items={alertas.horas_invalidas.map(a => `OS ${a.numero_remision} · ${formatDate(a.fecha_servicio)}`)}
                />
              )}
            </div>
          )}

          {/* ── KPI Strip ────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <KpiCard label="Registros" valor={totalGeneral.registros} icono={<Users size={18} />} color="#6366f1" />
            <KpiCard label="Horas Liquidadas" valor={formatHoras(totalGeneral.horas)} icono={<Clock size={18} />} color="#10b981" />
            <KpiCard label="Comisión Total" valor={formatCOP(totalGeneral.comision)} icono={<DollarSign size={18} />} color="#f59e0b" />
            <KpiCard label="Operarios activos" valor={gruposOperario.length} icono={<Users size={18} />} color="#8b5cf6" />
          </div>

          {/* ── SECCIÓN 1 – Detalle por Operario ─────────────────────── */}
          {gruposOperario.length === 0 ? (
            <div className="empty-state" style={{ minHeight: '250px' }}>
              <Users size={48} className="empty-state__icon" />
              <h2 className="empty-state__title">Sin registros</h2>
              <p className="empty-state__desc">No se encontraron servicios LIQUIDADOS con operarios asignados en la quincena seleccionada.</p>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: '2rem', overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(99,102,241,0.1)', padding: '8px', borderRadius: '8px' }}>
                  <Users size={20} color="#6366f1" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Sección 1 — Detalle por Operario</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Cantidad de registros: {totalGeneral.registros} &nbsp;|&nbsp;
                    Horas liquidadas: {formatHoras(totalGeneral.horas)} &nbsp;|&nbsp;
                    Comisión total: {formatCOP(totalGeneral.comision)}
                  </p>
                </div>
              </div>

              <div className="table-wrapper" style={{ borderRadius: 0, border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Operario</th>
                      <th style={{ width: 110 }}>N° Orden S.</th>
                      <th>Máquina</th>
                      <th style={{ width: 100 }}>Fecha</th>
                      <th style={{ width: 90, textAlign: 'center' }}>Estado</th>
                      <th style={{ width: 120, textAlign: 'right' }}>Bonif. x Hora</th>
                      <th style={{ width: 110, textAlign: 'right' }}>Horas Liq.</th>
                      <th style={{ width: 130, textAlign: 'right' }}>Comisión $</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gruposOperario.map(g => (
                      <React.Fragment key={g.operario_id}>
                        {/* Cabecera del grupo */}
                        <tr style={{ background: 'rgba(99,102,241,0.04)' }}>
                          <td colSpan={8} style={{ padding: '0.6rem 1rem', fontWeight: 700, fontSize: '0.85rem', color: '#6366f1', letterSpacing: '0.02em' }}>
                            <Users size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                            {g.operario_nombre}
                            {g.filas[0]?.cedula && g.filas[0].cedula !== '—' && (
                              <span style={{ marginLeft: 10, fontWeight: 400, fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                CC {g.filas[0].cedula}
                              </span>
                            )}
                          </td>
                        </tr>
                        {/* Filas del grupo */}
                        {g.filas.map((f, idx) => (
                          <tr key={`${g.operario_id}-${f.id}-${idx}`}>
                            <td style={{ paddingLeft: '2rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</td>
                            <td>
                              <code style={{ fontWeight: 700, fontSize: '13px', color: 'var(--clr-primary-400)' }}>
                                {f.numero_remision}
                              </code>
                              {f.is_servicio_fijo && (
                                <span style={{ marginLeft: 6, display: 'inline-block', padding: '1px 6px', borderRadius: 4, background: 'var(--clr-primary-100)', color: 'var(--clr-primary-700)', fontSize: '10px', fontWeight: 800 }}>
                                  FIJO
                                </span>
                              )}
                            </td>
                            <td>
                              <span style={{ fontWeight: 500, fontSize: '13px' }}>{f.maquina_nombre}</span>
                              {f.equipo_serial && (
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>S/N: {f.equipo_serial}</div>
                              )}
                            </td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{formatDate(f.fecha_servicio)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '20px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: f.estado === 'LIQUIDADA' ? 'rgba(99,102,241,0.12)' : 'rgba(16,185,129,0.12)',
                                color: f.estado === 'LIQUIDADA' ? '#6366f1' : '#10b981',
                              }}>{f.estado}</span>
                            </td>
                            <td style={{ textAlign: 'right', fontSize: '13px' }}>{formatCOP(f.bonificacion_hora)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '13px', color: 'var(--clr-primary-400)' }}>
                              {formatHoras(f.horas_efectivas)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '13px', color: 'var(--clr-success-500)' }}>
                              {formatCOP(f.comision)}
                            </td>
                          </tr>
                        ))}
                        {/* Subtotal del grupo */}
                        <tr style={{ background: 'var(--bg-subtle)', borderTop: '2px solid var(--border-color)' }}>
                          <td colSpan={6} style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '2rem' }}>
                            Subtotal {g.operario_nombre} — {g.filas.length} servicio(s)
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--clr-primary-400)' }}>
                            {formatHoras(g.subtotal_horas)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--clr-success-500)' }}>
                            {formatCOP(g.subtotal_comision)}
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                  {/* Total general */}
                  <tfoot style={{ borderTop: '3px solid var(--clr-primary-400)', background: 'rgba(99,102,241,0.07)' }}>
                    <tr style={{ fontWeight: 800 }}>
                      <td colSpan={6} style={{ color: '#6366f1', fontSize: '0.9rem' }}>
                        TOTALES GENERALES — {totalGeneral.registros} registros
                      </td>
                      <td style={{ textAlign: 'right', color: '#6366f1', fontSize: '1rem' }}>
                        {formatHoras(totalGeneral.horas)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--clr-success-500)', fontSize: '1rem' }}>
                        {formatCOP(totalGeneral.comision)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── SECCIÓN 2 – Resumen de Productividad ─────────────────── */}
          {resumenProductividad.length > 0 && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(16,185,129,0.1)', padding: '8px', borderRadius: '8px' }}>
                  <TrendingUp size={20} color="#10b981" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Sección 2 — Resumen de Productividad</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Comparación con quincena anterior ({formatDate(data.quincena_anterior?.fecha_inicio)} – {formatDate(data.quincena_anterior?.fecha_fin)}) · Objetivo: {HORAS_ESPERADAS_QUINCENA}h
                  </p>
                </div>
              </div>

              <div className="table-wrapper" style={{ borderRadius: 0, border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                       <th style={{ width: 120 }}>Cédula</th>
                       <th>Operario</th>
                       <th>Máquina</th>
                       <th style={{ textAlign: 'right', width: 110 }}>Hrs Actual</th>
                       <th style={{ textAlign: 'right', width: 110 }}>Hrs Anterior</th>
                       <th style={{ textAlign: 'right', width: 100 }}>Variación</th>
                       <th style={{ textAlign: 'center', width: 80 }}>Var %</th>
                       <th style={{ textAlign: 'center', width: 120 }}>Productividad</th>
                       <th>Observación</th>
                     </tr>
                  </thead>
                  <tbody>
                    {resumenProductividad.map((r, idx) => {
                      const prodColor = r.productividad >= 90 ? 'var(--clr-success-500)' : r.productividad >= 70 ? '#f59e0b' : 'var(--clr-danger-500)';
                      const varColor = r.variacion >= 0 ? 'var(--clr-success-500)' : 'var(--clr-danger-500)';
                      return (
                        <tr key={idx}>
                           <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>{r.cedula || '—'}</td>
                           <td style={{ fontWeight: 600, fontSize: '13px' }}>{r.operario_nombre}</td>
                           <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.maquina_nombre}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--clr-primary-400)' }}>{formatHoras(r.horas_actual)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatHoras(r.horas_anterior)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: varColor }}>
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                              {r.variacion >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                              {r.variacion >= 0 ? '+' : ''}{formatHoras(Math.abs(r.variacion))}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', color: varColor, fontWeight: 700, fontSize: '13px' }}>
                            {r.variacion_pct !== null ? `${r.variacion >= 0 ? '+' : ''}${r.variacion_pct.toFixed(1)}%` : 'N/A'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                              <span style={{ fontWeight: 800, fontSize: '14px', color: prodColor }}>{r.productividad.toFixed(1)}%</span>
                              <div style={{ width: '80px', height: 5, background: 'var(--border-color)', borderRadius: 3 }}>
                                <div style={{ width: `${Math.min(r.productividad, 100)}%`, height: '100%', background: prodColor, borderRadius: 3 }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{r.observacion}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function KpiCard({ label, valor, icono, color }) {
  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
          <p style={{ margin: '0.35rem 0 0', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{valor}</p>
        </div>
        <div style={{ background: `${color}18`, padding: '10px', borderRadius: '10px', color }}>
          {icono}
        </div>
      </div>
    </div>
  );
}

function AlertaBanner({ tipo, icono, titulo, items }) {
  const [expanded, setExpanded] = useState(false);
  const colorMap = {
    warning: { bg: 'rgba(245,158,11,0.08)', border: '#f59e0b', text: '#b45309' },
    danger:  { bg: 'rgba(239,68,68,0.08)',  border: '#ef4444', text: '#dc2626' },
  };
  const c = colorMap[tipo] || colorMap.warning;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}40`, borderRadius: '8px', padding: '0.75rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
        <span style={{ color: c.border }}>{icono}</span>
        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: c.text, flex: 1 }}>{titulo}</span>
        <ChevronDown size={14} style={{ color: c.border, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>
      {expanded && items.length > 0 && (
        <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0, fontSize: '0.78rem', color: c.text, lineHeight: 1.8 }}>
          {items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      )}
    </div>
  );
}
