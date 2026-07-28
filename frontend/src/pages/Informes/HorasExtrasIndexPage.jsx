import React from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { ClipboardList, Wrench, ArrowRight, Clock } from 'lucide-react';

export function HorasExtrasIndexPage() {
  return (
    <Layout
      title="Horas Extras"
      subtitle="Seleccione un área para consultar el reporte de horas extras"
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '2rem',
        marginTop: '2rem'
      }}>
        
        {/* Tarjeta Horas Extras Servicios */}
        <Link to="/informes/horas-extras/servicios" style={{ textDecoration: 'none', display: 'flex', height: '100%' }}>
          <div className="card" style={{
            padding: '2.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            background: 'linear-gradient(145deg, var(--bg-elevated) 0%, rgba(99, 102, 241, 0.05) 100%)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            width: '100%',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(99, 102, 241, 0.15), 0 10px 10px -5px rgba(99, 102, 241, 0.04)';
            e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }}
          >
            <div style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              borderRadius: '50%',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.4)'
            }}>
              <ClipboardList size={32} color="white" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Horas Extras Servicios
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem', flex: 1 }}>
              Consulte y analice las horas extras registradas por los técnicos en las remisiones de servicio.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6366f1', fontWeight: 600, fontSize: '0.95rem' }}>
              Ver reporte <ArrowRight size={18} />
            </div>
          </div>
        </Link>

        {/* Tarjeta Horas Extras Mantenimiento */}
        <Link to="/informes/horas-extras/mantenimiento" style={{ textDecoration: 'none', display: 'flex', height: '100%' }}>
          <div className="card" style={{
            padding: '2.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            background: 'linear-gradient(145deg, var(--bg-elevated) 0%, rgba(16, 185, 129, 0.05) 100%)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            width: '100%',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(16, 185, 129, 0.15), 0 10px 10px -5px rgba(16, 185, 129, 0.04)';
            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }}
          >
            <div style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '50%',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              boxShadow: '0 8px 16px -4px rgba(16, 185, 129, 0.4)'
            }}>
              <Wrench size={32} color="white" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Horas Extras Mantenimiento
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem', flex: 1 }}>
              Consulte y analice las horas extras registradas por los técnicos en las órdenes de trabajo de mantenimiento.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 600, fontSize: '0.95rem' }}>
              Ver reporte <ArrowRight size={18} />
            </div>
          </div>
        </Link>

      </div>
    </Layout>
  );
}
