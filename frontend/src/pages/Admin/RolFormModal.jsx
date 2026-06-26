import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { rolesService } from '../../services/rolesService';
import { toast } from 'react-hot-toast';

export function RolFormModal({ onClose, onSuccess, rolToEdit = null }) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (rolToEdit) {
      setNombre(rolToEdit.nombre || '');
      setDescripcion(rolToEdit.descripcion || '');
    }
  }, [rolToEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (rolToEdit) {
        await rolesService.actualizarRol(rolToEdit.id, { nombre, descripcion });
        toast.success('Rol actualizado correctamente');
      } else {
        await rolesService.crearRol({ nombre, descripcion });
        toast.success('Rol creado correctamente');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Error al guardar el rol');
    } finally {
      setLoading(false);
    }
  };

  const isSystemRole = rolToEdit?.es_sistema;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <form onSubmit={handleSubmit}>
          <div className="modal__header">
            <h3 className="font-bold">{rolToEdit ? 'Editar Rol' : 'Nuevo Rol'}</h3>
            <button type="button" className="icon-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className="modal__body flex flex-col gap-4">
            <div className="input-group">
              <label className="input-label">Nombre del Rol</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="input"
                required
                minLength={3}
                maxLength={100}
                placeholder="Ej: Supervisor Comercial"
                disabled={isSystemRole && false} 
              />
            </div>

            <div className="input-group">
              <label className="input-label">Descripción</label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="input"
                rows={3}
                maxLength={500}
                placeholder="Describe las responsabilidades de este rol..."
              />
            </div>

            {isSystemRole && (
              <div className="text-sm" style={{ color: 'var(--warning-dark, #b45309)', background: 'var(--warning-light, #fffbeb)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--warning-border, #fcd34d)' }}>
                <strong>Nota:</strong> Este es un rol del sistema. Modificar el nombre o la descripción no afectará su comportamiento interno.
              </div>
            )}
          </div>

          <div className="modal__footer flex justify-end gap-2">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
