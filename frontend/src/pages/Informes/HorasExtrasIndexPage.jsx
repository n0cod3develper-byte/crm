import React from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { ClipboardList, Wrench, ArrowRight, Users, Settings } from 'lucide-react';

const CARDS = [
  {
    to: '/informes/horas-extras/servicios',
    icon: ClipboardList,
    color: '#6366f1',
    title: 'Horas Extras Servicios',
    desc: 'Liquidación y desglose por operario con motor de cálculo configurable. Regla MAX(horas).',
  },
  {
    to: '/informes/horas-extras/mantenimiento',
    icon: Wrench,
    color: '#10b981',
    title: 'Horas Extras Mantenimiento',
    desc: 'Horas extras de técnicos en órdenes de trabajo de mantenimiento.',
  },
  {
    to: '/informes/horas-extras/gestion-humana',
    icon: Users,
    color: '#8b5cf6',
    title: 'Gestión Humana',
    desc: 'Informe operativo que incluye recargo nocturno ordinario (regla de duplicación GH).',
  },
];

export function HorasExtrasIndexPage() {
  return (
    <Layout
      title="Horas Extras"
      subtitle="Seleccione un área para consultar el reporte de horas extras"
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '2rem',
        marginTop: '2rem',
      }}>
        {CARDS.map(card => (
          <Link key={card.to} to={card.to} style={{ textDecoration: 'none', display: 'flex', height: '100%' }}>
            <div
              className="card"
              style={{
                padding: '2.5rem 2rem',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                textAlign: 'center', cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: `linear-gradient(145deg, var(--bg-elevated) 0%, ${card.color}08 100%)`,
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                width: '100%',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = `0 20px 25px -5px ${card.color}25`;
                e.currentTarget.style.borderColor = `${card.color}40`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              <div style={{
                background: `linear-gradient(135deg, ${card.color} 0%, ${card.color}cc 100%)`,
                borderRadius: '50%', padding: '1.25rem', marginBottom: '1.5rem',
                boxShadow: `0 8px 16px -4px ${card.color}60`,
              }}>
                <card.icon size={32} color="white" />
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                {card.title}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem', flex: 1 }}>
                {card.desc}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: card.color, fontWeight: 600, fontSize: '0.9rem' }}>
                Ver reporte <ArrowRight size={18} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Acceso a Configuración */}
      <div style={{ marginTop: '2rem', textAlign: 'right' }}>
        <Link to="/horas-extras/configuracion" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: 'var(--text-muted)', fontSize: '0.85rem',
          textDecoration: 'none', padding: '6px 12px',
          border: '1px solid var(--border-color)', borderRadius: 8,
          transition: 'all 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = '#6366f1'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <Settings size={14} /> Configuración de porcentajes y horarios
        </Link>
      </div>
    </Layout>
  );
}
