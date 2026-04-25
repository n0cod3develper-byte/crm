import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';
import { 
  ArrowLeft, Save, Building2, User, 
  MapPin, CreditCard, Clock, Globe,
  Briefcase, Mail, Phone, Info
} from 'lucide-react';
import { Sidebar } from '../../components/layout/Sidebar';
import { Topbar } from '../../components/layout/Topbar';
import api from '../../lib/api';
import { createProveedorSchema } from '../../../../backend/src/modules/proveedores/proveedores.schema'; // Error potential if path is wrong, I'll copy the schema if needed or use relative

// Note: Importing from backend might fail in some build setups. I'll define a local version if needed.
// But let's try to find where it's stored in frontend if it's shared.
// For now, I'll define the local schema to avoid import errors.

import { z } from 'zod';

const localProveedorSchema = z.object({
  tipo_proveedor: z.array(z.string()).min(1, 'Debe seleccionar al menos un tipo'),
  razon_social: z.string().min(3, 'Razón social requerida'),
  nombre_comercial: z.string().optional().nullable(),
  tipo_documento: z.enum(['NIT', 'CC', 'CE', 'PASAPORTE', 'RUT']),
  numero_documento: z.string().min(3, 'Número de documento requerido'),
  digito_verificacion: z.string().max(1).optional().nullable(),
  regimen_tributario: z.enum(['RESPONSABLE_IVA', 'NO_RESPONSABLE', 'GRAN_CONTRIBUYENTE', 'REGIMEN_SIMPLE']),
  aplica_iva: z.boolean().default(true),
  tarifa_iva: z.coerce.number().default(19.00),
  pais: z.string().default('Colombia'),
  departamento: z.string().optional().nullable(),
  ciudad: z.string().optional().nullable(),
  direccion: z.string().optional().nullable(),
  telefono_principal: z.string().min(5, 'Teléfono principal requerido'),
  email_principal: z.string().email('Email principal inválido'),
  condicion_pago: z.enum(['CONTADO', '15_DIAS', '30_DIAS', '45_DIAS', '60_DIAS', '90_DIAS', 'CREDITO_ESPECIAL']).default('30_DIAS'),
  estado: z.enum(['ACTIVO', 'INACTIVO', 'BLOQUEADO', 'EN_EVALUACION']).default('ACTIVO'),
});

export function ProveedorFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(localProveedorSchema),
    defaultValues: {
      tipo_proveedor: ['SUMINISTROS'],
      tipo_documento: 'NIT',
      regimen_tributario: 'RESPONSABLE_IVA',
      aplica_iva: true,
      tarifa_iva: 19,
      pais: 'Colombia',
      condicion_pago: '30_DIAS',
      estado: 'ACTIVO'
    }
  });

  React.useEffect(() => {
    if (isEdit) {
      api.get(`/proveedores/${id}`)
        .then(({ data }) => {
          const p = data.data || data;
          reset(p);
        })
        .catch(() => toast.error('Error al cargar el proveedor'));
    }
  }, [id, isEdit, reset]);

  const onSubmit = async (data) => {
    try {
      if (isEdit) {
        await api.put(`/proveedores/${id}`, data);
        toast.success('Proveedor actualizado exitosamente');
      } else {
        await api.post('/proveedores', data);
        toast.success('Proveedor creado exitosamente');
      }
      navigate('/proveedores');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al guardar el proveedor');
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <Topbar 
        title={isEdit ? 'Editar Proveedor' : 'Nuevo Proveedor'} 
        subtitle="Información legal, comercial y de contacto" 
        rightContent={
          <div className="flex items-center gap-3">
            <button className="btn btn--ghost btn--sm" onClick={() => navigate('/proveedores')}>
              <ArrowLeft size={18} />
            </button>
            <button 
              className="btn btn--primary" 
              onClick={handleSubmit(onSubmit, (errs) => {
                console.error('Validation errors:', errs);
                toast.error('Revisa los campos obligatorios del formulario');
              })}
              disabled={isSubmitting}
            >
              <Save size={18} /> {isSubmitting ? 'Guardando...' : 'Guardar Proveedor'}
            </button>
          </div>
        } 
      />

      <main className="main-content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
          
          <div className="flex flex-col gap-6">
            
            {/* Sección 1: Datos Básicos */}
            <section className="card">
              <div className="flex items-center gap-2 mb-6">
                <Building2 size={20} className="text-primary" />
                <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Información Legal y Tributaria</h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="input-group" style={{ gridColumn: 'span 2' }}>
                  <label className="input-label">Razón Social *</label>
                  <input {...register('razon_social')} className="input" placeholder="Nombre legal de la empresa" />
                  {errors.razon_social && <span className="input-error">{errors.razon_social.message}</span>}
                </div>

                <div className="input-group">
                  <label className="input-label">Nombre Comercial</label>
                  <input {...register('nombre_comercial')} className="input" placeholder="Nombre por el que se conoce" />
                </div>

                <div className="input-group">
                  <label className="input-label">Tipo de Documento *</label>
                  <select {...register('tipo_documento')} className="input">
                    <option value="NIT">NIT</option>
                    <option value="CC">Cédula de Ciudadanía</option>
                    <option value="CE">Cédula de Extranjería</option>
                    <option value="RUT">RUT</option>
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Número de Documento *</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <input {...register('numero_documento')} className="input" style={{ width: '100%' }} />
                      {errors.numero_documento && <span className="input-error">{errors.numero_documento.message}</span>}
                    </div>
                    {watch('tipo_documento') === 'NIT' && (
                      <div style={{ width: '60px' }}>
                        <input {...register('digito_verificacion')} className="input" style={{ width: '100%' }} placeholder="DV" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Régimen Tributario *</label>
                  <select {...register('regimen_tributario')} className="input">
                    <option value="RESPONSABLE_IVA">Responsable de IVA</option>
                    <option value="NO_RESPONSABLE">No Responsable de IVA</option>
                    <option value="GRAN_CONTRIBUYENTE">Gran Contribuyente</option>
                    <option value="REGIMEN_SIMPLE">Régimen Simple</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Sección 2: Ubicación y Contacto */}
            <section className="card">
              <div className="flex items-center gap-2 mb-6">
                <MapPin size={20} className="text-primary" />
                <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Ubicación y Contacto Principal</h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="input-group">
                  <label className="input-label">País</label>
                  <input {...register('pais')} className="input" />
                </div>
                <div className="input-group">
                  <label className="input-label">Ciudad</label>
                  <input {...register('ciudad')} className="input" />
                </div>
                <div className="input-group" style={{ gridColumn: 'span 2' }}>
                  <label className="input-label">Dirección</label>
                  <input {...register('direccion')} className="input" />
                </div>
                <div className="input-group">
                  <label className="input-label">Teléfono Principal *</label>
                  <input {...register('telefono_principal')} className="input" />
                  {errors.telefono_principal && <span className="input-error">{errors.telefono_principal.message}</span>}
                </div>
                <div className="input-group">
                  <label className="input-label">Email de Contacto *</label>
                  <input {...register('email_principal')} className="input" />
                  {errors.email_principal && <span className="input-error">{errors.email_principal.message}</span>}
                </div>
              </div>
            </section>

            {/* Sección 3: Condiciones Comerciales */}
            <section className="card">
              <div className="flex items-center gap-2 mb-6">
                <CreditCard size={20} className="text-primary" />
                <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Condiciones Comerciales</h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="input-group">
                  <label className="input-label">Condición de Pago *</label>
                  <select {...register('condicion_pago')} className="input">
                    <option value="CONTADO">Contado</option>
                    <option value="15_DIAS">15 días</option>
                    <option value="30_DIAS">30 días</option>
                    <option value="60_DIAS">60 días</option>
                    <option value="90_DIAS">90 días</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Estado del Proveedor</label>
                  <select {...register('estado')} className="input">
                    <option value="ACTIVO">Activo</option>
                    <option value="EN_EVALUACION">En Evaluación</option>
                    <option value="INACTIVO">Inactivo</option>
                    <option value="BLOQUEADO">Bloqueado</option>
                  </select>
                </div>
              </div>
            </section>

          </div>

          {/* Sidebar Info */}
          <aside className="flex flex-col gap-6">
            <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--clr-primary-500)' }}>
              <div className="flex gap-3">
                <Info size={20} className="text-primary" />
                <div style={{ fontSize: 'var(--text-xs)' }}>
                  <p className="font-bold mb-1">Requisitos de Registro</p>
                  <p className="text-muted">Asegúrate de adjuntar el RUT y Certificado Bancario actualizado una vez creado el perfil.</p>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="font-bold text-sm mb-3">Categorías</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {['SUMINISTROS', 'SERVICIOS', 'REPUESTOS', 'LOGISTICA'].map(cat => (
                  <label key={cat} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-elevated" style={{ fontSize: 'var(--text-xs)' }}>
                    <input 
                      type="checkbox" 
                      value={cat} 
                      {...register('tipo_proveedor')}
                    />
                    {cat}
                  </label>
                ))}
              </div>
              {errors.tipo_proveedor && <span className="input-error mt-2 block">{errors.tipo_proveedor.message}</span>}
            </div>
          </aside>

        </div>
      </main>
    </div>
  );
}
