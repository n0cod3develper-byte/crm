import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Box, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Sidebar } from '../../components/layout/Sidebar';
import { Modal } from '../../components/common/Modal';
import { InventoryForm } from '../../components/Inventory/InventoryForm';
import api from '../../lib/api';

function formatCurrency(val) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val || 0);
}

export function InventoryPage() {
  const [search, setSearch] = React.useState('');
  const [filterActive, setFilterActive] = React.useState('all');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', search, filterActive],
    queryFn: async () => {
      const params = { limit: 50 };
      if (search) params.search = search;
      if (filterActive !== 'all') params.isActive = filterActive === 'true';
      const { data } = await api.get('/inventory', { params });
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/inventory/${id}`),
    onSuccess: () => {
      toast.success('Ítem eliminado');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  const items = data?.data || [];

  const handleCreate = () => { setEditingItem(null); setIsModalOpen(true); };
  const handleEdit = (it) => { setEditingItem(it); setIsModalOpen(true); };
  const handleClose = () => { setIsModalOpen(false); setEditingItem(null); };

  return (
    <div className="app-layout">
      <Sidebar />

      <header className="header">
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Inventario y Catálogo</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Gestiona productos y servicios para tus cotizaciones
          </p>
        </div>
        <button className="btn btn--primary" onClick={handleCreate}>
          <Plus size={16} /> Nuevo Ítem
        </button>
      </header>

      <main className="main-content">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 420 }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="input" style={{ paddingLeft: '2.5rem' }} placeholder="Buscar por nombre o SKU…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {['all', 'true', 'false'].map(s => {
               let label = 'Todos';
               if (s === 'true') label = 'Activos';
               if (s === 'false') label = 'Inactivos';
               return (
                 <button
                   key={s}
                   className={`btn btn--sm ${filterActive === s ? 'btn--primary' : 'btn--ghost'}`}
                   onClick={() => setFilterActive(s)}
                 >
                   {label}
                 </button>
               );
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <Box size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Inventario vacío</h2>
            <p className="empty-state__desc">No hay elementos que coincidan con la búsqueda.</p>
            <button className="btn btn--primary" onClick={handleCreate}><Plus size={16} /> Crear Ítem</button>
          </div>
        ) : (
          <div className="table-container">
            <table className="table" style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Artículo / Servicio</th>
                  <th>Categoría</th>
                  <th>Precio Venta</th>
                  <th>Stock</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ opacity: item.is_active ? 1 : 0.5 }}>
                    <td style={{ color: 'var(--text-secondary)' }}>{item.sku || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                    <td>{item.category || 'General'}</td>
                    <td>{formatCurrency(item.unit_price)}</td>
                    <td>
                      <span style={{ color: item.stock_current <= item.stock_minimum ? 'var(--clr-danger)' : 'inherit', fontWeight: item.stock_current <= item.stock_minimum ? 600 : 400 }}>
                        {item.stock_current} {item.unit}
                      </span>
                    </td>
                    <td>
                       <span style={{
                          padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                          background: item.is_active ? '#dcfce3' : '#fee2e2', 
                          color: item.is_active ? '#166534' : '#991b1b'
                        }}>
                          {item.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                    <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }}>
                      <button className="btn btn--ghost btn--sm" style={{ padding: '0.375rem', color: 'var(--clr-primary-500)' }} onClick={() => handleEdit(item)} title="Editar">
                        <Edit2 size={16} />
                      </button>
                      <button 
                        className="btn btn--ghost btn--sm" 
                        style={{ padding: '0.375rem', color: 'var(--clr-danger)' }} 
                        onClick={() => {
                          if(window.confirm('¿Seguro de eliminar este ítem permanentemente?')) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
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
          <InventoryForm item={editingItem} onSuccess={handleClose} onCancel={handleClose} />
        </Modal>
      )}
    </div>
  );
}
