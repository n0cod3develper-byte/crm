-- Migration 076: Reestructura cotizaciones a proveedores + tipo proveedor en contactos
-- Fecha: 2026-07-06

BEGIN;

-- ─── 1. Añadir campos de cabecera a supplier_quotes ──────────────────────────
-- Contacto del proveedor (viene del módulo de contactos)
ALTER TABLE supplier_quotes
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- Teléfono del contacto (auto-llenado, guardado en la cotización por trazabilidad)
ALTER TABLE supplier_quotes
  ADD COLUMN IF NOT EXISTS telefono_contacto VARCHAR(50);

-- Info comercial
ALTER TABLE supplier_quotes
  ADD COLUMN IF NOT EXISTS validez_oferta INT DEFAULT NULL;        -- en días
ALTER TABLE supplier_quotes
  ADD COLUMN IF NOT EXISTS forma_pago VARCHAR(30) DEFAULT NULL;    -- 'CONTADO','15_DIAS','30_DIAS','45_DIAS','60_DIAS','90_DIAS','CREDITO_ESPECIAL'
ALTER TABLE supplier_quotes
  ADD COLUMN IF NOT EXISTS estado_comercial VARCHAR(20) DEFAULT 'EN_ESPERA'; -- 'EN_ESPERA','ACEPTADO','RECHAZADO'

-- ─── 2. Reestructura de ítems: renombrar campos para alinearse con la nueva lógica ─
-- Los ítems del requerimiento usan: item (texto), codigo, descripcion, cantidad, valor_unitario, descuento, total
ALTER TABLE supplier_quote_items
  ADD COLUMN IF NOT EXISTS codigo VARCHAR(100);
ALTER TABLE supplier_quote_items
  ADD COLUMN IF NOT EXISTS descuento DECIMAL(12,2) DEFAULT 0;
-- "descripcion" ya existe como descripcion_manual, se reutiliza
-- "valor_unitario" es precio_unitario — ya existe
-- "total" se calcula como (cantidad * precio_unitario) - descuento (calculado en frontend/backend, no se almacena)

-- ─── 3. Permitir que contacts tenga proveedor_id opcional ────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_proveedor ON contacts(proveedor_id);

COMMIT;
