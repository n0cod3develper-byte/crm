-- Migración para resetear el consecutivo de cotizaciones de servicios a 28328
UPDATE consecutivos
SET ultimo_valor = 28328
WHERE id = 'cotizacion_servicio';
