-- ============================================================
-- Migracion 046: Corrige FK de responsable_id en inventario
-- 
-- responsable_id estaba apuntando a users(id) pero el frontend
-- envia employees.id. Se cambia la FK para que referencie
-- employees(id).
-- ============================================================

BEGIN;

-- 1. Eliminar la FK existente que apunta a users(id)
ALTER TABLE inventario
  DROP CONSTRAINT IF EXISTS inventario_responsable_id_fkey;

-- 2. Opcional: migrar valores existentes de responsable_id
--    Si algun responsable_id existente apunta a users pero no a employees,
--    lo dejamos como NULL para evitar errores.
UPDATE inventario i
SET responsable_id = NULL
WHERE responsable_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM employees e WHERE e.id = i.responsable_id)
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = i.responsable_id);

-- 3. Agregar la nueva FK apuntando a employees(id)
ALTER TABLE inventario
  ADD CONSTRAINT inventario_responsable_id_fkey
  FOREIGN KEY (responsable_id) REFERENCES employees(id)
  ON DELETE SET NULL;

COMMIT;
