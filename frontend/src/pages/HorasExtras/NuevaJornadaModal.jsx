import React, { useState, useEffect } from 'react';
import { X, Save, Clock, Calendar, User, Edit2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export function NuevaJornadaModal({ isOpen, onClose, initialData = null }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    empleado_id: '',
    fecha_trabajo: '',
    hora_entrada: '',
    hora_salida: '',
    observacion: '',
    minutos_descuento: 50,
  });

  useEffect(() => {
    if (initialData && isOpen) {
      setFormData({
        jornada_id: initialData.id || '',
        empleado_id: initialData.operario_id || '',
        fecha_trabajo: initialData.fecha_trabajo ? String(initialData.fecha_trabajo).split('T')[0] : '',
        hora_entrada: initialData.hora_entrada ? String(initialData.hora_entrada).substring(0, 5) : '',
        hora_salida: initialData.hora_salida ? String(initialData.hora_salida).substring(0, 5) : '',
        observacion: initialData.observacion || '',
        minutos_descuento: initialData.minutos_descuento !== undefined ? initialData.minutos_descuento : 50,
        remision_id: initialData.remision_id || null,
      });
    } else if (!isOpen) {
      setFormData({ jornada_id: '', empleado_id: '', fecha_trabajo: '', hora_entrada: '', hora_salida: '', observacion: '', minutos_descuento: 50, remision_id: null });
    }
  }, [initialData, isOpen]);

  const { data: operarios = [] } = useQuery({
    queryKey: ['he-operarios'],
    queryFn: async () => {
      const res = await api.get('/horas-extras/operarios');
      return res.data || [];
    },
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.empleado_id || !formData.fecha_trabajo || !formData.hora_entrada || !formData.hora_salida) {
      toast.error('Complete los campos obligatorios');
      return;
    }

    try {
      await api.post('/horas-extras/jornada', formData);
      toast.success(initialData ? 'Jornada actualizada correctamente' : 'Jornada registrada correctamente');
      queryClient.invalidateQueries(['he-gestion-humana']);
      queryClient.invalidateQueries(['he-resumen-agrupado']);
      onClose();
      setFormData({ jornada_id: '', empleado_id: '', fecha_trabajo: '', hora_entrada: '', hora_salida: '', observacion: '', minutos_descuento: 50, remision_id: null });
    } catch (error) {
      toast.error('Error al registrar jornada');
      console.error(error);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'var(--bg-elevated)',
        borderRadius: 16,
        width: '100%', maxWidth: 500,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border-color)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--bg-main)'
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {initialData ? <Edit2 size={18} color="var(--primary)" /> : <Calendar size={18} color="var(--primary)" />}
            {initialData ? 'Editar Jornada Laboral' : 'Registrar Jornada Laboral (Independiente)'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
              Empleado <span style={{ color: 'red' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
              <select
                className="input"
                value={formData.empleado_id}
                onChange={e => setFormData({ ...formData, empleado_id: e.target.value })}
                style={{ width: '100%', paddingLeft: '2rem' }}
                required
              >
                <option value="">Seleccione empleado...</option>
                {operarios.map(op => (
                  <option key={op.id} value={op.id}>{op.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
              Fecha de Trabajo <span style={{ color: 'red' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Calendar size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
              <input
                type="date"
                className="input"
                value={formData.fecha_trabajo}
                onChange={e => setFormData({ ...formData, fecha_trabajo: e.target.value })}
                style={{ width: '100%', paddingLeft: '2rem' }}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                Hora de Entrada <span style={{ color: 'red' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Clock size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                <input
                  type="time"
                  className="input"
                  value={formData.hora_entrada}
                  onChange={e => setFormData({ ...formData, hora_entrada: e.target.value })}
                  style={{ width: '100%', paddingLeft: '2rem' }}
                  required
                />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                Hora de Salida <span style={{ color: 'red' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Clock size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                <input
                  type="time"
                  className="input"
                  value={formData.hora_salida}
                  onChange={e => setFormData({ ...formData, hora_salida: e.target.value })}
                  style={{ width: '100%', paddingLeft: '2rem' }}
                  required
                />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
              Descuento de Descanso / Almuerzo (Minutos)
            </label>
            <input
              type="number"
              className="input"
              value={formData.minutos_descuento}
              onChange={e => setFormData({ ...formData, minutos_descuento: parseInt(e.target.value) || 0 })}
              style={{ width: '100%' }}
              min="0"
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
              Por defecto son 50 minutos. Cámbielo a 0 si el operario no tomó descanso.
            </small>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
              Observaciones
            </label>
            <textarea
              className="input"
              value={formData.observacion}
              onChange={e => setFormData({ ...formData, observacion: e.target.value })}
              style={{ width: '100%', minHeight: 80, resize: 'vertical' }}
              placeholder="Ej. Reemplazo de turno, jornada sin remisión, etc."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Save size={16} />
              Guardar Jornada
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
