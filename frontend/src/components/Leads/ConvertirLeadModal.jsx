import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Modal } from '../common/Modal';
import { NOTA_MIN, NOTA_MAX } from '../../constants/leads';
import api from '../../lib/api';

/** Igual que en CambiarEstadoModal: soporta los dos formatos de error del backend. */
function mensajeDeError(err, porDefecto) {
  const data = err?.response?.data;
  const detalles = Array.isArray(data?.details)
    ? data.details
    : (Array.isArray(data?.error?.details) ? data.error.details : []);
  const mensaje = data?.error?.message || data?.error;
  return detalles[0]?.message || (typeof mensaje === 'string' ? mensaje : null) || porDefecto;
}

/**
 * Modal de conversión de lead a contacto + empresa.
 *
 * Es un cambio de estado manual (`* → converted`), así que también exige nota
 * (decisión D1). Sustituye el `window.confirm` anterior.
 */
export function ConvertirLeadModal({ lead, onClose }) {
  const queryClient = useQueryClient();
  const [nota, setNota] = React.useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch(`/leads/${lead.id}/convert`, { nota });
      return data;
    },
    onSuccess: () => {
      toast.success('¡Lead convertido a Contacto y Empresa exitosamente!');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', lead.id] });
      queryClient.invalidateQueries({ queryKey: ['lead-summary', lead.id] });
      queryClient.invalidateQueries({ queryKey: ['lead-history', lead.id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      onClose();
    },
    onError: (err) => {
      toast.error(mensajeDeError(err, 'Error al convertir el lead'));
    },
  });

  const notaValida = nota.trim().length >= NOTA_MIN;
  const puedeEnviar = notaValida && !mutation.isPending;

  const enviar = (e) => {
    e.preventDefault();
    if (puedeEnviar) mutation.mutate();
  };

  return (
    <Modal title="Convertir lead en contacto" onClose={onClose}>
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
          Se creará un <strong>contacto</strong>
          {lead.company_name ? ' y se vinculará la empresa' : ''} y el lead quedará en estado
          <strong> Convertido</strong>. La conversión no se puede deshacer.
        </p>

        <div className="input-group">
          <label className="input-label" htmlFor="nota-conversion">Nota de la conversión *</label>
          <textarea
            id="nota-conversion"
            className="input"
            rows="4"
            maxLength={NOTA_MAX}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Motivo o contexto de la conversión (mínimo 5 caracteres)"
            autoFocus
          />
          <span
            className="input-hint"
            style={{
              color: notaValida ? 'var(--text-muted)' : '#b91c1c',
              fontSize: 'var(--text-xs)',
            }}
          >
            {nota.trim().length}/{NOTA_MAX} · obligatoria, mínimo {NOTA_MIN} caracteres
          </span>
        </div>

        <div className="modal__footer" style={{ padding: '1rem 0 0 0', border: 'none' }}>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={!puedeEnviar}>
            {mutation.isPending ? 'Convirtiendo…' : 'Convertir lead'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
