-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN 051: Semilla para Áreas de Inventario
-- ═══════════════════════════════════════════════════════════════════
BEGIN;

INSERT INTO areas_inventario (id, nombre, descripcion, activo)
VALUES
  (1, 'Mantenimiento', 'Área de mantenimiento general e industrial', true),
  (2, 'Sistemas', 'Área de sistemas, cómputo y telecomunicaciones', true),
  (3, 'SST', 'Seguridad y Salud en el Trabajo', true),
  (4, 'Locativo', 'Mantenimiento locativo y enseres', true)
ON CONFLICT (id) DO NOTHING;

-- Ajustar la secuencia del serial
SELECT setval('areas_inventario_id_seq', COALESCE((SELECT MAX(id) FROM areas_inventario), 1));

COMMIT;
