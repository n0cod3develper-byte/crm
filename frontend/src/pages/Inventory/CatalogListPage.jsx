import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../../services/catalogApi';
import { Search, Filter, Plus, Package, Wrench, MoreHorizontal, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatters';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useQueryClient } from '@tanstack/react-query';
import { StockAdjustModal } from '../../components/Inventory/StockAdjustModal';
import { Topbar } from '../../components/layout/Topbar';

export function CatalogListPage() {
  const [tipo, setTipo] = useState('todos');
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');

  const { puede } = usePermissions();
  const queryClient = useQueryClient();
  const [stockModalItem, setStockModalItem] = useState(null);

  const handleStockAdjustSuccess = () => {
    queryClient.invalidateQueries(['catalog-items', tipo, categoria, search]);
  };

  const openStockModal = (item) => {
    setStockModalItem(item);
  };

  const closeStockModal = () => {
    setStockModalItem(null);
  };

  const { data: itemsData, isLoading } = useQuery({
    queryKey: ['catalog-items', tipo, categoria, search],
    queryFn: () => catalogApi.getItems({ tipo, categoria, search }),
    keepPreviousData: true,
    staleTime: 0,
  });

  const { data: catData } = useQuery({
    queryKey: ['catalog-categories'],
    queryFn: () => catalogApi.getCategorias()
  });

  return (
    <div className="app-layout">
      <Topbar 
        title="Explorar Catálogo" 
        subtitle="Listado unificado de familias de productos y servicios profesionales"
        rightContent={
          <Link to="/catalogo/nuevo" className="btn btn--primary flex items-center gap-2">
            <Plus size={18} /> Nuevo Item
          </Link>
        }
      />
      <main className="main-content">
        <div className="animate-in fade-in duration-500">
          
          <div className="card mb-6" style={{ padding: '1rem' }}>
            <div className="catalog-filters-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {/* Tabs de Tipo */}
              <div style={{ display: 'flex', background: 'var(--bg-app)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
                <button 
                  onClick={() => setTipo('todos')}
                  style={{ flex: 1, border: 'none', background: tipo === 'todos' ? 'var(--bg-surface)' : 'transparent', color: tipo === 'todos' ? 'var(--clr-primary-500)' : 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', boxShadow: tipo === 'todos' ? 'var(--shadow-sm)' : 'none', transition: 'all 0.2s' }}
                >
                  Todos
                </button>
                <button 
                  onClick={() => setTipo('PRODUCTO')}
                  style={{ flex: 1, border: 'none', background: tipo === 'PRODUCTO' ? 'var(--bg-surface)' : 'transparent', color: tipo === 'PRODUCTO' ? 'var(--clr-primary-500)' : 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', boxShadow: tipo === 'PRODUCTO' ? 'var(--shadow-sm)' : 'none', transition: 'all 0.2s' }}
                >
                  Productos
                </button>
                <button 
                  onClick={() => setTipo('SERVICIO')}
                  style={{ flex: 1, border: 'none', background: tipo === 'SERVICIO' ? 'var(--bg-surface)' : 'transparent', color: tipo === 'SERVICIO' ? 'var(--clr-primary-500)' : 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-xs)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', boxShadow: tipo === 'SERVICIO' ? 'var(--shadow-sm)' : 'none', transition: 'all 0.2s' }}
                >
                  Servicios
                </button>
              </div>

              {/* Buscador */}
              <div style={{ position: 'relative', gridColumn: 'span 2' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre, código o referencia..."
                  className="input"
                  style={{ paddingLeft: '2.5rem' }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Familia */}
              <div style={{ position: 'relative' }}>
                <Filter size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <select 
                  className="input"
                  style={{ paddingLeft: '2.5rem', appearance: 'none' }}
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                >
                  <option value="">Todas las Familias</option>
                  {catData?.data?.map(c => (
                    <option key={c.id} value={c.slug}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Item / Marca</th>
                  <th>Familia</th>
                  <th>Ubicación</th>
                  <th>Stock / Cobro</th>
                  <th>Precio Venta</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
                        <div className="spinner" /> Cargando catálogo...
                      </div>
                    </td>
                  </tr>
                ) : itemsData?.items?.length > 0 ? itemsData.items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div className="flex items-center gap-4">
                        <div style={{ width: '3rem', height: '3rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-app)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {item.imagen_thumb_url ? (
                            <img 
                              src={`/uploads/${item.imagen_thumb_url}`} 
                              alt={item.nombre_comercial} 
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            />
                          ) : item.tipo === 'PRODUCTO' ? (
                            <Package size={24} color="var(--text-muted)" />
                          ) : (
                            <Wrench size={24} color="var(--text-muted)" />
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700 }}>
                            {item.nombre_comercial}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '0.125rem 0.375rem', borderRadius: '4px', background: 'var(--bg-app)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              {item.codigo_interno}
                            </span>
                            {item.nombre_interno && item.nombre_interno !== item.codigo_interno && (
                              <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '0.125rem 0.375rem', borderRadius: '4px', background: 'rgba(59,130,246,0.1)', color: 'var(--clr-info)', textTransform: 'uppercase' }}>
                                Ref: {item.nombre_interno}
                              </span>
                            )}
                            {item.marca && (
                              <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '0.125rem 0.375rem', borderRadius: '4px', background: 'rgba(34,197,94,0.1)', color: 'var(--clr-success)', textTransform: 'uppercase' }}>
                                {item.marca}
                              </span>
                            )}
                            {item.tipo === 'SERVICIO' && (
                              <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '0.125rem 0.375rem', borderRadius: '4px', background: 'rgba(99,102,241,0.1)', color: 'var(--clr-primary-500)', textTransform: 'uppercase' }}>
                                Servicio
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div 
                          style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.categoria_color || 'var(--clr-gray-500)' }}
                        />
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{item.categoria_nombre}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.codigo_ubicacion || '---'}
                      </span>
                    </td>
                    <td>
                      {item.tipo === 'PRODUCTO' ? (
                        <div className="flex flex-col">
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: item.stock_actual <= item.stock_minimo ? 'var(--clr-danger)' : 'var(--text-primary)' }}>
                            {item.stock_actual} {item.unidad_medida}
                          </span>
                          <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Mínimo: {item.stock_minimo}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--clr-primary-500)', textTransform: 'uppercase' }}>
                          Por {item.unidad_cobro || 'unidad'}
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {formatCurrency(item.precio_venta)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        {puede('catalogo', 'editar') && (
                          <button onClick={() => openStockModal(item)} className="btn btn--primary btn--sm" title="Ajustar stock">
                            Ajustar
                          </button>
                        )}
                        <Link 
                          to={`/catalogo/${item.id}/editar`}
                          className="btn btn--ghost btn--sm"
                          title="Editar item"
                        >
                          <MoreHorizontal size={18} />
                        </Link>
                        <Link 
                          to={`/catalogo/${item.id}`}
                          className="btn btn--secondary btn--sm"
                        >
                          <ChevronRight size={18} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      No se encontraron items con los filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
                      </div>
            <StockAdjustModal item={stockModalItem} isOpen={!!stockModalItem} onClose={closeStockModal} onSuccess={handleStockAdjustSuccess} />
        </div>
      </main>
    </div>
  );
}
