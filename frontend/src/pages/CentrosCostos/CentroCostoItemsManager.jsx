import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Search, Plus, Trash2, Package, Wrench, Loader2 } from 'lucide-react';
import api from '../../lib/api';

export function CentroCostoItemsManager({ centroCostoId }) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');

  // Fetch items associated with the cost center
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['centro-costo-items', centroCostoId],
    queryFn: async () => {
      const res = await api.get(`/centros-costos/${centroCostoId}/items`);
      return res.data || [];
    },
    enabled: !!centroCostoId
  });

  // Fetch catalog search results to add
  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ['catalog-search', catalogSearch],
    queryFn: async () => {
      if (!catalogSearch || catalogSearch.length < 2) return [];
      const res = await api.get(`/catalog?search=${catalogSearch}&limit=10`);
      return res.data?.data || [];
    },
    enabled: catalogSearch.length >= 2
  });

  const addMutation = useMutation({
    mutationFn: async (inventario_id) => {
      const res = await api.post(`/centros-costos/${centroCostoId}/items`, { inventario_id });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['centro-costo-items', centroCostoId]);
      toast.success('Ítem agregado al Centro de Costos');
      setCatalogSearch('');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Error al agregar ítem');
    }
  });

  const removeMutation = useMutation({
    mutationFn: async (inventario_id) => {
      const res = await api.delete(`/centros-costos/${centroCostoId}/items/${inventario_id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['centro-costo-items', centroCostoId]);
      toast.success('Ítem removido');
    },
    onError: (error) => {
      toast.error('Error al remover ítem');
    }
  });

  const filteredItems = items.filter(i => 
    i.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.codigo_interno?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '0.5rem' }}>
      
      {/* Search and Add from Catalog */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label className="input-label">Buscar y Agregar desde el Catálogo</label>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Buscar por código, referencia o nombre para agregar..."
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
          />
          {isSearching && (
            <Loader2 className="spinner" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
          )}
        </div>

        {searchResults.length > 0 && catalogSearch.length >= 2 && (
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginTop: '0.5rem' }}>
            {searchResults.map(res => (
              <div 
                key={res.id} 
                style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                  padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', background: '#fff'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {res.tipo === 'SERVICIO' ? <Wrench size={18} color="var(--primary-color)" /> : <Package size={18} color="var(--primary-color)" />}
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{res.name || res.codigo_interno}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{res.tipo} - {res.codigo_interno}</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--secondary"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  onClick={() => addMutation.mutate(res.id)}
                  disabled={addMutation.isLoading || items.some(i => i.id === res.id)}
                >
                  {items.some(i => i.id === res.id) ? 'Agregado' : <><Plus size={14} /> Agregar</>}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />

      {/* Assigned Items List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>Ítems Asignados ({items.length})</h4>
          <div style={{ position: 'relative', width: '250px' }}>
            <Search style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={14} />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: '1.75rem', padding: '0.35rem 0.5rem 0.35rem 1.75rem', fontSize: '0.8125rem' }}
              placeholder="Filtrar asignados..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}><Loader2 className="spinner" size={24} /></div>
        ) : filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No hay ítems asignados a este Centro de Costo.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Código</th>
                  <th>Referencia</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr key={item.id}>
                    <td>
                      <span style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                        fontSize: '0.75rem', padding: '0.125rem 0.5rem', borderRadius: '1rem',
                        background: item.tipo === 'SERVICIO' ? 'var(--primary-bg)' : '#f3f4f6',
                        color: item.tipo === 'SERVICIO' ? 'var(--primary-color)' : 'var(--text-main)',
                        fontWeight: 500
                      }}>
                        {item.tipo === 'SERVICIO' ? <Wrench size={12} /> : <Package size={12} />}
                        {item.tipo}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.875rem', fontFamily: 'monospace' }}>{item.codigo_interno}</td>
                    <td style={{ fontSize: '0.875rem', fontWeight: 500 }}>{item.name || 'N/A'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn--icon"
                        style={{ color: 'var(--danger-color)' }}
                        onClick={() => {
                          if (window.confirm('¿Seguro que deseas remover este ítem del centro de costo?')) {
                            removeMutation.mutate(item.id);
                          }
                        }}
                        title="Remover"
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
      </div>

    </div>
  );
}
