import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, FileText, Download, Calendar, Filter, Truck, Clock,
  Wrench, RefreshCw, Building2, Shield, MapPin, AlertTriangle,
  Search, Eye, History,
} from 'lucide-react';
import { Topbar } from '../../components/layout/Topbar';
import api from '../../lib/api';

/* ================================================================
   Styles
   ================================================================ */
const CARD = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-lg)',
  padding: '1.5rem',
};

const SECTION_TITLE = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: 'var(--clr-primary-500)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.75rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
};

const INFO_ROW = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '0.5rem 0',
  borderBottom: '1px solid var(--border-color)',
  fontSize: 'var(--text-sm)',
};

const INFO_LABEL = { color: 'var(--text-muted)', fontWeight: 500 };
const INFO_VALUE = { color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right' };

const BADGE = (color = 'var(--text-muted)') => ({
  display: 'inline-block',
  padding: '0.125rem 0.5rem',
  borderRadius: '9999px',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  background: `${color}20`,
  color,
});

/* ================================================================
   Componente
   ================================================================ */
export function HojaDeVidaPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Cuando se accede desde /informes/hoja-de-vida (sin ID),
  // mostrar selector de equipo. Cuando se accede desde /equipos/:id/hoja-de-vida,
  // ir directo al historial.
  const [equipoId, setEquipoId] = useState(id || null);
  const [search, setSearch] = useState('');
  const [filtroFecha, setFiltroFecha] = useState({ desde: '', hasta: '' });
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  // Cargar lista de equipos cuando no hay ID en la URL
  const { data: equiposLista, isLoading: isEquiposLoading } = useQuery({
    queryKey: ['equipos-list', search],
    queryFn: async () => {
      const { data } = await api.get('/equipos', { params: { search: search || undefined, limit: 50 } });
      return data?.data || [];
    },
    enabled: !equipoId,
  });

  // ─── Queries ────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['hoja-vida', equipoId, filtroFecha.desde, filtroFecha.hasta, page],
    queryFn: async () => {
      if (!equipoId) return null;
      const params = { limit };
      if (filtroFecha.desde) params.fecha_desde = filtroFecha.desde;
      if (filtroFecha.hasta) params.fecha_hasta = filtroFecha.hasta;
      if (page > 1) params.page = page;
      const { data } = await api.get(`/equipos/${equipoId}/hoja-de-vida`, { params });
      return data.data;
    },
    enabled: !!equipoId,
  });

  // ─── Helpers ────────────────────────────────────────────
  const formatDate = (d) => (d ? new Date(d).toLocaleDateString('es-CO') : '—');
  const formatCurrency = (v) => (v != null ? `$${Number(v).toLocaleString('es-CO')}` : '—');
  const formatHoras = (v) => (v != null ? `${Number(v).toLocaleString('es-CO')} hrs` : '—');

  const tipoBadgeClass = (tipo) => {
    if (tipo.includes('Remisión')) return 'badge badge--primary';
    if (tipo.includes('Tramo')) return 'badge badge--warning';
    if (tipo.includes('OT')) return 'badge badge--info';
    if (tipo.includes('estado')) return 'badge badge--gray';
    return 'badge badge--gray';
  };

  // ─── Loading / Not Found ────────────────────────────────
  // Estado: selector de equipo (cuando se accede desde Informes)
  if (!equipoId) {
    return (
      <div className="app-layout">
        <Topbar
          title="Hoja de Vida"
          subtitle="Selecciona un equipo para ver su historial consolidado"
          rightContent={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Link to="/equipos" className="btn btn--ghost btn--sm">
                <ArrowLeft size={16} /> Volver a Equipos
              </Link>
            </div>
          }
        />
        <main className="main-content">
          <div className="card" style={{ maxWidth: '640px', margin: '2rem auto', padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <FileText size={24} color="var(--clr-primary-500)" />
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Hoja de Vida</h2>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  Consulta el historial completo de cualquier equipo: remisiones, OTs, horómetros, facturación.
                </p>
              </div>
            </div>

            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="Buscar por marca, modelo, serial o serie..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {isEquiposLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" /></div>
            ) : equiposLista.length === 0 ? (
              <div className="empty-state">
                <Truck size={40} className="empty-state__icon" />
                <h3 className="empty-state__title" style={{ fontSize: '1rem' }}>No se encontraron equipos</h3>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {equiposLista.map(eq => (
                  <button
                    key={eq.id}
                    className="btn btn--ghost"
                    style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '0.75rem 1rem', width: '100%' }}
                    onClick={() => { setEquipoId(eq.id); navigate(`/equipos/${eq.id}/hoja-de-vida`); }}
                  >
                    <Eye size={14} style={{ marginRight: '0.75rem', color: 'var(--text-muted)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{eq.marca} {eq.modelo}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {eq.serial} · {eq.empresa_nombre} · {eq.serie || 'Sin código'}
                        </div>
                      </div>
                      <span className="badge badge--gray" style={{ fontSize: '10px' }}>
                        {eq.estado}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  if (isLoading) return (
    <div className="app-layout">
      <div className="main-content" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    </div>
  );

  if (!data?.equipo) return (
    <div className="app-layout">
      <div className="main-content">
        <div className="empty-state">
          <Truck size={48} className="empty-state__icon" />
          <h2 className="empty-state__title">Equipo no encontrado</h2>
          <Link to="/equipos" className="btn btn--primary">
            <ArrowLeft size={16} /> Volver a Equipos
          </Link>
        </div>
      </div>
    </div>
  );

  const equipo = data.equipo;
  const propiedad = data.propiedad;
  const resumen = data.resumen;
  const historial = data.historial || [];
  const pagination = data.pagination;

  const esCargar = propiedad === 'CARGAR S.A.S.' || propiedad?.includes('CARGAR');

  return (
    <div className="app-layout">
      {/* ─── Topbar ─────────────────────────────────────── */}
      <Topbar
        title="Hoja de Vida"
        subtitle={`${equipo.marca} ${equipo.modelo} · ${equipo.serie || 'Sin código'}`}
        rightContent={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link to="/equipos" className="btn btn--ghost btn--sm">
              <ArrowLeft size={16} />
            </Link>
            <button className="btn btn--secondary btn--sm" onClick={() => window.open(`/api/v1/equipos/${id}/hoja-de-vida/export/excel`, '_blank')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Download size={14} /> Excel
            </button>
            <button className="btn btn--primary btn--sm" onClick={() => window.open(`/api/v1/equipos/${id}/hoja-de-vida/export/pdf`, '_blank')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Download size={14} /> PDF
            </button>
          </div>
        }
      />

      <main className="main-content">
        {/* ─── Resumen Agregado ──────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ ...CARD, borderLeft: '4px solid var(--clr-primary-500)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Clock size={18} color="var(--clr-primary-500)" />
              <span style={{ ...SECTION_TITLE, marginBottom: 0 }}>Horas Totales</span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {resumen.horas_totales.total.toLocaleString('es-CO', { maximumFractionDigits: 2 })}
              <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.25rem' }}>hrs</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {resumen.horas_totales.alquilado.toFixed(2)}h alquilado + {resumen.horas_totales.taller.toFixed(2)}h taller
            </div>
          </div>

          <div style={{ ...CARD, borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <FileText size={18} color="#8b5cf6" />
              <span style={{ ...SECTION_TITLE, marginBottom: 0 }}>Servicios</span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {resumen.numero_servicios}
              <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.25rem' }}>remisiones</span>
            </div>
          </div>

          <div style={{ ...CARD, borderLeft: '4px solid #f59e0b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Wrench size={18} color="#f59e0b" />
              <span style={{ ...SECTION_TITLE, marginBottom: 0 }}>Mantenimientos</span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {resumen.numero_mantenimientos}
              <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.25rem' }}>OTs</span>
            </div>
          </div>

          <div style={{ ...CARD, borderLeft: '4px solid #ef4444' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <RefreshCw size={18} color="#ef4444" />
              <span style={{ ...SECTION_TITLE, marginBottom: 0 }}>Costo Mantenimiento</span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {formatCurrency(resumen.costo_mantenimiento_total)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.25rem' }}>histórico total</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* ─── Datos del equipo ──────────────────────────── */}
          <div style={CARD}>
            <div style={SECTION_TITLE}>
              <Truck size={14} /> Datos del Equipo
            </div>
            <div style={INFO_ROW}><span style={INFO_LABEL}>Propiedad</span><span style={INFO_VALUE}>
              <span className={esCargar ? 'badge badge--warning' : 'badge badge--info'} style={{ fontWeight: 700, background: esCargar ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)', color: esCargar ? '#fbbf24' : '#3b82f6' }}>
                {propiedad}
              </span>
            </span></div>
            <div style={INFO_ROW}><span style={INFO_LABEL}>Estado Operativo</span><span style={INFO_VALUE}>
              <span style={{
                display: 'inline-block',
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                background: 'rgba(34,197,94,0.15)',
                color: '#4ade80',
              }}>{equipo.estado}</span>
              {equipo.motivo_estado && (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', textAlign: 'right' }}>
                  {equipo.motivo_estado}
                </div>
              )}
            </span></div>
            <div style={INFO_ROW}><span style={INFO_LABEL}>Tipo de equipo</span><span style={INFO_VALUE}>{equipo.tipo_equipo_label || equipo.tipo_equipo}</span></div>
            <div style={INFO_ROW}><span style={INFO_LABEL}>Propulsión</span><span style={INFO_VALUE}>{equipo.tipo_propulsion_label || equipo.combustible || '—'}</span></div>
            <div style={INFO_ROW}><span style={INFO_LABEL}>Marca</span><span style={INFO_VALUE}>{equipo.marca}</span></div>
            <div style={INFO_ROW}><span style={INFO_LABEL}>Modelo</span><span style={INFO_VALUE}>{equipo.modelo}</span></div>
            <div style={INFO_ROW}><span style={INFO_LABEL}>Serial / Placa</span><span style={INFO_VALUE}><code>{equipo.serial}</code></span></div>
            <div style={INFO_ROW}><span style={INFO_LABEL}>Serie (código)</span><span style={INFO_VALUE}>{equipo.serie || '—'}</span></div>
            <div style={INFO_ROW}><span style={INFO_LABEL}>Horómetro actual</span><span style={INFO_VALUE}>{Number(equipo.horometro_actual || 0).toLocaleString()} hrs</span></div>
            <div style={INFO_ROW}><span style={INFO_LABEL}>Fecha horómetro</span><span style={INFO_VALUE}>{formatDate(equipo.fecha_horometro)}</span></div>
            <div style={INFO_ROW}><span style={INFO_LABEL}>Odómetro</span><span style={INFO_VALUE}>
              {equipo.odometro ? `${Number(equipo.odometro).toLocaleString()} km` : '—'}
            </span></div>
            <div style={INFO_ROW}><span style={INFO_LABEL}>Ubicación física</span><span style={INFO_VALUE}>{equipo.ubicacion_fisica || '—'}</span></div>
            <div style={INFO_ROW}><span style={INFO_LABEL}>Ciudad</span><span style={INFO_VALUE}>{equipo.ciudad_ubicacion || '—'}</span></div>
            <div style={INFO_ROW}><span style={INFO_LABEL}>SOAT</span><span style={INFO_VALUE}>
              {equipo.soat_vigente ? (
                equipo.soat_vencimiento ? `Vigente · Vence ${formatDate(equipo.soat_vencimiento)}` : 'Vigente'
              ) : 'No registrado'}
            </span></div>
            <div style={INFO_ROW}><span style={INFO_LABEL}>Bonificación / hora</span><span style={INFO_VALUE}>{formatCurrency(equipo.bonificacion_hora)}</span></div>
            <div style={{ ...INFO_ROW, borderBottom: 'none' }}><span style={INFO_LABEL}>Centro de Costos</span><span style={INFO_VALUE}>{equipo.centro_costo_nombre || '—'}</span></div>
          </div>

          {/* ─── Estado de Facturación ────────────────────── */}
          <div style={CARD}>
            <div style={SECTION_TITLE}>
              <Shield size={14} /> Facturación de Servicios
            </div>
            <div style={INFO_ROW}><span style={INFO_LABEL}>Total neto servicios</span><span style={INFO_VALUE}>{formatCurrency(resumen.resumen_facturacion.total_neto)}</span></div>
            <div style={INFO_ROW}><span style={INFO_LABEL}>Total facturado</span><span style={INFO_VALUE}>{formatCurrency(resumen.resumen_facturacion.total_facturado)}</span></div>
            <div style={INFO_ROW}><span style={INFO_LABEL}>Saldo pendiente</span><span style={{ ...INFO_VALUE, color: resumen.resumen_facturacion.saldo_pendiente > 0 ? '#ef4444' : '#22c55e' }}>
              {formatCurrency(resumen.resumen_facturacion.saldo_pendiente)}
            </span></div>
            <div style={{ ...INFO_ROW, borderBottom: 'none' }}><span style={INFO_LABEL}>N° facturas</span><span style={INFO_VALUE}>{resumen.resumen_facturacion.numero_facturas}</span></div>

            {/* Estado de facturación badge */}
            <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Estado general</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className={`badge ${resumen.resumen_facturacion.saldo_pendiente > 0 ? 'badge--danger' : 'badge--success'}`}>
                  {resumen.resumen_facturacion.saldo_pendiente > 0 ? 'Tiene saldo pendiente' : 'Totalmente facturado'}
                </span>
                <span className="badge badge--gray">{resumen.resumen_facturacion.numero_facturas} factura(s)</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Filtros ─────────────────────────────────────── */}
        <div style={{ ...CARD, marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={SECTION_TITLE}>
              <Calendar size={14} /> Filtros de Historial
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Filter size={14} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)' }} />
                <input
                  className="input"
                  type="date"
                  style={{ paddingLeft: '2.25rem', width: '150px' }}
                  value={filtroFecha.desde}
                  onChange={(e) => { setFiltroFecha(f => ({ ...f, desde: e.target.value })); setPage(1); }}
                />
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Filter size={14} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)' }} />
                <input
                  className="input"
                  type="date"
                  style={{ paddingLeft: '2.25rem', width: '150px' }}
                  value={filtroFecha.hasta}
                  onChange={(e) => { setFiltroFecha(f => ({ ...f, hasta: e.target.value })); setPage(1); }}
                />
              </div>
              {(filtroFecha.desde || filtroFecha.hasta) && (
                <button className="btn btn--ghost btn--sm" onClick={() => { setFiltroFecha({ desde: '', hasta: '' }); setPage(1); }}>
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ─── Historial ──────────────────────────────────── */}
        <div style={CARD}>
          <div style={SECTION_TITLE}>
            <History size={14} /> Historial Cronológico
            <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 400, textTransform: 'none', color: 'var(--text-muted)' }}>
              {historial.length} evento(s)
            </span>
          </div>

          {historial.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 0' }}>
              <FileText size={40} className="empty-state__icon" />
              <h3 className="empty-state__title" style={{ fontSize: '1rem' }}>Sin historial registrado</h3>
              <p className="empty-state__desc" style={{ fontSize: '12px' }}>
                No hay remisiones, OTs, tramos ni cambios de estado para este equipo.
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>Fecha</th>
                    <th style={{ width: 110 }}>Tipo</th>
                    <th>Identificador</th>
                    <th style={{ width: 100 }}>Estado</th>
                    <th style={{ width: 140 }}>Empresa / Cliente</th>
                    <th style={{ width: 140 }}>Responsable</th>
                    <th>Descripción / Servicios</th>
                    <th class="text-right" style={{ width: 70 }}>Horas</th>
                    <th style={{ width: 80 }}>H. Entrada</th>
                    <th style={{ width: 80 }}>H. Salida</th>
                    <th class="text-right" style={{ width: 90 }}>Costo</th>
                    <th style={{ width: 130 }}>Factura(s)</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((fila) => (
                    <tr key={`${fila.tipo}-${fila.id}-${fila.fecha}`}>
                      <td>{formatDate(fila.fecha)}</td>
                      <td>
                        <span className={tipoBadgeClass(fila.tipo)}>
                          {fila.tipo}
                        </span>
                      </td>
                      <td>
                        <strong>{fila.id}</strong>
                      </td>
                      <td>
                        <span className="badge badge--gray" style={{ fontSize: '10px' }}>
                          {fila.estado || '—'}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px' }}>{fila.empresa || '—'}</td>
                      <td style={{ fontSize: '12px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {fila.responsable || '—'}
                      </td>
                      <td style={{ fontSize: '12px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {fila.descripcion || '—'}
                      </td>
                      <td class="text-right">{fila.horas ? formatHoras(fila.horas) : '—'}</td>
                      <td class="text-right">{fila.hEntrada || '—'}</td>
                      <td class="text-right">{fila.hSalida || '—'}</td>
                      <td class="text-right">{fila.costo ? formatCurrency(fila.costo) : '—'}</td>
                      <td style={{ fontSize: '11px' }}>{fila.facturas || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {pagination?.hasMore && pagination.total > limit && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem', gap: '0.5rem' }}>
              <button
                className="btn btn--ghost btn--sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Anterior
              </button>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center' }}>
                Página {pagination.page} de {pagination.total > 0 ? Math.ceil(pagination.total / limit) : 1}
              </span>
              <button
                className="btn btn--ghost btn--sm"
                disabled={!pagination.hasMore}
                onClick={() => setPage(p => p + 1)}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
