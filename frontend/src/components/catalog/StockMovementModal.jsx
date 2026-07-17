import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import api from '../../lib/api';
import { PlusCircle, MinusCircle } from 'lucide-react';

const TIPOS_MOVIMIENTO = [
  { value: 'ENTRADA_COMPRA',      label: 'Entrada – Compra',         dir: 'entrada' },
  { value: 'ENTRADA_DEVOLUCION',  label: 'Entrada – Devolución',     dir: 'entrada' },
  { value: 'ENTRADA_AJUSTE',      label: 'Entrada – Ajuste positivo',dir: 'entrada' },
  { value: 'SALIDA_USO',          label: 'Salida – Uso interno',     dir: 'salida'  },
  { value: 'SALIDA_VENTA',        label: 'Salida – Venta',           dir: 'salida'  },
  { value: 'SALIDA_AJUSTE',       label: 'Salida – Ajuste negativo', dir: 'salida'  },
  { value: 'SALIDA_MERMA',        label: 'Salida – Merma / Baja',    dir: 'salida'  },
];

const TIPOS_DOCUMENTO = ['FACTURA', 'REMISION', 'NOTA_INTERNA', 'OTRO'];

export function StockMovementModal({ item, onClose, onSuccess }) {
  const [tipoMovimiento, setTipoMovimiento] = useState('ENTRADA_COMPRA');
  const [cantidad, setCantidad] = useState('');
  const [precioUnitario, setPrecioUnitario] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('FACTURA');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const tipoSeleccionado = TIPOS_MOVIMIENTO.find(t => t.value === tipoMovimiento);
  const esEntrada = tipoSeleccionado?.dir === 'entrada';

  const handleSubmit = async () => {
    if (!cantidad || isNaN(cantidad) || Number(cantidad) <= 0) {
      setError('La cantidad debe ser mayor a cero');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post('/movements', {
        inventario_id: item.id,
        tipo_movimiento: tipoMovimiento,
        tipo_documento: tipoDocumento,
        numero_documento: numeroDocumento || null,
        cantidad: Number(cantidad),
        precio_unitario: precioUnitario ? Number(precioUnitario) : null,
        notas: notas || null,
      });
      onSuccess && onSuccess();
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message || e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Registrar Movimiento de Stock"
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="btn btn--ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Guardando...' : 'Registrar Movimiento'}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Resumen del item */}
        <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{item?.nombre_comercial}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item?.codigo_interno}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Stock actual</div>
            <div style={{ fontWeight: 800, fontSize: '1.25rem' }}>{item?.stock_actual ?? 0} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>{item?.unidad_medida}</span></div>
          </div>
        </div>

        {/* Tipo de movimiento */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: '0.375rem' }}>
            Tipo de Movimiento
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {TIPOS_MOVIMIENTO.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipoMovimiento(t.value)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${tipoMovimiento === t.value ? (t.dir === 'entrada' ? 'var(--clr-success)' : 'var(--clr-danger)') : 'var(--border-color)'}`,
                  background: tipoMovimiento === t.value ? (t.dir === 'entrada' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)') : 'var(--bg-surface)',
                  color: tipoMovimiento === t.value ? (t.dir === 'entrada' ? 'var(--clr-success)' : 'var(--clr-danger)') : 'var(--text-secondary)',
                  fontWeight: tipoMovimiento === t.value ? 700 : 500,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.15s',
                }}
              >
                {t.dir === 'entrada'
                  ? <PlusCircle size={14} />
                  : <MinusCircle size={14} />
                }
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cantidad */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: '0.375rem' }}>
            Cantidad <span style={{ color: 'var(--clr-danger)' }}>*</span>
          </label>
          <input
            type="number"
            className="input"
            min="0.01"
            step="any"
            placeholder="0"
            value={cantidad}
            onChange={e => setCantidad(e.target.value)}
          />
        </div>

        {/* Precio unitario (solo entradas) */}
        {esEntrada && (
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: '0.375rem' }}>
              Precio Unitario (costo)
            </label>
            <input
              type="number"
              className="input"
              min="0"
              step="any"
              placeholder="0.00"
              value={precioUnitario}
              onChange={e => setPrecioUnitario(e.target.value)}
            />
          </div>
        )}

        {/* Documento */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: '0.375rem' }}>
              Tipo Documento
            </label>
            <select
              className="input"
              value={tipoDocumento}
              onChange={e => setTipoDocumento(e.target.value)}
            >
              {TIPOS_DOCUMENTO.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: '0.375rem' }}>
              N° Documento
            </label>
            <input
              type="text"
              className="input"
              placeholder="Ej: FAC-001"
              value={numeroDocumento}
              onChange={e => setNumeroDocumento(e.target.value)}
            />
          </div>
        </div>

        {/* Notas */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: '0.375rem' }}>
            Notas (opcional)
          </label>
          <textarea
            className="input"
            rows={2}
            placeholder="Observaciones sobre el movimiento..."
            value={notas}
            onChange={e => setNotas(e.target.value)}
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
