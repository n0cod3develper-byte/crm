import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { X, CheckCircle2, Clock, ListChecks, FileText } from 'lucide-react';

export function OtActivitiesModal({ otId, onClose }) {
  const { data: otData, isLoading } = useQuery({
    queryKey: ['orden-trabajo', otId],
    queryFn: async () => {
      const { data } = await api.get(`/mantenimiento/ot/${otId}`);
      return data.data;
    },
    enabled: !!otId,
  });

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="modal-content card" onClick={e => e.stopPropagation()} style={{
        width: '90%', maxWidth: '600px', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column', padding: 0
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
            <ListChecks size={18} />
            Resumen de Actividades {otData ? `- ${otData.consecutivo}` : ''}
          </h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando actividades...</div>
          ) : (
            <>
              {/* Detalle general de la OT */}
              <div style={{ marginBottom: '1.5rem', background: 'var(--bg-surface)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '13px' }}>Detalle / Novedad General:</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
                  {otData?.detalle_servicio || <span style={{ color: 'var(--text-muted)' }}>Sin detalles de servicio.</span>}
                </div>
              </div>

              {/* Lista de actividades (Solo Preventivo tiene pm_actividades) */}
              {otData?.tipo_mantenimiento === 'PREVENTIVO' && otData?.pm_actividades ? (
                <div>
                  <h4 style={{ fontSize: '14px', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Lista de Chequeo (Preventivo)</h4>
                  {otData.pm_actividades.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No hay actividades registradas en esta plantilla.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {otData.pm_actividades.map(act => (
                        <div key={act.id} style={{ 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '6px', 
                          padding: '12px',
                          borderLeft: act.estado === 'COMPLETADA' ? '4px solid #22c55e' : (act.estado === 'NO_APLICA' ? '4px solid #94a3b8' : '4px solid #f59e0b')
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{act.nombre}</div>
                            <span className="badge" style={{ 
                              fontSize: '10px', 
                              backgroundColor: act.estado === 'COMPLETADA' ? '#dcfce7' : (act.estado === 'NO_APLICA' ? '#f1f5f9' : '#fef3c7'),
                              color: act.estado === 'COMPLETADA' ? '#166534' : (act.estado === 'NO_APLICA' ? '#475569' : '#92400e')
                            }}>
                              {act.estado.replace('_', ' ')}
                            </span>
                          </div>
                          
                          {act.estado !== 'PENDIENTE' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={12} />
                                {act.completada_por || 'Sin firmar'}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={12} />
                                {new Date(act.updated_at).toLocaleString('es-CO')}
                              </div>
                            </div>
                          )}
                          
                          {act.observacion && (
                            <div style={{ marginTop: '8px', fontSize: '12px', background: 'var(--bg-body)', padding: '6px 8px', borderRadius: '4px', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                              Obs: {act.observacion}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '1rem' }}>
                  {otData?.tipo_mantenimiento === 'CORRECTIVO' 
                    ? 'Las actividades de mantenimientos correctivos se registran directamente en el detalle general y en los reportes manuales físicos.' 
                    : 'No hay checklist de actividades para esta orden.'}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
