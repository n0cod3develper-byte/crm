import React, { useState } from 'react';
import { Layout } from '../../components/Layout';
import { Calendar, Filter } from 'lucide-react';
import { KpiHorasOperativas } from './KpiHorasOperativas';
import GraficoVentasPorLinea from './components/servicios/GraficoVentasPorLinea';
import GraficoVentasMensuales from './components/servicios/GraficoVentasMensuales';
import GraficoVentasPorEquipo from './components/servicios/GraficoVentasPorEquipo';
import GraficoVentasVsPresupuesto from './components/servicios/GraficoVentasVsPresupuesto';
import GraficoTop10Clientes from './components/servicios/GraficoTop10Clientes';

const getLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function InformesServiciosPage() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1); // Por defecto el mes actual

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
    <Layout
      title="Informes Analíticos - Servicios"
      subtitle="Métricas y estadísticas del rendimiento de servicios prestados"
    >
      {/* ── Filtros ── */}
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
            <Filter size={15} /> Generar Reporte
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* KPIs de Horas Trabajadas (Nivel Superior) */}
        <KpiHorasOperativas appliedFilters={appliedFilters} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <GraficoVentasVsPresupuesto appliedFilters={appliedFilters} />
          </div>

          <GraficoVentasPorLinea appliedFilters={appliedFilters} />
          
          <GraficoVentasMensuales appliedFilters={appliedFilters} />

          <div style={{ gridColumn: '1 / -1' }}>
            <GraficoVentasPorEquipo appliedFilters={appliedFilters} />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <GraficoTop10Clientes appliedFilters={appliedFilters} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
