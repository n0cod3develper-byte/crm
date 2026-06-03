import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Clock, DollarSign, Activity, Package, FileText, MessageSquare, History } from 'lucide-react';
import { mpService } from '../../../services/mantenimientosProgramadosService';
import { EstadoBadge } from '../../../components/MantenimientosProgramados/EstadoBadge';
import { PrioridadBadge } from '../../../components/MantenimientosProgramados/PrioridadBadge';
import { ActividadChecklist } from '../../../components/MantenimientosProgramados/ActividadChecklist';
import { InsumosList } from '../../../components/MantenimientosProgramados/InsumosList';
import { EvidenciasUploader } from '../../../components/MantenimientosProgramados/EvidenciasUploader';
import { BitacoraTimeline } from '../../../components/MantenimientosProgramados/BitacoraTimeline';
import toast from 'react-hot-toast';

const TRANSICIONES = {
  PROGRAMADO:    ['EN_EJECUCION', 'CANCELADO', 'POSPUESTO'],
  EN_EJECUCION:  ['COMPLETADO', 'POSPUESTO', 'CANCELADO'],
  COMPLETADO:    ['VERIFICADO', 'EN_EJECUCION'],
  VERIFICADO:    [],
  POSPUESTO:     ['PROGRAMADO', 'CANCELADO'],
  CANCELADO:     [],
};

const ESTADO_TRANS_LABELS = {
  PROGRAMADO: 'Programar', EN_EJECUCION: 'Iniciar Ejecución',
  COMPLETADO: 'Completar', VERIFICADO: 'Verificar',
  POSPUESTO: 'Pospuesto', CANCELADO: 'Cancelado',
};

export default function OrdenDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [orden, setOrden] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [comentarioEstado, setComentarioEstado] = useState('');
  const [showCambiarEstado, setShowCambiarEstado] = useState(false);
  const [tab, setTab] = useState('actividades');

  const loadOrden = () => {
    setLoading(true);
    mpService.getOrden(id)
      .then(res => setOrden(res.data?.data))
      .catch(err => { toast.error('Error al cargar orden'); navigate('..'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrden(); }, [id, navigate]);

  const handleCambiarEstado = async (nuevoEstado) => {
    setCambiandoEstado(true);
    try {
      await mpService.cambiarEstado(id, { estado_nuevo: nuevoEstado, comentario: comentarioEstado });
      toast.success(`Estado cambiado a ${nuevoEstado}`);
      setShowCambiarEstado(false);
      setComentarioEstado('');
      loadOrden();
    } catch (err) { toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Error al cambiar estado'); }
    finally { setCambiandoEstado(false); }
  };

  const handleToggleActividad = async (act) => {
    try { await mpService.completarActividad(id, act.id, { completada: !act.completada }); loadOrden(); }
    catch (err) { toast.error('Error al actualizar actividad'); }
  };

  const handleSubirEvidencia = async (ordenId, fd) => { const res = await mpService.subirEvidencia(ordenId, fd); loadOrden(); return res; };
  const handleEliminarEvidencia = async (evId) => {
    if (!window.confirm('¿Eliminar esta evidencia?')) return;
    try { await mpService.eliminarEvidencia(id, evId); toast.success('Evidencia eliminada'); loadOrden(); }
    catch (err) { toast.error('Error al eliminar evidencia'); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" /></div>;
  if (!orden) return null;

  const transicionesPermitidas = TRANSICIONES[orden.estado] || [];

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate('..')} className="btn btn--ghost"><ArrowLeft size={20} /></button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{orden.titulo}</h2>
              <span className="badge badge--primary" style={{ fontFamily: 'var(--font-mono)' }}>{orden.codigo}</span>
              <EstadoBadge estado={orden.estado} />
              <PrioridadBadge prioridad={orden.prioridad} />
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {orden.tipo_mantenimiento} • {orden.tipo_entidad} • {new Date(orden.fecha_programada).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(orden.estado !== 'VERIFICADO' && orden.estado !== 'CANCELADO') && (
            <button onClick={() => navigate(`../${id}/editar`)} className="btn btn--secondary btn--sm"><Edit size={14} /> Editar</button>
          )}
          {transicionesPermitidas.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowCambiarEstado(!showCambiarEstado)}
                className="btn btn--primary btn--sm">
                <Clock size={14} /> Cambiar Estado
              </button>
              {showCambiarEstado && (
                <div className="card" style={{ position: 'absolute', right: 0, top: '100%', marginTop: '0.5rem', width: '250px', zIndex: 10, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cambiar a:</p>
                  {transicionesPermitidas.map(est => (
                    <button key={est} onClick={() => handleCambiarEstado(est)} disabled={cambiandoEstado}
                      className="btn btn--ghost btn--sm" style={{ justifyContent: 'flex-start', width: '100%' }}>
                      {ESTADO_TRANS_LABELS[est] || est}
                    </button>
                  ))}
                  <textarea placeholder="Comentario (opcional)" value={comentarioEstado}
                    onChange={(e) => setComentarioEstado(e.target.value)}
                    className="input" rows={2} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
        <InfoCard label="Tipo" value={orden.tipo_mantenimiento} />
        <InfoCard label="Entidad" value={`${orden.tipo_entidad} ${orden.equipo_id ? `#${orden.equipo_id}` : orden.area_id ? `#${orden.area_id}` : ''}`} />
        <InfoCard label="Creado por" value={orden.creador_nombre || (orden.created_by ? `#${orden.created_by}` : '—')} />
        <InfoCard label="Responsable" value={orden.responsable_nombre || (orden.responsable_id ? `#${orden.responsable_id}` : 'Sin asignar')} />
        <InfoCard label="Requiere Paro" value={orden.requiere_paro ? 'Sí' : 'No'} />
        {orden.fecha_inicio_real && <InfoCard label="Inicio real" value={new Date(orden.fecha_inicio_real).toLocaleString()} />}
        {orden.fecha_fin_real && <InfoCard label="Fin real" value={new Date(orden.fecha_fin_real).toLocaleString()} />}
        {orden.duracion_real_horas && <InfoCard label="Duración real" value={`${orden.duracion_real_horas} hrs`} />}
        <div className="card" style={{ padding: '0.75rem' }}>
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)' }}>Costo Total</p>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
            <DollarSign size={14} /> ${(orden.costo_total || 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Descripción */}
      {orden.descripcion && (
        <div className="card" style={{ padding: '1rem' }}>
          <h3 style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descripción</h3>
          <p style={{ fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap' }}>{orden.descripcion}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
          {[
            { id: 'actividades', label: 'Actividades', icon: Activity, count: orden.actividades?.length },
            { id: 'insumos', label: 'Insumos', icon: Package, count: orden.insumos?.length },
            { id: 'evidencias', label: 'Evidencias', icon: FileText, count: orden.evidencias?.length },
            { id: 'bitacora', label: 'Bitácora', icon: History, count: orden.bitacora?.length },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="btn btn--ghost btn--sm"
                style={{
                  flex: 1, padding: '0.75rem 1rem', borderRadius: 0,
                  borderBottom: tab === t.id ? '2px solid var(--clr-primary-500)' : '2px solid transparent',
                  color: tab === t.id ? 'var(--clr-primary-500)' : 'var(--text-muted)',
                  fontWeight: tab === t.id ? 700 : 500,
                }}>
                <Icon size={16} /> {t.label}
                {t.count > 0 && <span className="badge badge--gray" style={{ fontSize: '10px', padding: '0.1rem 0.375rem' }}>{t.count}</span>}
              </button>
            );
          })}
        </div>
        <div style={{ padding: '1rem' }}>
          {tab === 'actividades' && (
            <ActividadChecklist actividades={orden.actividades} onToggle={handleToggleActividad}
              readOnly={orden.estado === 'VERIFICADO' || orden.estado === 'CANCELADO'} />
          )}
          {tab === 'insumos' && <InsumosList insumos={orden.insumos} showUsado />}
          {tab === 'evidencias' && (
            <EvidenciasUploader
              ordenId={id} evidencias={orden.evidencias}
              onUpload={handleSubirEvidencia} onDelete={handleEliminarEvidencia} />
          )}
          {tab === 'bitacora' && <BitacoraTimeline entries={orden.bitacora} />}
        </div>
      </div>

      {/* Observaciones */}
      {orden.observaciones && (
        <div className="card" style={{ padding: '1rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            <MessageSquare size={14} /> Observaciones
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{orden.observaciones}</p>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="card" style={{ padding: '0.75rem' }}>
      <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</p>
      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginTop: '0.25rem' }}>{value}</p>
    </div>
  );
}
