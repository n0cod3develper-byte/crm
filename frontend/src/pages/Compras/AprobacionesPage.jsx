import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, XCircle, Clock, Search, ShieldCheck,
  FileText, ArrowRight, UserCheck
} from 'lucide-react';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import api from '../../lib/api';
import toast from 'react-hot-toast';

export const AprobacionesPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState('pendientes');

  // En una implementación real, esto filtraría por el ID del aprobador actual
  const { data: aprobaciones, isLoading, refetch } = useQuery({
    queryKey: ['aprobaciones-pendientes', activeTab],
    queryFn: async () => {
      const { data } = await api.get('/compras/oc', { 
        params: { estado: activeTab === 'pendientes' ? 'EN_APROBACION' : 'APROBADA' } 
      });
      return data.data || [];
    }
  });

  const handleApprove = async (id) => {
    try {
      await api.patch(`/compras/oc/${id}/estado`, { estado: 'APROBADA' });
      toast.success('Orden de compra aprobada correctamente');
      refetch();
    } catch (error) {
      toast.error('Error al aprobar la orden');
    }
  };

  const handleReject = async (id) => {
    try {
      await api.patch(`/compras/oc/${id}/estado`, { estado: 'RECHAZADA' });
      toast.success('Orden de compra rechazada');
      refetch();
    } catch (error) {
      toast.error('Error al rechazar la orden');
    }
  };

  const fmt = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

  return (
    <div className="app-layout">
      <Sidebar />
      <Topbar 
        title="Centro de Aprobaciones" 
        subtitle="Valida y autoriza solicitudes de gasto y órdenes de compra" 
        rightContent={
          <div className="flex items-center gap-3">
            <div style={{ padding: '0.5rem', background: 'var(--clr-primary-500)', borderRadius: 'var(--radius-md)' }}>
              <ShieldCheck color="white" size={20} />
            </div>
          </div>
        } 
      />

      <main className="main-content">
        <div className="card mb-6" style={{ padding: '0' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
            <button 
              onClick={() => setActiveTab('pendientes')}
              style={{
                padding: '1rem 1.5rem',
                border: 'none',
                background: 'none',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: activeTab === 'pendientes' ? 'var(--clr-primary-500)' : 'var(--text-muted)',
                borderBottom: activeTab === 'pendientes' ? '2px solid var(--clr-primary-500)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Pendientes de mi firma
            </button>
            <button 
              onClick={() => setActiveTab('historial')}
              style={{
                padding: '1rem 1.5rem',
                border: 'none',
                background: 'none',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: activeTab === 'historial' ? 'var(--clr-primary-500)' : 'var(--text-muted)',
                borderBottom: activeTab === 'historial' ? '2px solid var(--clr-primary-500)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Historial de decisiones
            </button>
          </div>

          <div style={{ padding: '1.5rem' }}>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <div className="spinner" />
              </div>
            ) : aprobaciones.length === 0 ? (
              <div className="empty-state">
                <UserCheck size={48} className="empty-state__icon" />
                <h3 className="empty-state__title">No hay pendientes</h3>
                <p className="empty-state__desc">Estás al día con tus aprobaciones.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Proveedor / Concepto</th>
                      <th>Solicitante</th>
                      <th style={{ textAlign: 'right' }}>Monto Total</th>
                      <th>Fecha</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aprobaciones.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--clr-primary-500)' }}>{item.consecutivo}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Orden de Compra</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{item.proveedor_nombre || 'Proveedor por definir'}</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Compra de repuestos e insumos</div>
                        </td>
                        <td>{item.usuario_nombre || 'Admin'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(item.total)}</td>
                        <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="flex justify-end gap-2">
                            <button 
                              className="btn btn--sm btn--ghost"
                              onClick={() => navigate(`/compras/oc/${item.id}/editar`)}
                              title="Ver detalle"
                            >
                              <FileText size={16} />
                            </button>
                            {activeTab === 'pendientes' && (
                              <>
                                <button 
                                  className="btn btn--sm btn--danger"
                                  onClick={() => handleReject(item.id)}
                                  style={{ padding: '0.4rem' }}
                                  title="Rechazar"
                                >
                                  <XCircle size={16} />
                                </button>
                                <button 
                                  className="btn btn--sm btn--primary"
                                  onClick={() => handleApprove(item.id)}
                                  style={{ padding: '0.4rem', background: 'var(--clr-success)', borderColor: 'var(--clr-success)' }}
                                  title="Aprobar"
                                >
                                  <CheckCircle2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="card" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)' }}>
          <div className="flex gap-3">
            <Clock size={20} className="text-primary" />
            <div>
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>Políticas de Gasto</h4>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Recuerda que toda compra superior a $5.000.000 requiere aprobación de Gerencia Administrativa. 
                Las aprobaciones pendientes caducan a los 5 días hábiles.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
