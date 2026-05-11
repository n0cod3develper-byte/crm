import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Truck, Trash2, Edit, Building2, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import { EquipoForm } from '../../components/Equipos/EquipoForm';
import { EquipoDrawer } from '../../components/Equipos/EquipoDrawer';
import api from '../../lib/api';

const MOTORES    = ['all', 'Mazda', 'Toyota', 'Hyster'];
const COMBUSTIBLES = ['all', 'GLP', 'Gasolina', 'Eléctrico', 'Híbrido'];

const ESTADO_COLORS = {
  Operativo:          { bg: 'rgba(34,197,94,0.12)',  color: '#4ade80' },
  'En taller':        { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24' },
  'En bodega':        { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa' },
  'Fuera de servicio':{ bg: 'rgba(239,68,68,0.12)',  color: '#f87171' },
};

export function EquiposPage() {
  const qc = useQueryClient();
  const [search, setSearch]         = React.useState('');
  const [filterMotor, setFilterMotor]   = React.useState('all');
  const [filterFuel, setFilterFuel]     = React.useState('all');
  const [isModalOpen, setIsModalOpen]   = React.useState(false);
  const [editingEquipo, setEditingEquipo] = React.useState(null);
  const [drawerEquipoId, setDrawerEquipoId] = React.useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['equipos', search, filterMotor, filterFuel],
    queryFn: async () => {
      const params = { limit: 100 };
      if (search) params.search = search;
      if (filterMotor !== 'all') params.motor = filterMotor;
      if (filterFuel  !== 'all') params.combustible = filterFuel;
      const { data } = await api.get('/equipos', { params });
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/equipos/${id}`),
    onSuccess: () => { toast.success('Equipo eliminado'); qc.invalidateQueries({ queryKey: ['equipos'] }); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar'),
  });

  const equipos = data?.data || [];

  const handleCreate  = () => { setEditingEquipo(null); setIsModalOpen(true); };
  const handleEdit    = (eq) => { setEditingEquipo(eq);  setIsModalOpen(true); };
  const handleClose   = () => { setIsModalOpen(false); setEditingEquipo(null); };
  const handleRowClick = (id) => setDrawerEquipoId(id);

  return (
    <div className="app-layout">
      <Sidebar />
      <Topbar
        title="Equipos &amp; Maquinaria"
        subtitle={`Gestiona la flota de tus clientes (${equipos.length} registrados)`}
        rightContent={
          <button className="btn btn--primary" onClick={handleCreate}>
            <Plus size={16} /> Nuevo Equipo
          </button>
        }
      />

      <main className="main-content">
        {/* Filtros */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 420 }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Buscar por marca, modelo o serial..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="input" style={{ width: 'auto' }} value={filterMotor} onChange={e => setFilterMotor(e.target.value)}>
            <option value="all">Cualquier Motor</option>
            {MOTORES.slice(1).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="input" style={{ width: 'auto' }} value={filterFuel} onChange={e => setFilterFuel(e.target.value)}>
            <option value="all">Combustible: Todos</option>
            {COMBUSTIBLES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
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
                    <th>Empresa</th>
                    <th>Marca / Modelo</th>
                    <th>Serial / No. Equipo</th>
                    <th>Tipo</th>
                    <th>Motor</th>
                    <th>Combustible</th>
                    <th>Capacidad</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {equipos.map(eq => {
                    const estadoConf = ESTADO_COLORS[eq.estado_inicial] || { bg: 'var(--bg-elevated)', color: 'var(--text-muted)' };
                    return (
                      <tr
                        key={eq.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleRowClick(eq.id)}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Building2 size={14} color="var(--text-muted)" />
                            <span style={{ fontWeight: 600 }}>{eq.empresa_nombre}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{eq.marca}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{eq.modelo}</div>
                        </td>
                        <td>
                          <code>{eq.serial}</code>
                          {eq.numero_equipo && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No: {eq.numero_equipo}</div>}
                        </td>
                        <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{eq.tipo_equipo}</td>
                        <td>{eq.motor}</td>
                        <td><span className="badge badge--gray">{eq.combustible}</span></td>
                        <td style={{ fontWeight: 700 }}>{eq.capacidad_carga} T</td>
                        <td>
                          <span style={{ padding: '0.15rem 0.6rem', borderRadius: 'var(--radius-full)', fontSize: 'var(--text-xs)', fontWeight: 700, background: estadoConf.bg, color: estadoConf.color }}>
                            {eq.estado_inicial || '—'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                            <button className="btn btn--ghost btn--sm" onClick={() => handleEdit(eq)} title="Editar">
                              <Edit size={14} />
                            </button>
                            <button
                              className="btn btn--ghost btn--sm"
                              style={{ color: 'var(--clr-danger)' }}
                              onClick={() => { if (window.confirm('¿Eliminar este equipo?')) deleteMutation.mutate(eq.id); }}
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                            <button className="btn btn--ghost btn--sm" onClick={() => handleRowClick(eq.id)} title="Ver detalle">
                              <ChevronRight size={14} />
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

      {/* Modal crear / editar equipo */}
      {isModalOpen && (
        <Modal title={editingEquipo ? 'Editar Equipo' : 'Nuevo Equipo'} onClose={handleClose} maxWidth="720px">
          <EquipoForm
            equipo={editingEquipo}
            onSuccess={handleClose}
            onCancel={handleClose}
          />
        </Modal>
      )}

      {/* Drawer detalle del equipo */}
      {drawerEquipoId && (
        <EquipoDrawer
          equipoId={drawerEquipoId}
          onClose={() => setDrawerEquipoId(null)}
        />
      )}
    </div>
  );
}
