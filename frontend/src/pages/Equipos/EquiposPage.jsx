import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Truck, Trash2, Edit, Building2, AlertTriangle, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import { EquipoForm } from '../../components/Equipos/EquipoForm';
import { EstadoEquipoBadge } from '../../components/Equipos/EstadoEquipoBadge';
import { ESTADOS_EQUIPO, TIPOS_EQUIPO, TIPOS_PROPULSION } from '../../constants/equipos';
import api from '../../lib/api';

const MOTORES = ['all', 'Mazda', 'Toyota', 'Nissan', 'Isuzu', 'N/A', 'Hyster'];
const COMBUSTIBLES = ['all', 'GLP', 'Gasolina', 'Eléctrico', 'Híbrido', 'Diesel', 'Gas', 'Dual'];

export function EquiposPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = React.useState('');
  const [filterMotor, setFilterMotor] = React.useState('all');
  const [filterFuel, setFilterFuel] = React.useState('all');
  const [filterTipo, setFilterTipo] = React.useState('all');
  const [filterEstado, setFilterEstado] = React.useState('all');
  const [filterPropulsion, setFilterPropulsion] = React.useState('all');
  const [filterCiudad, setFilterCiudad] = React.useState('');
  const [filterSoat, setFilterSoat] = React.useState(searchParams.get('soat') || '');

  // Cuando cambia el query param externamente (ej. desde Dashboard)
  React.useEffect(() => {
    const soatParam = searchParams.get('soat');
    if (soatParam === 'alerta') {
      setFilterSoat('alerta');
    }
  }, [searchParams]);

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingEquipo, setEditingEquipo] = React.useState(null);

  const { data, isLoading } = useQuery({
    queryKey: [
      'equipos',
      search,
      filterMotor,
      filterFuel,
      filterTipo,
      filterEstado,
      filterPropulsion,
      filterCiudad,
      filterSoat
    ],
    queryFn: async () => {
      const params = { limit: 100 };
      if (search) params.search = search;
      if (filterMotor !== 'all') params.motor = filterMotor;
      if (filterFuel !== 'all') params.combustible = filterFuel;
      if (filterTipo !== 'all') params.tipo_equipo = filterTipo;
      if (filterEstado !== 'all') params.estado = filterEstado;
      if (filterPropulsion !== 'all') params.tipo_propulsion = filterPropulsion;
      if (filterCiudad.trim()) params.ciudad = filterCiudad.trim();
      if (filterSoat === 'alerta') params.soat = 'alerta';
      
      const { data } = await api.get('/equipos', { params });
      return data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/equipos/${id}`),
    onSuccess: () => {
      toast.success('Equipo eliminado');
      qc.invalidateQueries({ queryKey: ['equipos'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al eliminar');
    }
  });

  const equipos = data?.data || [];

  const handleCreate = () => { setEditingEquipo(null); setIsModalOpen(true); };
  const handleEdit = (eq) => { setEditingEquipo(eq); setIsModalOpen(true); };
  const handleClose = () => { setIsModalOpen(false); setEditingEquipo(null); };

  const getEquipoThumbUrl = (eq) => {
    const path = eq.foto_thumb_url || `/api/v1/equipos/${eq.id}/foto?thumb=true`;
    if (path.startsWith('http')) return path;
    return path;
  };

  return (
    <div className="app-layout">
      <Topbar 
        title="Equipos & Maquinaria" 
        subtitle={`Gestiona la flota de tus clientes (${equipos.length} registrados)`} 
        rightContent={
          <button className="btn btn--primary" onClick={handleCreate}>
            <Plus size={16} /> Nuevo Equipo
          </button>
        } 
      />

      <main className="main-content">
        {/* Banner de alerta SOAT */}
        {filterSoat === 'alerta' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '1rem',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-sm)',
          }}>
            <AlertTriangle size={18} color="#f59e0b" />
            <span style={{ flex: 1 }}>
              <strong style={{ color: '#f59e0b' }}>Filtro SOAT activo:</strong> Mostrando equipos con SOAT vencido o por vencer en los próximos 30 días
            </span>
            <button
              className="btn btn--ghost btn--sm"
              style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              onClick={() => {
                setFilterSoat('');
                setSearchParams({}, { replace: true });
              }}
            >
              <X size={14} />
              Quitar filtro
            </button>
          </div>
        )}

        {/* Panel de Filtros Premium */}
        <div style={{
          background: 'var(--bg-elevated)',
          padding: '1.25rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          {/* Fila Principal: Búsqueda y Ciudad */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '2 1 300px' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="Buscar por marca, modelo, serial o serie..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <input
                className="input"
                placeholder="Buscar por ciudad..."
                value={filterCiudad}
                onChange={e => setFilterCiudad(e.target.value)}
              />
            </div>
          </div>

          {/* Fila Secundaria: Clasificación y Estados */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', flex: 1 }}>
              {/* Tipo de Equipo */}
              <div style={{ minWidth: '150px' }}>
                <select className="input" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
                  <option value="all">Todos los Equipos</option>
                  {TIPOS_EQUIPO.map(t => <option key={t.valor} value={t.valor}>{t.icono} {t.label}</option>)}
                </select>
              </div>

              {/* Estado */}
              <div style={{ minWidth: '150px' }}>
                <select className="input" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
                  <option value="all">Todos los Estados</option>
                  {ESTADOS_EQUIPO.map(e => <option key={e.valor} value={e.valor}>{e.label}</option>)}
                </select>
              </div>

              {/* Tipo de Propulsión */}
              <div style={{ minWidth: '180px' }}>
                <select className="input" value={filterPropulsion} onChange={e => setFilterPropulsion(e.target.value)}>
                  <option value="all">Todas las Propulsiones</option>
                  {TIPOS_PROPULSION.map(tp => <option key={tp.valor} value={tp.valor}>{tp.label}</option>)}
                </select>
              </div>

              {/* Legacy: Motor */}
              <div style={{ minWidth: '130px' }}>
                <select className="input" value={filterMotor} onChange={e => setFilterMotor(e.target.value)}>
                  <option value="all">Cualquier Motor</option>
                  {MOTORES.slice(1).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* Legacy: Combustible */}
              <div style={{ minWidth: '150px' }}>
                <select className="input" value={filterFuel} onChange={e => setFilterFuel(e.target.value)}>
                  <option value="all">Cualquier Combustible</option>
                  {COMBUSTIBLES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Limpiar Filtros */}
            {(search || filterCiudad || filterTipo !== 'all' || filterEstado !== 'all' || filterPropulsion !== 'all' || filterMotor !== 'all' || filterFuel !== 'all') && (
              <button 
                className="btn btn--ghost btn--sm" 
                style={{ height: '38px', padding: '0 1rem' }}
                onClick={() => {
                  setSearch('');
                  setFilterCiudad('');
                  setFilterTipo('all');
                  setFilterEstado('all');
                  setFilterPropulsion('all');
                  setFilterMotor('all');
                  setFilterFuel('all');
                }}
              >
                Limpiar Filtros
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : equipos.length === 0 ? (
          <div className="empty-state">
            <Truck size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Sin equipos registrados</h2>
            <p className="empty-state__desc">Comienza agregando maquinaria a las empresas de tu CRM.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>Foto</th>
                    <th>Empresa</th>
                    <th>Marca / Modelo</th>
                    <th>Serial</th>
                    <th>Código</th>
                    <th>Horómetro</th>
                    <th>Combustible / Propulsión</th>
                    <th>Ubicación</th>
                    <th>SOAT</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {equipos.map(eq => {
                    const tipoInfo = TIPOS_EQUIPO.find(t => t.valor === eq.tipo_equipo);
                    const icon = tipoInfo ? tipoInfo.icono : '🏭';

                    return (
                      <tr key={eq.id}>
                        <td>
                          <div style={{
                            width: '64px',
                            height: '48px',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-elevated)',
                            position: 'relative',
                            boxShadow: 'var(--shadow-sm)'
                          }}>
                            <img 
                              src={getEquipoThumbUrl(eq)} 
                              alt={`${eq.marca} ${eq.modelo}`}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                cursor: 'pointer',
                                transition: 'transform 0.2s ease'
                              }}
                              onClick={() => handleEdit(eq)}
                              title="Ver / Editar Equipo"
                              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            />
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Building2 size={14} color="var(--text-muted)" />
                            <span style={{ fontWeight: 600 }}>{eq.empresa_nombre}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.2rem' }} title={eq.tipo_equipo_label}>
                              {icon}
                            </span>
                            <div>
                              <div style={{ fontWeight: 600 }}>{eq.marca}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{eq.modelo}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <code>{eq.serial}</code>
                        </td>
                        <td>
                          {eq.serie ? <code>{eq.serie}</code> : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 700 }}>
                              {eq.horometro_actual !== undefined && eq.horometro_actual !== null
                                ? `${Number(eq.horometro_actual).toLocaleString()} hrs`
                                : '0 hrs'}
                            </span>
                            {eq.odometro ? (
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                {Number(eq.odometro).toLocaleString()} km
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="badge badge--gray">{eq.tipo_propulsion_label || eq.combustible || '—'}</span>
                            {eq.tipo_mastil_label && (
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Mástil: {eq.tipo_mastil_label} ({eq.altura_maxima ? `${eq.altura_maxima}m` : ''})
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 500 }}>{eq.ciudad_ubicacion || '—'}</span>
                            {eq.ubicacion_fisica && (
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                {eq.ubicacion_fisica}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {eq.soat_vigente ? (
                            (() => {
                              const hoy = new Date();
                              const venc = eq.soat_vencimiento ? new Date(eq.soat_vencimiento + 'T23:59:59') : null;
                              const diffDays = venc ? Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24)) : null;
                              const fechaStr = eq.soat_vencimiento ? new Date(eq.soat_vencimiento).toLocaleDateString('es-CO') : '';

                              // Sin fecha de vencimiento
                              if (diffDays === null) {
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                    <span className="badge badge--gray">Sin venc.</span>
                                  </div>
                                );
                              }

                              // VENCIDO
                              if (diffDays < 0) {
                                const absDias = Math.abs(diffDays);
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                    <div style={{
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      width: 40, height: 40, borderRadius: '50%',
                                      background: 'rgba(239,68,68,0.12)',
                                      border: '2px solid rgba(239,68,68,0.4)',
                                      fontSize: 'var(--text-xs)', fontWeight: 800,
                                      color: '#ef4444',
                                    }}>
                                      {absDias}
                                    </div>
                                    <span className="badge badge--danger" style={{ fontSize: '10px', padding: '1px 6px' }}>Vencido</span>
                                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                      {fechaStr}
                                    </span>
                                  </div>
                                );
                              }

                              // POR VENCER (≤30 días)
                              if (diffDays <= 30) {
                                const isUrgent = diffDays <= 7;
                                const color = isUrgent ? '#ef4444' : '#f59e0b';
                                const bgColor = isUrgent ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)';
                                const borderColor = isUrgent ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)';
                                const dotColor = isUrgent ? '#ef4444' : '#f59e0b';

                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                    <div style={{
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      width: 40, height: 40, borderRadius: '50%',
                                      background: bgColor,
                                      border: `2px solid ${borderColor}`,
                                      fontSize: 'var(--text-sm)', fontWeight: 800,
                                      color: color,
                                      position: 'relative',
                                    }}>
                                      {diffDays}
                                      <div style={{
                                        position: 'absolute', bottom: 4, right: 5,
                                        width: 6, height: 6, borderRadius: '50%',
                                        background: dotColor,
                                        animation: isUrgent ? 'pulse 1.5s ease infinite' : 'none',
                                      }} />
                                    </div>
                                    <span className="badge" style={{
                                      fontSize: '10px', padding: '1px 6px',
                                      background: bgColor, color: color,
                                      border: `1px solid ${borderColor}`,
                                    }}>
                                      {diffDays} día{diffDays !== 1 ? 's' : ''}
                                    </span>
                                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                      {fechaStr}
                                    </span>
                                  </div>
                                );
                              }

                              // VIGENTE (>30 días)
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                  <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: 40, height: 40, borderRadius: '50%',
                                    background: 'rgba(34,197,94,0.1)',
                                    border: '2px solid rgba(34,197,94,0.3)',
                                    fontSize: 'var(--text-sm)', fontWeight: 800,
                                    color: '#22c55e',
                                  }}>
                                    {diffDays > 99 ? '99+' : diffDays}
                                  </div>
                                  <span className="badge badge--success" style={{ fontSize: '10px', padding: '1px 6px' }}>Vigente</span>
                                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                    {fechaStr}
                                  </span>
                                </div>
                              );
                            })()
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 40, height: 40, borderRadius: '50%',
                                background: 'rgba(148,163,184,0.1)',
                                border: '2px dashed rgba(148,163,184,0.3)',
                                fontSize: 'var(--text-xs)', fontWeight: 700,
                                color: 'var(--text-muted)',
                              }}>
                                —
                              </div>
                              <span className="badge badge--gray" style={{ fontSize: '10px', padding: '1px 6px' }}>Sin SOAT</span>
                            </div>
                          )}
                        </td>
                        <td>
                          <EstadoEquipoBadge estado={eq.estado} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn--ghost btn--sm" onClick={() => handleEdit(eq)} title="Editar">
                              <Edit size={14} />
                            </button>
                            <button 
                              className="btn btn--ghost btn--sm" 
                              style={{ color: 'var(--clr-danger)' }}
                              onClick={() => {
                                if (window.confirm('¿Eliminar este equipo de forma permanente?')) deleteMutation.mutate(eq.id);
                              }}
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {isModalOpen && (
        <Modal title={editingEquipo ? 'Editar Equipo' : 'Nuevo Equipo'} onClose={handleClose} maxWidth="880px">
          <EquipoForm
            equipo={editingEquipo}
            onSuccess={handleClose}
            onCancel={handleClose}
          />
        </Modal>
      )}
    </div>
  );
}
