import React from 'react';
import { useForm, useWatch, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, Plus, Trash2, MapPin } from 'lucide-react';
import api from '../../lib/api';

const companySchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio (mín 2 caracteres)').transform(v => v.toUpperCase()),
  nit: z.string().min(1, 'El NIT es obligatorio'),
  industry: z.string().default('logistics'),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  phone: z.string().optional(),
  city: z.string().optional(),
  address: z.string().min(1, 'La dirección es obligatoria'),
  notes: z.string().optional(),
  modelo_captacion: z.string().optional(),
  regimen: z.string().min(1, 'El régimen es obligatorio').default('RC'),
  responsable_captacion_id: z.string().optional(),
  correo_facturacion: z.string().email('Formato de correo inválido').max(150, 'Máximo 150 caracteres').optional().or(z.literal('')),
  correo_rut: z.string().email('Formato de correo inválido').max(150, 'Máximo 150 caracteres').optional().or(z.literal('')),
  service_addresses: z.array(z.object({
    address: z.string().min(1, 'La dirección es obligatoria'),
    notes: z.string().optional()
  })).optional(),
});

const MODELOS_CAPTACION = [
  'Recomendación / Referido',
  'Redes Sociales',
  'Google / Buscador',
  'Correo Electrónico',
  'WhatsApp',
  'Visita Asesor Comercial',
  'Página Web / Sitio Oficial',
  'Mail Marketing',
];

export function CompanyForm({ company, onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const isEditing = !!company;

  const { data: empleados, isLoading: loadingEmpleados } = useQuery({
    queryKey: ['empleados-lista'],
    queryFn: async () => {
      const { data } = await api.get('/employees', { params: { limit: 200 } });
      return data.data || [];
    },
  });

  const { register, handleSubmit, setValue, control, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(companySchema),
    defaultValues: company
      ? { ...company, name: company.name ? company.name.toUpperCase() : '', regimen: company.regimen || 'RC' }
      : { industry: 'logistics', regimen: 'RC' },
  });

  // Convertir nombre a MAYÚSCULAS en tiempo real
  const nameValue = useWatch({ control, name: 'name' });
  React.useEffect(() => {
    if (nameValue && nameValue !== nameValue.toUpperCase()) {
      setValue('name', nameValue.toUpperCase(), { shouldValidate: false, shouldDirty: true });
    }
  }, [nameValue, setValue]);

  const { fields: addressFields, append: appendAddress, remove: removeAddress } = useFieldArray({
    control,
    name: 'service_addresses'
  });

  const { data: existingAddresses } = useQuery({
    queryKey: ['company-service-addresses', company?.id],
    queryFn: async () => {
      const { data } = await api.get(`/companies/${company.id}/service-addresses`);
      return data.data;
    },
    enabled: isEditing,
  });

  React.useEffect(() => {
    if (existingAddresses && existingAddresses.length > 0) {
      setValue('service_addresses', existingAddresses);
    }
  }, [existingAddresses, setValue]);

  const mutation = useMutation({
    mutationFn: async (values) => {
      if (isEditing) {
        const { data } = await api.patch(`/companies/${company.id}`, values);
        return data;
      } else {
        const { data } = await api.post('/companies', values);
        return data;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Empresa actualizada' : 'Empresa creada');
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      onSuccess?.();
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.response?.data?.error;
      if (msg && msg.toLowerCase().includes('nit')) {
        toast.error('Este NIT ya está registrado');
      } else {
        toast.error(msg || 'Error al guardar empresa');
      }
    },
  });

  const onSubmit = (data) => mutation.mutate(data);

  return (
    <form id="company-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="input-group">
        <label className="input-label">Nombre de la empresa *</label>
        <input
          {...register('name')}
          className="input"
          placeholder="Ej: LOGÍSTICA CARGAR SAS"
          autoFocus
          style={{ textTransform: 'uppercase' }}
        />
        {errors.name && <span className="input-error">{errors.name.message}</span>}
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            NIT *
            <span className="nit-tooltip-wrapper" aria-label="Ayuda sobre el NIT">
              <Info size={14} className="nit-tooltip-icon" />
              <span className="nit-tooltip-bubble" role="tooltip">
                Favor ingresar el NIT sin puntos ni dígito de verificación.
              </span>
            </span>
          </label>
          <input {...register('nit')} className="input" placeholder="900123456" />
          {errors.nit && <span className="input-error">{errors.nit.message}</span>}
        </div>
        <div className="input-group w-full">
          <label className="input-label">Sector</label>
          <select {...register('industry')} className="input">
            <option value="logistics">Logística / Transporte</option>
            <option value="manufacturing">Manufactura</option>
            <option value="retail">Retail / Comercio</option>
            <option value="technology">Tecnología</option>
            <option value="other">Otro</option>
          </select>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Sitio Web</label>
          <input {...register('website')} className="input" placeholder="https://..." />
          {errors.website && <span className="input-error">{errors.website.message}</span>}
        </div>
        <div className="input-group w-full">
          <label className="input-label">Teléfono</label>
          <input {...register('phone')} className="input" placeholder="+57 ..." />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Ciudad</label>
          <input {...register('city')} className="input" placeholder="Bogotá, Colombia" />
        </div>
        <div className="input-group w-full">
          <label className="input-label">Dirección *</label>
          <input {...register('address')} className="input" placeholder="Ej: Calle 26 # 45-10" />
          {errors.address && <span className="input-error">{errors.address.message}</span>}
        </div>
      </div>

      <div className="input-group">
        <label className="input-label">Notas internas</label>
        <textarea 
          {...register('notes')} 
          className="input" 
          placeholder="Información adicional sobre la empresa..."
          rows="3"
        />
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />
      <div className="flex items-center justify-between">
        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Direcciones de Servicio Adicionales
        </p>
        <button
          type="button"
          onClick={() => appendAddress({ address: '', notes: '' })}
          className="btn btn--secondary btn--sm flex items-center gap-1"
        >
          <Plus size={14} /> Añadir Dirección
        </button>
      </div>
      
      {addressFields.length > 0 && (
        <div className="flex flex-col gap-3">
          {addressFields.map((field, index) => (
            <div key={field.id} className="p-3 bg-surface-elevated rounded border border-border flex gap-3 relative">
              <div className="flex-1 flex flex-col gap-3">
                <div className="input-group">
                  <label className="input-label">Dirección de Servicio *</label>
                  <input
                    {...register(`service_addresses.${index}.address`)}
                    className="input"
                    placeholder="Ej: Bodega Norte - Calle 80 # 65-20"
                  />
                  {errors.service_addresses?.[index]?.address && (
                    <span className="input-error">{errors.service_addresses[index].address.message}</span>
                  )}
                </div>
                <div className="input-group">
                  <label className="input-label">Notas de la dirección (Opcional)</label>
                  <input
                    {...register(`service_addresses.${index}.notes`)}
                    className="input"
                    placeholder="Horarios, contacto en puerta..."
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeAddress(index)}
                className="btn btn--ghost text-danger-500 self-start"
                title="Eliminar dirección"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />
      <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Información Comercial</p>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Modelo de captación</label>
          <select {...register('modelo_captacion')} className="input">
            <option value="">Seleccionar...</option>
            {MODELOS_CAPTACION.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="input-group w-full">
          <label className="input-label">Régimen *</label>
          <select {...register('regimen')} className="input">
            <option value="RC">RC</option>
            <option value="NI">NI</option>
          </select>
          {errors.regimen && <span className="input-error">{errors.regimen.message}</span>}
        </div>
      </div>

      <div className="input-group">
        <label className="input-label">Responsable de captación</label>
        <select {...register('responsable_captacion_id')} className="input">
          <option value="">Seleccionar...</option>
          {loadingEmpleados ? (
            <option disabled>Cargando empleados...</option>
          ) : !empleados || empleados.length === 0 ? (
            <option disabled>No hay empleados registrados</option>
          ) : (
            empleados.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name || `${emp.user_nombre || ''} ${emp.user_apellido || ''}`.trim() || emp.email}
              </option>
            ))
          )}
        </select>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />
      <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Correos Electrónicos</p>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Correo de Facturación</label>
          <input
            {...register('correo_facturacion')}
            type="email"
            className="input"
            placeholder="facturacion@empresa.com"
            maxLength={150}
          />
          {errors.correo_facturacion && <span className="input-error">{errors.correo_facturacion.message}</span>}
        </div>
        <div className="input-group w-full">
          <label className="input-label">Correo RUT</label>
          <input
            {...register('correo_rut')}
            type="email"
            className="input"
            placeholder="rut@empresa.com"
            maxLength={150}
          />
          {errors.correo_rut && <span className="input-error">{errors.correo_rut.message}</span>}
        </div>
      </div>

      <div className="modal__footer" style={{ padding: '1rem 0 0 0', border: 'none' }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary" disabled={isSubmitting || mutation.isPending}>
          {isSubmitting ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear Empresa')}
        </button>
      </div>
    </form>
  );
}
