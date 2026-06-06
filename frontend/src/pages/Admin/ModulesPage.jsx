import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Topbar } from '../../components/layout/Topbar';
import { Modal } from '../../components/common/Modal';
import api from '../../lib/api';

const fetchModules = async () => {
  const { data } = await api.get('/admin/modulos');
  return data;
};

// Componente para renderizar icono dinámicamente
const DynamicIcon = ({ name, size = 20, className = '' }) => {
  if (!name) return null;
  const IconComponent = LucideIcons[name];
  if (!IconComponent) return <LucideIcons.HelpCircle size={size} className={className} />;
  return <IconComponent size={size} className={className} />;
};

export function ModulesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  
  const [formData, setFormData] = useState({
    nombre: '',
    slug: '',
    icono: '',
    ruta_base: '',
    orden_menu: 0,
    activo: true
  });

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ['admin-modulos'],
    queryFn: fetchModules
  });

  const createMutation = useMutation({
    mutationFn: (newModule) => api.post('/admin/modulos', newModule),
    onSuccess: () => {
      toast.success('Módulo creado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['admin-modulos'] });
      closeModal();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al crear módulo')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...updateData }) => api.put(`/admin/modulos/${id}`, updateData),
    onSuccess: () => {
      toast.success('Módulo actualizado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['admin-modulos'] });
      closeModal();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al actualizar módulo')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/modulos/${id}`),
    onSuccess: () => {
      toast.success('Módulo eliminado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['admin-modulos'] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error al eliminar módulo')
  });

  const openModal = (moduleToEdit = null) => {
    if (moduleToEdit) {
      setEditingModule(moduleToEdit);
      setFormData({
        nombre: moduleToEdit.nombre || '',
        slug: moduleToEdit.slug || '',
        icono: moduleToEdit.icono || '',
        ruta_base: moduleToEdit.ruta_base || '',
        orden_menu: moduleToEdit.orden_menu || 0,
        activo: moduleToEdit.activo
      });
    } else {
      setEditingModule(null);
      setFormData({ nombre: '', slug: '', icono: '', ruta_base: '', orden_menu: 0, activo: true });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingModule(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingModule) {
      updateMutation.mutate({ id: editingModule.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id, nombre) => {
    if (window.confirm(`¿Estás seguro de eliminar el módulo "${nombre}"? Esta acción eliminará los permisos asociados y no se puede deshacer.`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="app-layout">
      <Topbar 
        title="Módulos del Sistema" 
        subtitle="Administra los módulos disponibles y su configuración"
      />

      <main className="main-content">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
          <button className="btn btn--primary" onClick={() => openModal()}>
            <Plus size={16} /> Nuevo Módulo
          </button>
        </div>

        {isLoading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : modules.length === 0 ? (
          <div className="empty-state">No se encontraron módulos configurados.</div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Icono</th>
                    <th>Nombre</th>
                    <th>Slug</th>
                    <th>Ruta Base</th>
                    <th>Estado</th>
                    <th style={{ width: 100, textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((m) => (
                    <tr key={m.id}>
                      <td style={{ textAlign: 'center' }}>{m.orden_menu}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: 'var(--bg-secondary)', borderRadius: 6 }}>
                          <DynamicIcon name={m.icono} size={18} className="text-muted" />
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{m.nombre}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{m.slug}</td>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{m.ruta_base || '—'}</td>
                      <td>
                        <span className={`badge ${m.activo ? 'badge--success' : 'badge--error'}`}>
                          {m.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn-icon" onClick={() => openModal(m)} title="Editar módulo">
                            <Edit2 size={16} />
                          </button>
                          <button className="btn-icon text-error" onClick={() => handleDelete(m.id, m.nombre)} title="Eliminar módulo">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {isModalOpen && (
        <Modal title={editingModule ? 'Editar Módulo' : 'Nuevo Módulo'} onClose={closeModal}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Nombre del Módulo *</label>
              <input 
                className="input" 
                name="nombre" 
                value={formData.nombre} 
                onChange={handleChange} 
                required 
                placeholder="Ej. Gestión de Tickets" 
                autoFocus
              />
            </div>
            <div className="input-group">
              <label className="input-label">Slug (Identificador único) *</label>
              <input 
                className="input" 
                name="slug" 
                value={formData.slug} 
                onChange={handleChange} 
                required 
                placeholder="Ej. gestion_tickets" 
                style={{ fontFamily: 'monospace' }}
              />
              <p className="help-text">Sin espacios ni caracteres especiales. Usado internamente para permisos.</p>
            </div>
            <div className="input-group">
              <label className="input-label">Icono (Nombre del icono Lucide)</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input 
                  className="input" 
                  name="icono" 
                  value={formData.icono} 
                  onChange={handleChange} 
                  placeholder="Ej. Briefcase, Users, Layout" 
                  style={{ flex: 1 }}
                />
                <div 
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    width: 38, height: 38, background: 'var(--bg-secondary)', 
                    border: '1px solid var(--border-color)', borderRadius: '6px' 
                  }}
                  title="Previsualización del Icono"
                >
                  {formData.icono ? <DynamicIcon name={formData.icono} /> : <LucideIcons.Image size={20} className="text-muted" />}
                </div>
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Ruta Base (Opcional)</label>
              <input 
                className="input" 
                name="ruta_base" 
                value={formData.ruta_base} 
                onChange={handleChange} 
                placeholder="Ej. /tickets" 
                style={{ fontFamily: 'monospace' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Orden en Menú</label>
                <input 
                  type="number" 
                  className="input" 
                  name="orden_menu" 
                  value={formData.orden_menu} 
                  onChange={handleChange} 
                  min="0"
                />
              </div>
              <div className="input-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', marginTop: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500 }}>
                  <input 
                    type="checkbox" 
                    name="activo" 
                    checked={formData.activo} 
                    onChange={handleChange} 
                    style={{ width: 16, height: 16, accentColor: 'var(--clr-primary-500)' }}
                  />
                  Módulo Activo
                </label>
              </div>
            </div>

            <div className="modal__footer">
              <button type="button" className="btn btn--secondary" onClick={closeModal} disabled={createMutation.isPending || updateMutation.isPending}>
                Cancelar
              </button>
              <button type="submit" className="btn btn--primary" disabled={createMutation.isPending || updateMutation.isPending}>
                <Save size={16} /> {editingModule ? 'Guardar Cambios' : 'Crear Módulo'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
