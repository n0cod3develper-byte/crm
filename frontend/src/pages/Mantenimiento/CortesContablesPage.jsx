import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Calendar, CheckCircle, Play, XCircle, Info, ArrowRight,
  TrendingUp, RefreshCw, FileText, ChevronRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import api from '../../lib/api';

export function CortesContablesPage() {
  const qc = useQueryClient();
  const [selectedCorteId, setSelectedCorteId] = React.useState(null);
  const [fechaCorte, setFechaCorte] = React.useState('');

  // Cargar lista de cortes
  const { data: cortesData, isLoading: loadingList, refetch } = useQuery({
    queryKey: ['cortes-contables'],
    queryFn: async () => {
      const { data } = await api.get('/mantenimiento/cortes');
      return data.data || [];
    }
  });

  // Cargar detalle del corte seleccionado
  const { data: corteDetalle, isLoading: loadingDetail } = useQuery({
    queryKey: ['corte-detalle', selectedCorteId],
    queryFn: async () => {
      const { data } = await api.get(`/mantenimiento/cortes/${selectedCorteId}`);
      return data.data;
    },
    enabled: Boolean(selectedCorteId)
  });

  // Mutaciones
  const generarMut = useMutation({
    mutationFn: (body) => api.post('/mantenimiento/cortes/generar', body),
    onSuccess: (res) => {
      toast.success('Propuesta de corte generada exitosamente');
      refetch();
      if (res.data?.corte?.id) {
        setSelectedCorteId(res.data.corte.id);
      }
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al generar propuesta')
  });

  const confirmarMut = useMutation({
    mutationFn: (id) => api.post(`/mantenimiento/cortes/${id}/confirmar`),
    onSuccess: () => {
      toast.success('Corte confirmado exitosamente');
      refetch();
      qc.invalidateQueries({ queryKey: ['corte-detalle', selectedCorteId] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al confirmar corte')
  });

  const ejecutarMut = useMutation({
    mutationFn: (id) => api.post(`/mantenimiento/cortes/${id}/ejecutar`),
    onSuccess: () => {
      toast.success('Corte ejecutado y órdenes cerradas/continuadas.');
      refetch();
      qc.invalidateQueries({ queryKey: ['corte-detalle', selectedCorteId] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al ejecutar corte')
  });

  const cancelarMut = useMutation({
    mutationFn: (id) => api.delete(`/mantenimiento/cortes/${id}`),
    onSuccess: () => {
      toast.success('Propuesta cancelada con éxito');
      refetch();
      qc.invalidateQueries({ queryKey: ['corte-detalle', selectedCorteId] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al cancelar corte')
  });

  const handleGenerar = (e) => {
    e.preventDefault();
    if (!fechaCorte) return toast.error('Seleccione una fecha de corte.');
    generarMut.mutate({ fecha_corte: fechaCorte });
  };

  const getCorteEstadoBadge = (estado) => {
    const map = {
      PROPUESTO: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', label: 'Propuesto' },
      CONFIRMADO: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', label: 'Confirmado' },
      EJECUTADO: { bg: 'rgba(34,197,94,0.15)', color: '#4ade80', label: 'Ejecutado' },
      CANCELADO: { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', label: 'Cancelado' }
    };
    const current = map[estado] || map.CANCELADO;
    return (
      <span className="badge" style={{ background: current.bg, color: current.color, fontWeight: 600 }}>
        {current.label}
      </span>
    );
  };

  const fmt = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

  return (
    <div className="app-layout">
      <Topbar 
        title="Corte Contable Mensual" 
        subtitle="Administra el proceso de cierre y continuación de Órdenes de Trabajo de servicio continuo" 
      />
      <main className="main-content" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', padding: '1.5rem' }}>
        
        {/* Lado Izquierdo: Lista de Periodos y Generación */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Generador */}
          <div className="card">
            <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} /> Nuevo Corte Mensual
            </h3>
            <form onSubmit={handleGenerar} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="input-group">
                <label className="input-label" style={{ fontSize: '12px' }}>Fecha de Corte (Fin de Mes)</label>
                <input 
                  type="date" 
                  className="input-control" 
                  value={fechaCorte}
                  onChange={(e) => setFechaCorte(e.target.value)}
                  required 
                />
              </div>
              <button 
                type="submit" 
                className="btn btn--primary w-full"
                disabled={generarMut.isPending}
              >
                {generarMut.isPending ? 'Generando...' : 'Generar Propuesta'}
              </button>
            </form>
          </div>

          {/* Listado de Periodos */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '1rem' }}>Cortes Recientes</h3>
            {loadingList ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><RefreshCw className="animate-spin" /></div>
            ) : cortesData?.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '2rem' }}>No hay registros de cortes.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', maxHeight: '400px' }}>
                {cortesData.map((c) => (
                  <div 
                    key={c.id} 
                    onClick={() => setSelectedCorteId(c.id)}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: selectedCorteId === c.id ? 'rgba(59,130,246,0.05)' : 'var(--bg-surface)',
                      borderColor: selectedCorteId === c.id ? 'var(--clr-primary-400)' : 'var(--border-color)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>Periodo {c.periodo}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Corte: {new Date(c.fecha_corte).toLocaleDateString('es-CO')}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>OTs: {c.total_ots}</div>
                    </div>
                    {getCorteEstadoBadge(c.estado)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lado Derecho: Detalle del Lote Seleccionado */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {selectedCorteId ? (
            loadingDetail ? (
              <div className="card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <RefreshCw className="animate-spin" />
              </div>
            ) : (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Cabecera del Detalle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Detalle del Corte Periodo {corteDetalle.periodo}</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Fecha límite de liquidación: <strong>{new Date(corteDetalle.fecha_corte).toLocaleDateString('es-CO')}</strong>
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {getCorteEstadoBadge(corteDetalle.estado)}
                    
                    {corteDetalle.estado === 'PROPUESTO' && (
                      <>
                        <button 
                          className="btn btn--success btn--sm" 
                          style={{ gap: '0.5rem' }}
                          onClick={() => confirmarMut.mutate(corteDetalle.id)}
                          disabled={confirmarMut.isPending}
                        >
                          <CheckCircle size={16} /> Confirmar Lote
                        </button>
                        <button 
                          className="btn btn--danger btn--sm" 
                          style={{ gap: '0.5rem' }}
                          onClick={() => cancelarMut.mutate(corteDetalle.id)}
                          disabled={cancelarMut.isPending}
                        >
                          <XCircle size={16} /> Cancelar
                        </button>
                      </>
                    )}

                    {corteDetalle.estado === 'CONFIRMADO' && (
                      <>
                        <button 
                          className="btn btn--primary btn--sm" 
                          style={{ gap: '0.5rem' }}
                          onClick={() => {
                            if(window.confirm('¿Está seguro de ejecutar este corte contable? Se liquidarán las OTs actuales y se generarán de manera irreversible las nuevas de continuación.')) {
                              ejecutarMut.mutate(corteDetalle.id);
                            }
                          }}
                          disabled={ejecutarMut.isPending}
                        >
                          <Play size={16} /> Ejecutar Cierre
                        </button>
                        <button 
                          className="btn btn--secondary btn--sm" 
                          style={{ gap: '0.5rem' }}
                          onClick={() => cancelarMut.mutate(corteDetalle.id)}
                          disabled={cancelarMut.isPending}
                        >
                          <XCircle size={16} /> Cancelar Lote
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Grid de Items del Lote */}
                <div style={{ overflowX: 'auto' }}>
                  <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                        <th style={{ padding: '0.75rem 0.5rem' }}>OT Original</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>Empresa / Cliente</th>
                        <th style={{ padding: '0.75rem 0.5rem' }}>Equipo</th>
                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>M.O.</th>
                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Repuestos</th>
                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Otros</th>
                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Subtotal</th>
                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Continuación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {corteDetalle.items?.map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '13px', transition: 'background 0.2s' }}>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, color: 'var(--clr-primary-500)' }}>
                            {item.consecutivo_ot}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{item.empresa_nombre}</td>
                          <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>{item.equipo_resumen}</td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{fmt(item.monto_mano_obra)}</td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{fmt(item.monto_repuestos)}</td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{fmt(item.monto_mo_adicional)}</td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 700 }}>{fmt(item.subtotal)}</td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                            {item.nueva_ot_id ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#22c55e', fontWeight: 600 }}>
                                <ArrowRight size={14} /> {item.nueva_consecutivo}
                              </span>
                            ) : item.error_mensaje ? (
                              <span style={{ color: '#ef4444', fontSize: '11px' }} title={item.error_mensaje}>
                                Error: {item.error_mensaje}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            )
          ) : (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '350px', color: 'var(--text-muted)' }}>
              <Info size={36} style={{ marginBottom: '1rem', color: 'var(--text-muted)' }} />
              <p style={{ fontSize: '14px' }}>Selecciona un lote de corte contable a la izquierda para ver su detalle y gestionarlo.</p>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
