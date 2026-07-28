import React, { useState } from 'react';
import { Layout } from '../../components/Layout';
import { Calendar, Filter, Clock } from 'lucide-react';

const getLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function HorasExtrasMantenimientoPage() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const [fechaInicio, setFechaInicio] = useState(getLocalDateString(firstDay));
  const [fechaFin, setFechaFin] = useState(getLocalDateString(today));

  return (
    <Layout
      title="Horas Extras — Mantenimiento"
      subtitle="Reporte de horas extras registradas en órdenes de trabajo de mantenimiento"
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

          <button className="btn btn--primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '120px' }}>
            <Filter size={15} /> Generar Reporte
          </button>
        </div>
      </div>

      {/* Placeholder */}
      <div className="card" style={{
        padding: '3rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)',
          borderRadius: '50%',
          padding: '1.5rem',
        }}>
          <Clock size={40} style={{ color: '#10b981' }} />
        </div>
        <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.15rem' }}>
          Módulo en Construcción
        </h3>
        <p style={{ color: 'var(--text-muted)', maxWidth: '450px', lineHeight: 1.6 }}>
          El reporte de horas extras de mantenimiento estará disponible próximamente. 
          Aquí podrá consultar las horas extras registradas por los técnicos en las órdenes de trabajo.
        </p>
      </div>
    </Layout>
  );
}
