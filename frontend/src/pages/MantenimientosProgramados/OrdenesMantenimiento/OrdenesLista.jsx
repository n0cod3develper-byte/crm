import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { Plus, Search, RefreshCw, LayoutGrid, List, Eye } from 'lucide-react';
import { mpService } from '../../../services/mantenimientosProgramadosService';
import { EstadoBadge } from '../../../components/MantenimientosProgramados/EstadoBadge';
import { PrioridadBadge } from '../../../components/MantenimientosProgramados/PrioridadBadge';
import toast from 'react-hot-toast';
import OrdenForm from './OrdenForm';
import OrdenDetalle from './OrdenDetalle';
import OrdenKanban from './OrdenKanban';

export default function OrdenesMantenimiento() {
  const navigate = useNavigate();
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');

  const loadOrdenes = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      if (search) params.search = search;
      const res = await mpService.getOrdenes(params);
      setOrdenes(res.data?.data || []);
    } catch (err) { toast.error('Error al cargar órdenes'); }
    finally { setLoading(false); }
  }, [filters, search]);

  useEffect(() => { loadOrdenes(); }, [loadOrdenes]);

  return (
    <Routes>
      <Route index element={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Órdenes de Mantenimiento</h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Instancias ejecutables de mantenimiento preventivo y correctivo
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
                <button onClick={() => setView('list')}
                  className={`btn btn--sm ${view === 'list' ? 'btn--primary' : 'btn--ghost'}`}
                  title="Vista lista"><List size={16} /></button>
                <button onClick={() => setView('kanban')}
                  className={`btn btn--sm ${view === 'kanban' ? 'btn--primary' : 'btn--ghost'}`}
                  title="Vista Kanban"><LayoutGrid size={16} /></button>
              </div>
              <button onClick={() => navigate('nueva')} className="btn btn--primary btn--sm">
                <Plus size={16} /> Nueva Orden
              </button>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 320 }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="text" placeholder="Buscar órdenes..." value={search}
                onChange={(e) => setSearch(e.target.value)} className="input" style={{ paddingLeft: '2.25rem' }} />
            </div>
            <select value={filters.estado || ''} onChange={(e) => setFilters(f => ({ ...f, estado: e.target.value || undefined }))} className="input" style={{ width: 'auto' }}>
              <option value="">Todos los estados</option>
              <option value="PROGRAMADO">Programado</option>
              <option value="EN_EJECUCION">En Ejecución</option>
              <option value="COMPLETADO">Completado</option>
              <option value="VERIFICADO">Verificado</option>
              <option value="POSPUESTO">Pospuesto</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
            <select value={filters.tipo_mantenimiento || ''} onChange={(e) => setFilters(f => ({ ...f, tipo_mantenimiento: e.target.value || undefined }))} className="input" style={{ width: 'auto' }}>
              <option value="">Todos los tipos</option>
              <option value="PREVENTIVO">Preventivo</option>
              <option value="CORRECTIVO">Correctivo</option>
              <option value="PREDICTIVO">Predictivo</option>
              <option value="INSPECCION">Inspección</option>
            </select>
            <button onClick={loadOrdenes} className="btn btn--ghost btn--sm" title="Recargar">{loading ? <div className="spinner" /> : <RefreshCw size={18} />}</button>
          </div>

          {/* Content */}
          {view === 'kanban' ? (
            <OrdenKanban ordenes={ordenes} loading={loading} onRefresh={loadOrdenes} />
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Título</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Prioridad</th>
                    <th>Entidad</th>
                    <th>Fecha Prog.</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" /></td></tr>
                  ) : ordenes.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No hay órdenes registradas</td></tr>
                  ) : ordenes.map((o) => (
                    <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`${o.id}`)}>
                      <td><code style={{ fontWeight: 700, color: 'var(--clr-primary-400)' }}>{o.codigo}</code></td>
                      <td style={{ fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.titulo}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{o.tipo_mantenimiento}</td>
                      <td><EstadoBadge estado={o.estado} /></td>
                      <td><PrioridadBadge prioridad={o.prioridad} /></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{o.tipo_entidad}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{new Date(o.fecha_programada).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => navigate(`${o.id}`)} className="btn btn--ghost btn--sm" title="Ver"><Eye size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      } />
      <Route path="nueva" element={<OrdenForm />} />
      <Route path=":id" element={<OrdenDetalle />} />
      <Route path=":id/editar" element={<OrdenForm />} />
    </Routes>
  );
}
