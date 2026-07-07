import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Topbar } from '../../components/layout/Topbar';
import { Building2, Search, Plus, Filter, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import CentroCostoModal from './CentroCostoModal';
import { debounce } from 'lodash';

export function CentrosCostosPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedEmpresa, setSelectedEmpresa] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Debounce search
  useEffect(() => {
    const handler = debounce(() => setDebouncedSearch(searchTerm), 500);
    handler();
    return () => handler.cancel();
  }, [searchTerm]);

  const { data, isLoading } = useQuery({
    queryKey: ['centros-costos', debouncedSearch, selectedEmpresa],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (selectedEmpresa) params.append('empresa_id', selectedEmpresa);
      const res = await api.get(`/centros-costos?${params.toString()}`);
      return res.data?.data || [];
    }
  });

  // Empresas for filter
  const { data: companies = [] } = useQuery({
    queryKey: ['companies-list'],
    queryFn: async () => {
      const res = await api.get('/companies?limit=1000');
      return res.data?.data || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/centros-costos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['centros-costos']);
      toast.success('Centro de costo eliminado correctamente');
    },
    onError: () => {
      toast.error('Error al eliminar el centro de costo');
    }
  });

  const handleDelete = (item) => {
    if (window.confirm(`¿Está seguro de eliminar el centro de costo "${item.nombre}"?`)) {
      deleteMutation.mutate(item.id);
    }
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  return (
    <div className="app-layout">
      <Topbar 
        title="Centros de Costos" 
        subtitle="Gestión de centros de costos por empresa"
        rightContent={
          <button className="btn btn--primary" onClick={() => { setSelectedItem(null); setIsModalOpen(true); }}>
            <Plus size={16} /> Nuevo Centro de Costo
          </button>
        }
      />

      <main className="main-content">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {/* Buscador */}
          <div style={{ position: 'relative', flex: '1', minWidth: '250px', maxWidth: '400px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: '2.5rem', width: '100%' }}
              placeholder="Buscar por nombre o empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filtro Empresa */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              className="input"
              value={selectedEmpresa}
              onChange={(e) => setSelectedEmpresa(e.target.value)}
              style={{ paddingRight: '2rem' }}
            >
              <option value="">Todas las Empresas</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabla */}
        {isLoading ? (
          <div className="empty-state">
            <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
          </div>
        ) : !data || data.length === 0 ? (
          <div className="empty-state">
            <Building2 size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Sin centros de costos</h2>
            <p className="empty-state__desc">
              No se encontraron resultados o aún no has creado ninguno.
            </p>
            <button className="btn btn--primary" onClick={() => { setSelectedItem(null); setIsModalOpen(true); }}>
              <Plus size={16} /> Crear Centro de Costo
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Centro de Costo</th>
                  <th>Descripción</th>
                  <th>Estado</th>
                  <th style={{ width: 100, textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                        <Building2 size={16} style={{ color: 'var(--text-muted)' }} />
                        {item.empresa_nombre}
                      </div>
                    </td>
                    <td>{item.nombre}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.descripcion || '—'}
                    </td>
                    <td>
                      <span className={`badge ${item.estado ? 'badge--success' : 'badge--error'}`}>
                        {item.estado ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn--icon" onClick={() => handleEdit(item)} title="Editar">
                          <Edit2 size={16} />
                        </button>
                        <button className="btn btn--icon" style={{ color: 'var(--danger-main)' }} onClick={() => handleDelete(item)} title="Eliminar">
                          <Trash2 size={16} />
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

      <CentroCostoModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        centroCosto={selectedItem}
      />
    </div>
  );
}
