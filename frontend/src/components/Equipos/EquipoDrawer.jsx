import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Building2, Truck, Wrench, Clock, Calendar, Gauge, MapPin, ArrowLeft, Edit } from 'lucide-react';
import { HistorialTimeline } from './HistorialTimeline';
import { HistorialDetail } from './HistorialDetail';
import { Modal } from '../common/Modal';
import { EquipoForm } from './EquipoForm';
import api from '../../lib/api';

const ESTADO_COLORS = {
  Operativo: '#4ade80',
  'En taller': '#fbbf24',
  'En bodega': '#60a5fa',
  'Fuera de servicio': '#f87171',
};

function Badge({ children, color, bg }) {
  return (
    <span style={{
      padding: '0.2rem 0.65rem', borderRadius: 'var(--radius-full)',
      fontSize: 'var(--text-xs)', fontWeight: 700,
      background: bg || 'var(--bg-elevated)', color: color || 'var(--text-secondary)',
    }}>
      {children}
    </span>
  );
}

function InfoItem({ icon: Icon, label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
      <Icon size={13} style={{ color: 'var(--text-muted)', marginTop: 2, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  );
}

export function EquipoDrawer({ equipoId, onClose }) {
  const [tab, setTab] = React.useState('info');           // 'info' | 'historial'
  const [histView, setHistView] = React.useState('list'); // 'list' | 'detail'
  const [selectedRegistro, setSelectedRegistro] = React.useState(null);
  const [editingEquipo, setEditingEquipo] = React.useState(false);
  const qc = useQueryClient();

  // Cargar datos del equipo
  const { data: equipo, isLoading: loadingEquipo } = useQuery({
    queryKey: ['equipo', equipoId],
    queryFn: async () => { const { data } = await api.get(`/equipos/${equipoId}`); return data.data; },
    enabled: !!equipoId,
  });

  // Cargar historial
  const { data: historialData, isLoading: loadingHistorial } = useQuery({
    queryKey: ['equipo-historial', equipoId],
    queryFn: async () => { const { data } = await api.get(`/equipos/${equipoId}/historial`); return data.data || []; },
    enabled: !!equipoId && tab === 'historial',
  });

  const handleVerDetalle = (r) => { setSelectedRegistro(r); setHistView('detail'); };

  // Título dinámico del historial
  const histTitle = histView === 'detail' ? 'Detalle de Registro' : 'Historial del Equipo';

  const estadoColor = equipo ? ESTADO_COLORS[equipo.estado_inicial] || '#9ca3af' : '#9ca3af';

  return (
    <>
      {/* Overlay */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 89, backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div className="slideout" style={{ width: 680, zIndex: 90, display: 'flex', flexDirection: 'column' }}>

        {/* ── Header ── */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            {(tab === 'historial' && histView !== 'list') && (
              <button className="btn btn--ghost btn--sm" style={{ padding: '0.25rem' }} onClick={() => { setHistView('list'); setSelectedRegistro(null); }}>
                <ArrowLeft size={15} />
              </button>
            )}
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {loadingEquipo ? '…' : equipo ? `${equipo.marca} ${equipo.modelo}` : 'Equipo'}
              </h2>
              {equipo && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  {tab === 'historial' ? histTitle : equipo.empresa_nombre}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {tab === 'info' && equipo && (
              <button className="btn btn--ghost btn--sm" onClick={() => setEditingEquipo(true)}>
                <Edit size={13} /> Editar
              </button>
            )}
            <button className="btn btn--ghost btn--sm" style={{ padding: '0.25rem' }} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          {[
            { key: 'info', label: 'Información', icon: Truck },
            { key: 'historial', label: 'Historial', icon: Wrench },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setHistView('list'); setSelectedRegistro(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.75rem 1.25rem', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 'var(--text-sm)', fontWeight: 600,
                color: tab === key ? 'var(--clr-primary-500)' : 'var(--text-muted)',
                borderBottom: tab === key ? '2px solid var(--clr-primary-500)' : '2px solid transparent',
                transition: 'all 150ms ease',
              }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* ── Cuerpo ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

          {/* ── Tab: Información ── */}
          {tab === 'info' && (
            loadingEquipo ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
            ) : equipo ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Identificación */}
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 800, margin: 0 }}>{equipo.marca} {equipo.modelo}</h3>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>{equipo.tipo_equipo}</div>
                    </div>
                    <Badge color={estadoColor} bg={`${estadoColor}18`}>{equipo.estado_inicial}</Badge>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <InfoItem icon={Building2} label="Empresa" value={equipo.empresa_nombre} />
                    <InfoItem icon={MapPin} label="Ubicación" value={equipo.ubicacion} />
                    <InfoItem icon={Gauge} label="Serial" value={equipo.serial} />
                    <InfoItem icon={Truck} label="No. Equipo" value={equipo.numero_equipo} />
                    <InfoItem icon={Clock} label="Horómetro inicial" value={`${equipo.horometro_inicial} h`} />
                    <InfoItem icon={Calendar} label="Adquisición" value={equipo.fecha_adquisicion ? new Date(equipo.fecha_adquisicion).toLocaleDateString('es-CO') : null} />
                  </div>
                </div>

                {/* Especificaciones */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <div style={{ padding: '0.625rem 1rem', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Especificaciones Técnicas</span>
                  </div>
                  <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.875rem' }}>
                    <InfoItem icon={Truck} label="Motor" value={equipo.motor} />
                    <InfoItem icon={Truck} label="Combustible" value={equipo.combustible} />
                    <InfoItem icon={Truck} label="Capacidad" value={`${equipo.capacidad_carga} Ton`} />
                    <InfoItem icon={Truck} label="Color" value={equipo.color} />
                    {equipo.horas_operacion_diaria && <InfoItem icon={Clock} label="Horas/día estimadas" value={`${equipo.horas_operacion_diaria} h`} />}
                  </div>
                </div>

                {/* Garantía */}
                {equipo.fecha_vencimiento_garantia && (
                  <div style={{ padding: '0.875rem 1rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <Calendar size={14} color="#fbbf24" />
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                      Garantía hasta: <strong>{new Date(equipo.fecha_vencimiento_garantia).toLocaleDateString('es-CO')}</strong>
                    </span>
                  </div>
                )}
              </div>
            ) : null
          )}

          {/* ── Tab: Historial ── */}
          {tab === 'historial' && (
            loadingHistorial && histView === 'list' ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
            ) : histView === 'list' ? (
              <HistorialTimeline
                registros={historialData || []}
                onVerDetalle={handleVerDetalle}
              />
            ) : histView === 'detail' ? (
              <HistorialDetail
                registro={selectedRegistro}
              />
            ) : null
          )}
        </div>
      </div>

      {/* Modal editar equipo */}
      {editingEquipo && equipo && (
        <Modal title="Editar Equipo" onClose={() => setEditingEquipo(false)} maxWidth="720px">
          <EquipoForm
            equipo={equipo}
            onSuccess={() => { setEditingEquipo(false); qc.invalidateQueries({ queryKey: ['equipo', equipoId] }); qc.invalidateQueries({ queryKey: ['equipos'] }); }}
            onCancel={() => setEditingEquipo(false)}
          />
        </Modal>
      )}
    </>
  );
}
