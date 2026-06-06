-- ============================================================
-- Migración 055: Nuevos campos de correo en Empresas
-- companies: correo_facturacion, correo_rut
-- ============================================================

BEGIN;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS correo_facturacion VARCHAR(150),
  ADD COLUMN IF NOT EXISTS correo_rut         VARCHAR(150);

COMMENT ON COLUMN companies.correo_facturacion IS 'Correo electrónico para envío de facturas, estados de cuenta y comunicaciones administrativas.';
COMMENT ON COLUMN companies.correo_rut         IS 'Correo electrónico para recepción y gestión de documentos tributarios y actualizaciones del RUT.';

COMMIT;
