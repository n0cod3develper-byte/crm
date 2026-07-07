import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Truck } from 'lucide-react';
import api from '../../lib/api';
import { SearchableSelect } from '../ui/SearchableSelect';

const contactSchema = z.object({
  first_name: z.string().min(2, 'El nombre es obligatorio (mín 2 caracteres)'),
  last_name: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  position: z.string().optional(),
  company_id: z.string().optional(),
  proveedor_id: z.string().optional(),
  notes: z.string().optional(),
  is_primary: z.boolean().default(false),
});

export function ContactForm({ contact, defaultCompanyId, defaultProveedorId, fixedCompany = false, fixedProveedor = false, onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const isEditing = !!contact;

  // Determinar tipo inicial
  const getInitialTipo = () => {
    if (contact?.proveedor_id || defaultProveedorId) return 'proveedor';
    return 'empresa';
  };
  const [tipo, setTipo] = React.useState(getInitialTipo);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: contact
      ? {
          ...contact,
          company_id: contact.company_id?.toString() || '',
          proveedor_id: contact.proveedor_id?.toString() || '',
        }
      : {
          is_primary: false,
          company_id: defaultCompanyId?.toString() || '',
          proveedor_id: defaultProveedorId?.toString() || '',
        },
  });

  const companyId = watch('company_id');
  const proveedorId = watch('proveedor_id');
  const [selectedCompany, setSelectedCompany] = React.useState(null);
  const [selectedProveedor, setSelectedProveedor] = React.useState(null);

  React.useEffect(() => {
    const targetId = contact?.company_id || defaultCompanyId;
    if (targetId) {
      api.get(`/companies/${targetId}`)
        .then(r => setSelectedCompany(r.data.data))
        .catch(() => {});
    }
  }, [contact, defaultCompanyId]);

  React.useEffect(() => {
    const targetId = contact?.proveedor_id || defaultProveedorId;
    if (targetId) {
      api.get(`/proveedores/${targetId}`)
        .then(r => setSelectedProveedor(r.data.data))
        .catch(() => {});
    }
  }, [contact, defaultProveedorId]);

  const searchCompanies = React.useCallback(async (searchTerm) => {
    const { data } = await api.get('/companies', {
      params: { search: searchTerm || undefined, limit: 20 }
    });
    return data.data || [];
  }, []);

  const searchProveedores = React.useCallback(async (searchTerm) => {
    const { data } = await api.get('/proveedores', {
      params: { search: searchTerm || undefined, limit: 20 }
    });
    return data.data || [];
  }, []);

  // Al cambiar de tipo, limpiar el campo anterior
  const handleTipoChange = (newTipo) => {
    setTipo(newTipo);
    if (newTipo === 'empresa') {
      setValue('proveedor_id', '');
      setSelectedProveedor(null);
    } else {
      setValue('company_id', '');
      setSelectedCompany(null);
    }
  };

  const mutation = useMutation({
    mutationFn: async (values) => {
      // Forzar IDs fijos si aplica
      const finalCompanyId   = fixedCompany   ? defaultCompanyId   : (tipo === 'empresa'   ? values.company_id   : null);
      const finalProveedorId = fixedProveedor ? defaultProveedorId : (tipo === 'proveedor' ? values.proveedor_id : null);
      const payload = {
        ...values,
        company_id:   finalCompanyId   || null,
        proveedor_id: finalProveedorId || null,
      };
      if (isEditing) {
        const { data } = await api.patch(`/contacts/${contact.id}`, payload);
        return data;
      } else {
        const { data } = await api.post('/contacts', payload);
        return data;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Contacto actualizado' : 'Contacto creado');
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['company-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['proveedor-contacts'] });
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Error al guardar el contacto');
    },
  });

  const onSubmit = (data) => mutation.mutate(data);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Nombre *</label>
          <input {...register('first_name')} className="input" placeholder="Nombre" autoFocus />
          {errors.first_name && <span className="input-error">{errors.first_name.message}</span>}
        </div>
        <div className="input-group w-full">
          <label className="input-label">Apellidos</label>
          <input {...register('last_name')} className="input" placeholder="Apellidos" />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Correo electrónico</label>
          <input {...register('email')} className="input" placeholder="correo@empresa.com" type="email" />
          {errors.email && <span className="input-error">{errors.email.message}</span>}
        </div>
        <div className="input-group w-full">
          <label className="input-label">Cargo / Posición</label>
          <input {...register('position')} className="input" placeholder="Ej: Gerente Logístico" />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="input-group w-full">
          <label className="input-label">Teléfono</label>
          <input {...register('phone')} className="input" placeholder="+57 300..." />
        </div>
        <div className="input-group w-full">
          <label className="input-label">WhatsApp</label>
          <input {...register('whatsapp')} className="input" placeholder="+57 300..." />
        </div>
      </div>

      {/* Toggle Tipo de vínculo */}
      {!fixedCompany && !fixedProveedor && (
        <div className="input-group">
          <label className="input-label">Tipo de vínculo</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className={`btn btn--sm ${tipo === 'empresa' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => handleTipoChange('empresa')}
              style={{ flex: 1 }}
            >
              <Building2 size={13} style={{ marginRight: '0.25rem' }} />
              Empresa
            </button>
            <button
              type="button"
              className={`btn btn--sm ${tipo === 'proveedor' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => handleTipoChange('proveedor')}
              style={{ flex: 1 }}
            >
              <Truck size={13} style={{ marginRight: '0.25rem' }} />
              Proveedor
            </button>
          </div>
        </div>
      )}

      {/* Selección de Empresa */}
      {tipo === 'empresa' && (
        <div className="input-group">
          <label className="input-label">Empresa</label>
          {fixedCompany ? (
            <input
              className="input"
              value={selectedCompany?.name || 'Cargando empresa...'}
              disabled
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
            />
          ) : (
            <SearchableSelect
              fetchFn={searchCompanies}
              value={companyId}
              onChange={(val) => setValue('company_id', val)}
              initialItem={selectedCompany}
              getOptionLabel={(item) => item.name || ''}
              placeholder="Buscar empresa (min. 1 letra)..."
              name="company_id"
              noOptionsMessage="No se encontraron empresas"
              minSearchLength={0}
            />
          )}
        </div>
      )}

      {/* Selección de Proveedor */}
      {tipo === 'proveedor' && (
        <div className="input-group">
          <label className="input-label">Proveedor</label>
          {fixedProveedor ? (
            <input
              className="input"
              value={selectedProveedor?.razon_social || 'Cargando proveedor...'}
              disabled
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
            />
          ) : (
            <SearchableSelect
              fetchFn={searchProveedores}
              value={proveedorId}
              onChange={(val) => setValue('proveedor_id', val)}
              initialItem={selectedProveedor}
              getOptionLabel={(item) => item.razon_social || ''}
              placeholder="Buscar proveedor..."
              name="proveedor_id"
              noOptionsMessage="No se encontraron proveedores"
              minSearchLength={0}
            />
          )}
        </div>
      )}

      <div className="input-group">
        <label className="input-label">Notas</label>
        <textarea {...register('notes')} className="input" rows="3" placeholder="Información adicional..." />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <input type="checkbox" id="is_primary" {...register('is_primary')} style={{ width: 16, height: 16, cursor: 'pointer' }} />
        <label htmlFor="is_primary" className="input-label" style={{ margin: 0, cursor: 'pointer' }}>
          Contacto principal
        </label>
      </div>

      <div className="modal__footer" style={{ padding: '1rem 0 0 0', border: 'none' }}>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear Contacto')}
        </button>
      </div>
    </form>
  );
}
