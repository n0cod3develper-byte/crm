import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Modal } from '../../components/common/Modal';
import api from '../../lib/api';
import { CentroCostoItemsManager } from './CentroCostoItemsManager';

export default function CentroCostoModal({ isOpen, onClose, centroCosto }) {
  const queryClient = useQueryClient();
  const isEditing = !!centroCosto;
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'items'

  const [form, setForm] = useState({
    empresa_id: '',
    nombre: '',
    descripcion: '',
    estado: true
  });

  useEffect(() => {
    if (isOpen) {
      setActiveTab('general');
      if (centroCosto) {
        setForm({
          empresa_id: centroCosto.empresa_id || '',
          nombre: centroCosto.nombre || '',
          descripcion: centroCosto.descripcion || '',
          estado: centroCosto.estado ?? true
        });
      } else {
        setForm({
          empresa_id: '',
          nombre: '',
          descripcion: '',
          estado: true
        });
      }
    }
  }, [centroCosto, isOpen]);

  const { data: companies = [], isLoading: isLoadingCompanies } = useQuery({
    queryKey: ['companies-list'],
    queryFn: async () => {
      const res = await api.get('/companies?limit=1000');
      return res.data?.data || [];
    },
    enabled: isOpen
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (isEditing) {
        const res = await api.patch(`/centros-costos/${centroCosto.id}`, data);
        return res.data;
      } else {
        const res = await api.post('/centros-costos', data);
        return res.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['centros-costos']);
      toast.success(isEditing ? 'Centro de costo actualizado' : 'Centro de costo creado');
      if (!isEditing) {
        onClose();
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Ocurrió un error al guardar');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.empresa_id || !form.nombre) {
      toast.error('Empresa y Nombre son obligatorios');
      return;
    }
    saveMutation.mutate(form);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  if (!isOpen) return null;

  return (
    <Modal
      title={isEditing ? 'Editar Centro de Costo' : 'Nuevo Centro de Costo'}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', width: '100%' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn--secondary"
          >
            {isEditing ? 'Cerrar' : 'Cancelar'}
          </button>
          {activeTab === 'general' && (
            <button
              type="submit"
              form="cc-form"
              className="btn btn--primary"
              disabled={saveMutation.isLoading}
            >
              {saveMutation.isLoading ? 'Guardando...' : 'Guardar Centro de Costo'}
            </button>
          )}
        </div>
      }
    >
      
      {isEditing && (
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            style={{
              background: 'none', border: 'none', padding: '0.5rem 0',
              fontWeight: activeTab === 'general' ? 600 : 500,
              color: activeTab === 'general' ? 'var(--primary-color)' : 'var(--text-muted)',
              borderBottom: activeTab === 'general' ? '2px solid var(--primary-color)' : '2px solid transparent',
              cursor: 'pointer', fontSize: '0.875rem'
            }}
          >
            Detalles Generales
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            style={{
              background: 'none', border: 'none', padding: '0.5rem 0',
              fontWeight: activeTab === 'items' ? 600 : 500,
              color: activeTab === 'items' ? 'var(--primary-color)' : 'var(--text-muted)',
              borderBottom: activeTab === 'items' ? '2px solid var(--primary-color)' : '2px solid transparent',
              cursor: 'pointer', fontSize: '0.875rem'
            }}
          >
            Insumos y Servicios
          </button>
        </div>
      )}

      {activeTab === 'general' ? (
        <form id="cc-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div className="input-group">
            <label className="input-label">Empresa *</label>
            <select
              name="empresa_id"
              value={form.empresa_id}
              onChange={handleChange}
              required
              className="input"
              disabled={isLoadingCompanies}
            >
              <option value="">Seleccione una empresa...</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Nombre del Centro de Costo *</label>
            <input
              type="text"
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              required
              placeholder="Ej: Operaciones Norte"
              className="input"
            />
          </div>

          <div className="input-group">
            <label className="input-label">Descripción (Opcional)</label>
            <textarea
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              rows="3"
              placeholder="Detalles adicionales..."
              className="input"
              style={{ resize: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input
              type="checkbox"
              name="estado"
              id="cc-estado"
              checked={form.estado}
              onChange={handleChange}
              className="custom-checkbox"
            />
            <label htmlFor="cc-estado" style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-main)', cursor: 'pointer' }}>
              Centro de Costo Activo
            </label>
          </div>

        </form>
      ) : (
        <CentroCostoItemsManager centroCostoId={centroCosto.id} />
      )}
    </Modal>
  );
}
