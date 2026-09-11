-- Migración 130: agrega columnas de horómetro a remision_dias_fijo
-- Corrige bug de producción: estas columnas existían solo en la base local
-- (nunca se creó una migración para ellas), causando error 500 en
-- POST /api/v1/servicios/:id/dias-fijo ("column horometro_inicial ... does not exist")
 
ALTER TABLE remision_dias_fijo
  ADD COLUMN IF NOT EXISTS horometro_inicial NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS horometro_final NUMERIC(12,2);