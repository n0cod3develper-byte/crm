import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '../../services/catalogApi';
import { Topbar } from '../../components/layout/Topbar';
import { Layers, Plus, Edit2, Trash2, Save, X, Palette, Type, Hash } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function FamiliesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState(null);

  const { data: families, isLoading } = useQuery({
    queryKey: ['catalog-categories'],
    queryFn: () => catalogApi.getCategorias()
  });

  const mutation = useMutation({
    mutationFn: (data) => editingFamily 
      ? catalogApi.updateCategoria(editingFamily.id, data) 
      : catalogApi.createCategoria(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['catalog-categories']);
      toast.success(editingFamily ? 'Familia actualizada' : 'Familia creada');
      closeModal();
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => catalogApi.deleteCategoria(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['catalog-categories']);
      toast.success('Familia eliminada');
    }
  });

  const openModal = (f = null) => {
    setEditingFamily(f);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingFamily(null);
    setIsModalOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    // Auto-slug if empty
    if (!data.slug) {
      data.slug = data.nombre.toLowerCase().replace(/ /g, '_').replace(/[^\w-]+/g, '');
    }

    mutation.mutate({
      ...data,
      orden: parseInt(data.orden || 0),
      activo: true
    });
  };

  return (
    <div className="app-layout">
      <Topbar 
        title="Gestión de Familias" 
        subtitle="Organiza tus productos y servicios por categorías comerciales"
        rightContent={
          <button onClick={() => openModal()} className="btn btn--primary flex items-center gap-2">
            <Plus size={18} /> Nueva Familia
          </button>
        }
      />
      <main className="main-content">
        <div className="animate-in fade-in duration-500">
          
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>Icono</th>
                  <th>Nombre / Slug</th>
                  <th>Aplicable a</th>
                  <th>Items</th>
                  <th>Orden</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>Cargando familias...</td></tr>
                ) : families?.data?.length > 0 ? families.data.map(f => (
                  <tr key={f.id}>
                    <td>
                      <div 
                        style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: f.color_hex || 'var(--clr-gray-500)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Layers size={16} />
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{f.nombre}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{f.slug}</div>
                    </td>
                    <td>
                      <span className="badge" style={{ fontSize: '10px' }}>
                        {f.tipo_aplicable === 'AMBOS' ? 'Todo el catálogo' : f.tipo_aplicable}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: 'var(--text-xs)' }}>
                        <span style={{ color: 'var(--clr-primary-500)', fontWeight: 600 }}>{f.total_productos}</span> Prod. | 
                        <span style={{ color: 'var(--clr-info)', fontWeight: 600 }}> {f.total_servicios}</span> Serv.
                      </div>
                    </td>
                    <td>{f.orden}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openModal(f)} className="btn btn--ghost btn--sm" title="Editar"><Edit2 size={16} /></button>
                        <button 
                          onClick={() => { if(window.confirm('¿Eliminar esta familia? Se ocultará del catálogo.')) deleteMutation.mutate(f.id) }} 
                          className="btn btn--ghost btn--sm" 
                          style={{ color: 'var(--clr-danger)' }}
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No hay familias configuradas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontWeight: 700 }}>{editingFamily ? 'Editar Familia' : 'Nueva Familia'}</h2>
              <button onClick={closeModal} className="btn btn--ghost"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-group">
                <label className="input-label flex items-center gap-2"><Type size={14} /> Nombre de la Familia</label>
                <input name="nombre" defaultValue={editingFamily?.nombre} required className="input" placeholder="Ej: Neumáticos, Motor, etc." />
              </div>

              <div className="input-group">
                <label className="input-label flex items-center gap-2"><Hash size={14} /> Slug (Identificador único)</label>
                <input name="slug" defaultValue={editingFamily?.slug} className="input" placeholder="ej_neumaticos (opcional)" />
              </div>

              <div className="input-group">
                <label className="input-label">Tipo Aplicable</label>
                <select name="tipo_aplicable" defaultValue={editingFamily?.tipo_aplicable || 'AMBOS'} className="input">
                  <option value="AMBOS">Ambos (Productos y Servicios)</option>
                  <option value="PRODUCTO">Solo Productos</option>
                  <option value="SERVICIO">Solo Servicios</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label flex items-center gap-2"><Palette size={14} /> Color (HEX)</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="color" name="color_hex" defaultValue={editingFamily?.color_hex || '#3b82f6'} style={{ width: '40px', height: '38px', padding: 0, border: 'none', borderRadius: '4px' }} />
                    <input name="color_hex_text" defaultValue={editingFamily?.color_hex || '#3b82f6'} className="input" style={{ flex: 1 }} readOnly />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Orden</label>
                  <input type="number" name="orden" defaultValue={editingFamily?.orden || 0} className="input" />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Descripción</label>
                <textarea name="descripcion" defaultValue={editingFamily?.descripcion} className="input" rows="2"></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={closeModal} className="btn btn--secondary">Cancelar</button>
                <button type="submit" disabled={mutation.isLoading} className="btn btn--primary flex items-center gap-2">
                  <Save size={18} /> {mutation.isLoading ? 'Guardando...' : 'Guardar Familia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
