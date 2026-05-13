import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';

const labelStyle = { fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' };
const sectionTitle = { fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0.25rem 0 0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' };

const UNIDADES = ['hora', 'día', 'semana', 'mes', 'servicio', 'km', 'COP'];


export function CatalogoServicioForm({ item, onSuccess, onCancel }) {
  const qc = useQueryClient();
  const [form, setForm] = React.useState({
    nombre: item?.nombre || '',
    descripcion: item?.descripcion || '',
    precio_base: item?.precio_base || 0,
    cantidad: item?.cantidad || 1,
    unidad: item?.unidad || 'hora',
    tipo: item?.tipo || 'Servicio',
  });

  const mutation = useMutation({
    mutationFn: (payload) =>
      item ? api.put(`/catalogo-servicios/${item.id}`, payload) : api.post('/catalogo-servicios', payload),
    onSuccess: () => {
      toast.success(item ? 'Ítem actualizado' : 'Ítem creado');
      qc.invalidateQueries({ queryKey: ['catalogo-servicios'] });
      onSuccess();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.nombre) { toast.error('Nombre es obligatorio'); return; }
    mutation.mutate(form);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {item?.codigo && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '6px', padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Código:</span>
          <code style={{ fontWeight: 700, color: 'var(--clr-primary-500)' }}>{item.codigo}</code>
        </div>
      )}
      {!item && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '11px', color: 'var(--text-muted)' }}>
          El código se generará automáticamente (SRV-0001, SRV-0002…)
        </div>
      )}

      <div>
        <label style={labelStyle}>Tipo de Ítem *</label>
        <select name="tipo" className="input" style={{ width: '100%' }} value={form.tipo} onChange={handleChange} disabled={!!item}>
          <option value="Servicio">Servicio</option>
          <option value="Producto">Producto</option>
        </select>
        {!item && form.tipo === 'Producto' && (
          <div style={{ fontSize: '11px', color: 'var(--clr-primary-500)', marginTop: '4px' }}>
            Este producto se agregará automáticamente al Inventario General.
          </div>
        )}
      </div>

      <div>
        <label style={labelStyle}>Nombre / Descripción del Ítem *</label>
        <input name="nombre" className="input" style={{ width: '100%' }} placeholder={form.tipo === 'Servicio' ? "Ej: SERVICIO DE MONTACARGAS..." : "Ej: REPUESTO FILTRO DE ACEITE..."} value={form.nombre} onChange={handleChange} required />
      </div>

      <div>
        <label style={labelStyle}>Descripción interna (opcional)</label>
        <textarea name="descripcion" className="input" rows={3} style={{ width: '100%' }} value={form.descripcion} onChange={handleChange} placeholder={`Detalles adicionales del ${form.tipo.toLowerCase()}...`} />
      </div>

      <p style={sectionTitle}>Precio</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label style={labelStyle}>Precio Base (COP)</label>
          <input name="precio_base" type="number" min={0} className="input" style={{ width: '100%' }} value={form.precio_base} onChange={handleChange} />
        </div>
        <div>
          <label style={labelStyle}>Cantidad</label>
          <input name="cantidad" type="number" min={1} className="input" style={{ width: '100%' }} value={form.cantidad} onChange={handleChange} />
        </div>
        <div>
          <label style={labelStyle}>Unidad de Medida</label>
          <select name="unidad" className="input" style={{ width: '100%' }} value={form.unidad} onChange={handleChange}>
            {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>



      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn--primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando...' : item ? 'Actualizar' : 'Crear Ítem'}
        </button>
      </div>
    </form>
  );
}
