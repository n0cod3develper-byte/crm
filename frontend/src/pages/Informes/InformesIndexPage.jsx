import React from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { BarChart3, Wrench, ArrowRight, Users, Fuel, Package, ShoppingCart } from 'lucide-react';

export function InformesIndexPage() {
  return (
    <Layout
      title="Centro de Informes"
      subtitle="Seleccione un área para visualizar sus informes dinámicos"
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '2rem',
        marginTop: '2rem'
      }}>
        
        {/* Tarjeta de Servicios */}
        <Link to="/informes/servicios" style={{ textDecoration: 'none', display: 'flex', height: '100%' }}>
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
              <BarChart3 size={32} color="white" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Informes de Servicios
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem', flex: 1 }}>
              Visualice las ventas por línea de negocio, histórico mensual y rendimiento general de los servicios prestados.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6366f1', fontWeight: 600, fontSize: '0.95rem' }}>
              Ver informes <ArrowRight size={18} />
            </div>
          </div>
        </Link>

        {/* Tarjeta de Mantenimiento */}
        <Link to="/informes/mantenimiento" style={{ textDecoration: 'none', display: 'flex', height: '100%' }}>
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
              Informes de Mantenimiento
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem', flex: 1 }}>
              Analice los costos, tiempos de ejecución y rentabilidad de las órdenes de trabajo de mantenimiento.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 600, fontSize: '0.95rem' }}>
              Ver informes <ArrowRight size={18} />
            </div>
          </div>
        </Link>

        {/* Tarjeta de Gestión Humana */}
        <Link to="/informes/gestion-humana" style={{ textDecoration: 'none', display: 'flex', height: '100%' }}>
          <div className="card" style={{
            padding: '2.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            background: 'linear-gradient(145deg, var(--bg-elevated) 0%, rgba(245, 158, 11, 0.05) 100%)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            width: '100%',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(245, 158, 11, 0.15), 0 10px 10px -5px rgba(245, 158, 11, 0.04)';
            e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }}
          >
            <div style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              borderRadius: '50%',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              boxShadow: '0 8px 16px -4px rgba(245, 158, 11, 0.4)'
            }}>
              <Users size={32} color="white" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Gestión Humana
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem', flex: 1 }}>
              Liquidación quincenal de bonificación por horas para operarios de montacargas. Incluye resumen de productividad y auditoría de alertas.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontWeight: 600, fontSize: '0.95rem' }}>
              Ver informes <ArrowRight size={18} />
            </div>
          </div>
        </Link>

        {/* Tarjeta de Ventas con Combustible */}
        <Link to="/informes/ventas-combustible" style={{ textDecoration: 'none', display: 'flex', height: '100%' }}>
          <div className="card" style={{
            padding: '2.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            background: 'linear-gradient(145deg, var(--bg-elevated) 0%, rgba(239, 68, 68, 0.05) 100%)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            width: '100%',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(239, 68, 68, 0.15), 0 10px 10px -5px rgba(239, 68, 68, 0.04)';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }}
          >
            <div style={{
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              borderRadius: '50%',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              boxShadow: '0 8px 16px -4px rgba(239, 68, 68, 0.4)'
            }}>
              <Fuel size={32} color="white" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Ventas con Combustible
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem', flex: 1 }}>
              Remisiones con tipo de servicio que incluye combustible. Filtro por rango de fechas y exportación a Excel.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 600, fontSize: '0.95rem' }}>
              Ver informes <ArrowRight size={18} />
            </div>
          </div>
        </Link>

        {/* Tarjeta de Email Marketing */}
        <Link to="/informes/email-marketing" style={{ textDecoration: 'none', display: 'flex', height: '100%' }}>
          <div className="card" style={{
            padding: '2.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            background: 'linear-gradient(145deg, var(--bg-elevated) 0%, rgba(236, 72, 153, 0.05) 100%)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            width: '100%',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(236, 72, 153, 0.15), 0 10px 10px -5px rgba(236, 72, 153, 0.04)';
            e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }}
          >
            <div style={{
              background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
              borderRadius: '50%',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              boxShadow: '0 8px 16px -4px rgba(236, 72, 153, 0.4)'
            }}>
              <BarChart3 size={32} color="white" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Email Marketing
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem', flex: 1 }}>
              Analiza el rendimiento global de tus envíos: tasas de apertura, clics, rebotes, bajas y salud de tus listas.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ec4899', fontWeight: 600, fontSize: '0.95rem' }}>
              Ver informes <ArrowRight size={18} />
            </div>
          </div>
        </Link>

        {/* Tarjeta de Catálogo de Productos y Servicios */}
        <Link to="/informes/catalogo" style={{ textDecoration: 'none', display: 'flex', height: '100%' }}>
          <div className="card" style={{
            padding: '2.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            background: 'linear-gradient(145deg, var(--bg-elevated) 0%, rgba(14, 165, 233, 0.05) 100%)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            width: '100%',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(14, 165, 233, 0.15), 0 10px 10px -5px rgba(14, 165, 233, 0.04)';
            e.currentTarget.style.borderColor = 'rgba(14, 165, 233, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }}
          >
            <div style={{
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
              borderRadius: '50%',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              boxShadow: '0 8px 16px -4px rgba(14, 165, 233, 0.4)'
            }}>
              <Package size={32} color="white" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Catálogo e Inventario
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem', flex: 1 }}>
              Consulte y descargue en formato Excel los productos y servicios registrados por rango de fechas de creación y tipo.
            </p>              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0ea5e9', fontWeight: 600, fontSize: '0.95rem' }}>
              Ver informes <ArrowRight size={18} />
            </div>
          </div>
        </Link>

        {/* Tarjeta de Compras */}
        <Link to="/informes/compras" style={{ textDecoration: 'none', display: 'flex', height: '100%' }}>
          <div className="card" style={{
            padding: '2.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            background: 'linear-gradient(145deg, var(--bg-elevated) 0%, rgba(168, 85, 247, 0.05) 100%)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            width: '100%',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(168, 85, 247, 0.15), 0 10px 10px -5px rgba(168, 85, 247, 0.04)';
            e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }}
          >
            <div style={{
              background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
              borderRadius: '50%',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              boxShadow: '0 8px 16px -4px rgba(168, 85, 247, 0.4)'
            }}>
              <ShoppingCart size={32} color="white" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Informe de Compras
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem', flex: 1 }}>
              Compras registradas por rango de fechas con desglose por factura, proveedor y exportación a Excel.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a855f7', fontWeight: 600, fontSize: '0.95rem' }}>
              Ver informes <ArrowRight size={18} />
            </div>
          </div>
        </Link>

      </div>
    </Layout>
  );
}
