import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, X, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';

export function ReemplazarEquipoModal({ remision, onClose, onSuccess }) {
  const qc = useQueryClient();
  const [equipoNuevoId, setEquipoNuevoId] = useState('');
  const [fechaEfectiva, setFechaEfectiva] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [motivo, setMotivo] = useState('');

  // Cargar equipos disponibles (OPERATIVOS)
  const { data: equipos = [], isLoading: loadingEquipos } = useQuery({
    queryKey: ['equipos-disponibles-sustitucion'],
    queryFn: async () => {
      const { data } = await api.get('/equipos/by-company/cargar', {
        params: { estado: 'OPERATIVO', limit: 200 },
      });
      return data.data || [];
    },
  });

  // Filtrar fuera el equipo actual
  const equiposDisponibles = equipos.filter(
    (e) => String(e.id) !== String(remision.equipo_id)
  );

  const sustitucionMutation = useMutation({
    mutationFn: (payload) =>
      api.post(`/servicios/${remision.id}/reemplazar-equipo`, payload),
    onSuccess: () => {
      toast.success('Equipo reemplazado exitosamente');
      qc.invalidateQueries({ queryKey: ['servicios', remision.id] });
      qc.invalidateQueries({ queryKey: ['tramos-equipo', remision.id] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al sustituir el equipo');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!equipoNuevoId) {
      toast.error('Seleccione el equipo de reemplazo');
      return;
    }
    if (!fechaEfectiva) {
      toast.error('Ingrese la fecha efectiva del reemplazo');
      return;
    }

    sustitucionMutation.mutate({
      equipo_nuevo_id: equipoNuevoId,
      fecha_efectiva: fechaEfectiva,
      motivo,
    });
  };

  const MOTIVOS_RAPIDOS = [
    'Avería mecánica / hidráulica',
    'Mantenimiento preventivo',
    'Solicitud del cliente',
    'Reasignación operativa',
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-card, #fff)',
          borderRadius: '12px',
          maxWidth: '520px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          border: '1px solid var(--border-color, #e5e7eb)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color, #e5e7eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-subtle, #f9fafb)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                backgroundColor: 'rgba(234, 179, 8, 0.15)',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RefreshCw size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-main, #111827)' }}>
                Reemplazar Máquina
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted, #6b7280)', margin: 0 }}>
                Remisión N° {remision.numero_remision}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted, #6b7280)',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {/* Info actual */}
          <div
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              fontSize: '0.8125rem',
              color: '#1d4ed8',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Máquina actual:</strong> {remision.equipo_marca || ''} {remision.equipo_serie || remision.numero_maquina || 'Sin asignar'}
              <br />
              <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                Fecha inicio de remisión: {remision.fecha_servicio}
              </span>
            </div>
          </div>

          {/* Selector equipo nuevo */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                display: 'block',
                marginBottom: '0.375rem',
                color: 'var(--text-secondary, #374151)',
              }}
            >
              Nuevo Equipo de Reemplazo *
            </label>
            {loadingEquipos ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Cargando equipos disponibles...</p>
            ) : (
              <select
                value={equipoNuevoId}
                onChange={(e) => setEquipoNuevoId(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #d1d5db)',
                  backgroundColor: 'var(--bg-input, #fff)',
                  fontSize: '0.875rem',
                }}
              >
                <option value="">-- Seleccionar máquina disponible --</option>
                {equiposDisponibles.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.marca} {eq.modelo} — Serie: {eq.serie || eq.serial || 'S/N'} {eq.capacidad_carga ? `(${eq.capacidad_carga})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Fecha efectiva */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                display: 'block',
                marginBottom: '0.375rem',
                color: 'var(--text-secondary, #374151)',
              }}
            >
              Fecha Efectiva del Reemplazo *
            </label>
            <input
              type="date"
              value={fechaEfectiva}
              min={remision.fecha_servicio}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setFechaEfectiva(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.625rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #d1d5db)',
                backgroundColor: 'var(--bg-input, #fff)',
                fontSize: '0.875rem',
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
              Día desde el cual la nueva máquina empieza a operar en el sitio del cliente.
            </span>
          </div>

          {/* Motivo */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                display: 'block',
                marginBottom: '0.375rem',
                color: 'var(--text-secondary, #374151)',
              }}
            >
              Motivo del Reemplazo
            </label>
            {/* Motivos rápidos */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.5rem' }}>
              {MOTIVOS_RAPIDOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotivo(m)}
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color, #d1d5db)',
                    background: motivo === m ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-subtle, #f3f4f6)',
                    color: motivo === m ? '#1d4ed8' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Describa el motivo del cambio de máquina..."
              style={{
                width: '100%',
                padding: '0.625rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #d1d5db)',
                backgroundColor: 'var(--bg-input, #fff)',
                fontSize: '0.875rem',
                resize: 'none',
              }}
            />
          </div>

          {/* Buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color, #e5e7eb)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.625rem 1.25rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #d1d5db)',
                background: 'var(--bg-subtle, #f3f4f6)',
                color: 'var(--text-main, #374151)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sustitucionMutation.isPending}
              style={{
                padding: '0.625rem 1.25rem',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--color-primary, #2563eb)',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: sustitucionMutation.isPending ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {sustitucionMutation.isPending ? (
                'Procesando...'
              ) : (
                <>
                  <RefreshCw size={16} /> Confirmar Reemplazo
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
