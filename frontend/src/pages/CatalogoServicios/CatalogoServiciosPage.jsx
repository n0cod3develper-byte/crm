import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Bookmark, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import { CatalogoServicioForm } from '../../components/CatalogoServicios/CatalogoServicioForm';
import api from '../../lib/api';

export function CatalogoServiciosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['catalogo-servicios', search],
    queryFn: async () => {
      const { data } = await api.get('/catalogo-servicios', { params: { search, limit: 200 } });
      return data.data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/catalogo-servicios/${id}`),
    onSuccess: () => { toast.success('Ítem eliminado'); qc.invalidateQueries({ queryKey: ['catalogo-servicios'] }); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => api.put(`/catalogo-servicios/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalogo-servicios'] }),
    onError: (err) => toast.error(err.response?.data?.message || 'Error'),
  });

  const handleCreate = () => { setEditingItem(null); setIsModalOpen(true); };
  const handleEdit = (item) => { setEditingItem(item); setIsModalOpen(true); };
  const handleClose = () => { setIsModalOpen(false); setEditingItem(null); };

  return (
    <div className="app-layout">
      <Sidebar />
      <Topbar
        title="Catálogo"
        subtitle={`${items.length} ítems registrados`}
        rightContent={
          <button className="btn btn--primary" onClick={handleCreate}>
            <Plus size={16} /> Nuevo Ítem
          </button>
        }
      />

      <main className="main-content">
        <div style={{ position: 'relative', marginBottom: '1.5rem', maxWidth: 420 }}>
          <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Buscar por nombre o código..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <Bookmark size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Sin ítems en el catálogo</h2>
            <p className="empty-state__desc">Agrega los servicios y productos que ofrece CARGAR S.A.S.</p>
            <button className="btn btn--primary" onClick={handleCreate}><Plus size={16} /> Agregar Ítem</button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th>Precio Base</th>
                  <th>Cantidad</th>
                  <th>Unidad</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} style={{ opacity: item.is_active ? 1 : 0.55 }}>
                    <td><code style={{ fontSize: '11px' }}>{item.codigo}</code></td>
                    <td style={{ fontWeight: 600, maxWidth: 280 }}>{item.nombre}</td>
                    <td>
                      <span className={`badge badge--${item.tipo === 'Producto' ? 'green' : 'blue'}`}>
                        {item.tipo || 'Servicio'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '11px', maxWidth: 200 }}>
                      {item.descripcion ? item.descripcion.substring(0, 80) + (item.descripcion.length > 80 ? '...' : '') : '—'}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(item.precio_base || 0)}
                    </td>
                    <td><span className="badge badge--gray">{item.cantidad}</span></td>
                    <td><span className="badge badge--gray">{item.unidad}</span></td>
                    <td>
                      <span className={`badge badge--${item.is_active ? 'primary' : 'gray'}`}>
                        {item.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn--ghost btn--sm" onClick={() => handleEdit(item)} title="Editar">
                          <Edit size={14} />
                        </button>
                        <button
                          className="btn btn--ghost btn--sm"
                          title={item.is_active ? 'Desactivar' : 'Activar'}
                          onClick={() => toggleMutation.mutate({ id: item.id, is_active: !item.is_active })}
                        >
                          {item.is_active ? <ToggleRight size={14} color="var(--clr-primary-500)" /> : <ToggleLeft size={14} />}
                        </button>
                        <button
                          className="btn btn--ghost btn--sm"
                          style={{ color: 'var(--clr-danger)' }}
                          title="Eliminar"
                          onClick={() => { if (window.confirm('¿Eliminar este ítem del catálogo?')) deleteMutation.mutate(item.id); }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {isModalOpen && (
        <Modal title={editingItem ? 'Editar Ítem' : 'Nuevo Ítem'} onClose={handleClose}>
          <CatalogoServicioForm item={editingItem} onSuccess={handleClose} onCancel={handleClose} />
        </Modal>
      )}
    </div>
  );
}
