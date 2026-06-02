import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, CalendarPlus, Power, PowerOff, Trash2, Activity, Package } from 'lucide-react';
import { mpService } from '../../../services/mantenimientosProgramadosService';
import { PrioridadBadge } from '../../../components/MantenimientosProgramados/PrioridadBadge';
import toast from 'react-hot-toast';

export default function PlanDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    mpService.getPlan(id)
      .then(res => setPlan(res.data?.data))
      .catch(err => { toast.error('Error al cargar plan'); navigate('..'); })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleToggle = async () => {
    try {
      const res = await mpService.togglePlan(id);
      setPlan(prev => ({ ...prev, activo: res.data?.data?.activo }));
      toast.success('Estado actualizado');
    } catch (err) { toast.error('Error al cambiar estado'); }
  };

  const handleGenerarOrden = async () => {
    if (!window.confirm('¿Generar orden de mantenimiento desde este plan?')) return;
    try { await mpService.generarOrden(id); toast.success('Orden generada'); }
    catch (err) { toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Error al generar orden'); }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar este plan permanentemente?')) return;
    try { await mpService.deletePlan(id); toast.success('Plan eliminado'); navigate('..'); }
    catch (err) { toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Error al eliminar'); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" /></div>;
  if (!plan) return null;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate('..')} className="btn btn--ghost"><ArrowLeft size={20} /></button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{plan.nombre}</h2>
              <span className="badge badge--primary" style={{ fontFamily: 'var(--font-mono)' }}>{plan.codigo}</span>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Creado {new Date(plan.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => navigate(`../${id}/editar`)} className="btn btn--secondary btn--sm"><Edit size={14} /> Editar</button>
          <button onClick={handleGenerarOrden} className="btn btn--secondary btn--sm" style={{ color: '#16a34a' }}><CalendarPlus size={14} /> Generar OMP</button>
          <button onClick={handleToggle} className={`btn btn--sm ${plan.activo ? 'btn--secondary' : 'btn--secondary'}`}
            style={{ color: plan.activo ? '#ea580c' : '#16a34a' }}>
            {plan.activo ? <><PowerOff size={14} /> Desactivar</> : <><Power size={14} /> Activar</>}
          </button>
          <button onClick={handleDelete} className="btn btn--danger btn--sm"><Trash2 size={14} /> Eliminar</button>
        </div>
      </div>

      {/* Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
        <InfoCard label="Tipo de Entidad" value={plan.tipo_entidad} />
        <InfoCard label="Tipo de Mantenimiento" value={plan.tipo_mantenimiento} />
        <InfoCard label="Frecuencia" value={plan.frecuencia_tipo === 'MANUAL' ? 'Manual' : `Cada ${plan.frecuencia_valor} ${plan.frecuencia_tipo.toLowerCase()}`} />
        <InfoCard label="Prioridad" value={<PrioridadBadge prioridad={plan.prioridad} />} />
        <InfoCard label="Estado" value={
          <span style={{ color: plan.activo ? '#22c55e' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: plan.activo ? '#22c55e' : 'var(--text-muted)', display: 'inline-block' }} />
            {plan.activo ? 'Activo' : 'Inactivo'}
          </span>
        } />
        <InfoCard label="Responsable" value={plan.responsable_nombre || (plan.responsable_id ? `#${plan.responsable_id}` : 'Sin asignar')} />
        <InfoCard label="Creado por" value={plan.creador_nombre || (plan.created_by ? `#${plan.created_by}` : '—')} />
        <InfoCard label="Inicio Vigencia" value={new Date(plan.fecha_inicio_vigencia).toLocaleDateString()} />
        <InfoCard label="Fin Vigencia" value={plan.fecha_fin_vigencia ? new Date(plan.fecha_fin_vigencia).toLocaleDateString() : 'Indefinido'} />
      </div>

      {/* Descripción */}
      {plan.descripcion && (
        <div className="card">
          <h3 style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Descripción</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{plan.descripcion}</p>
        </div>
      )}

      {/* Observaciones */}
      {plan.observaciones && (
        <div className="card">
          <h3 style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Observaciones</h3>
          <p style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{plan.observaciones}</p>
        </div>
      )}

      {/* Actividades */}
      <div className="card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '1rem' }}>
          <Activity size={18} /> Actividades ({plan.actividades?.length || 0})
        </h3>
        {plan.actividades?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {plan.actividades.map((act) => (
              <div key={act.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(99,102,241,0.15)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--clr-primary-400)' }}>{act.orden}</span>
                <span style={{ flex: 1, fontSize: 'var(--text-sm)' }}>{act.descripcion}</span>
                {act.obligatoria && <span className="badge badge--danger" style={{ fontSize: '10px' }}>Obligatoria</span>}
                {act.tiempo_estimado_min && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{act.tiempo_estimado_min} min</span>}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin actividades registradas</p>
        )}
      </div>

      {/* Insumos */}
      <div className="card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '1rem' }}>
          <Package size={18} /> Insumos ({plan.insumos?.length || 0})
        </h3>
        {plan.insumos?.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th style={{ textAlign: 'right' }}>Cantidad</th>
                  <th>Unidad</th>
                </tr>
              </thead>
              <tbody>
                {plan.insumos.map((ins) => (
                  <tr key={ins.id}>
                    <td>{ins.producto_id ? `Producto #${ins.producto_id}` : ins.descripcion_libre || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{ins.cantidad}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{ins.unidad || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin insumos registrados</p>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="card" style={{ padding: '0.75rem' }}>
      <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{label}</p>
      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>{value}</p>
    </div>
  );
}
