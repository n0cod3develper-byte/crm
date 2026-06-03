import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Building2, ExternalLink } from 'lucide-react';
import { Topbar } from '../../components/layout/Topbar';
import api from '../../lib/api';
import { toast } from 'react-hot-toast';

import { Modal } from '../../components/common/Modal';
import { CompanyForm } from '../../components/Companies/CompanyForm';
import { ImportCompaniesModal } from '../../components/Companies/ImportCompaniesModal';
import Papa from 'papaparse';

export function CompaniesPage() {
  const [search, setSearch] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
  const [editingCompany, setEditingCompany] = React.useState(null);
  const [deletingId, setDeletingId] = React.useState(null);

  const [cursorHistory, setCursorHistory] = React.useState([]);
  const [currentCursor, setCurrentCursor] = React.useState(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['companies', search, currentCursor],
    queryFn: async () => {
      const params = { limit: 100 };
      if (search) params.search = search;
      if (currentCursor) params.cursor = currentCursor;
      const { data } = await api.get('/companies', { params });
      return data;
    },
    enabled: true,
  });

  // Si cambia la búsqueda, resetear la paginación
  React.useEffect(() => {
    setCursorHistory([]);
    setCurrentCursor(null);
  }, [search]);

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/companies/${id}`),
    onSuccess: () => {
      toast.success('Empresa eliminada correctamente');
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setDeletingId(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Error al eliminar empresa (¿Eres admin?)');
      setDeletingId(null);
    }
  });

  const companies = data?.data || [];

  const handleCreate = () => {
    setEditingCompany(null);
    setIsModalOpen(true);
  };

  const handleEdit = (company) => {
    setEditingCompany(company);
    setIsModalOpen(true);
  };

  const handleExport = () => {
    if (companies.length === 0) {
      toast.error('No hay empresas para exportar');
      return;
    }
    const exportData = companies.map(comp => ({
      name: comp.name,
      nit: comp.nit || '',
      industry: comp.industry || '',
      department: comp.department || '',
      website: comp.website || '',
      phone: comp.phone || '',
      phone_2: comp.phone_2 || '',
      city: comp.city || '',
      address: comp.address || '',
      notes: comp.notes || '',
      assigned_to_name: comp.assigned_to_name || '',
      created_at: comp.created_at ? new Date(comp.created_at).toLocaleString('es-CO') : '',
      updated_at: comp.updated_at ? new Date(comp.updated_at).toLocaleString('es-CO') : ''
    }));
    
    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'empresas.csv';
    link.click();
    toast.success('Lista de empresas exportada');
  };

  return (
    <div className="app-layout">
      <Topbar 
        title="Empresas" 
        subtitle={data?.pagination ? `${data.pagination.totalCount} empresas registradas` : 'Cargando...'} 
        rightContent={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn--outline" onClick={() => setIsImportModalOpen(true)}>
              Importar
            </button>
            <button className="btn btn--outline" onClick={handleExport}>
              Exportar
            </button>
            <button className="btn btn--primary" onClick={handleCreate}>
              <Plus size={16} />
              Nueva empresa
            </button>
          </div>
        }
      />

      <main className="main-content">
        {/* Buscador */}
        <div style={{ position: 'relative', marginBottom: '1.5rem', maxWidth: 400 }}>
          <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Buscar empresa o NIT…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Tabla */}
        {isLoading ? (
          <div className="empty-state">
            <div className="spinner" style={{ width: '2rem', height: '2rem' }} />
          </div>
        ) : companies.length === 0 ? (
          <div className="empty-state">
            <Building2 size={48} className="empty-state__icon" />
            <h2 className="empty-state__title">Sin empresas aún</h2>
            <p className="empty-state__desc">
              Crea tu primera empresa para comenzar a gestionar clientes logísticos.
            </p>
            <button className="btn btn--primary" onClick={handleCreate}>
              <Plus size={16} />
              Crear empresa
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}><input type="checkbox" className="custom-checkbox" /></th>
                  <th>Empresa</th>
                  <th>NIT</th>
                  <th>Ciudad</th>
                  <th>Contactos</th>
                  <th>Oportunidades</th>
                  <th>Responsable</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {companies.map(company => (
                  <tr key={company.id}>
                    <td><input type="checkbox" className="custom-checkbox" /></td>
                    <td>
                      <Link 
                        to={`/companies/${company.id}`} 
                        style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}
                        className="hover-link"
                      >
                        {company.name}
                      </Link>
                      {company.website && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{company.website}</div>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{company.nit || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{company.city || '—'}</td>
                    <td>
                      <span className="badge badge--gray">{company.contacts_count || 0}</span>
                    </td>
                    <td>
                      <span className="badge badge--primary">{company.open_opportunities_count || 0}</span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                      {company.assigned_to_name || '—'}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button 
                          className="btn btn--secondary btn--sm" 
                          onClick={() => handleEdit(company)}
                          title="Editar"
                        >
                          Editar
                        </button>
                        <button 
                          className="btn btn--ghost btn--sm" 
                          style={{ color: 'var(--clr-danger)' }}
                          onClick={() => setDeletingId(company.id)}
                          title="Eliminar"
                        >
                          Eliminar
                        </button>
                        <Link to={`/companies/${company.id}`} className="btn btn--ghost btn--sm" title="Abrir">
                          <ExternalLink size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Controles de Paginación */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Mostrando <strong>{companies.length}</strong> de <strong>{data?.pagination?.totalCount || 0}</strong> empresas {search && '(filtradas)'}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn btn--outline btn--sm" 
                  onClick={() => {
                    const newHistory = [...cursorHistory];
                    const prevCursor = newHistory.pop() || null;
                    setCursorHistory(newHistory);
                    setCurrentCursor(prevCursor);
                  }}
                  disabled={cursorHistory.length === 0}
                >
                  Anterior
                </button>
                <button 
                  className="btn btn--outline btn--sm" 
                  onClick={() => {
                    if (data?.pagination?.hasMore) {
                      setCursorHistory([...cursorHistory, currentCursor]);
                      setCurrentCursor(data.pagination.nextCursor);
                    }
                  }}
                  disabled={!data?.pagination?.hasMore}
                >
                  Siguiente
                </button>
              </div>
            </div>

          </div>
        )}
      </main>

      {isModalOpen && (
        <Modal 
          title={editingCompany ? "Editar Empresa" : "Agregar Nueva Empresa"} 
          onClose={() => setIsModalOpen(false)}
        >
          <CompanyForm 
            company={editingCompany}
            onSuccess={() => setIsModalOpen(false)} 
            onCancel={() => setIsModalOpen(false)} 
          />
        </Modal>
      )}

      {deletingId && (
        <Modal 
          title="Eliminar Empresa" 
          onClose={() => setDeletingId(null)}
          maxWidth="400px"
        >
          <p style={{ color: 'var(--text-secondary)' }}>
            ¿Estás seguro de que deseas eliminar esta empresa? Esta acción se reflejará en el sistema, aunque no eliminará los datos históricos permanentemente (soft delete).
          </p>
          <div className="flex gap-3 justify-end mt-6">
            <button className="btn btn--secondary" onClick={() => setDeletingId(null)}>
              Cancelar
            </button>
            <button 
              className="btn btn--danger" 
              onClick={() => deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
          </div>
        </Modal>
      )}

      {isImportModalOpen && (
        <ImportCompaniesModal 
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            setIsImportModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['companies'] });
          }}
        />
      )}
    </div>
  );
}
