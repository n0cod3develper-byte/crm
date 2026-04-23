import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Building2, ExternalLink } from 'lucide-react';
import { Sidebar } from '../../components/layout/Sidebar';
import api from '../../lib/api';
import { toast } from 'react-hot-toast';

import { Modal } from '../../components/common/Modal';
import { CompanyForm } from '../../components/Companies/CompanyForm';

export function CompaniesPage() {
  const [search, setSearch] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingCompany, setEditingCompany] = React.useState(null);
  const [deletingId, setDeletingId] = React.useState(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['companies', search],
    queryFn: async () => {
      const { data } = await api.get('/companies', { params: { search, limit: 20 } });
      return data;
    },
    enabled: true,
  });

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

  return (
    <div className="app-layout">
      <Sidebar />

      <header className="header">
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Empresas</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {data?.pagination ? `${companies.length} empresas` : 'Cargando...'}
          </p>
        </div>
        <button className="btn btn--primary" onClick={handleCreate}>
          <Plus size={16} />
          Nueva empresa
        </button>
      </header>

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
    </div>
  );
}
