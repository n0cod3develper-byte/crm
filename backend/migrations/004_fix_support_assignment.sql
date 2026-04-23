-- ============================================================
-- Migración 004: Cambiar asignación de Soporte a Empleados
-- Fecha: 2026-04-10
-- ============================================================

-- Eliminar relación actual con users
ALTER TABLE support_tickets 
  DROP CONSTRAINT IF EXISTS support_tickets_assigned_to_fkey;

-- Agregar relación con la tabla employees
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_assigned_to_fkey 
  FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE SET NULL;
