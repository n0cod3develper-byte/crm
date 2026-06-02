import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { Plus, Search, Power, PowerOff, CalendarPlus, RefreshCw, Eye, Trash2 } from 'lucide-react';
import { mpService } from '../../../services/mantenimientosProgramadosService';
import { PrioridadBadge } from '../../../components/MantenimientosProgramados/PrioridadBadge';
import toast from 'react-hot-toast';
import PlanForm from './PlanForm';
import PlanDetalle from './PlanDetalle';

export default function PlanesLista() {
  const navigate = useNavigate();
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ activo: 'true' });
  const [search, setSearch] = useState('');

  const loadPlanes = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      if (search) params.search = search;
      const res = await mpService.getPlanes(params);
      setPlanes(res.data?.data || []);
    } catch (err) {
      toast.error('Error al cargar planes');
    } finally {
      setLoading(false);
    }
  }, [filters, search]);

  useEffect(() => { loadPlanes(); }, [loadPlanes]);

  const handleToggle = async (id) => {
    try {
      await mpService.togglePlan(id);
      toast.success('Estado actualizado');
      loadPlanes();
    } catch (err) { toast.error('Error al cambiar estado'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este plan? No se puede eliminar si tiene órdenes activas.')) return;
    try {
      await mpService.deletePlan(id);
      toast.success('Plan eliminado');
      loadPlanes();
    } catch (err) { toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Error al eliminar'); }
  };

  const handleGenerarOrden = async (id) => {
    if (!window.confirm('¿Generar orden de mantenimiento desde este plan?')) return;
    try {
      await mpService.generarOrden(id);
      toast.success('Orden generada exitosamente');
      loadPlanes();
    } catch (err) { toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Error al generar orden'); }
  };

  return (
    <Routes>
      <Route index element={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Planes de Mantenimiento</h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Plantillas recurrentes por equipo o área
              </p>
            </div>
            <button onClick={() => navigate('nuevo')} className="btn btn--primary btn--sm">
              <Plus size={16} /> Nuevo Plan
            </button>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 320 }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="text" placeholder="Buscar planes..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="input" style={{ paddingLeft: '2.25rem' }} />
            </div>
            <select value={filters.activo} onChange={(e) => setFilters(f => ({ ...f, activo: e.target.value }))} className="input" style={{ width: 'auto' }}>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
              <option value="">Todos</option>
            </select>
            <select value={filters.tipo_entidad || ''} onChange={(e) => setFilters(f => ({ ...f, tipo_entidad: e.target.value || undefined }))} className="input" style={{ width: 'auto' }}>
              <option value="">Todas las entidades</option>
              <option value="EQUIPO">Equipos</option>
              <option value="AREA">Áreas</option>
            </select>
            <select value={filters.prioridad || ''} onChange={(e) => setFilters(f => ({ ...f, prioridad: e.target.value || undefined }))} className="input" style={{ width: 'auto' }}>
              <option value="">Todas las prioridades</option>
              <option value="CRITICA">Crítica</option>
              <option value="ALTA">Alta</option>
              <option value="MEDIA">Media</option>
              <option value="BAJA">Baja</option>
            </select>
            <button onClick={loadPlanes} className="btn btn--ghost btn--sm" title="Recargar">
              {loading ? <div className="spinner" /> : <RefreshCw size={18} />}
            </button>
          </div>

          {/* Table */}
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Entidad</th>
                  <th>Tipo</th>
                  <th>Frecuencia</th>
                  <th>Prioridad</th>
                  <th style={{ textAlign: 'center' }}>Activo</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}><div className="spinner" /></td></tr>
                ) : planes.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No hay planes registrados</td></tr>
                ) : planes.map((plan) => (
                  <tr key={plan.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`${plan.id}`)}>
                    <td><code style={{ fontWeight: 700, color: 'var(--clr-primary-400)' }}>{plan.codigo}</code></td>
                    <td style={{ fontWeight: 600 }}>{plan.nombre}</td>
                    <td>
                      <span className={`badge ${plan.tipo_entidad === 'EQUIPO' ? 'badge--primary' : 'badge--success'}`}>
                        {plan.tipo_entidad}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{plan.tipo_mantenimiento}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {plan.frecuencia_tipo === 'MANUAL' ? 'Manual' : `Cada ${plan.frecuencia_valor} ${plan.frecuencia_tipo.toLowerCase()}`}
                    </td>
                    <td><PrioridadBadge prioridad={plan.prioridad} /></td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={(e) => { e.stopPropagation(); handleToggle(plan.id); }}
                        className={`btn btn--sm ${plan.activo ? 'btn--ghost' : 'btn--secondary'}`}
                        style={{ color: plan.activo ? '#22c55e' : undefined }}
                        title={plan.activo ? 'Desactivar' : 'Activar'}>
                        {plan.activo ? <Power size={14} /> : <PowerOff size={14} />}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => navigate(`${plan.id}`)} className="btn btn--ghost btn--sm" title="Ver"><Eye size={16} /></button>
                        <button onClick={() => handleGenerarOrden(plan.id)} className="btn btn--ghost btn--sm" title="Generar orden"><CalendarPlus size={16} /></button>
                        <button onClick={() => handleDelete(plan.id)} className="btn btn--ghost btn--sm" style={{ color: 'var(--clr-danger)' }} title="Eliminar"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      } />
      <Route path="nuevo" element={<PlanForm />} />
      <Route path=":id" element={<PlanDetalle />} />
      <Route path=":id/editar" element={<PlanForm />} />
    </Routes>
  );
}
