import z from 'zod';

export const createProveedorSchema = z.object({
  tipo_proveedor: z.array(z.string()).min(1, 'Debe seleccionar al menos un tipo de proveedor'),
  razon_social: z.string().min(3, 'Razón social requerida'),
  nombre_comercial: z.string().optional().nullable(),
  tipo_documento: z.enum(['NIT', 'CC', 'CE', 'PASAPORTE', 'RUT']),
  numero_documento: z.string().min(3, 'Número de documento requerido'),
  digito_verificacion: z.string().max(1).optional().nullable(),
  regimen_tributario: z.enum(['RESPONSABLE_IVA', 'NO_RESPONSABLE', 'GRAN_CONTRIBUYENTE', 'REGIMEN_SIMPLE']),
  aplica_iva: z.boolean().default(true),
  tarifa_iva: z.number().default(19.00),
  pais: z.string().default('Colombia'),
  departamento: z.string().optional().nullable(),
  ciudad: z.string().optional().nullable(),
  direccion: z.string().optional().nullable(),
  telefono_principal: z.string().min(5, 'Teléfono principal requerido'),
  telefono_secundario: z.string().optional().nullable(),
  email_principal: z.string().email('Email principal inválido'),
  email_facturacion: z.string().email('Email de facturación inválido').optional().nullable(),
  sitio_web: z.string().url().optional().nullable().or(z.literal('')),
  contacto_nombre: z.string().optional().nullable(),
  contacto_cargo: z.string().optional().nullable(),
  contacto_telefono: z.string().optional().nullable(),
  contacto_email: z.string().email().optional().nullable().or(z.literal('')),
  condicion_pago: z.enum(['CONTADO', '15_DIAS', '30_DIAS', '45_DIAS', '60_DIAS', '90_DIAS', 'CREDITO_ESPECIAL']).default('30_DIAS'),
  dias_entrega_promedio: z.number().int().default(0),
  moneda: z.enum(['COP', 'USD', 'EUR']).default('COP'),
  cuenta_bancaria_banco: z.string().optional().nullable(),
  cuenta_bancaria_tipo: z.enum(['CORRIENTE', 'AHORROS']).optional().nullable(),
  cuenta_bancaria_numero: z.string().optional().nullable(),
  cuenta_bancaria_titular: z.string().optional().nullable(),
  notas_internas: z.string().optional().nullable(),
  estado: z.enum(['ACTIVO', 'INACTIVO', 'BLOQUEADO', 'EN_EVALUACION']).default('ACTIVO'),
  categorias: z.array(z.object({
    categoria: z.string(),
    descripcion: z.string().optional().nullable()
  })).optional()
});

export const updateProveedorSchema = createProveedorSchema.partial();
