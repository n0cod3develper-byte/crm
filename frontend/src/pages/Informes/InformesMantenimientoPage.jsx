import React from 'react';
import { Layout } from '../../components/Layout';
import { Wrench, Clock } from 'lucide-react';

export function InformesMantenimientoPage() {
  return (
    <Layout
      title="Informes de Mantenimiento"
      subtitle="Analítica y KPIs para órdenes de trabajo"
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: '2rem'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)',
          borderRadius: '50%',
          padding: '2rem',
          marginBottom: '2rem',
          position: 'relative'
        }}>
          <Wrench size={64} style={{ color: '#10b981' }} />
          <div style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            background: 'var(--bg-elevated)',
            borderRadius: '50%',
            padding: '0.5rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
          }}>
            <Clock size={24} style={{ color: '#f59e0b' }} />
          </div>
        </div>
        
        <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--text-primary)' }}>
          Próximamente
        </h2>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', maxWidth: '500px', lineHeight: 1.6 }}>
          Estamos construyendo los informes dinámicos para el área de Mantenimiento. 
          Aquí podrás visualizar el rendimiento de técnicos, costos de repuestos y más.
        </p>
      </div>
    </Layout>
  );
}
