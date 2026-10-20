import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Modal } from '../common/Modal';
import { ESTADOS_LEAD, NOTA_MIN, NOTA_MAX } from '../../constants/leads';
import api from '../../lib/api';

/**
 * Extrae el mensaje más útil del backend.
 * Hay dos formas: validación de zod (`{ error: 'texto', details: [...] }`) y
 * AppError del dominio (`{ error: { message, details } }`).
 */
function mensajeDeError(err, porDefecto) {
  const data = err?.response?.data;
  const detalles = Array.isArray(data?.details)
    ? data.details
    : (Array.isArray(data?.error?.details) ? data.error.details : []);
  const mensaje = data?.error?.message || data?.error;
  return detalles[0]?.message || (typeof mensaje === 'string' ? mensaje : null) || porDefecto;
}

/**
 * Modal para cambiar el estado de un lead.
 *
 * Todo cambio de estado manual exige una nota (decisión D1). La nota y el
 * estado se envían juntos a `PATCH /leads/:id`; el backend los guarda en
 * `lead_history` dentro de la misma transacción.
 */
export function CambiarEstadoModal({ lead, onClose }) {
  const queryClient = useQueryClient();
  // Si el estado actual no es seleccionable aquí (p. ej. `converted`), se
  // arranca vacío y se muestra un placeholder: obliga a elegir uno nuevo.
  const [estado, setEstado] = React.useState(
    ESTADOS_LEAD.some((opcion) => opcion.value === lead.status) ? lead.status : ''
  );
  const [nota, setNota] = React.useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch(`/leads/${lead.id}`, { status: estado, nota });
      return data;
    },
    onSuccess: () => {
      toast.success('Estado actualizado y registrado en el historial');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', lead.id] });
      queryClient.invalidateQueries({ queryKey: ['lead-summary', lead.id] });
      queryClient.invalidateQueries({ queryKey: ['lead-history', lead.id] });
      onClose();
    },
    onError: (err) => {
      toast.error(mensajeDeError(err, 'No fue posible cambiar el estado'));
    },
  });

  const notaValida = nota.trim().length >= NOTA_MIN;
  const estadoValido = Boolean(estado) && estado !== lead.status;
  const puedeEnviar = notaValida && estadoValido && !mutation.isPending;

  const enviar = (e) => {
    e.preventDefault();
    if (puedeEnviar) mutation.mutate();
  };

  return (
    <Modal title="Cambiar estado del lead" onClose={onClose}>
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <div className="input-group">
          <label className="input-label" htmlFor="nuevo-estado">Nuevo estado *</label>
          <select
            id="nuevo-estado"
            className="input"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
          >
            {!ESTADOS_LEAD.some((opcion) => opcion.value === lead.status) && (
              <option value="" disabled>Selecciona un estado…</option>
            )}
            {ESTADOS_LEAD.map((opcion) => (
              <option
                key={opcion.value}
                value={opcion.value}
                disabled={opcion.value === lead.status}
              >
                {opcion.label}{opcion.value === lead.status ? ' (actual)' : ''}
              </option>
            ))}
          </select>
          {!estadoValido && (
            <span className="input-hint" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
              Selecciona un estado distinto al actual.
            </span>
          )}
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="nota-cambio">Nota del cambio *</label>
          <textarea
            id="nota-cambio"
            className="input"
            rows="4"
            maxLength={NOTA_MAX}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Describe la gestión realizada (mínimo 5 caracteres)"
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
            {mutation.isPending ? 'Guardando…' : 'Cambiar estado'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
