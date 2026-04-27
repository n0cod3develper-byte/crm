import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '../../services/catalogApi';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import { MapPin, Plus, Search, Filter, Trash2, Edit2, CheckCircle, XCircle, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function UbicacionesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [zonaFilter, setZonaFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUbicacion, setSelectedUbicacion] = useState(null);

  const { data: ubicaciones, isLoading } = useQuery({
    queryKey: ['ubicaciones', search],
    queryFn: () => catalogApi.getUbicaciones({ search })
  });

  const { data: stats } = useQuery({
    queryKey: ['ubicaciones-stats'],
    queryFn: () => catalogApi.getUbicacionStats()
  });

  const mutation = useMutation({
    mutationFn: (data) => selectedUbicacion 
      ? catalogApi.updateUbicacion(selectedUbicacion.id, data) 
      : catalogApi.createUbicacion(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['ubicaciones']);
      queryClient.invalidateQueries(['ubicaciones-stats']);
      toast.success(selectedUbicacion ? 'Ubicación actualizada' : 'Ubicación creada');
      closeModal();
    },
    onError: (err) => toast.error(err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => catalogApi.deleteUbicacion(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['ubicaciones']);
      toast.success('Ubicación eliminada');
    },
    onError: (err) => toast.error(err.message)
  });

  const openModal = (u = null) => {
    setSelectedUbicacion(u);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedUbicacion(null);
    setIsModalOpen(false);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    mutation.mutate({ ...data, activo: data.activo === 'on' });
  };

  const filteredUbicaciones = ubicaciones?.data?.filter(u => 
    !zonaFilter || u.zona === zonaFilter
  );

  const zonas = [...new Set(ubicaciones?.data?.map(u => u.zona))].filter(Boolean);

  return (
    <div className="app-layout">
      <Sidebar />
      <Topbar 
        title="Ubicaciones de Bodega" 
        subtitle="Gestión profesional de espacios físicos de almacenamiento"
        rightContent={
          <button onClick={() => openModal()} className="btn btn--primary flex items-center gap-2">
            <Plus size={18} /> Nueva Ubicación
          </button>
        }
      />
      <main className="main-content">
        <div className="animate-in fade-in duration-500">
          
          {/* Dashboard Rápido */}
          <div className="kpi-grid mb-6">
            <div className="kpi-card">
              <div className="kpi-label">Ubicaciones Totales</div>
              <div className="kpi-value">{ubicaciones?.data?.length || 0}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Zonas Configuradas</div>
              <div className="kpi-value">{zonas.length}</div>
            </div>
            <div className="kpi-card" style={{ borderLeft: '4px solid var(--clr-warning)' }}>
              <div className="kpi-label">Ubicaciones Vacías</div>
              <div className="kpi-value" style={{ color: 'var(--clr-warning)' }}>
                {stats?.data?.ubicaciones_vacias || 0}
              </div>
            </div>
            <div className="kpi-card" style={{ borderLeft: '4px solid var(--clr-danger)' }}>
              <div className="kpi-label">Items sin Ubicación</div>
              <div className="kpi-value" style={{ color: 'var(--clr-danger)' }}>
                {stats?.data?.sin_ubicacion || 0}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Ocupación por Zona */}
            <div className="card">
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-secondary)' }}>Ocupación por Zona</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {stats?.data?.por_zona?.map(z => (
                  <div key={z.zona} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--text-sm)' }}>{z.zona}</span>
                    <span className="badge" style={{ fontSize: '10px' }}>{z.total} ubi.</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Ubicaciones */}
            <div className="card">
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-secondary)' }}>Top Ubicaciones (Más ítems)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {stats?.data?.top_ubicaciones?.map(t => (
                  <div key={t.codigo_ubicacion} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{t.codigo_ubicacion}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--clr-primary-500)', fontWeight: 700 }}>{t.total_items} items</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card mb-6" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Buscar por código, bodega o zona..."
                  className="input"
                  style={{ paddingLeft: '2.5rem' }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div style={{ width: '200px', position: 'relative' }}>
                <Filter size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <select 
                  className="input"
                  style={{ paddingLeft: '2.5rem', appearance: 'none' }}
                  value={zonaFilter}
                  onChange={(e) => setZonaFilter(e.target.value)}
                >
                  <option value="">Todas las Zonas</option>
                  {zonas.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Código Ubicación</th>
                  <th>Bodega / Zona</th>
                  <th>E/N/P</th>
                  <th>Items</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>Cargando...</td></tr>
                ) : filteredUbicaciones?.length > 0 ? filteredUbicaciones.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <MapPin size={14} color="var(--clr-primary-500)" />
                        <span style={{ fontWeight: 700 }}>{u.codigo_ubicacion}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.bodega}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Zona: {u.zona || 'N/A'}</div>
                    </td>
                    <td>
                      <span style={{ fontSize: 'var(--text-sm)' }}>
                        E: {u.estante || '-'} | N: {u.nivel || '-'} | P: {u.posicion || '-'}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{ background: u.total_items > 0 ? 'rgba(37,99,235,0.1)' : 'var(--bg-app)', color: u.total_items > 0 ? 'var(--clr-primary-500)' : 'var(--text-muted)' }}>
                        {u.total_items} items
                      </span>
                    </td>
                    <td>
                      {u.activo ? (
                        <span className="badge badge--success flex items-center gap-1"><CheckCircle size={12} /> Activo</span>
                      ) : (
                        <span className="badge badge--warning flex items-center gap-1"><XCircle size={12} /> Inactivo</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openModal(u)} className="btn btn--ghost btn--sm"><Edit2 size={16} /></button>
                        <button 
                          onClick={() => { if(window.confirm('¿Eliminar esta ubicación?')) deleteMutation.mutate(u.id) }} 
                          className="btn btn--ghost btn--sm" 
                          style={{ color: 'var(--clr-danger)' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No se encontraron ubicaciones.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content card" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontWeight: 700 }}>{selectedUbicacion ? 'Editar Ubicación' : 'Nueva Ubicación'}</h2>
              <button onClick={closeModal} className="btn btn--ghost">Cerrar</button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Bodega</label>
                  <input name="bodega" defaultValue={selectedUbicacion?.bodega || 'Principal'} required className="input" />
                </div>
                <div className="input-group">
                  <label className="input-label">Zona / Sector</label>
                  <input name="zona" defaultValue={selectedUbicacion?.zona} placeholder="Ej: A, B, Repuestos..." required className="input" />
                </div>
                <div className="input-group">
                  <label className="input-label">Estante</label>
                  <input name="estante" defaultValue={selectedUbicacion?.estante} placeholder="Ej: 1, 2, E1..." required className="input" />
                </div>
                <div className="input-group">
                  <label className="input-label">Nivel / Altura</label>
                  <input name="nivel" defaultValue={selectedUbicacion?.nivel} placeholder="Ej: 1, 2, N3..." required className="input" />
                </div>
                <div className="input-group">
                  <label className="input-label">Posición</label>
                  <input name="posicion" defaultValue={selectedUbicacion?.posicion} placeholder="Ej: 01, 02, P04..." required className="input" />
                </div>
                <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
                  <input type="checkbox" name="activo" defaultChecked={selectedUbicacion ? selectedUbicacion.activo : true} style={{ width: '1.25rem', height: '1.25rem' }} />
                  <label className="input-label" style={{ margin: 0 }}>Ubicación Activa</label>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Descripción / Notas</label>
                <textarea name="descripcion" defaultValue={selectedUbicacion?.descripcion} className="input" rows="2"></textarea>
              </div>

              <div style={{ marginTop: '0.5rem', padding: '1rem', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', display: 'flex', gap: '0.75rem' }}>
                <Info size={18} color="var(--clr-primary-500)" />
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  El sistema generará el código automático siguiendo el patrón: <br/>
                  <strong>BODE-ZONA-ESTA-NIVE-POSI</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={closeModal} className="btn btn--secondary">Cancelar</button>
                <button type="submit" disabled={mutation.isLoading} className="btn btn--primary">
                  {mutation.isLoading ? 'Guardando...' : 'Guardar Ubicación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
