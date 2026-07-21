import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { Wrench, Plus, Edit2, Search, CheckCircle, XCircle } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

export function ComponentesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  
  // Estado modal
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', descripcion: '', is_active: true });

  const { data: componentes = [], isLoading } = useQuery({
    queryKey: ['mantenimiento-componentes-todos'],
    queryFn: async () => {
      const { data } = await api.get('/mantenimiento/componentes');
      return data.data || [];
    }
  });

  const saveMut = useMutation({
    mutationFn: async (payload) => {
      if (editingItem) {
        return api.put(`/mantenimiento/componentes/${editingItem.id}`, payload);
      }
      return api.post('/mantenimiento/componentes', payload);
    },
    onSuccess: () => {
      toast.success(`Componente ${editingItem ? 'actualizado' : 'creado'} con éxito`);
      qc.invalidateQueries(['mantenimiento-componentes-todos']);
      qc.invalidateQueries(['mantenimiento-componentes-activos']);
      closeModal();
    },
    onError: (err) => {
      toast.error('Error al guardar el componente');
    }
  });

  const handleOpenModal = (item = null) => {
    setEditingItem(item);
    setFormData(item ? { ...item } : { nombre: '', descripcion: '', is_active: true });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData({ nombre: '', descripcion: '', is_active: true });
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return toast.error('El nombre es obligatorio');
    saveMut.mutate(formData);
  };

  const filtered = componentes.filter(c => 
    c.nombre.toLowerCase().includes(search.toLowerCase()) || 
    (c.descripcion || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout title="Catálogo de Componentes" subtitle="Administra los sistemas y componentes de los equipos">
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div className="input-group" style={{ flex: 1, minWidth: '250px', marginBottom: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input"
              placeholder="Buscar componente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>
        <button className="btn btn--primary" onClick={() => handleOpenModal()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={18} /> Nuevo Componente
        </button>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Componente / Sistema</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" style={{ margin: '0 auto' }}/></td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No se encontraron componentes</td>
                </tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{c.descripcion || '—'}</td>
                    <td>
                      {c.is_active 
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(74,222,128,0.1)', color: '#4ade80', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}><CheckCircle size={12}/> Activo</span>
                        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(248,113,113,0.1)', color: '#f87171', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}><XCircle size={12}/> Inactivo</span>
                      }
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn-icon" onClick={() => handleOpenModal(c)} title="Editar componente">
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h2 className="modal-title">
              {editingItem ? 'Editar Componente' : 'Nuevo Componente'}
            </h2>
            <form onSubmit={handleSave}>
              <div className="input-group">
                <label className="input-label">Nombre del Sistema/Componente *</label>
                <input
                  type="text"
                  className="input"
                  value={formData.nombre}
                  onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Sistema Hidráulico"
                  autoFocus
                />
              </div>
              <div className="input-group">
                <label className="input-label">Descripción</label>
                <textarea
                  className="input"
                  value={formData.descripcion}
                  onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Opcional..."
                  rows={3}
                />
              </div>
              <div className="input-group">
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--clr-primary-500)' }}
                  />
                  Componente Activo (Visible en OTs)
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn--secondary" onClick={closeModal} disabled={saveMut.isLoading}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn--primary" disabled={saveMut.isLoading}>
                  {saveMut.isLoading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
