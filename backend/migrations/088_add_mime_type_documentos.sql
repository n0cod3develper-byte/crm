-- Agrega columnas faltantes en 'documentos' requeridas por documentoService.js
-- para el flujo de subida y consulta de documentos (incluye OT firmada).

ALTER TABLE documentos
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(150),
  ADD COLUMN IF NOT EXISTS es_visualizable_inline BOOLEAN DEFAULT false;
