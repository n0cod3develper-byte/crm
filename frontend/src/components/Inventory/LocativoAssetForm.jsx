import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  Building2, TrendingUp, Calculator, MapPin, FileText,
  ChevronDown, ChevronUp, AlertTriangle, HelpCircle, User,
} from 'lucide-react';
import api from '../../lib/api';
import { SearchableSelect } from '../ui/SearchableSelect';

const GRUPOS_LOCATIVOS = [
  {
    value: 'A', label: 'Grupo A — Redes e Infraestructura',
    desc: 'Redes eléctricas, hidráulicas, voz/datos, climatización, seguridad',
    color: '#6366F1',
  },
  {
    value: 'B', label: 'Grupo B — Obra Civil y Acabados',
    desc: 'Divisiones modulares, puertas/portones, falsos techos, pisos',
    color: '#F97316',
  },
  {
    value: 'C', label: 'Grupo C — Cerrajería, Fachadas y Confort',
    desc: 'Cierres/rejas, películas/polarizados, sanitarios y griferías',
    color: '#22C55E',
  },
];

const ESTADOS_FISICOS = [
  { value: 'NUEVO', label: 'Nuevo' },
  { value: 'BUENO', label: 'Bueno' },
  { value: 'REGULAR', label: 'Regular' },
  { value: 'MALO', label: 'Malo' },
  { value: 'DADO_DE_BAJA', label: 'Dado de Baja' },
];

const TIPOS_DOCUMENTO = [
  { value: 'FACTURA_COMPRA', label: 'Factura de Compra' },
  { value: 'ORDEN_TRABAJO', label: 'Orden de Trabajo' },
  { value: 'CONTRATO_OBRA', label: 'Contrato de Obra' },
  { value: 'ACTA_ENTREGA', label: 'Acta de Entrega' },
  { value: 'OTRO', label: 'Otro' },
];

const METODOS_DEPRECIACION = [
  { value: 'LINEA_RECTA', label: 'Línea Recta' },
  { value: 'UNIDADES_PRODUCCION', label: 'Unidades de Producción' },
];

const fieldGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' };
const fieldFull = { gridColumn: '1 / -1' };
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

function FormInput({ form, errors, handleChange, field, label, placeholder, type = 'text', style: extraStyle, errorProp, disabled }) {
  const hasError = errors[field] || errorProp;
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        name={field} value={form[field] ?? ''} onChange={handleChange}
        placeholder={placeholder} type={type} disabled={disabled}
        style={{ ...inputStyle, ...(hasError ? { borderColor: 'var(--clr-danger)' } : {}), ...extraStyle, ...(disabled ? { opacity: 0.5 } : {}) }}
      />
      {hasError && <span style={{ fontSize: '0.65rem', color: 'var(--clr-danger)', marginTop: '0.125rem', display: 'block' }}>{errors[field] || errorProp}</span>}
    </div>
  );
}

function FormSelect({ form, errors, handleChange, field, label, options, placeholder, style: extraStyle, disabled }) {
  const hasError = errors[field];
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select
        name={field} value={form[field] ?? ''} onChange={handleChange} disabled={disabled}
        style={{ ...selectStyle, ...(hasError ? { borderColor: 'var(--clr-danger)' } : {}), ...extraStyle, ...(disabled ? { opacity: 0.5 } : {}) }}
      >
        <option value="">{placeholder || 'Seleccionar...'}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hasError && <span style={{ fontSize: '0.65rem', color: 'var(--clr-danger)', marginTop: '0.125rem', display: 'block' }}>{errors[field]}</span>}
    </div>
  );
}

function FormTextarea({ form, errors, handleChange, field, label, placeholder, rows = 3 }) {
  const hasError = errors[field];
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <textarea
        name={field} value={form[field] ?? ''} onChange={handleChange}
        placeholder={placeholder} rows={rows}
        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', minHeight: '60px', ...(hasError ? { borderColor: 'var(--clr-danger)' } : {}) }}
      />
      {hasError && <span style={{ fontSize: '0.65rem', color: 'var(--clr-danger)', marginTop: '0.125rem', display: 'block' }}>{errors[field]}</span>}
    </div>
  );
}

function SeccionFormulario({ numero, titulo, icono, children }) {
  const [abierta, setAbierta] = React.useState(numero === 1);
  const Icono = icono;
  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-card)' }}>
      <button type="button" onClick={() => setAbierta(!abierta)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.75rem 1rem', background: abierta ? 'var(--bg-elevated)' : 'transparent',
        border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {Icono && <Icono size={16} />}
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '20px', height: '20px', borderRadius: '50%',
            background: 'var(--clr-primary-500)', color: '#fff', fontSize: '0.65rem', fontWeight: 700,
          }}>{numero}</span>
          {titulo}
        </span>
        {abierta ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {abierta && <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>{children}</div>}
    </div>
  );
}

function AlertaContable() {
  const [expandida, setExpandida] = React.useState(false);
  return (
    <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', overflow: 'hidden' }}>
      <button type="button" onClick={() => setExpandida(!expandida)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.6rem 0.85rem', background: 'transparent', border: 'none',
        cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>Regla NIIF — Sección 17</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{expandida ? 'Ocultar guía' : 'Ver guía'}</span>
      </button>
      {expandida && (
        <div style={{ padding: '0 0.85rem 0.75rem', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <p><strong>GASTO:</strong> Conserva la condición original. No requiere depreciación. (NIIF PYMES 17.6)</p>
          <p><strong>ACTIVO:</strong> Extiende vida útil o aumenta capacidad. Requiere costo + vida útil. (NIIF PYMES 17.9)</p>
          <p><strong>Arrendado:</strong> Amortizar en el menor plazo entre vida útil y contrato. (ET Art. 70)</p>
        </div>
      )}
    </div>
  );
}

function ClasificacionContable({ clasificacion, tipoPropiedad, onClasificacionChange, onTipoPropiedadChange, errores }) {
  return (
    <div>
      <label style={{ ...labelStyle, marginBottom: '0.5rem' }}>Clasificacin Contable *</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button type="button" onClick={() => onClasificacionChange('GASTO')} style={{
          padding: '0.85rem 0.75rem', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
          border: clasificacion === 'GASTO' ? '2px solid #F59E0B' : '1px solid var(--border-color)',
          background: clasificacion === 'GASTO' ? 'rgba(245,158,11,0.1)' : 'var(--bg-elevated)',
          transition: 'all 0.15s ease', fontFamily: 'inherit', color: 'var(--text-primary)',
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.25rem' }}>Gasto de Mantenimiento</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>Arreglo menor. Cuentas de resultado.</div>
          <div style={{ fontSize: '0.65rem', color: '#F59E0B', marginTop: '0.25rem', fontStyle: 'italic' }}>Ej: Pintura, reparacin menor</div>
        </button>
        <button type="button" onClick={() => onClasificacionChange('ACTIVO')} style={{
          padding: '0.85rem 0.75rem', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
          border: clasificacion === 'ACTIVO' ? '2px solid #6366F1' : '1px solid var(--border-color)',
          background: clasificacion === 'ACTIVO' ? 'rgba(99,102,241,0.1)' : 'var(--bg-elevated)',
          transition: 'all 0.15s ease', fontFamily: 'inherit', color: 'var(--text-primary)',
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.25rem' }}>Activo Mejora Capitalizable</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>Se capitaliza como PPE.</div>
          <div style={{ fontSize: '0.65rem', color: '#6366F1', marginTop: '0.25rem', fontStyle: 'italic' }}>Ej: Aire nuevo, cambio pisos</div>
        </button>
      </div>
      {errores.clasificacion_contable && <span style={{ fontSize: '0.65rem', color: 'var(--clr-danger)', display: 'block', marginBottom: '0.5rem' }}>{errores.clasificacion_contable}</span>}
      {clasificacion === 'ACTIVO' && (
        <div style={{ marginTop: '0.5rem' }}>
          <label style={labelStyle}>Tipo de Inmueble</label>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
            {['PROPIA', 'ARRENDADA'].map(t => (
              <label key={t} style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.4rem 0.75rem', borderRadius: '6px',
                background: tipoPropiedad === t ? 'rgba(99,102,241,0.1)' : 'var(--bg-elevated)',
                border: tipoPropiedad === t ? '1px solid #6366F1' : '1px solid var(--border-color)',
                cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-primary)',
              }}>
                <input type="radio" name="tipo_propiedad" value={t} checked={tipoPropiedad === t}
                  onChange={() => onTipoPropiedadChange(t)} style={{ accentColor: '#6366F1' }} />
                {t === 'PROPIA' ? 'Inmueble propio (PPE)' : 'Inmueble arrendado (Cta 1640)'}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CamposTecnicos({ campos = [], valores, onChange, errores }) {
  if (!campos || campos.length === 0) return <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>Sin campos tcnicos definidos.</div>;
  return (
    <div style={fieldGrid}>
      {campos.map((campo) => {
        const fieldName = `esp_${campo.nombre}`;
        const hasError = errores[fieldName];
        const errStyle = hasError ? { borderColor: 'var(--clr-danger)' } : {};
        if (campo.tipo === 'boolean') return (
          <div key={campo.nombre} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0' }}>
            <input type="checkbox" id={`tec_${campo.nombre}`} checked={!!valores[campo.nombre]}
              onChange={(e) => onChange(campo.nombre, e.target.checked)} style={{ accentColor: '#6366F1' }} />
            <label htmlFor={`tec_${campo.nombre}`} style={{ ...labelStyle, margin: 0, textTransform: 'none', cursor: 'pointer' }}>{campo.label}</label>
          </div>
        );
        if (campo.tipo === 'select') return (
          <div key={campo.nombre}>
            <label style={labelStyle}>{campo.label}{campo.requerido && <span style={{ color: 'var(--clr-danger)' }}> *</span>}</label>
            <select value={valores[campo.nombre] || ''} onChange={(e) => onChange(campo.nombre, e.target.value)} style={{ ...selectStyle, ...errStyle }}>
              <option value="">Seleccionar...</option>
              {(campo.opciones || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            {hasError && <span style={{ fontSize: '0.65rem', color: 'var(--clr-danger)', display: 'block', marginTop: '0.125rem' }}>{errores[fieldName]}</span>}
          </div>
        );
        return (
          <div key={campo.nombre}>
            <label style={labelStyle}>{campo.label}{campo.requerido && <span style={{ color: 'var(--clr-danger)' }}> *</span>}</label>
            <input type={campo.tipo === 'number' ? 'number' : 'text'} value={valores[campo.nombre] ?? ''}
              onChange={(e) => onChange(campo.nombre, e.target.value)} placeholder={campo.label}
              step={campo.tipo === 'number' ? 'any' : undefined} style={{ ...inputStyle, ...errStyle }} />
            {hasError && <span style={{ fontSize: '0.65rem', color: 'var(--clr-danger)', display: 'block', marginTop: '0.125rem' }}>{errores[fieldName]}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function LocativoAssetForm({ item, onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const isEditing = !!item;
  const [form, setForm] = React.useState({
    nombre: item?.nombre || '', descripcion: item?.descripcion || '',
    codigo_placa: item?.codigo_placa || '',
    grupo_locativo: item?.grupo_locativo || '', subcategoria: item?.subcategoria || '',
    clasificacion_contable: item?.clasificacion_contable || '',
    tipo_propiedad: item?.tipo_propiedad || 'PROPIA', cuenta_contable: item?.cuenta_contable || '',
    costo_historico: item?.costo_historico || '', valor_residual: item?.valor_residual || 0,
    vida_util_anios: item?.vida_util_anios || '',
    fecha_adquisicion: item?.fecha_adquisicion ? item.fecha_adquisicion.split('T')[0] : '',
    fecha_inicio_depreciacion: item?.fecha_inicio_depreciacion ? item.fecha_inicio_depreciacion.split('T')[0] : '',
    metodo_depreciacion: item?.metodo_depreciacion || 'LINEA_RECTA',
    fecha_fin_contrato: item?.fecha_fin_contrato ? item.fecha_fin_contrato.split('T')[0] : '',
    incluye_prorrogas: item?.incluye_prorrogas ?? false,
    sede: item?.sede || '', piso_nivel: item?.piso_nivel || '',
    area_oficina_bodega: item?.area_oficina_bodega || '',
    ubicacion_detalle: item?.ubicacion_detalle || '', direccion_inmueble: item?.direccion_inmueble || '',
    estado_fisico: item?.estado_fisico || 'BUENO',
    fecha_ultimo_mantenimiento: item?.fecha_ultimo_mantenimiento ? item.fecha_ultimo_mantenimiento.split('T')[0] : '',
    responsable_id: item?.responsable_id || '',
    tipo_documento_soporte: item?.tipo_documento_soporte || '',
    numero_documento_soporte: item?.numero_documento_soporte || '',
    proveedor_id: item?.proveedor_id || '',
    especificaciones: (typeof item?.especificaciones === 'object' && item?.especificaciones !== null && !Array.isArray(item?.especificaciones)) ? item.especificaciones : {},
    observaciones: item?.observaciones || '',
  });
  const [errors, setErrors] = React.useState({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [subcategoriaConfig, setSubcategoriaConfig] = React.useState(null);
  const [selectedResponsable, setSelectedResponsable] = React.useState(null);
  const [selectedProveedor, setSelectedProveedor] = React.useState(null);

  const { data: subcategoriasData } = useQuery({
    queryKey: ['locativo-subcategorias'],
    queryFn: () => api.get('/inventario/locativo/subcategorias').then(r => r.data.lista || []),
  });
  const subcategoriasList = subcategoriasData || [];
  const subcategoriasFiltradas = React.useMemo(() => {
    if (!form.grupo_locativo) return [];
    return subcategoriasList.filter(s => s.grupo === form.grupo_locativo);
  }, [form.grupo_locativo, subcategoriasList]);

  React.useEffect(() => {
    if (form.subcategoria) {
      const config = subcategoriasList.find(s => s.codigo === form.subcategoria);
      setSubcategoriaConfig(config || null);
    } else { setSubcategoriaConfig(null); }
  }, [form.subcategoria, subcategoriasList]);

  React.useEffect(() => {
    if (isEditing && item?.responsable_id && !selectedResponsable) {
      api.get(`/employees/${item.responsable_id}`).then(r => setSelectedResponsable(r.data.data)).catch(() => {});
    }
  }, [isEditing, item]);
  React.useEffect(() => {
    if (isEditing && item?.proveedor_id && !selectedProveedor) {
      api.get(`/proveedores/${item.proveedor_id}`).then(r => setSelectedProveedor(r.data.data)).catch(() => {});
    }
  }, [isEditing, item]);

  React.useEffect(() => {
    if (form.subcategoria) {
      const subActual = subcategoriasList.find(s => s.codigo === form.subcategoria);
      if (subActual && subActual.grupo !== form.grupo_locativo) setForm(prev => ({ ...prev, subcategoria: '' }));
    }
  }, [form.grupo_locativo]);

  React.useEffect(() => {
    if (form.clasificacion_contable === 'GASTO') setForm(prev => ({ ...prev, metodo_depreciacion: 'NO_APLICA', vida_util_anios: '', valor_residual: 0, costo_historico: '' }));
    if (form.clasificacion_contable === 'ACTIVO') setForm(prev => ({ ...prev, metodo_depreciacion: 'LINEA_RECTA' }));
  }, [form.clasificacion_contable]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };
  const handleEspecificaciones = (campo, valor) => {
    setForm(prev => ({ ...prev, especificaciones: { ...prev.especificaciones, [campo]: valor } }));
    if (errors[`esp_${campo}`]) setErrors(prev => ({ ...prev, [`esp_${campo}`]: '' }));
  };

  const searchEmployees = React.useCallback(async (s) => { const { data } = await api.get('/employees', { params: { search: s || undefined, limit: 20 } }); return data.data || []; }, []);
  const getEmployeeLabel = (emp) => { if (!emp) return ''; return (emp.full_name || `${emp.nombre || ''} ${emp.apellido || ''}`.trim() || emp.email || '') + (emp.numero_documento ? ` [${emp.tipo_documento || ''} ${emp.numero_documento}]` : ''); };
  const searchProveedores = React.useCallback(async (s) => { const { data } = await api.get('/proveedores', { params: { search: s || undefined, limit: 20 } }); return data.data || []; }, []);

  const validate = () => {
    const errs = {};
    if (!form.nombre?.trim()) errs.nombre = 'El nombre es obligatorio';
    if (!form.grupo_locativo) errs.grupo_locativo = 'Selecciona el grupo';
    if (!form.subcategoria) errs.subcategoria = 'Selecciona la subcategora';
    if (!form.clasificacion_contable) errs.clasificacion_contable = 'Define la clasificacin contable';
    if (form.clasificacion_contable === 'ACTIVO') {
      if (!form.costo_historico || parseFloat(form.costo_historico) <= 0) errs.costo_historico = 'Obligatorio para activos (NIIF 17.9)';
      if (!form.vida_util_anios || parseFloat(form.vida_util_anios) <= 0) errs.vida_util_anios = 'Obligatorio para activos (NIIF 17.17)';
      if (!form.fecha_adquisicion) errs.fecha_adquisicion = 'Obligatoria para activos';
    }
    if (form.tipo_propiedad === 'ARRENDADA' && !form.fecha_fin_contrato) errs.fecha_fin_contrato = 'Obligatorio (ET Art. 70)';
    if (subcategoriaConfig?.campos_json) {
      const campos = typeof subcategoriaConfig.campos_json === 'string' ? JSON.parse(subcategoriaConfig.campos_json) : subcategoriaConfig.campos_json;
      campos.filter(c => c.requerido).forEach(c => {
        const val = form.especificaciones[c.nombre];
        if (val === undefined || val === null || val === '') errs[`esp_${c.nombre}`] = `${c.label} es obligatorio`;
      });
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const payload = { ...form, costo_historico: form.costo_historico ? parseFloat(form.costo_historico) : null, valor_residual: form.valor_residual ? parseFloat(form.valor_residual) : 0, vida_util_anios: form.vida_util_anios ? parseFloat(form.vida_util_anios) : null, especificaciones: form.especificaciones };
      Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null; });
      if (isEditing) await api.put(`/inventario/locativo/${item.id}`, payload);
      else await api.post('/inventario/locativo', payload);
      toast.success(isEditing ? 'Item locativo actualizado' : 'Item locativo registrado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onSuccess?.();
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.errores && Array.isArray(errData.errores)) {
        const errMap = {}; errData.errores.forEach(e => { errMap[e.campo] = e.mensaje; }); setErrors(errMap);
        toast.error('Corrige los errores de validacin contable');
      } else toast.error(errData?.error?.message || 'Error al guardar');
    } finally { setIsSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <SeccionFormulario numero={1} titulo="Categora del Item" icono={Building2}>
        <div>
          <label style={labelStyle}>Grupo Locativo *</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            {GRUPOS_LOCATIVOS.map(g => (
              <button key={g.value} type="button" onClick={() => { setForm(prev => ({ ...prev, grupo_locativo: g.value, subcategoria: '' })); if (errors.grupo_locativo) setErrors(prev => ({ ...prev, grupo_locativo: '' })); }} style={{
                flex: 1, minWidth: '160px', padding: '0.65rem 0.75rem', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                border: form.grupo_locativo === g.value ? `2px solid ${g.color}` : '1px solid var(--border-color)',
                background: form.grupo_locativo === g.value ? `${g.color}15` : 'var(--bg-elevated)',
                transition: 'all 0.15s ease', fontFamily: 'inherit', color: 'var(--text-primary)',
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.15rem' }}>Grupo {g.value}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>{g.desc}</div>
              </button>
            ))}
          </div>
          {errors.grupo_locativo && <span style={{ fontSize: '0.65rem', color: 'var(--clr-danger)', marginTop: '0.25rem', display: 'block' }}>{errors.grupo_locativo}</span>}
        </div>
        {form.grupo_locativo && (
          <FormSelect form={form} errors={errors} handleChange={handleChange} field="subcategoria" label="Subcategora *"
            options={subcategoriasFiltradas.map(s => ({ value: s.codigo, label: s.nombre }))} placeholder="Seleccionar subcategora..." />
        )}
        <FormInput form={form} errors={errors} handleChange={handleChange} field="nombre" label="Nombre del Item *" placeholder="Ej: Tablero elctrico principal" />
        <FormTextarea form={form} errors={errors} handleChange={handleChange} field="descripcion" label="Descripcin tcnica" placeholder="Descripcin detallada del item..." />
        <FormInput form={form} errors={errors} handleChange={handleChange} field="codigo_placa" label="Cdigo de Placa / QR" placeholder="Cdigo de la placa fsica instalada" />
      </SeccionFormulario>

      {form.subcategoria && (
        <SeccionFormulario numero={2} titulo="Clasificacin Contable (NIIF)" icono={TrendingUp}>
          <AlertaContable />
          <ClasificacionContable clasificacion={form.clasificacion_contable} tipoPropiedad={form.tipo_propiedad}
            onClasificacionChange={(v) => setForm(prev => ({ ...prev, clasificacion_contable: v }))}
            onTipoPropiedadChange={(v) => setForm(prev => ({ ...prev, tipo_propiedad: v }))} errores={errors} />
          {form.clasificacion_contable === 'ACTIVO' && (
            <div style={{ border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', padding: '0.85rem', background: 'rgba(99,102,241,0.04)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.6rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Calculator size={14} /> Valoracin del Activo
              </div>
              <div style={fieldGrid}>
                <FormInput form={form} errors={errors} handleChange={handleChange} field="costo_historico" label="Costo Histrico *" type="number" step="100" placeholder="COP" />
                <FormInput form={form} errors={errors} handleChange={handleChange} field="valor_residual" label="Valor Residual" type="number" step="1000" placeholder="Valor final estimado" />
                <FormInput form={form} errors={errors} handleChange={handleChange} field="vida_util_anios" label="Vida til (aos) *" type="number" step="0.5" placeholder="Ej: 5, 10" />
                <FormInput form={form} errors={errors} handleChange={handleChange} field="fecha_adquisicion" label="Fecha de Adquisicin *" type="date" />
                <FormInput form={form} errors={errors} handleChange={handleChange} field="fecha_inicio_depreciacion" label="Inicio Depreciacin" type="date" />
                <FormSelect form={form} errors={errors} handleChange={handleChange} field="metodo_depreciacion" label="Mtodo" options={METODOS_DEPRECIACION} />
              </div>
            </div>
          )}
          {form.tipo_propiedad === 'ARRENDADA' && (
            <div style={{ border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '0.85rem', background: 'rgba(245,158,11,0.04)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.6rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <FileText size={14} /> Contrato de Arrendamiento
              </div>
              <div style={fieldGrid}>
                <FormInput form={form} errors={errors} handleChange={handleChange} field="fecha_fin_contrato" label="Fecha Fin Contrato *" type="date" />
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <input type="checkbox" name="incluye_prorrogas" checked={form.incluye_prorrogas} onChange={handleChange} style={{ accentColor: '#F59E0B' }} />
                    Incluye prrrogas
                  </label>
                </div>
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                La depreciacin se calcula en el menor plazo entre vida til y contrato. (ET Art. 70)
              </div>
            </div>
          )}
          <FormInput form={form} errors={errors} handleChange={handleChange} field="cuenta_contable" label="Cuenta Contable (PUC)" placeholder="Ej: 1640 (Mejoras en propiedades ajenas)" />
        </SeccionFormulario>
      )}

      {form.clasificacion_contable && subcategoriaConfig && (
        <SeccionFormulario numero={3} titulo="Caractersticas Tcnicas" icono={HelpCircle}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Subcategora: <strong>{subcategoriaConfig.nombre}</strong> &mdash; {subcategoriaConfig.descripcion}
          </div>
          <FormSelect form={form} errors={errors} handleChange={handleChange} field="estado_fisico" label="Estado Fsico" options={ESTADOS_FISICOS} />
          {form.estado_fisico !== 'DADO_DE_BAJA' && (
            <FormInput form={form} errors={errors} handleChange={handleChange} field="fecha_ultimo_mantenimiento" label="Fecha ltimo Mantenimiento" type="date" />
          )}
          <CamposTecnicos campos={(() => {
            if (!subcategoriaConfig?.campos_json) return [];
            const raw = subcategoriaConfig.campos_json;
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
          })()} valores={form.especificaciones} onChange={handleEspecificaciones} errores={errors} />
        </SeccionFormulario>
      )}

      {form.clasificacion_contable && (
        <SeccionFormulario numero={4} titulo="Ubicacin y Responsable" icono={MapPin}>
          <div style={fieldGrid}>
            <FormInput form={form} errors={errors} handleChange={handleChange} field="sede" label="Sede" placeholder="Ej: Sede Principal" />
            <FormInput form={form} errors={errors} handleChange={handleChange} field="piso_nivel" label="Piso / Nivel" placeholder="Ej: Piso 1" />
            <FormInput form={form} errors={errors} handleChange={handleChange} field="area_oficina_bodega" label="Oficina / Bodega" placeholder="Ej: Oficina Gerencia" />
            <FormInput form={form} errors={errors} handleChange={handleChange} field="ubicacion_detalle" label="Ubicacin detalle" placeholder="Pared norte" />
            <FormInput form={form} errors={errors} handleChange={handleChange} field="direccion_inmueble" label="Direccin del Inmueble" placeholder="Cra 15 #45-20, Medelln" style={fieldFull} />
          </div>
          <div>
            <label style={labelStyle}><User size={12} style={{ marginRight: '0.25rem' }} />Responsable / Custodio</label>
            <SearchableSelect fetchFn={searchEmployees} value={form.responsable_id} initialItem={selectedResponsable}
              getOptionLabel={getEmployeeLabel}
              renderOption={(emp) => (
                <div style={{ padding: '0.25rem 0' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{emp.full_name || `${emp.nombre || ''} ${emp.apellido || ''}`.trim()}</div>
                  {emp.numero_documento && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{emp.tipo_documento || ''} {emp.numero_documento}{emp.departamento ? ` ${emp.departamento}` : ''}</div>}
                </div>
              )}
              onChange={(val, emp) => { setForm(prev => ({ ...prev, responsable_id: val || '' })); setSelectedResponsable(emp || null); }}
              placeholder="Buscar empleado..." noOptionsMessage="No se encontraron empleados" />
          </div>
        </SeccionFormulario>
      )}

      {form.clasificacion_contable && (
        <SeccionFormulario numero={5} titulo="Documento Soporte y Observaciones" icono={FileText}>
          <div style={fieldGrid}>
            <FormSelect form={form} errors={errors} handleChange={handleChange} field="tipo_documento_soporte" label="Tipo Documento" options={TIPOS_DOCUMENTO} placeholder="Seleccionar..." />
            <FormInput form={form} errors={errors} handleChange={handleChange} field="numero_documento_soporte" label="N Documento" placeholder="Ej: FAC-2026-001" />
          </div>
          <div>
            <label style={labelStyle}>Proveedor / Contratista</label>
            <SearchableSelect fetchFn={searchProveedores} value={form.proveedor_id} initialItem={selectedProveedor}
              getOptionLabel={(p) => p?.name || p?.nombre || ''}
              renderOption={(p) => (
                <div style={{ padding: '0.25rem 0' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{p.name || p.nombre || ''}</div>
                  {p.nit && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>NIT: {p.nit}</div>}
                </div>
              )}
              onChange={(val, prov) => { setForm(prev => ({ ...prev, proveedor_id: val || '' })); setSelectedProveedor(prov || null); }}
              placeholder="Buscar proveedor..." noOptionsMessage="No se encontraron proveedores" />
          </div>
          <FormTextarea form={form} errors={errors} handleChange={handleChange} field="observaciones" label="Observaciones" placeholder="Notas adicionales..." />
        </SeccionFormulario>
      )}

      {errors.general && (
        <div style={{ padding: '0.6rem 0.85rem', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.75rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <AlertTriangle size={14} /> {errors.general}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={isSubmitting}>Cancelar</button>
        <button type="submit" className="btn btn--primary" disabled={isSubmitting}
          style={{ background: '#F97316', borderColor: '#F97316' }}>
          {isSubmitting ? 'Guardando...' : (isEditing ? 'Actualizar Item Locativo' : 'Registrar Item Locativo')}
        </button>
      </div>
    </form>
  );
}
