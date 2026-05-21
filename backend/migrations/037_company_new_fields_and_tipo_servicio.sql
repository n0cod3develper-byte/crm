-- ============================================================
-- Migraci├│n 037: Nuevos campos en Empresas y Cat├ílogo Servicios
-- Empresas: modelo_captacion, regimen, responsable_captacion_id
-- Cat├ílogo Servicios: tipo_servicio (Fijo/Espor├ídico/Otras Ventas)
-- ============================================================

BEGIN;

-- ============================================================
-- EMPRESAS
-- ============================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS modelo_captacion VARCHAR(100),
  ADD COLUMN IF NOT EXISTS regimen VARCHAR(10),
  ADD COLUMN IF NOT EXISTS responsable_captacion_id UUID REFERENCES employees(id) ON DELETE SET NULL;

COMMENT ON COLUMN companies.modelo_captacion IS 'Modelo de captaci├│n del cliente: Recomendaci├│n/Referido, Redes Sociales, etc.';
COMMENT ON COLUMN companies.regimen IS 'R├ęgimen tributario: RC o NI';
COMMENT ON COLUMN companies.responsable_captacion_id IS 'Empleado responsable de la captaci├│n del cliente';

-- ============================================================
-- CAT├üLOGO SERVICIOS
-- ============================================================

ALTER TABLE catalogo_servicios
  ADD COLUMN IF NOT EXISTS tipo_servicio VARCHAR(50) NOT NULL DEFAULT 'Fijo'
    CHECK (tipo_servicio IN ('Fijo', 'Espor├ídico', 'Otras Ventas'));

CREATE INDEX IF NOT EXISTS idx_catalogo_servicios_tipo_servicio
  ON catalogo_servicios(tipo_servicio);

COMMENT ON COLUMN catalogo_servicios.tipo_servicio IS 'Tipo de servicio: Fijo, Espor├ídico u Otras Ventas';

COMMIT;
