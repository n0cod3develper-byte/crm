import React, { useState, useEffect } from 'react';
import { catalogApi } from '../../services/catalogApi';
import { usePermissions } from '../../contexts/PermissionsContext';
import { Modal } from '../common/Modal';

export function StockAdjustModal({ item, isOpen, onClose, onSuccess }) {
  const { puede } = usePermissions();
  const [nuevoStock, setNuevoStock] = useState(item?.stock_actual ?? 0);
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setNuevoStock(item?.stock_actual ?? 0);
      setMotivo('');
      setError(null);
    }
  }, [isOpen, item]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (nuevoStock === '' || isNaN(nuevoStock) || Number(nuevoStock) < 0) {
      setError('El stock debe ser un número no negativo');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await catalogApi.adjustStock(item.id, { nuevo_stock: Number(nuevoStock), motivo });
      onSuccess && onSuccess();
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`Ajustar Stock – ${item?.nombre_comercial || item?.name}`}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="btn btn--ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
          Stock actual: <strong>{item?.stock_actual}</strong> {item?.unidad_medida}
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: '0.375rem' }}>
            Nuevo Stock
          </label>
          <input
            type="number"
            className="input"
            value={nuevoStock}
            onChange={e => setNuevoStock(e.target.value)}
            min="0"
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: '0.375rem' }}>
            Motivo (opcional)
          </label>
          <textarea
            className="input"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Ejemplo: Corrección de inventario"
            rows={3}
            style={{ resize: 'vertical' }}
          />
        </div>

        {error && (
          <div className="alert alert--danger">{error}</div>
        )}
      </div>
    </Modal>
  );
}
