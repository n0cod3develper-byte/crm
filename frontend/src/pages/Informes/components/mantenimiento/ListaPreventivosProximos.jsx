import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, AlertTriangle, ArrowRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../../lib/api';

const PRIORIDAD_COLOR = {
  CRITICA: '#ef4444',
  ALTA: '#f97316',
  MEDIA: '#f59e0b',
  BAJA: '#6b7280',
};

const PRIORIDAD_BG = {
  CRITICA: '#ef444422',
  ALTA: '#f9731622',
  MEDIA: '#f59e0b22',
  BAJA: '#6b728022',
};

export default function ListaPreventivosProximos() {
  const [dias, setDias] = useState(15);
  const navigate = useNavigate();

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['preventivos-proximos', dias],
    queryFn: async () => {
      const res = await api.get('/informes/mantenimiento/preventivos-proximos', { params: { dias } });
      return res.data?.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const criticos = data.filter(p => p.prioridad === 'CRITICA' || parseInt(p.dias_restantes) <= 3);

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#8b5cf622', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={18} color="#8b5cf6" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Preventivos Próximos a Vencer
            </h4>
            <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {data.length} programado{data.length !== 1 ? 's' : ''} en los próximos {dias} días
              {criticos.length > 0 && <span style={{ color: '#ef4444', fontWeight: 700 }}> · {criticos.length} crítico{criticos.length !== 1 ? 's' : ''}</span>}
            </p>
          </div>
        </div>

        {/* Selector de ventana */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {[7, 15, 30].map(d => (
            <button key={d} onClick={() => setDias(d)} style={{
              padding: '4px 10px', borderRadius: 6, border: '1.5px solid', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
              borderColor: dias === d ? '#8b5cf6' : 'var(--border)',
              background: dias === d ? '#8b5cf622' : 'transparent',
              color: dias === d ? '#8b5cf6' : 'var(--text-muted)',
            }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" /></div>
      )}
      {error && (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--clr-danger-500)' }}>
          <AlertCircle size={18} /> <span style={{ fontSize: '0.85rem' }}>Error al cargar</span>
        </div>
      )}
      {!isLoading && !error && data.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          <Calendar size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
          <p style={{ margin: 0, fontSize: '0.85rem' }}>No hay preventivos programados en los próximos {dias} días</p>
        </div>
      )}

      {!isLoading && !error && data.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {data.map((p) => {
            const diasNum = parseInt(p.dias_restantes);
            const esUrgente = diasNum <= 3;
            const nombre = p.tipo_entidad === 'EQUIPO' ? p.equipo_nombre : p.area_nombre;
            return (
              <div key={p.id} style={{
                display: 'grid', gridTemplateColumns: '1fr auto',
                padding: '10px 12px', borderRadius: 10,
                background: esUrgente ? '#ef444410' : 'var(--surface-2)',
                border: `1.5px solid ${esUrgente ? '#ef444440' : 'transparent'}`,
                gap: '0.5rem', alignItems: 'center',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700,
                      background: PRIORIDAD_BG[p.prioridad] || '#6b728022',
                      color: PRIORIDAD_COLOR[p.prioridad] || '#6b7280',
                    }}>
                      {p.prioridad}
                    </span>
                    {esUrgente && <AlertTriangle size={12} color="#ef4444" />}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.codigo}</span>
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.titulo}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {nombre || 'Sin asignar'}{p.responsable_nombre ? ` · ${p.responsable_nombre}` : ''}
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: diasNum <= 3 ? '#ef4444' : diasNum <= 7 ? '#f59e0b' : '#10b981' }}>
                    {diasNum === 0 ? '¡Hoy!' : `${diasNum}d`}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {new Date(p.fecha_programada).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer link */}
      {data.length > 0 && (
        <button
          onClick={() => navigate('/mantenimientos-programados')}
          style={{
            marginTop: '1rem', width: '100%', padding: '8px', borderRadius: 8,
            border: '1.5px solid var(--border)', background: 'transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            fontSize: '0.8rem', color: '#8b5cf6', fontWeight: 600,
          }}
        >
          Ver todos los preventivos <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}
