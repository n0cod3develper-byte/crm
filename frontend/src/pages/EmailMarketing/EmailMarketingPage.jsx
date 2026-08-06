import React from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { Mail, List, FileCode, PlaySquare, BarChart3, Users, ChevronRight } from 'lucide-react';

export function EmailMarketingPage() {
  const modulos = [
    {
      title: 'Contactos y Listas',
      desc: 'Administra tus contactos de marketing, crea listas personalizadas e importa desde clientes y empresas del CRM.',
      icon: List,
      link: '/email-marketing/contactos',
      color: '#6366f1',
      bg: 'rgba(99, 102, 241, 0.1)',
    },
    {
      title: 'Plantillas de Correo',
      desc: 'Diseña plantillas personalizables en HTML/Handlebars con soporte de variables dinámicas y vista previa en tiempo real.',
      icon: FileCode,
      link: '/email-marketing/plantillas',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.1)',
    },
    {
      title: 'Campañas de Email',
      desc: 'Crea, programa y envía tus campañas masivas de correo electrónico y realiza un seguimiento detallado en tiempo real.',
      icon: PlaySquare,
      link: '/email-marketing/campanas',
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.1)',
    },
    {
      title: 'Informes y Estadísticas',
      desc: 'Analiza el rendimiento global de tus envíos: tasas de apertura, clics, rebotes, bajas y salud de tus listas.',
      icon: BarChart3,
      link: '/informes/email-marketing',
      color: '#ec4899',
      bg: 'rgba(236, 72, 153, 0.1)',
    },
  ];

  return (
    <Layout
      title="Email Marketing"
      subtitle="Diseña plantillas, segmenta tus listas y envía campañas masivas por Graph API"
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
        marginTop: '2rem'
      }}>
        {modulos.map((m, i) => {
          const Icon = m.icon;
          return (
            <Link key={i} to={m.link} style={{ textDecoration: 'none' }}>
              <div 
                className="card"
                style={{
                  padding: '2rem',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px',
                  background: 'var(--bg-elevated)',
                  transition: 'all 0.2s ease-in-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = m.color;
                  e.currentTarget.style.boxShadow = `0 12px 20px -8px ${m.color}33`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: m.bg,
                  color: m.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.5rem'
                }}>
                  <Icon size={24} />
                </div>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'between',
                  width: '100%'
                }}>
                  {m.title}
                </h3>
                <p style={{
                  fontSize: '0.925rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.5',
                  flexGrow: 1,
                  marginBottom: '1.5rem'
                }}>
                  {m.desc}
                </p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: m.color,
                  fontWeight: 600,
                  fontSize: '0.9rem'
                }}>
                  Ingresar <ChevronRight size={16} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Layout>
  );
}
