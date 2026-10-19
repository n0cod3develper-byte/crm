import z from 'zod';

export const LEAD_STATUS = ['new', 'contacted', 'qualified', 'converted', 'dead'];

const emailOpcional = z
  .union([z.string().email('Correo inválido'), z.literal(''), z.null()])
  .optional();

/**
 * Crea un lead. `assigned_employee_id` es opcional (se permite leads sin asignar)
 * pero, cuando viene, debe ser un UUID: la existencia y el estado activo del empleado
 * se verifican contra la base de datos en el controlador (zod no tiene acceso a ella).
 */
export const createLeadSchema = z.object({
  first_name: z.string().trim().min(2, 'El nombre es requerido (mínimo 2 caracteres)').max(100),
  last_name: z.string().trim().max(100).optional().nullable(),
  email: emailOpcional,
  phone: z.string().trim().max(30).optional().nullable(),
  company_name: z.string().trim().max(255).optional().nullable(),
  source: z.string().trim().max(100).optional().nullable(),
  campaign_id: z.string().uuid('Campaña inválida').optional().nullable(),
  status: z.enum(LEAD_STATUS).default('new'),
  score: z.coerce.number().int().min(0).max(100).default(0),
  assigned_employee_id: z
    .string()
    .uuid('El empleado seleccionado no es válido')
    .optional()
    .nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

/** Edita un lead: mismo conjunto de campos, todos opcionales. */
export const updateLeadSchema = createLeadSchema.partial();

/**
 * Listado. Se conserva el nombre del parámetro `assignedTo` por compatibilidad hacia
 * atrás con el filtro actual, pero ahora identifica al EMPLEADO (assigned_employee_id).
 * El valor especial 'none' filtra los leads sin asignar.
 */
export const listLeadsQuerySchema = z.object({
  status: z.enum(LEAD_STATUS).optional(),
  assignedTo: z
    .union([z.literal('none'), z.string().uuid('Filtro de empleado inválido')])
    .optional(),
  source: z.string().trim().max(100).optional(),
  campaignId: z.string().uuid('Filtro de campaña inválido').optional(),
  search: z.string().trim().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().uuid().optional(),
});

/** Búsqueda de empleados activos para el select (ítem del formulario). */
export const asignablesQuerySchema = z.object({
  search: z.string().trim().max(255).optional(),
});
