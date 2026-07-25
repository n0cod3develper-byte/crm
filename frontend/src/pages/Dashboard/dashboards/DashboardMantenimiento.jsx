import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Filter, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import api from '../../../lib/api';

// Componentes existentes
import GraficoOrdenesPorEstado from '../../Informes/components/mantenimiento/GraficoOrdenesPorEstado';
import GraficoEquiposMasMantenimientos from '../../Informes/components/mantenimiento/GraficoEquiposMasMantenimientos';
import GraficoTipoMantenimiento from '../../Informes/components/mantenimiento/GraficoTipoMantenimiento';
import GraficoVentasVsPresupuesto from '../../Informes/components/mantenimiento/GraficoVentasVsPresupuesto';
import GraficoHorasTecnicos from '../../Informes/components/mantenimiento/GraficoHorasTecnicos';
import KpiDisponibilidadFlota from '../../Informes/components/mantenimiento/KpiDisponibilidadFlota';
import GraficoVentasVsPresupuestoMensual from '../../Informes/components/mantenimiento/GraficoVentasVsPresupuestoMensual';
import KpiCostoPorEquipo from '../../Informes/components/mantenimiento/KpiCostoPorEquipo';
import KpiReincidenciaFallas from '../../Informes/components/mantenimiento/KpiReincidenciaFallas';

// Nuevos componentes
import KpiMTTR from '../../Informes/components/mantenimiento/KpiMTTR';
import KpiMTBF from '../../Informes/components/mantenimiento/KpiMTBF';
import ListaPreventivosProximos from '../../Informes/components/mantenimiento/ListaPreventivosProximos';
import AlertaStockBajo from '../../Informes/components/mantenimiento/AlertaStockBajo';
import KpiCobertura from '../../Informes/components/mantenimiento/KpiCobertura';

const getLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ── Widget: Comparación vs Periodo Anterior ──────────────────────────────────
function ComparacionPeriodo({ appliedFilters }) {
  // Calcula el periodo anterior de igual duración
  const periodoAnterior = useMemo(() => {
    if (!appliedFilters?.desde || !appliedFilters?.hasta) return null;
    const d0 = new Date(appliedFilters.desde);
    const d1 = new Date(appliedFilters.hasta);
    const duracion = d1 - d0; // ms
    const prevHasta = new Date(d0.getTime() - 1);
    const prevDesde = new Date(prevHasta.getTime() - duracion);
    return { desde: getLocalDateString(prevDesde), hasta: getLocalDateString(prevHasta) };
  }, [appliedFilters]);

  const fetchOTs = async (params) => {
    const res = await api.get('/informes/mantenimiento/ordenes-por-estado', {
      params: { fecha_inicio: params.desde, fecha_fin: params.hasta }
    });
    const rows = res.data?.data || [];
    return rows.reduce((acc, r) => acc + parseInt(r.total || 0), 0);
  };

  const fetchMTTR = async (params) => {
    const res = await api.get('/informes/mantenimiento/mttr', {
      params: { fecha_inicio: params.desde, fecha_fin: params.hasta }
    });
    return parseFloat(res.data?.data?.mttr_horas || 0);
  };

  const { data: actual, isLoading: loadA } = useQuery({
    queryKey: ['comp-actual', appliedFilters?.desde, appliedFilters?.hasta],
    queryFn: async () => ({
      ots: await fetchOTs(appliedFilters),
      mttr: await fetchMTTR(appliedFilters),
    }),
    enabled: !!appliedFilters?.desde && !!appliedFilters?.hasta,
  });

  const { data: anterior, isLoading: loadB } = useQuery({
    queryKey: ['comp-anterior', periodoAnterior?.desde, periodoAnterior?.hasta],
    queryFn: async () => ({
      ots: await fetchOTs(periodoAnterior),
      mttr: await fetchMTTR(periodoAnterior),
    }),
    enabled: !!periodoAnterior,
  });

  const pctChange = (curr, prev) => {
    if (!prev || prev === 0) return null;
    return (((curr - prev) / prev) * 100).toFixed(1);
  };

  const otsChange = pctChange(actual?.ots, anterior?.ots);
  const mttrChange = pctChange(actual?.mttr, anterior?.mttr);

  // Para OTs: más es mejor. Para MTTR: menos es mejor.
  const OtIcon = otsChange === null ? Minus : otsChange >= 0 ? TrendingUp : TrendingDown;
  const MttrIcon = mttrChange === null ? Minus : mttrChange <= 0 ? TrendingUp : TrendingDown;
  const otColor = otsChange === null ? 'var(--text-muted)' : otsChange >= 0 ? '#10b981' : '#ef4444';
  const mttrColor = mttrChange === null ? 'var(--text-muted)' : mttrChange <= 0 ? '#10b981' : '#ef4444';

  if (loadA || loadB) return (
    <div className="card" style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" /></div>
  );

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          Comparación vs Periodo Anterior
        </h4>
        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Periodo anterior: {periodoAnterior?.desde} → {periodoAnterior?.hasta}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* OTs totales */}
        <div style={{ padding: '1rem', borderRadius: 10, background: 'var(--surface-2)', textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>OTs liquidadas</p>
          <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>{actual?.ots ?? '—'}</p>
          {otsChange !== null && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '4px' }}>
              <OtIcon size={14} color={otColor} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: otColor }}>{otsChange > 0 ? '+' : ''}{otsChange}%</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>vs {anterior?.ots}</span>
            </div>
          )}
          {otsChange === null && <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sin datos anteriores</p>}
        </div>

        {/* MTTR */}
        <div style={{ padding: '1rem', borderRadius: 10, background: 'var(--surface-2)', textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>MTTR promedio</p>
          <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>{actual?.mttr ? `${actual.mttr}h` : '—'}</p>
          {mttrChange !== null && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '4px' }}>
              <MttrIcon size={14} color={mttrColor} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: mttrColor }}>{mttrChange > 0 ? '+' : ''}{mttrChange}%</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>vs {anterior?.mttr}h</span>
            </div>
          )}
          {mttrChange === null && <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sin datos anteriores</p>}
        </div>
      </div>
    </div>
  );
}

// ── Dashboard Principal ───────────────────────────────────────────────────────
export default function DashboardMantenimiento({ nombreModulo }) {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const [fechaInicio, setFechaInicio] = useState(getLocalDateString(firstDay));
  const [fechaFin, setFechaFin] = useState(getLocalDateString(today));

  const [appliedFilters, setAppliedFilters] = useState({
    desde: getLocalDateString(firstDay),
    hasta: getLocalDateString(today)
  });

  const handleApplyFilter = () => {
    setAppliedFilters({ desde: fechaInicio, hasta: fechaFin });
  };

  return (
    <div className="dashboard-mantenimiento-container" style={{ paddingBottom: '2rem' }}>
      {/* ── Filtros por Rango de Fechas ── */}
      <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.35rem' }}>
              <Calendar size={14} className="text-muted" /> Fecha Inicio
            </label>
            <input
              type="date"
              className="input"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.35rem' }}>
              <Calendar size={14} className="text-muted" /> Fecha Fin
            </label>
            <input
              type="date"
              className="input"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>

          <button className="btn btn--primary" onClick={handleApplyFilter} style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '120px' }}>
            <Filter size={15} /> Aplicar Filtros
          </button>
        </div>
      </div>

      {/* ── SECCIÓN 1: Cobertura (siempre visible arriba) ── */}
      <div style={{ marginBottom: '2rem' }}>
        <KpiCobertura appliedFilters={appliedFilters} />
      </div>

      {/* ── SECCIÓN 2: Grid principal ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem' }}>

        {/* Evolución mensual — ancho completo */}
        <div style={{ gridColumn: '1 / -1' }}>
          <GraficoVentasVsPresupuestoMensual appliedFilters={appliedFilters} />
        </div>

        {/* Fila 1 */}
        <KpiDisponibilidadFlota appliedFilters={appliedFilters} />
        <GraficoVentasVsPresupuesto appliedFilters={appliedFilters} />

        {/* Fila 2 */}
        <GraficoHorasTecnicos appliedFilters={appliedFilters} />
        <GraficoOrdenesPorEstado appliedFilters={appliedFilters} />

        {/* Fila 3 */}
        <GraficoTipoMantenimiento appliedFilters={appliedFilters} />
        <GraficoEquiposMasMantenimientos appliedFilters={appliedFilters} />

        {/* Fila 4 */}
        <KpiCostoPorEquipo appliedFilters={appliedFilters} />
        <KpiReincidenciaFallas appliedFilters={appliedFilters} />

        {/* ── NUEVOS KPIs ── */}

        {/* Fila 5: MTTR + MTBF */}
        <KpiMTTR appliedFilters={appliedFilters} />
        <KpiMTBF appliedFilters={appliedFilters} />

        {/* Fila 6: Comparación vs periodo anterior */}
        <ComparacionPeriodo appliedFilters={appliedFilters} />

        {/* Fila 7: Preventivos próximos — ancho completo */}
        <div style={{ gridColumn: '1 / -1' }}>
          <ListaPreventivosProximos />
        </div>

        {/* Fila 8: Stock bajo en OTs activas — ancho completo */}
        <div style={{ gridColumn: '1 / -1' }}>
          <AlertaStockBajo />
        </div>
      </div>
    </div>
  );
}
