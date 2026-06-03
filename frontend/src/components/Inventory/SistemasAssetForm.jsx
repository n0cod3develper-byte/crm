import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Cpu, Wifi, Monitor, User, CreditCard, FileText } from 'lucide-react';
import api from '../../lib/api';
import { SearchableSelect } from '../ui/SearchableSelect';

const TIPOS_ACTIVO = [
  { value: 'LAPTOP',        label: 'Laptop',       grupo: 'computo' },
  { value: 'DESKTOP',       label: 'Desktop',      grupo: 'computo' },
  { value: 'SERVIDOR',      label: 'Servidor',     grupo: 'computo' },
  { value: 'SWITCH',        label: 'Switch',        grupo: 'red' },
  { value: 'ROUTER',        label: 'Router',        grupo: 'red' },
  { value: 'FIREWALL',      label: 'Firewall',      grupo: 'red' },
  { value: 'ACCESS_POINT',  label: 'Access Point',  grupo: 'red' },
  { value: 'IMPRESORA',     label: 'Impresora',     grupo: 'otro' },
  { value: 'CAMARA',        label: 'Camara',        grupo: 'otro' },
  { value: 'UPS',           label: 'UPS',           grupo: 'otro' },
  { value: 'MONITOR',       label: 'Monitor',       grupo: 'otro' },
  { value: 'OTRO',          label: 'Otro',          grupo: 'otro' },
];

const ESTADOS_ACTIVO = [
  { value: 'DISPONIBLE',       label: 'Disponible' },
  { value: 'ASIGNADO',         label: 'Asignado' },
  { value: 'EN_MANTENIMIENTO', label: 'En mantenimiento' },
  { value: 'DE_BAJA',          label: 'De baja' },
  { value: 'EN_STOCK',         label: 'En stock' },
];

const MODALIDADES = [
  { value: 'PROPIA',        label: 'Propiedad de la empresa' },
  { value: 'ARRENDAMIENTO', label: 'Arrendamiento' },
];

const CAPAS_OPERACION = [
  { value: 'CAPA_2', label: 'Capa 2' },
  { value: 'CAPA_3', label: 'Capa 3' },
];

const isValidIP = (ip) => {
  if (!ip) return true;
  const parts = ip.split('.');
  return parts.length === 4 && parts.every(p => {
    const n = parseInt(p, 10);
    return n >= 0 && n <= 255 && String(n) === p;
  });
};

const sectionTitle = {
  fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)',
  marginBottom: '0.75rem', paddingBottom: '0.375rem',
  borderBottom: '1px solid var(--border-color)',
  display: 'flex', alignItems: 'center', gap: '0.5rem',
};

const fieldGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' };
const fieldFull = { gridColumn: '1 / -1' };

const inputStyle = {
  padding: '0.5rem 0.75rem', borderRadius: '6px',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
  fontSize: '0.8rem', width: '100%', outline: 'none',
};

const labelStyle = {
  fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)',
  display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

const selectStyle = { ...inputStyle, cursor: 'pointer' };
const textareaStyle = { ...inputStyle, resize: 'vertical', minHeight: '60px', fontFamily: 'inherit' };

// ─── Componentes auxiliares FUERA del componente principal ───
// Esto es crítico: si se definen dentro del componente, React las recrea en cada render
// y pierde el foco de los inputs (solo se pueden escribir 1-2 caracteres).
function FormInput({ form, errors, handleChange, field, label, placeholder, type = 'text', style: extraStyle, groupClassName, errorProp, ...rest }) {
  const hasError = errors[field] || errorProp;
  return (
    <div className={groupClassName || undefined} style={!groupClassName ? { marginBottom: 0 } : undefined}>
      <label style={labelStyle}>{label}</label>
      {type === 'textarea' ? (
        <textarea
          name={field}
          value={form[field] || ''}
          onChange={handleChange}
          placeholder={placeholder}
          style={{ ...textareaStyle, ...extraStyle }}
          {...rest}
        />
      ) : (
        <input
          name={field}
          value={form[field] || ''}
          onChange={handleChange}
          placeholder={placeholder}
          type={type}
          style={{ ...inputStyle, ...extraStyle }}
          {...rest}
        />
      )}
      {hasError && (
        <span style={{ fontSize: '0.65rem', color: 'var(--clr-danger)', marginTop: '0.125rem', display: 'block' }}>
          {errors[field] || errorProp}
        </span>
      )}
    </div>
  );
}

function FormSelect({ form, errors, handleChange, field, label, options, placeholder, style: extraStyle }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select name={field} value={form[field] || ''} onChange={handleChange} style={{ ...selectStyle, ...extraStyle }}>
        <option value="">{placeholder || 'Seleccionar...'}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {errors[field] && (
        <span style={{ fontSize: '0.65rem', color: 'var(--clr-danger)', marginTop: '0.125rem', display: 'block' }}>
          {errors[field]}
        </span>
      )}
    </div>
  );
}

export function SistemasAssetForm({ item, onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const isEditing = !!item;

  const [form, setForm] = React.useState({
    codigo_activo: item?.codigo_activo || '',
    numero_serie: item?.numero_serie || '',
    tipo_activo: item?.tipo_activo || '',
    marca: item?.marca || '',
    modelo: item?.name || '',
    estado_activo: item?.estado_activo || 'DISPONIBLE',
    cpu: item?.cpu || '',
    ram: item?.ram || '',
    almacenamiento: item?.almacenamiento || '',
    gpu: item?.gpu || '',
    cargador_info: item?.cargador_info || '',
    cantidad_puertos: item?.cantidad_puertos || '',
    velocidad_puertos: item?.velocidad_puertos || '',
    capa_operacion: item?.capa_operacion || '',
    poe: item?.poe ?? false,
    poe_watts: item?.poe_watts || '',
    mac_lan: item?.mac_lan || '',
    mac_wifi: item?.mac_wifi || '',
    direccion_ip: item?.direccion_ip || '',
    tipo_ip: item?.tipo_ip || '',
    hostname: item?.hostname || '',
    vlan: item?.vlan || '',
    sistema_operativo: item?.sistema_operativo || '',
    licencia_so_key: item?.licencia_so_key || '',
    software_critico: Array.isArray(item?.software_critico) ? item.software_critico.join(', ') : '',
    responsable_id: item?.responsable_id || '',
    documento_empleado: item?.documento_empleado || '',
    departamento_area: item?.departamento_area || '',
    ubicacion_fisica_detalle: item?.ubicacion_fisica_detalle || '',
    fecha_asignacion: item?.fecha_asignacion ? item.fecha_asignacion.split('T')[0] : '',
    proveedor: item?.proveedor || '',
    factura_oc: item?.factura_oc || '',
    fecha_compra: item?.fecha_compra ? item.fecha_compra.split('T')[0] : '',
    costo_adquisicion: item?.costo_adquisicion || '',
    fin_garantia: item?.fin_garantia ? item.fin_garantia.split('T')[0] : '',
    modalidad: item?.modalidad || '',
    historial_mantenimientos: item?.historial_mantenimientos || '',
    observaciones: item?.observaciones || '',
  });

  const [errors, setErrors] = React.useState({});
  const [selectedResponsable, setSelectedResponsable] = React.useState(null);

  React.useEffect(() => {
    if (isEditing && item?.responsable_id && !selectedResponsable) {
      api.get('/employees/' + item.responsable_id)
        .then(r => setSelectedResponsable(r.data.data))
        .catch(() => {});
    }
  }, [isEditing, item]);

  const isComputo = ['LAPTOP', 'DESKTOP', 'SERVIDOR'].includes(form.tipo_activo);
  const isRed = ['SWITCH', 'ROUTER', 'FIREWALL', 'ACCESS_POINT'].includes(form.tipo_activo);
  const requiereSoftware = isComputo;

  const searchEmployees = React.useCallback(async (searchTerm) => {
    const { data } = await api.get('/employees', {
      params: { search: searchTerm || undefined, limit: 20 }
    });
    return data.data || [];
  }, []);

  const getEmployeeLabel = (emp) => {
    if (!emp) return '';
    const nombre = emp.full_name || `${emp.nombre || ''} ${emp.apellido || ''}`.trim() || emp.email || '';
    const doc = emp.numero_documento ? ` [${emp.tipo_documento || ''} ${emp.numero_documento}]` : '';
    return nombre + doc;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.codigo_activo.trim()) newErrors.codigo_activo = 'El codigo de inventario es obligatorio';
    if (!form.numero_serie.trim()) newErrors.numero_serie = 'El numero de serie es obligatorio';
    if (!form.tipo_activo) newErrors.tipo_activo = 'Selecciona el tipo de activo';
    if (form.direccion_ip && !isValidIP(form.direccion_ip)) newErrors.direccion_ip = 'Formato de IP invalido';
    if (form.mac_lan && !/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(form.mac_lan)) newErrors.mac_lan = 'Formato MAC invalido';
    if (form.mac_wifi && !/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(form.mac_wifi)) newErrors.mac_wifi = 'Formato MAC invalido';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const mutation = useMutation({
    mutationFn: async (values) => {
      const payload = {
        area: 'SISTEMAS',
        tipo: 'PRODUCTO',
        name: values.modelo || values.codigo_activo,
        marca: values.marca,
        codigo_activo: values.codigo_activo,
        numero_serie: values.numero_serie,
        tipo_activo: values.tipo_activo,
        estado_activo: values.estado_activo,
        ...(isComputo && {
          cpu: values.cpu, ram: values.ram, almacenamiento: values.almacenamiento,
          gpu: values.gpu, cargador_info: values.cargador_info,
        }),
        ...(isRed && {
          cantidad_puertos: values.cantidad_puertos ? parseInt(values.cantidad_puertos, 10) : null,
          velocidad_puertos: values.velocidad_puertos,
          capa_operacion: values.capa_operacion || null,
          poe: values.poe,
          poe_watts: values.poe_watts ? parseFloat(values.poe_watts) : null,
        }),
        mac_lan: values.mac_lan, mac_wifi: values.mac_wifi,
        direccion_ip: values.direccion_ip, tipo_ip: values.tipo_ip || null,
        hostname: values.hostname, vlan: values.vlan,
        ...(requiereSoftware && {
          sistema_operativo: values.sistema_operativo,
          licencia_so_key: values.licencia_so_key,
          software_critico: values.software_critico ? values.software_critico.split(',').map(s => s.trim()).filter(Boolean) : [],
        }),
        responsable_id: values.responsable_id || null,
        documento_empleado: values.documento_empleado || null,
        departamento_area: values.departamento_area || null,
        ubicacion_fisica_detalle: values.ubicacion_fisica_detalle || null,
        fecha_asignacion: values.fecha_asignacion || null,
        proveedor: values.proveedor || null,
        factura_oc: values.factura_oc || null,
        fecha_compra: values.fecha_compra || null,
        costo_adquisicion: values.costo_adquisicion ? parseFloat(values.costo_adquisicion) : null,
        fin_garantia: values.fin_garantia || null,
        modalidad: values.modalidad || null,
        historial_mantenimientos: values.historial_mantenimientos || null,
        observaciones: values.observaciones || null,
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
      toast.success(isEditing ? 'Activo actualizado' : 'Activo de sistemas registrado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Error al guardar el activo');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate(form);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ─── MÓDULO 1: Información General del Activo ────────────── */}
      <div>
        <div style={sectionTitle}>
          <Monitor size={16} /> Información General del Activo
        </div>
        <div style={fieldGrid}>
          <FormInput form={form} errors={errors} handleChange={handleChange} field="codigo_activo" label="Código de Inventario / Placa *" placeholder="Ej: SIS-00123" groupClassName="w-full" />
          <FormInput form={form} errors={errors} handleChange={handleChange} field="numero_serie" label="Número de Serie (S/N) *" placeholder="Único por equipo" groupClassName="w-full" />
          <div style={fieldFull}>
            <label style={labelStyle}>Tipo de Activo *</label>
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
              {TIPOS_ACTIVO.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setForm(prev => ({ ...prev, tipo_activo: t.value }));
                    if (errors.tipo_activo) setErrors(prev => ({ ...prev, tipo_activo: '' }));
                  }}
                  style={{
                    padding: '0.4rem 0.7rem', borderRadius: '6px', cursor: 'pointer',
                    fontSize: '0.75rem', fontWeight: 600,
                    border: form.tipo_activo === t.value ? '2px solid #6366F1' : '1px solid var(--border-color)',
                    background: form.tipo_activo === t.value ? 'rgba(99,102,241,0.15)' : 'var(--bg-elevated)',
                    color: form.tipo_activo === t.value ? '#6366F1' : 'var(--text-secondary)',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {errors.tipo_activo && (
              <span style={{ fontSize: '0.65rem', color: 'var(--clr-danger)', marginTop: '0.25rem', display: 'block' }}>
                {errors.tipo_activo}
              </span>
            )}
          </div>
          <FormInput form={form} errors={errors} handleChange={handleChange} field="marca" label="Marca" placeholder="Ej: Dell, HP, Cisco" />
          <FormInput form={form} errors={errors} handleChange={handleChange} field="modelo" label="Modelo" placeholder="Ej: Latitude 5420" />
          <FormSelect form={form} errors={errors} handleChange={handleChange} field="estado_activo" label="Estado del Activo" options={ESTADOS_ACTIVO} placeholder="Seleccionar..." />
        </div>
      </div>

      {/* ─── MÓDULO 2: Especificaciones Técnicas - Hardware ──────── */}
      {form.tipo_activo && (
        <div>
          <div style={sectionTitle}>
            <Cpu size={16} /> Especificaciones Técnicas
            {isComputo && <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)' }}>— Equipo de cómputo</span>}
            {isRed && <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)' }}>— Red / Conectividad</span>}
          </div>

          {isComputo && (
            <div style={fieldGrid}>
              <FormInput form={form} errors={errors} handleChange={handleChange} field="cpu" label="Procesador (CPU)" placeholder="Ej: Intel Core i7 12a Gen" />
              <FormInput form={form} errors={errors} handleChange={handleChange} field="ram" label="Memoria RAM" placeholder="Ej: 16 GB DDR4" />
              <FormInput form={form} errors={errors} handleChange={handleChange} field="almacenamiento" label="Almacenamiento" placeholder="Ej: 512 GB SSD NVMe" />
              <FormInput form={form} errors={errors} handleChange={handleChange} field="gpu" label="Tarjeta de Video (GPU)" placeholder="Ej: NVIDIA RTX 3050" />
              <FormInput form={form} errors={errors} handleChange={handleChange} field="cargador_info" label="Cargador / Fuente de Poder" placeholder="Modelo / Serie" style={fieldFull} groupClassName={fieldFull} />
            </div>
          )}

          {isRed && (
            <div style={fieldGrid}>
              <FormInput form={form} errors={errors} handleChange={handleChange} field="cantidad_puertos" label="Cantidad de Puertos" placeholder="Ej: 24" type="number" />
              <FormInput form={form} errors={errors} handleChange={handleChange} field="velocidad_puertos" label="Velocidad de Puertos" placeholder="Ej: 10/100/1000 Mbps" />
              <FormSelect form={form} errors={errors} handleChange={handleChange} field="capa_operacion" label="Capa de Operación (Layer)" options={CAPAS_OPERACION} />
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0', flex: 1 }}>
                  <input
                    type="checkbox" name="poe" id="poe"
                    checked={form.poe}
                    onChange={handleChange}
                    style={{ accentColor: '#6366F1' }}
                  />
                  <label htmlFor="poe" style={{ ...labelStyle, margin: 0, cursor: 'pointer', textTransform: 'none' }}>
                    PoE (Power over Ethernet)
                  </label>
                </div>
                {form.poe && (
                  <FormInput form={form} errors={errors} handleChange={handleChange} field="poe_watts" label="Watts PoE" placeholder="Ej: 370" type="number" style={{ maxWidth: '120px' }} />
                )}
              </div>
            </div>
          )}

          {!isComputo && !isRed && form.tipo_activo && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
              Especificaciones técnicas no aplican para este tipo de activo.
            </div>
          )}
        </div>
      )}

      {/* ─── MÓDULO 3: Información de Red y Conectividad ─────────── */}
      <div>
        <div style={sectionTitle}>
          <Wifi size={16} /> Información de Red y Conectividad
        </div>
        <div style={fieldGrid}>
          <FormInput form={form} errors={errors} handleChange={handleChange} field="mac_lan" label="Dirección MAC (LAN)" placeholder="Ej: 00:1A:2B:3C:4D:5E" />
          <FormInput form={form} errors={errors} handleChange={handleChange} field="mac_wifi" label="Dirección MAC (Wi-Fi)" placeholder="Ej: 00:1A:2B:3C:4D:5F" />
          <FormInput
            form={form} errors={errors} handleChange={handleChange}
            field="direccion_ip" label="Dirección IP" placeholder="Ej: 192.168.1.100"
            errorProp={errors.direccion_ip}
          />
          <FormSelect form={form} errors={errors} handleChange={handleChange} field="tipo_ip" label="Tipo de IP" options={[
            { value: 'FIJA', label: 'IP Fija' },
            { value: 'DHCP', label: 'DHCP' },
          ]} placeholder="Seleccionar..." />
          <FormInput form={form} errors={errors} handleChange={handleChange} field="hostname" label="Nombre en Red (Hostname)" placeholder="Ej: LAP-SISTEMAS01" />
          <FormInput form={form} errors={errors} handleChange={handleChange} field="vlan" label="Segmento de Red / VLAN" placeholder="Ej: VLAN 10 - Oficinas" />
        </div>
      </div>

      {/* ─── MÓDULO 4: Software y Sistema Operativo ─────────────── */}
      {requiereSoftware && (
        <div>
          <div style={sectionTitle}>
            <Monitor size={16} /> Software y Sistema Operativo
          </div>
          <div style={fieldGrid}>
            <FormInput form={form} errors={errors} handleChange={handleChange} field="sistema_operativo" label="Sistema Operativo" placeholder="Ej: Windows 11 Pro 64-bit" />
            <FormInput form={form} errors={errors} handleChange={handleChange} field="licencia_so_key" label="Licencia del SO / Key" placeholder="Clave de producto" />
            <FormInput
              form={form} errors={errors} handleChange={handleChange}
              field="software_critico" label="Software Crítico Instalado"
              placeholder="Office, Antivirus, Agente de monitoreo (separado por comas)"
              style={fieldFull} groupClassName={fieldFull}
            />
          </div>
        </div>
      )}

      {/* ─── MÓDULO 5: Asignación, Ubicación y Responsabilidad ──── */}
      <div>
        <div style={sectionTitle}>
          <User size={16} /> Asignación, Ubicación y Responsabilidad
        </div>
        <div style={fieldGrid}>
          <div style={fieldFull}>
            <label style={labelStyle}>Usuario Responsable</label>
            <SearchableSelect
              fetchFn={searchEmployees}
              value={form.responsable_id}
              onChange={(val, emp) => {
                setForm(prev => ({
                  ...prev,
                  responsable_id: val || '',
                  documento_empleado: emp?.numero_documento || '',
                  departamento_area: emp?.departamento || prev.departamento_area,
                }));
                setSelectedResponsable(emp || null);
              }}
              initialItem={selectedResponsable}
              getOptionLabel={getEmployeeLabel}
              renderOption={(emp, { isHighlighted }) => (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{emp.full_name}</div>
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                      {emp.numero_documento && <span>{emp.tipo_documento || 'CC'} {emp.numero_documento}</span>}
                      {emp.departamento && <span>• {emp.departamento}</span>}
                    </div>
                  </div>
                </div>
              )}
              placeholder="Buscar empleado por nombre..."
              noOptionsMessage="No se encontraron empleados"
            />
          </div>
          <FormInput form={form} errors={errors} handleChange={handleChange} field="documento_empleado" label="ID / Cédula del Empleado" placeholder="Autocompletado" />
          <FormInput form={form} errors={errors} handleChange={handleChange} field="departamento_area" label="Departamento / Área" placeholder="Ej: Contabilidad, Sistemas" />
          <FormInput form={form} errors={errors} handleChange={handleChange} field="ubicacion_fisica_detalle" label="Ubicación Física" placeholder="Sede, Edificio, Piso, Oficina" />
          <FormInput form={form} errors={errors} handleChange={handleChange} field="fecha_asignacion" label="Fecha de Asignación" type="date" />
        </div>
      </div>

      {/* ─── MÓDULO 6: Información Comercial, Financiera y Garantías ── */}
      <div>
        <div style={sectionTitle}>
          <CreditCard size={16} /> Información Comercial, Financiera y Garantías
        </div>
        <div style={fieldGrid}>
          <FormInput form={form} errors={errors} handleChange={handleChange} field="proveedor" label="Proveedor" placeholder="Nombre del proveedor" />
          <FormInput form={form} errors={errors} handleChange={handleChange} field="factura_oc" label="N° Factura / Orden de Compra" placeholder="Ej: FAC-2025-001" />
          <FormInput form={form} errors={errors} handleChange={handleChange} field="fecha_compra" label="Fecha de Compra" type="date" />
          <FormInput form={form} errors={errors} handleChange={handleChange} field="costo_adquisicion" label="Costo de Adquisición" type="number" step="1000" placeholder="COP" />
          <FormInput form={form} errors={errors} handleChange={handleChange} field="fin_garantia" label="Fin de Garantía de Fábrica" type="date" />
          <FormSelect form={form} errors={errors} handleChange={handleChange} field="modalidad" label="Modalidad" options={MODALIDADES} placeholder="Seleccionar..." />
        </div>
      </div>

      {/* ─── MÓDULO 7: Historial y Observaciones / Bitácora ────── */}
      <div>
        <div style={sectionTitle}>
          <FileText size={16} /> Historial y Observaciones
        </div>
        <div style={fieldGrid}>
          <FormInput form={form} errors={errors} handleChange={handleChange} field="historial_mantenimientos" label="Historial de Mantenimientos" placeholder="Registrar eventos de servicio técnico, cambios de piezas, etc." type="textarea" style={fieldFull} groupClassName={fieldFull} rows={3} />
          <FormInput form={form} errors={errors} handleChange={handleChange} field="observaciones" label="Observaciones / Notas" placeholder="Accesorios, detalles estéticos, notas adicionales..." type="textarea" style={fieldFull} groupClassName={fieldFull} rows={2} />
        </div>
      </div>

      {/* ─── Botones de acción ─────────────────────────────────── */}
      <div className="modal__footer" style={{ padding: '1rem 0 0 0', border: 'none' }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn--primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando...' : (isEditing ? 'Actualizar Activo' : 'Registrar Activo')}
        </button>
      </div>
    </form>
  );
}
