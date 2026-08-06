import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { emailMarketingApi } from '../../services/emailMarketingApi';
import { Search, ArrowLeft, Mail, Eye, Check, X, RefreshCw, AlertTriangle } from 'lucide-react';

export function CampanaDetallePage() {
  const { id } = useParams();
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');

  // Queries
  const { data: campanaRes, isLoading: isLoadingCampana, refetch: refetchCampana } = useQuery({
    queryKey: ['email_campana_detalle', id],
    queryFn: () => emailMarketingApi.getCampana(id),
  });

  const { data: enviosRes, isLoading: isLoadingEnvios, refetch: refetchEnvios } = useQuery({
    queryKey: ['email_campana_envios', id, estadoFiltro],
    queryFn: () => emailMarketingApi.getEnviosDeCampana(id, { estado: estadoFiltro || undefined, limit: 200 }),
  });

  const campana = campanaRes?.data;
  const envios = enviosRes?.data || [];

  const handleRefetch = () => {
    refetchCampana();
    refetchEnvios();
  };

  // Metrics
  const total = campana?.total_envios || 0;
  const enviados = campana?.enviados || 0;
  const fallidos = campana?.fallidos || 0;
  const abiertos = campana?.abiertos || 0;
  const clicks = campana?.clicks || 0;

  const pctEntrega = total > 0 ? (((enviados) / total) * 100).toFixed(1) : 0;
  const pctApertura = enviados > 0 ? ((abiertos / enviados) * 100).toFixed(1) : 0;
  const pctClicks = abiertos > 0 ? ((clicks / abiertos) * 100).toFixed(1) : 0;

  return (
    <Layout
      title={campana ? `Detalle: ${campana.nombre}` : 'Detalle de Campaña'}
      subtitle="Monitoreo de envíos en tiempo real, aperturas y clics"
      rightContent={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to="/email-marketing/campanas" className="btn btn--secondary">
            <ArrowLeft size={16} style={{ marginRight: '4px' }} /> Campañas
          </Link>
          <button className="btn btn--primary" onClick={handleRefetch}>
            <RefreshCw size={16} style={{ marginRight: '4px' }} /> Actualizar
          </button>
        </div>
      }
    >
      {isLoadingCampana ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : !campana ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <AlertTriangle size={32} style={{ margin: '0 auto 10px', color: 'var(--clr-danger)' }} />
          <h3>Campaña no encontrada</h3>
        </div>
      ) : (
        <>
          {/* KPI Dashboard */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="card" style={{ padding: '1.25rem', textAlign: 'center', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total Destinatarios</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{total}</div>
            </div>
            <div className="card" style={{ padding: '1.25rem', textAlign: 'center', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Entregados (Graph API)</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10b981' }}>{enviados} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>({pctEntrega}%)</span></div>
            </div>
            <div className="card" style={{ padding: '1.25rem', textAlign: 'center', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Aperturas únicas</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#6366f1' }}>{abiertos} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>({pctApertura}%)</span></div>
            </div>
            <div className="card" style={{ padding: '1.25rem', textAlign: 'center', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Clics en enlaces</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f59e0b' }}>{clicks} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>({pctClicks}%)</span></div>
            </div>
            <div className="card" style={{ padding: '1.25rem', textAlign: 'center', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Fallidos / Rebotados</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--clr-danger)' }}>{fallidos}</div>
            </div>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1 1 240px', maxWidth: '320px' }}>
              <select className="input" value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}>
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="enviado">Enviado</option>
                <option value="fallido">Fallido</option>
                <option value="rebotado">Rebotado</option>
              </select>
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Mostrando {envios.length} envíos
            </div>
          </div>

          {/* Tabla de envíos */}
          {isLoadingEnvios ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
          ) : envios.length === 0 ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No se encontraron envíos para esta selección.
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Destinatario</th>
                    <th>Correo</th>
                    <th>Empresa</th>
                    <th>Enviado At</th>
                    <th>Apertura</th>
                    <th>Clics</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {envios.map((env) => (
                    <tr key={env.id}>
                      <td style={{ fontWeight: 600 }}>{env.nombre}</td>
                      <td>{env.correo}</td>
                      <td>{env.empresa_nombre || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{env.enviado_at ? new Date(env.enviado_at).toLocaleString() : '—'}</td>
                      <td>
                        {env.abierto_at ? (
                          <span style={{ color: '#6366f1', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                            <Eye size={14} /> Abierto
                          </span>
                        ) : 'No'}
                      </td>
                      <td>{env.click_count}</td>
                      <td>
                        <span className={`badge badge--${
                          env.estado === 'enviado' ? 'success' : 
                          env.estado === 'pendiente' ? 'secondary' : 'danger'
                        }`}>
                          {env.estado}
                        </span>
                        {env.estado === 'fallido' && env.error_mensaje && (
                          <div style={{ fontSize: '10px', color: 'var(--clr-danger)', marginTop: '2px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {env.error_mensaje}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
