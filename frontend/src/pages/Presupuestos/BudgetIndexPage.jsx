import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import api from '../../lib/api';
import { DollarSign, Wrench, Briefcase, ArrowRight } from 'lucide-react';

export function BudgetIndexPage() {
  const { data: areas, isLoading } = useQuery({
    queryKey: ['budgetAreas'],
    queryFn: async () => {
      const res = await api.get('/budget/areas');
      return res.data;
    }
  });

  return (
    <Layout
      title="Presupuesto de Ventas"
      subtitle="Gestione el presupuesto anual y mensual por áreas y equipos"
    >
      {isLoading ? (
        <div className="empty-state">
          <div className="spinner" />
          <p>Cargando áreas...</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem',
          marginTop: '2rem'
        }}>
          {areas?.map((area) => (
            <Link key={area.id} to={`/presupuestos/area/${area.id}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{
                padding: '2.5rem 2rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
              }}>
                <div style={{
                  background: 'rgba(99, 102, 241, 0.1)',
                  borderRadius: '50%',
                  padding: '1.25rem',
                  marginBottom: '1.5rem',
                }}>
                  {area.name.toLowerCase().includes('mantenimiento') ? (
                    <Wrench size={32} color="#6366f1" />
                  ) : area.name.toLowerCase().includes('servicio') ? (
                    <Briefcase size={32} color="#6366f1" />
                  ) : (
                    <DollarSign size={32} color="#6366f1" />
                  )}
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                  {area.name}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem', flex: 1 }}>
                  {area.description || `Configurar presupuesto para el área de ${area.name}`}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6366f1', fontWeight: 600, fontSize: '0.95rem' }}>
                  Gestionar Presupuesto <ArrowRight size={18} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
