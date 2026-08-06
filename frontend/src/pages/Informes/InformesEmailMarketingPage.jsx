import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { emailMarketingApi } from '../../services/emailMarketingApi';
import { ArrowLeft, Mail, Eye, MousePointerClick, AlertCircle, Ban, TrendingUp, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export function InformesEmailMarketingPage() {
  // Queries
  const { data: resumen, isLoading: isLoadResumen } = useQuery({
    queryKey: ['reporte_email_resumen'],
    queryFn: () => emailMarketingApi.getResumen().then(r => r.data || {}),
  });

  const { data: tasas, isLoading: isLoadTasas } = useQuery({
    queryKey: ['reporte_email_tasas'],
    queryFn: () => emailMarketingApi.getTasasCampana().then(r => r.data || []),
  });

  const { data: evolucion, isLoading: isLoadEvolucion } = useQuery({
    queryKey: ['reporte_email_evolucion'],
    queryFn: () => emailMarketingApi.getEvolucionListas().then(r => r.data || []),
  });

  const { data: plantillas, isLoading: isLoadPlantillas } = useQuery({
    queryKey: ['reporte_email_plantillas'],
    queryFn: () => emailMarketingApi.getRankingPlantillas().then(r => r.data || []),
  });

  const { data: salud, isLoading: isLoadSalud } = useQuery({
    queryKey: ['reporte_email_salud'],
    queryFn: () => emailMarketingApi.getSaludLista().then(r => r.data || []),
  });

  const { data: comparativo, isLoading: isLoadComparativo } = useQuery({
    queryKey: ['reporte_email_comparativo'],
    queryFn: () => emailMarketingApi.getComparativoCampanas({ limit: 6 }).then(r => r.data || []),
  });

  const isLoading = isLoadResumen || isLoadTasas || isLoadEvolucion || isLoadPlantillas || isLoadSalud || isLoadComparativo;

  // Calculo de tasas globales
  const totalEnviados = resumen?.total_enviados || 0;
  const totalEntregados = resumen?.total_entregados || 0;
  const totalAbiertos = resumen?.total_abiertos || 0;
  const totalClicks = resumen?.total_clicks || 0;
  const totalFallidos = resumen?.total_fallidos || 0;

  const pctApertura = totalEntregados > 0 ? ((totalAbiertos / totalEntregados) * 100).toFixed(1) : 0;
  const pctClics = totalAbiertos > 0 ? ((totalClicks / totalAbiertos) * 100).toFixed(1) : 0;
  const pctEntrega = totalEnviados > 0 ? ((totalEntregados / totalEnviados) * 100).toFixed(1) : 0;

  return (
    <Layout
      title="BI — Analítica de Email Marketing"
      subtitle="Indicadores clave de rendimiento, entregabilidad y salud de listas"
      rightContent={
        <Link to="/informes" className="btn btn--secondary">
          <ArrowLeft size={16} style={{ marginRight: '4px' }} /> Volver a Informes
        </Link>
      }
    >
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* KPIs Globales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--border-color)' }}>
              <div style={{ padding: '0.75rem', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', borderRadius: '50%' }}>
                <Mail size={24} />
              </div>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Correos Enviados</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{totalEnviados}</h3>
                <span style={{ fontSize: '0.75rem', color: '#10b981' }}>{pctEntrega}% entregabilidad</span>
              </div>
            </div>
            <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--border-color)' }}>
              <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '50%' }}>
                <Eye size={24} />
              </div>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tasa de Apertura</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{pctApertura}%</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{totalAbiertos} aperturas</span>
              </div>
            </div>
            <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--border-color)' }}>
              <div style={{ padding: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: '50%' }}>
                <MousePointerClick size={24} />
              </div>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tasa de Clics</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{pctClics}%</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{totalClicks} clics</span>
              </div>
            </div>
            <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--border-color)' }}>
              <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '50%' }}>
                <Ban size={24} />
              </div>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Rebotes / Fallas</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{totalFallidos}</h3>
                <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>Salud general: Buena</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
            
            {/* Comparativo de Campañas */}
            <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Rendimiento de Últimas Campañas</h3>
              {comparativo.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin datos completados.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {comparativo.map((c, idx) => {
                    const totalEnv = c.enviados || 1;
                    const pctOpen = ((c.abiertos / totalEnv) * 100).toFixed(0);
                    const pctClick = c.abiertos > 0 ? ((c.clicks / c.abiertos) * 100).toFixed(0) : 0;
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600 }}>
                          <span>{c.nombre}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{c.enviados} envíos</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <div>
                            <span>Apertura: {pctOpen}%</span>
                            <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', marginTop: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${pctOpen}%`, height: '100%', background: '#6366f1', borderRadius: '4px' }} />
                            </div>
                          </div>
                          <div>
                            <span>Clics: {pctClick}%</span>
                            <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', marginTop: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${pctClick}%`, height: '100%', background: '#f59e0b', borderRadius: '4px' }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Salud y Estado de la Lista */}
            <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Salud de la Lista de Contactos</h3>
              {salud.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Sin contactos registrados.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {salud.map((s, idx) => {
                    const color = s.estado === 'activo' ? '#10b981' : s.estado === 'baja' ? '#ef4444' : '#f59e0b';
                    return (
                      <div key={idx}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '4px' }}>
                          <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{s.estado}</span>
                          <strong>{s.cantidad} ({s.porcentaje}%)</strong>
                        </div>
                        <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                          <div style={{ width: `${s.porcentaje}%`, height: '100%', background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Ranking de Plantillas */}
          <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Plantillas con Mayor Desempeño (Apertura Promedio)</h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Plantilla</th>
                    <th>Campañas Usadas</th>
                    <th>Total Enviados</th>
                    <th>Total Aperturas</th>
                    <th>Tasa Apertura Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {plantillas.map((p, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                      <td>{p.veces_usada}</td>
                      <td>{p.total_enviados}</td>
                      <td>{p.total_abiertos}</td>
                      <td style={{ fontWeight: 700, color: '#6366f1' }}>{p.tasa_apertura_promedio}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </Layout>
  );
}
