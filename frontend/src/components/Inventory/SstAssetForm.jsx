import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { HardHat, Calendar, FileText, User, ShieldCheck, AlertTriangle } from 'lucide-react';
import api from '../../lib/api';
import { SearchableSelect } from '../ui/SearchableSelect';

// ─── Constantes SST ─────────────────────────────────────────

const TIPOS_ELEMENTO_SST = [
  { value: 'EXTINTOR',          label: 'Extintor',          grupo: 'emergencia' },
  { value: 'BOTIQUIN',          label: 'Botiquín',           grupo: 'emergencia' },
  { value: 'DETECTOR_HUMO',     label: 'Detector de Humo',   grupo: 'emergencia' },
  { value: 'LUCES_EMERGENCIA',  label: 'Luces de Emergencia', grupo: 'emergencia' },
  { value: 'SALIDA_EMERGENCIA', label: 'Señalización Salida', grupo: 'señalización' },
  { value: 'SEÑALIZACION',      label: 'Señalización',        grupo: 'señalización' },
  { value: 'ARNES',             label: 'Arnés de Seguridad',  grupo: 'epp' },
  { value: 'LINEA_VIDA',        label: 'Línea de Vida',       grupo: 'epp' },
  { value: 'EPP',               label: 'Equipo de Protección', grupo: 'epp' },
  { value: 'CASCO',             label: 'Casco',               grupo: 'epp' },
  { value: 'GUANTES',           label: 'Guantes Dieléctricos',grupo: 'epp' },
  { value: 'EQUIPO_RESCATE',    label: 'Equipo de Rescate',   grupo: 'emergencia' },
  { value: 'EXTINTOR_CARRETA',  label: 'Extintor Carreta',    grupo: 'emergencia' },
  { value: 'GABINETE',          label: 'Gabinete Contra Incendios', grupo: 'emergencia' },
  { value: 'OTRO',              label: 'Otro',                grupo: 'otro' },
];

const ESTADOS_SST = [
  { value: 'VIGENTE',           label: 'Vigente' },
  { value: 'POR_VENCER',        label: 'Por Vencer (≤30d)' },
  { value: 'VENCIDO',           label: 'Vencido' },
  { value: 'EN_MANTENIMIENTO',  label: 'En Mantenimiento' },
  { value: 'FUERA_SERVICIO',    label: 'Fuera de Servicio' },
];

const FRECUENCIAS_SST = [
  { value: 30,   label: '30 días (Mensual)' },
  { value: 60,   label: '60 días (Bimestral)' },
  { value: 90,   label: '90 días (Trimestral)' },
  { value: 180,  label: '180 días (Semestral)' },
  { value: 365,  label: '365 días (Anual)' },
  { value: 730,  label: '730 días (Bienal)' },
];

// ─── Estilos compartidos ────────────────────────────────────

const sectionTitle = {
  fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)',
  marginBottom: '0.75rem', paddingBottom: '0.375rem',
  borderBottom: '1px solid var(--border-color)',
  display: 'flex', alignItems: 'center', gap: '0.5rem',
};

const inputStyle = {
  padding: '0.5rem 0.75rem', borderRadius: '6px',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
  fontSize: '0.8rem', width: '100%', outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = {
  fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)',
  display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

const selectStyle = { ...inputStyle, cursor: 'pointer' };

// ─── Sub-componentes de formulario ──────────────────────────

function FormInput({ form, errors, handleChange, field, label, placeholder, type, style: extraStyle }) {
  const hasError = errors[field];
  return (
    <div style={{ marginBottom: 0 }}>
      <label style={labelStyle}>{label}</label>
      <input
        name={field}
        value={form[field] || ''}
        onChange={handleChange}
        placeholder={placeholder}
        type={type || 'text'}
        style={{ ...inputStyle, ...(hasError ? { borderColor: 'var(--clr-danger)' } : {}), ...extraStyle }}
      />
      {hasError && <span style={{ fontSize: '0.65rem', color: 'var(--clr-danger)', marginTop: '0.125rem', display: 'block' }}>{errors[field]}</span>}
    </div>
  );
}

function FormSelect({ form, errors, handleChange, field, label, options, placeholder, style: extraStyle }) {
  const hasError = errors[field];
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select
        name={field}
        value={form[field] || ''}
        onChange={handleChange}
        style={{ ...selectStyle, ...(hasError ? { borderColor: 'var(--clr-danger)' } : {}), ...extraStyle }}
      >
        <option value="">{placeholder || 'Seleccionar...'}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hasError && <span style={{ fontSize: '0.65rem', color: 'var(--clr-danger)', marginTop: '0.125rem', display: 'block' }}>{errors[field]}</span>}
    </div>
  );
}

function FormDateInput({ form, errors, handleChange, field, label }) {
  const hasError = errors[field];
  return (
    <div>
      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <Calendar size={12} />
        {label}
      </label>
      <input
        name={field}
        value={form[field] || ''}
        onChange={handleChange}
        type="date"
        style={{ ...inputStyle, ...(hasError ? { borderColor: 'var(--clr-danger)' } : {}) }}
      />
      {hasError && <span style={{ fontSize: '0.65rem', color: 'var(--clr-danger)', marginTop: '0.125rem', display: 'block' }}>{errors[field]}</span>}
    </div>
  );
}

// ─── Indicador de estado SST con color ──────────────────────

const ESTADO_SST_STYLES = {
  VIGENTE:          { bg: '#dcfce7', fg: '#166534' },
  POR_VENCER:       { bg: '#fef9c3', fg: '#854d0e' },
  VENCIDO:          { bg: '#fee2e2', fg: '#991b1b' },
  EN_MANTENIMIENTO: { bg: '#dbeafe', fg: '#1e40af' },
  FUERA_SERVICIO:   { bg: '#f1f5f9', fg: '#475569' },
};

function EstadoSSTBadge({ estado }) {
  const style = ESTADO_SST_STYLES[estado] || { bg: '#f1f5f9', fg: '#475569' };
  return (
    <span style={{
      display: 'inline-block', padding: '0.25rem 0.6rem', borderRadius: '6px',
      fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.04em',
      background: style.bg, color: style.fg,
    }}>
      {estado ? estado.replace(/_/g, ' ') : '—'}
    </span>
  );
}

// ─── Componente principal ───────────────────────────────────

export function SstAssetForm({ item, onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const isEditing = !!item;

  // ─── Lógica de cálculo de estado y próxima revisión ───
  const calcularEstadoSST = React.useCallback((proximaRevision, fechaVencimiento) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (proximaRevision) {
      const revDate = new Date(proximaRevision + 'T23:59:59');
      const diffDays = Math.ceil((revDate - hoy) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return 'VENCIDO';
      if (diffDays <= 30) return 'POR_VENCER';
    }
    if (fechaVencimiento) {
      const vencDate = new Date(fechaVencimiento + 'T23:59:59');
      const diffDays = Math.ceil((vencDate - hoy) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return 'VENCIDO';
      if (diffDays <= 30) return 'POR_VENCER';
    }
    return 'VIGENTE';
  }, []);

  const calcularProximaRevision = React.useCallback((ultimaRevision, frecuenciaDias) => {
    if (!ultimaRevision || !frecuenciaDias) return '';
    const date = new Date(ultimaRevision + 'T00:00:00');
    date.setDate(date.getDate() + parseInt(frecuenciaDias, 10));
    return date.toISOString().split('T')[0];
  }, []);

  // ─── Estado del formulario ─────────────────────────────
  const [form, setForm] = React.useState({
    name: item?.name || '',
    marca: item?.marca || '',
    sst_codigo_elemento: item?.sst_codigo_elemento || '',
    sst_tipo_elemento: item?.sst_tipo_elemento || '',
    sst_marca_modelo: item?.sst_marca_modelo || '',
    sst_numero_serie: item?.sst_numero_serie || '',
    sst_ubicacion: item?.sst_ubicacion || '',
    sst_ultima_revision: item?.sst_ultima_revision ? item.sst_ultima_revision.split('T')[0] : '',
    sst_proxima_revision: item?.sst_proxima_revision ? item.sst_proxima_revision.split('T')[0] : '',
    sst_frecuencia_dias: item?.sst_frecuencia_dias || 365,
    sst_fecha_vencimiento: item?.sst_fecha_vencimiento ? item.sst_fecha_vencimiento.split('T')[0] : '',
    sst_estado: item?.sst_estado || calcularEstadoSST(
      item?.sst_proxima_revision,
      item?.sst_fecha_vencimiento
    ),
    sst_certificado: item?.sst_certificado || '',
    sst_responsable_id: item?.sst_responsable_id || '',
    sst_observaciones: item?.sst_observaciones || '',
  });

  const [errors, setErrors] = React.useState({});
  const [selectedResponsable, setSelectedResponsable] = React.useState(null);

  React.useEffect(() => {
    if (isEditing && item?.sst_responsable_id && !selectedResponsable) {
      api.get('/employees/' + item.sst_responsable_id)
        .then(r => setSelectedResponsable(r.data.data))
        .catch(() => {});
    }
  }, [isEditing, item]);

  // ─── Búsqueda de empleados ────────────────────────────
  const searchEmployees = React.useCallback(async (searchTerm) => {
    const { data } = await api.get('/employees', { params: { search: searchTerm || undefined, limit: 20 } });
    return data.data || [];
  }, []);

  const getEmployeeLabel = (emp) => {
    if (!emp) return '';
    const nombre = emp.full_name || `${emp.nombre || ''} ${emp.apellido || ''}`.trim() || emp.email || '';
    const doc = emp.numero_documento ? ` [${emp.tipo_documento || ''} ${emp.numero_documento}]` : '';
    return nombre + doc;
  };

  // ─── Handler de cambios ───────────────────────────────
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setForm(prev => {
      let updates = { [name]: newValue };

      // Auto-calcular próxima revisión
      if (name === 'sst_ultima_revision' || name === 'sst_frecuencia_dias') {
        const ultimaRev = name === 'sst_ultima_revision' ? newValue : prev.sst_ultima_revision;
        const freq = name === 'sst_frecuencia_dias' ? newValue : prev.sst_frecuencia_dias;
        const prox = calcularProximaRevision(ultimaRev, freq);
        updates.sst_proxima_revision = prox;
        // Auto-actualizar estado
        updates.sst_estado = calcularEstadoSST(prox, prev.sst_fecha_vencimiento);
      }

      // Auto-actualizar estado si cambia fecha vencimiento
      if (name === 'sst_fecha_vencimiento') {
        updates.sst_estado = calcularEstadoSST(prev.sst_proxima_revision, newValue);
      }

      return { ...prev, ...updates };
    });

    // Limpiar error
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  // ─── Validación ───────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!form.name?.trim()) errs.name = 'El nombre es obligatorio';
    if (!form.sst_tipo_elemento) errs.sst_tipo_elemento = 'Selecciona el tipo de elemento SST';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ─── Mutación ─────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async (values) => {
      // Calcular estado automáticamente antes de guardar
      const estadoAuto = calcularEstadoSST(values.sst_proxima_revision, values.sst_fecha_vencimiento);
      const payload = {
        ...values,
        area: 'SST',
        sst_estado: estadoAuto,
        sst_codigo_elemento: values.sst_codigo_elemento || values.name?.substring(0, 10).toUpperCase(),
      };
      if (isEditing) {
        const { data } = await api.patch(`/inventory/${item.id}`, payload);
        return data;
      } else {
        const { data } = await api.post('/inventory', payload);
        return data;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Elemento SST actualizado' : 'Elemento SST registrado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Error al guardar elemento SST');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate(form);
  };

  // ─── Render ───────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ───── Sección: Información General ───── */}
      <div style={sectionTitle}>
        <HardHat size={16} color="#22c55e" />
        Información General del Elemento
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <FormInput
          form={form} errors={errors} handleChange={handleChange}
          field="name" label="Nombre del Elemento *" placeholder="Ej: Extintor ABC-40"
        />
        <FormSelect
          form={form} errors={errors} handleChange={handleChange}
          field="sst_tipo_elemento" label="Tipo de Elemento *"
          options={TIPOS_ELEMENTO_SST}
        />
        <FormInput
          form={form} errors={errors} handleChange={handleChange}
          field="sst_codigo_elemento" label="Código Interno" placeholder="Ej: EXT-001"
        />
        <FormInput
          form={form} errors={errors} handleChange={handleChange}
          field="marca" label="Marca" placeholder="Ej: SURTE"
        />
        <FormInput
          form={form} errors={errors} handleChange={handleChange}
          field="sst_marca_modelo" label="Modelo / Referencia" placeholder="Ej: ABC-40"
        />
        <FormInput
          form={form} errors={errors} handleChange={handleChange}
          field="sst_numero_serie" label="Número de Serie" placeholder="N/S"
        />
      </div>

      <FormInput
        form={form} errors={errors} handleChange={handleChange}
        field="sst_ubicacion" label="Ubicación Física" placeholder="Ej: Bodega Principal - Piso 1"
        style={{ gridColumn: '1 / -1' }}
      />

      {/* ───── Sección: Control de Revisiones ───── */}
      <div style={{ ...sectionTitle, marginTop: '0.5rem' }}>
        <Calendar size={16} color="#22c55e" />
        Control de Revisiones y Vencimientos
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
        <FormDateInput
          form={form} errors={errors} handleChange={handleChange}
          field="sst_ultima_revision" label="Última Revisión"
        />
        <FormDateInput
          form={form} errors={errors} handleChange={handleChange}
          field="sst_proxima_revision" label="Próxima Revisión"
        />
        <FormDateInput
          form={form} errors={errors} handleChange={handleChange}
          field="sst_fecha_vencimiento" label="Fecha de Vencimiento"
        />
        <FormSelect
          form={form} errors={errors} handleChange={handleChange}
          field="sst_frecuencia_dias" label="Frecuencia de Revisión"
          options={FRECUENCIAS_SST}
          placeholder="Seleccionar..."
        />
      </div>

      {/* ───── Estado Actual ───── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        padding: '0.75rem 1rem',
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
      }}>
        <ShieldCheck size={20} color="#22c55e" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Estado Actual
          </div>
          <EstadoSSTBadge estado={form.sst_estado} />
        </div>
        {(form.sst_estado === 'VENCIDO' || form.sst_estado === 'POR_VENCER') && (
          <span style={{ fontSize: '0.7rem', color: form.sst_estado === 'VENCIDO' ? '#ef4444' : '#d97706', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <AlertTriangle size={14} />
            {form.sst_estado === 'VENCIDO' ? 'Requiere acción urgente' : 'Próximo a vencer'}
          </span>
        )}
      </div>

      {/* ───── Sección: Responsable ───── */}
      <div style={{ ...sectionTitle, marginTop: '0.5rem' }}>
        <User size={16} color="#22c55e" />
        Responsable y Certificación
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={labelStyle}>
            <User size={12} />
            {' '}Responsable
          </label>
          <SearchableSelect
            fetchFn={searchEmployees}
            value={form.sst_responsable_id}
            initialItem={selectedResponsable}
            getOptionLabel={getEmployeeLabel}
            renderOption={(emp) => (
              <div style={{ padding: '0.25rem 0' }}>
                <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                  {emp.full_name || `${emp.nombre || ''} ${emp.apellido || ''}`.trim()}
                </div>
                {emp.numero_documento && (
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {emp.tipo_documento || ''} {emp.numero_documento}
                    {emp.departamento ? ` · ${emp.departamento}` : ''}
                  </div>
                )}
              </div>
            )}
            onChange={(val, emp) => {
              setForm(prev => ({ ...prev, sst_responsable_id: val || '' }));
              setSelectedResponsable(emp || null);
            }}
            placeholder="Buscar empleado..."
            noOptionsMessage="No se encontraron empleados"
          />
        </div>
        <FormInput
          form={form} errors={errors} handleChange={handleChange}
          field="sst_certificado" label="Certificado / No. Lote"
          placeholder="Ej: Cert-2026-001"
        />
      </div>

      {/* ───── Observaciones ───── */}
      <div>
        <label style={labelStyle}>
          <FileText size={12} />
          {' '}Observaciones
        </label>
        <textarea
          name="sst_observaciones"
          value={form.sst_observaciones || ''}
          onChange={handleChange}
          placeholder="Notas, historial de revisiones, observaciones..."
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', minHeight: '60px' }}
        />
      </div>

      {/* ───── Acciones ───── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={mutation.isPending}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary" disabled={mutation.isPending}
          style={{ background: '#22c55e', borderColor: '#22c55e' }}
        >
          {mutation.isPending ? 'Guardando...' : (isEditing ? 'Actualizar Elemento SST' : 'Registrar Elemento SST')}
        </button>
      </div>
    </form>
  );
}

// ─── Helper exportado para usar en tablas ──────────────────
export { EstadoSSTBadge, ESTADO_SST_STYLES };
