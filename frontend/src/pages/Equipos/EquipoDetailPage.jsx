import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Edit, Truck, Building2, MapPin, Clock, Wrench, FileText,
  Timer, Search, Calendar, ChevronRight, AlertTriangle, Shield
} from 'lucide-react';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import { EquipoForm } from '../../components/Equipos/EquipoForm';
import { EstadoEquipoBadge } from '../../components/Equipos/EstadoEquipoBadge';
import { TIPOS_EQUIPO } from '../../constants/equipos';
import api from '../../lib/api';

/* ================================================================
   Styles
   ================================================================ */
const statCard = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-lg)',
  padding: '1.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const statValue = {
  fontSize: '2rem',
  fontWeight: 800,
  lineHeight: 1.1,
};

const statLabel = {
  fontSize: 'var(--text-sm)',
  color: 'var(--text-muted)',
  fontWeight: 500,
};

const infoRow = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '0.75rem 0',
  borderBottom: '1px solid var(--border-color)',
  fontSize: 'var(--text-sm)',
};

const infoLabel = {
  color: 'var(--text-muted)',
  fontWeight: 500,
};

const infoValue = {
  color: 'var(--text-primary)',
  fontWeight: 600,
  textAlign: 'right',
};

const filterRow = {
  display: 'flex',
  gap: '0.75rem',
  flexWrap: 'wrap',
  marginBottom: '1rem',
};

/* ================================================================
   Component
   ================================================================ */
export function EquipoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState('info');
  const [otSubTab, setOtSubTab] = React.useState('all');
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);

  // Filters
  const [otSearch, setOtSearch] = React.useState('');
  const [otFechaDesde, setOtFechaDesde] = React.useState('');
  const [otFechaHasta, setOtFechaHasta] = React.useState('');
  const [remSearch, setRemSearch] = React.useState('');
  const [remFechaDesde, setRemFechaDesde] = React.useState('');
  const [remFechaHasta, setRemFechaHasta] = React.useState('');
  const [remEstado, setRemEstado] = React.useState('all');

  // ─── Queries ───────────────────────────────────────────
  const { data: equipo, isLoading } = useQuery({
    queryKey: ['equipo-detail', id],
    queryFn: async () => {
      const { data } = await api.get(`/equipos/${id}`);
      return data.data;
    }
  });

  const otTipoParam = otSubTab === 'all' ? undefined : otSubTab === 'preventivos' ? 'PREVENTIVO' : 'CORRECTIVO';

  const { data: otsData, isLoading: isOtsLoading } = useQuery({
    queryKey: ['equipo-ots', id, otTipoParam, otSearch, otFechaDesde, otFechaHasta],
    queryFn: async () => {
      const params = { limit: 100 };
      if (otTipoParam) params.tipo_mantenimiento = otTipoParam;
      if (otSearch) params.search = otSearch;
      if (otFechaDesde) params.fecha_desde = otFechaDesde;
      if (otFechaHasta) params.fecha_hasta = otFechaHasta;
      const { data } = await api.get(`/equipos/${id}/ordenes-trabajo`, { params });
      return data;
    },
    enabled: activeTab === 'ots',
  });

  const { data: remisionesData, isLoading: isRemLoading } = useQuery({
    queryKey: ['equipo-remisiones', id, remSearch, remFechaDesde, remFechaHasta, remEstado],
    queryFn: async () => {
      const params = { limit: 100 };
      if (remSearch) params.search = remSearch;
      if (remFechaDesde) params.fecha_desde = remFechaDesde;
      if (remFechaHasta) params.fecha_hasta = remFechaHasta;
      if (remEstado !== 'all') params.estado = remEstado;
      const { data } = await api.get(`/equipos/${id}/remisiones`, { params });
      return data;
    },
    enabled: activeTab === 'remisiones',
  });

  const { data: tiemposData, isLoading: isTiemposLoading } = useQuery({
    queryKey: ['equipo-tiempos', id],
    queryFn: async () => {
      const { data } = await api.get(`/equipos/${id}/tiempos`);
      return data.data;
    },
    enabled: activeTab === 'tiempos',
  });

  // ─── Loading / Not Found ───────────────────────────────
  if (isLoading) return (
    <div className="app-layout">
      <div className="main-content" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    </div>
  );

  if (!equipo) return (
    <div className="app-layout">
      <div className="main-content">
        <div className="empty-state">
          <Truck size={48} className="empty-state__icon" />
          <h2 className="empty-state__title">Equipo no encontrado</h2>
          <Link to="/equipos" className="btn btn--primary">Volver a Equipos</Link>
        </div>
      </div>
    </div>
  );

  const tipoInfo = TIPOS_EQUIPO.find(t => t.valor === equipo.tipo_equipo);
  const icon = tipoInfo ? tipoInfo.icono : '🏭';
  const ots = otsData?.data || [];
  const remisiones = remisionesData?.data || [];

  // ─── Tabs Config ───────────────────────────────────────
  const tabs = [
    { id: 'info',       label: 'Información General', icon: Truck },
    { id: 'ots',        label: 'Órdenes de Trabajo',  icon: Wrench },
    { id: 'remisiones', label: 'Remisiones',           icon: FileText },
    { id: 'tiempos',    label: 'Tiempos',              icon: Timer },
    { id: 'repuestos',  label: 'Repuestos Compatibles', icon: Wrench },
  ];

  const otSubTabs = [
    { id: 'all',          label: 'Todas' },
    { id: 'preventivos',  label: 'Preventivos' },
    { id: 'correctivos',  label: 'Correctivos' },
  ];

  const PLACEHOLDER_SVG = 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
      <rect fill="#1e293b" width="400" height="300" rx="12"/>
      <text x="50%" y="45%" text-anchor="middle" font-size="64">${icon}</text>
      <text x="50%" y="70%" text-anchor="middle" font-size="20" fill="#94a3b8">${equipo.marca} ${equipo.modelo}</text>
    </svg>`.trim()
  );

  const getEquipoImgUrl = () => `/api/v1/equipos/${equipo.id}/foto`;

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-CO') : '—';
  const formatDateTime = (d) => d ? new Date(d).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const formatCurrency = (v) => v != null ? `$${Number(v).toLocaleString('es-CO')}` : '—';

  // ─── Render ────────────────────────────────────────────
  return (
    <div className="app-layout">
      <Topbar
        title={`${equipo.marca} ${equipo.modelo}`}
        subtitle={`Serial: ${equipo.serial}${equipo.serie ? ` · Código: ${equipo.serie}` : ''}`}
        rightContent={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link to="/equipos" className="btn btn--ghost btn--sm">
              <ArrowLeft size={16} />
            </Link>
            <button className="btn btn--secondary" onClick={() => setIsEditModalOpen(true)}>
              <Edit size={16} /> Editar
            </button>
          </div>
        }
      />

      <main className="main-content">
        {/* ─── Hero Card ──────────────────────────────────── */}
        <div className="card" style={{
          display: 'grid',
          gridTemplateColumns: '200px 1fr',
          gap: '1.5rem',
          marginBottom: '1.5rem',
          alignItems: 'center',
        }}>
          <div style={{
            width: '200px', height: '150px',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-elevated)',
          }}>
            <img
              src={getEquipoImgUrl()}
              alt={`${equipo.marca} ${equipo.modelo}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.target.src = PLACEHOLDER_SVG; e.target.style.objectFit = 'contain'; }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.75rem' }}>{icon}</span>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
                {equipo.marca} {equipo.modelo}
              </h2>
              <EstadoEquipoBadge estado={equipo.estado} />
            </div>

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Building2 size={14} color="var(--text-muted)" />
                <span style={{ fontWeight: 600 }}>{equipo.empresa_nombre}</span>
              </div>
              {equipo.ciudad_ubicacion && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <MapPin size={14} color="var(--text-muted)" />
                  <span>{equipo.ciudad_ubicacion}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Clock size={14} color="var(--text-muted)" />
                <span style={{ fontWeight: 700 }}>{Number(equipo.horometro_actual || 0).toLocaleString()} hrs</span>
              </div>
              {equipo.centro_costo_nombre && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Shield size={14} color="var(--text-muted)" />
                  <span>CC: {equipo.centro_costo_nombre}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Tabs ───────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          gap: '1.5rem',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '1.5rem',
          overflowX: 'auto',
        }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.75rem 0', whiteSpace: 'nowrap',
                  borderBottom: `2px solid ${isActive ? 'var(--clr-primary-500)' : 'transparent'}`,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer', background: 'none',
                  borderLeft: 'none', borderRight: 'none', borderTop: 'none',
                  fontSize: 'var(--text-sm)',
                  transition: 'all 200ms ease',
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ─── Tab: Información General ────────────────────── */}
        {activeTab === 'info' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Truck size={18} /> Datos del Equipo
              </h3>
              <div style={infoRow}><span style={infoLabel}>Tipo</span><span style={infoValue}>{equipo.tipo_equipo_label || equipo.tipo_equipo}</span></div>
              <div style={infoRow}><span style={infoLabel}>Marca</span><span style={infoValue}>{equipo.marca}</span></div>
              <div style={infoRow}><span style={infoLabel}>Modelo</span><span style={infoValue}>{equipo.modelo}</span></div>
              <div style={infoRow}><span style={infoLabel}>Serial</span><span style={infoValue}><code>{equipo.serial}</code></span></div>
              <div style={infoRow}><span style={infoLabel}>Código (Serie)</span><span style={infoValue}>{equipo.serie || '—'}</span></div>
              <div style={infoRow}><span style={infoLabel}>Capacidad Carga</span><span style={infoValue}>{equipo.capacidad_carga ? `${equipo.capacidad_carga} Ton` : '—'}</span></div>
              <div style={infoRow}><span style={infoLabel}>Capacidad Nominal</span><span style={infoValue}>{equipo.capacidad_nominal ? `${equipo.capacidad_nominal} Ton` : '—'}</span></div>
              <div style={infoRow}><span style={infoLabel}>Propulsión</span><span style={infoValue}>{equipo.tipo_propulsion_label || equipo.combustible || '—'}</span></div>
              <div style={infoRow}><span style={infoLabel}>Mástil</span><span style={infoValue}>{equipo.tipo_mastil_label || '—'}{equipo.altura_maxima ? ` (${equipo.altura_maxima}m)` : ''}</span></div>
              <div style={infoRow}><span style={infoLabel}>Color</span><span style={infoValue}>{equipo.color || '—'}</span></div>
              <div style={{ ...infoRow, borderBottom: 'none' }}><span style={infoLabel}>Bonificación / Hora</span><span style={infoValue}>{formatCurrency(equipo.bonificacion_hora)}</span></div>
            </div>

            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={18} /> Ubicación y Estado
              </h3>
              <div style={infoRow}><span style={infoLabel}>Empresa</span><span style={infoValue}>{equipo.empresa_nombre}</span></div>
              <div style={infoRow}><span style={infoLabel}>NIT</span><span style={infoValue}>{equipo.empresa_nit || '—'}</span></div>
              <div style={infoRow}><span style={infoLabel}>Centro de Costos</span><span style={infoValue}>{equipo.centro_costo_nombre || <span style={{ color: 'var(--clr-danger)' }}>Sin asignar</span>}</span></div>
              <div style={infoRow}><span style={infoLabel}>Ciudad</span><span style={infoValue}>{equipo.ciudad_ubicacion || '—'}</span></div>
              <div style={infoRow}><span style={infoLabel}>Ubicación Física</span><span style={infoValue}>{equipo.ubicacion_fisica || '—'}</span></div>
              <div style={infoRow}><span style={infoLabel}>Estado</span><span style={infoValue}><EstadoEquipoBadge estado={equipo.estado} /></span></div>
              {equipo.motivo_estado && (
                <div style={infoRow}><span style={infoLabel}>Motivo estado</span><span style={infoValue}>{equipo.motivo_estado}</span></div>
              )}
              <div style={infoRow}><span style={infoLabel}>Horómetro</span><span style={infoValue}>{Number(equipo.horometro_actual || 0).toLocaleString()} hrs</span></div>
              <div style={infoRow}><span style={infoLabel}>Odómetro</span><span style={infoValue}>{equipo.odometro ? `${Number(equipo.odometro).toLocaleString()} km` : '—'}</span></div>
              <div style={infoRow}><span style={infoLabel}>SOAT</span><span style={infoValue}>{equipo.soat_vigente ? `Vigente (${formatDate(equipo.soat_vencimiento)})` : 'No'}</span></div>
              <div style={{ ...infoRow, borderBottom: 'none' }}><span style={infoLabel}>Última actualización</span><span style={infoValue}>{formatDate(equipo.updated_at)}</span></div>
            </div>

            {/* Últimas OTs mini */}
            {equipo.ultimas_ots?.length > 0 && (
              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <Wrench size={18} /> Últimas Órdenes de Trabajo
                  </h3>
                  <button className="btn btn--ghost btn--sm" onClick={() => setActiveTab('ots')}>
                    Ver todas <ChevronRight size={14} />
                  </button>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Consecutivo</th>
                        <th>Tipo</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                        <th>Horómetro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equipo.ultimas_ots.map(ot => (
                        <tr key={ot.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/mantenimiento/ot/${ot.id}`)}>
                          <td><code>{ot.consecutivo}</code></td>
                          <td><span className={`badge ${ot.tipo === 'PREVENTIVO' ? 'badge--primary' : 'badge--warning'}`}>{ot.tipo}</span></td>
                          <td><span className="badge badge--gray">{ot.estado}</span></td>
                          <td>{formatDate(ot.fecha)}</td>
                          <td>{ot.horometro_final || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Tab: Órdenes de Trabajo ────────────────────── */}
        {activeTab === 'ots' && (
          <div>
            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {otSubTabs.map(st => (
                <button
                  key={st.id}
                  className={`btn btn--sm ${otSubTab === st.id ? 'btn--primary' : 'btn--ghost'}`}
                  onClick={() => setOtSubTab(st.id)}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div style={filterRow}>
              <div style={{ position: 'relative', flex: '2 1 200px' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="input" style={{ paddingLeft: '2.25rem' }}
                  placeholder="Buscar por consecutivo..."
                  value={otSearch} onChange={e => setOtSearch(e.target.value)}
                />
              </div>
              <input className="input" type="date" style={{ flex: '1 1 150px' }}
                value={otFechaDesde} onChange={e => setOtFechaDesde(e.target.value)}
              />
              <input className="input" type="date" style={{ flex: '1 1 150px' }}
                value={otFechaHasta} onChange={e => setOtFechaHasta(e.target.value)}
              />
            </div>

            {isOtsLoading ? (
              <div className="empty-state"><div className="spinner" /></div>
            ) : ots.length === 0 ? (
              <div className="empty-state">
                <Wrench size={48} className="empty-state__icon" />
                <h2 className="empty-state__title">Sin órdenes de trabajo</h2>
                <p className="empty-state__desc">No se encontraron OTs para este equipo con los filtros aplicados.</p>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Consecutivo</th>
                        <th>Tipo</th>
                        <th>Estado</th>
                        <th>Técnicos</th>
                        <th>Fecha</th>
                        <th>Costo</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ots.map(ot => (
                        <tr key={ot.id}>
                          <td>
                            <Link to={`/mantenimiento/ot/${ot.id}`} style={{ color: 'var(--clr-primary-500)', fontWeight: 600, textDecoration: 'none' }}>
                              {ot.consecutivo}
                            </Link>
                          </td>
                          <td>
                            <span className={`badge ${ot.tipo_mantenimiento === 'PREVENTIVO' ? 'badge--primary' : 'badge--warning'}`}>
                              {ot.tipo_mantenimiento}
                            </span>
                          </td>
                          <td><span className="badge badge--gray">{ot.estado}</span></td>
                          <td style={{ fontSize: 'var(--text-xs)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ot.tecnicos}
                          </td>
                          <td>{formatDate(ot.created_at)}</td>
                          <td>{formatCurrency(ot.costo_total)}</td>
                          <td>
                            <Link to={`/mantenimiento/ot/${ot.id}`} className="btn btn--ghost btn--sm">
                              <ChevronRight size={14} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Tab: Remisiones ────────────────────────────── */}
        {activeTab === 'remisiones' && (
          <div>
            <div style={filterRow}>
              <div style={{ position: 'relative', flex: '2 1 200px' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="input" style={{ paddingLeft: '2.25rem' }}
                  placeholder="Buscar por número o empresa..."
                  value={remSearch} onChange={e => setRemSearch(e.target.value)}
                />
              </div>
              <input className="input" type="date" style={{ flex: '1 1 150px' }}
                value={remFechaDesde} onChange={e => setRemFechaDesde(e.target.value)}
              />
              <input className="input" type="date" style={{ flex: '1 1 150px' }}
                value={remFechaHasta} onChange={e => setRemFechaHasta(e.target.value)}
              />
              <select className="input" style={{ flex: '1 1 150px' }}
                value={remEstado} onChange={e => setRemEstado(e.target.value)}
              >
                <option value="all">Todos los estados</option>
                <option value="BORRADOR">Borrador</option>
                <option value="REALIZADA">Realizada</option>
                <option value="LIQUIDADA">Liquidada</option>
                <option value="FACTURADA">Facturada</option>
                <option value="ANULADO">Anulada</option>
              </select>
            </div>

            {isRemLoading ? (
              <div className="empty-state"><div className="spinner" /></div>
            ) : remisiones.length === 0 ? (
              <div className="empty-state">
                <FileText size={48} className="empty-state__icon" />
                <h2 className="empty-state__title">Sin remisiones</h2>
                <p className="empty-state__desc">No se encontraron remisiones para este equipo.</p>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>N° Remisión</th>
                        <th>Fecha</th>
                        <th>Empresa</th>
                        <th>Servicio</th>
                        <th>Operarios</th>
                        <th>Horas</th>
                        <th>Total</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {remisiones.map(r => (
                        <tr key={r.id}>
                          <td>
                            <Link to={`/servicios/${r.id}`} style={{ color: 'var(--clr-primary-500)', fontWeight: 600, textDecoration: 'none' }}>
                              {r.numero_remision}
                            </Link>
                          </td>
                          <td>{formatDate(r.fecha_servicio)}</td>
                          <td style={{ fontSize: 'var(--text-xs)' }}>{r.empresa_nombre}</td>
                          <td style={{ fontSize: 'var(--text-xs)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.servicio_nombre}
                          </td>
                          <td style={{ fontSize: 'var(--text-xs)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.operarios}
                          </td>
                          <td style={{ fontWeight: 600 }}>{r.cantidad_horas || '—'}</td>
                          <td>{formatCurrency(r.total_neto)}</td>
                          <td>
                            <span className={`badge ${
                              r.estado === 'LIQUIDADA' ? 'badge--success' :
                              r.estado === 'FACTURADA' ? 'badge--primary' :
                              r.estado === 'ANULADO' ? 'badge--danger' :
                              r.estado === 'REALIZADA' ? 'badge--warning' : 'badge--gray'
                            }`}>{r.estado}</span>
                          </td>
                          <td>
                            <Link to={`/servicios/${r.id}`} className="btn btn--ghost btn--sm">
                              <ChevronRight size={14} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Tab: Tiempos ───────────────────────────────── */}
        {activeTab === 'tiempos' && (
          <div>
            {isTiemposLoading ? (
              <div className="empty-state"><div className="spinner" /></div>
            ) : tiemposData ? (
              <>
                {/* Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ ...statCard, borderLeft: '4px solid var(--clr-primary-500)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <Wrench size={20} color="var(--clr-primary-500)" />
                      <span style={statLabel}>Tiempo en Taller</span>
                    </div>
                    <span style={{ ...statValue, color: 'var(--clr-primary-500)' }}>
                      {tiemposData.taller.horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })} hrs
                    </span>
                    <span style={{ ...statLabel, fontSize: '11px' }}>
                      {tiemposData.taller.total_ots} OTs con registro de ingreso/salida
                    </span>
                  </div>

                  <div style={{ ...statCard, borderLeft: '4px solid #22c55e' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <Timer size={20} color="#22c55e" />
                      <span style={statLabel}>Tiempo Alquilado</span>
                    </div>
                    <span style={{ ...statValue, color: '#22c55e' }}>
                      {tiemposData.alquilado.horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })} hrs
                    </span>
                    <span style={{ ...statLabel, fontSize: '11px' }}>
                      {tiemposData.alquilado.total_remisiones} remisiones facturadas/liquidadas
                    </span>
                  </div>
                </div>

                {/* Detalle Taller */}
                {tiemposData.taller.detalle.length > 0 && (
                  <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Detalle — Tiempo en Taller (OTs)</h3>
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Consecutivo</th>
                            <th>Tipo</th>
                            <th>Estado</th>
                            <th>Ingreso</th>
                            <th>Salida</th>
                            <th style={{ textAlign: 'right' }}>Horas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tiemposData.taller.detalle.map(d => (
                            <tr key={d.id}>
                              <td>
                                <Link to={`/mantenimiento/ot/${d.id}`} style={{ color: 'var(--clr-primary-500)', fontWeight: 600, textDecoration: 'none' }}>
                                  {d.consecutivo}
                                </Link>
                              </td>
                              <td><span className={`badge ${d.tipo_mantenimiento === 'PREVENTIVO' ? 'badge--primary' : 'badge--warning'}`}>{d.tipo_mantenimiento}</span></td>
                              <td><span className="badge badge--gray">{d.estado}</span></td>
                              <td>{formatDateTime(d.fecha_hora_ingreso_taller)}</td>
                              <td>{formatDateTime(d.fecha_hora_salida_taller)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{d.horas} hrs</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Detalle Alquilado */}
                {tiemposData.alquilado.detalle.length > 0 && (
                  <div className="card">
                    <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Detalle — Tiempo Alquilado (Remisiones)</h3>
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>N° Remisión</th>
                            <th>Fecha</th>
                            <th>Empresa</th>
                            <th>Estado</th>
                            <th style={{ textAlign: 'right' }}>Horas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tiemposData.alquilado.detalle.map(d => (
                            <tr key={d.id}>
                              <td>
                                <Link to={`/servicios/${d.id}`} style={{ color: 'var(--clr-primary-500)', fontWeight: 600, textDecoration: 'none' }}>
                                  {d.numero_remision}
                                </Link>
                              </td>
                              <td>{formatDate(d.fecha_servicio)}</td>
                              <td>{d.empresa_nombre}</td>
                              <td><span className="badge badge--success">{d.estado}</span></td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{d.cantidad_horas} hrs</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {tiemposData.taller.detalle.length === 0 && tiemposData.alquilado.detalle.length === 0 && (
                  <div className="empty-state">
                    <Timer size={48} className="empty-state__icon" />
                    <h2 className="empty-state__title">Sin registros de tiempo</h2>
                    <p className="empty-state__desc">Este equipo aún no tiene OTs con registro de taller ni remisiones con horas calculadas.</p>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* ─── Tab: Repuestos ─────────────────────────────── */}
        {activeTab === 'repuestos' && (
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Wrench size={20} color="var(--clr-primary-500)" />
              Repuestos Compatibles
            </h3>
            
            {(!equipo.repuestos_compatibles || Object.keys(equipo.repuestos_compatibles).length === 0 || Object.values(equipo.repuestos_compatibles).every(v => !v)) ? (
              <div className="empty-state">
                <Wrench size={48} className="empty-state__icon" />
                <h2 className="empty-state__title">Sin repuestos registrados</h2>
                <p className="empty-state__desc">Puedes editar el equipo para añadir referencias de repuestos compatibles.</p>
                <button className="btn btn--primary" onClick={() => setIsEditModalOpen(true)} style={{ marginTop: '1rem' }}>
                  <Edit size={16} /> Añadir Repuestos
                </button>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: '1rem'
              }}>
                {[
                  { label: 'Aceite Motor', value: equipo.repuestos_compatibles.aceite_motor },
                  { label: 'Filtro GLP', value: equipo.repuestos_compatibles.filtro_glp },
                  { label: 'Filtro Aire', value: equipo.repuestos_compatibles.filtro_aire },
                  { label: 'Lubricante Cadena', value: equipo.repuestos_compatibles.lubricante_cadena },
                  { label: 'Grasa', value: equipo.repuestos_compatibles.grasa },
                  { label: 'Filtro Combustible', value: equipo.repuestos_compatibles.filtro_combustible },
                  { label: 'Filtro Motor', value: equipo.repuestos_compatibles.filtro_motor },
                  { label: 'Filtro Bomba Gasolina', value: equipo.repuestos_compatibles.filtro_bomba_gasolina }
                ].map((item, idx) => (
                  <div key={idx} style={{
                    padding: '1rem',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)'
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem', fontWeight: 600 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: item.value ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {item.value || 'No especificado'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ─── Edit Modal ───────────────────────────────────── */}
      {isEditModalOpen && (
        <Modal title="Editar Equipo" onClose={() => setIsEditModalOpen(false)} maxWidth="880px">
          <EquipoForm
            equipo={equipo}
            onSuccess={() => setIsEditModalOpen(false)}
            onCancel={() => setIsEditModalOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}
