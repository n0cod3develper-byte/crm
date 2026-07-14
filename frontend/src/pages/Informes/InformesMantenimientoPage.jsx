import React, { useState } from 'react';
import { Layout } from '../../components/Layout';
import { Calendar, Filter } from 'lucide-react';
import GraficoOrdenesPorEstado from './components/mantenimiento/GraficoOrdenesPorEstado';
import GraficoEquiposMasMantenimientos from './components/mantenimiento/GraficoEquiposMasMantenimientos';
import GraficoTipoMantenimiento from './components/mantenimiento/GraficoTipoMantenimiento';

const getLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function InformesMantenimientoPage() {
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
    <Layout
      title="Informes de Mantenimiento"
      subtitle="Analítica y KPIs para órdenes de trabajo"
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem' }}>
        <GraficoOrdenesPorEstado appliedFilters={appliedFilters} />
        
        <GraficoTipoMantenimiento appliedFilters={appliedFilters} />

        <div style={{ gridColumn: '1 / -1' }}>
          <GraficoEquiposMasMantenimientos appliedFilters={appliedFilters} />
        </div>
      </div>
    </Layout>
  );
}
