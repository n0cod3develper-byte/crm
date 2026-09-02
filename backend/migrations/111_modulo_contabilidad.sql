-- 111_modulo_contabilidad.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS contabilidad_periodos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anio INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    fecha_importacion TIMESTAMPTZ DEFAULT NOW(),
    importado_por UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_contabilidad_anio_mes UNIQUE(anio, mes)
);

CREATE TABLE IF NOT EXISTS contabilidad_cuentas (
    codigo VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS contabilidad_movimientos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    periodo_id UUID NOT NULL REFERENCES contabilidad_periodos(id) ON DELETE CASCADE,
    cuenta_codigo VARCHAR(50) NOT NULL REFERENCES contabilidad_cuentas(codigo) ON DELETE CASCADE,
    saldo_anterior NUMERIC(20,2) DEFAULT 0,
    debito NUMERIC(20,2) DEFAULT 0,
    credito NUMERIC(20,2) DEFAULT 0,
    neto NUMERIC(20,2) DEFAULT 0,
    saldo_actual NUMERIC(20,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contabilidad_rubros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(100) UNIQUE,
    reporte VARCHAR(50) NOT NULL, -- 'BALANCE', 'ESTADO_RESULTADOS'
    seccion VARCHAR(100) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    orden INTEGER NOT NULL,
    naturaleza VARCHAR(20), -- 'DEBITO', 'CREDITO'
    es_subtotal BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS contabilidad_mapeo_cuentas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cuenta_codigo VARCHAR(50) NOT NULL UNIQUE,
    rubro_id UUID NOT NULL REFERENCES contabilidad_rubros(id) ON DELETE CASCADE
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_movimientos_periodo ON contabilidad_movimientos(periodo_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_cuenta ON contabilidad_movimientos(cuenta_codigo);

-- Módulo en sistema
INSERT INTO modulos_sistema (slug, nombre, activo)
VALUES ('contabilidad', 'Contabilidad', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Permisos Admin
INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_eliminar, puede_exportar, puede_aprobar, puede_liquidar)
SELECT r.id, ms.id, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE
FROM roles r
JOIN modulos_sistema ms ON ms.slug = 'contabilidad'
WHERE r.slug = 'admin'
ON CONFLICT (rol_id, modulo_id) DO UPDATE
  SET puede_ver=TRUE, puede_crear=TRUE, puede_editar=TRUE, puede_eliminar=TRUE;

-- Permisos Contabilidad
INSERT INTO roles_permisos (rol_id, modulo_id, puede_ver, puede_crear, puede_editar, puede_eliminar, puede_exportar, puede_aprobar, puede_liquidar)
SELECT r.id, ms.id, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, FALSE
FROM roles r
JOIN modulos_sistema ms ON ms.slug = 'contabilidad'
WHERE r.slug = 'contabilidad'
ON CONFLICT (rol_id, modulo_id) DO UPDATE
  SET puede_ver=TRUE, puede_crear=TRUE, puede_editar=TRUE, puede_exportar=TRUE;

-- Seeds de rubros
INSERT INTO contabilidad_rubros (codigo, reporte, seccion, nombre, orden, naturaleza, es_subtotal) VALUES
-- ACTIVOS
('ACT_CORR_EFECTIVO', 'BALANCE', 'Activo corriente', 'Efectivo y equivalentes de efectivo', 10, 'DEBITO', FALSE),
('ACT_CORR_DEUDORES', 'BALANCE', 'Activo corriente', 'Deudores comerciales y otros', 20, 'DEBITO', FALSE),
('ACT_CORR_PAGOS_ANTICIPADOS', 'BALANCE', 'Activo corriente', 'Pagos anticipados', 30, 'DEBITO', FALSE),
('ACT_CORR_ANTICIPO_IMPUESTOS', 'BALANCE', 'Activo corriente', 'Anticipo de impuestos', 40, 'DEBITO', FALSE),
('ACT_CORR_COBRAR_TRAB', 'BALANCE', 'Activo corriente', 'Por cobrar a trabajadores', 50, 'DEBITO', FALSE),
('ACT_CORR_COBRAR_PART', 'BALANCE', 'Activo corriente', 'Por cobrar a particulares', 60, 'DEBITO', FALSE),
('ACT_CORR_INVENTARIOS', 'BALANCE', 'Activo corriente', 'Inventarios', 70, 'DEBITO', FALSE),
('ACT_CORR_GASTOS_ANTICIPADOS', 'BALANCE', 'Activo corriente', 'Gastos pagados por anticipado', 80, 'DEBITO', FALSE),
('ACT_CORR_TOTAL', 'BALANCE', 'Activo corriente', 'Total Activo corriente', 90, 'DEBITO', TRUE),

('ACT_NOCORR_PPE', 'BALANCE', 'Activo no corriente', 'Propiedades, planta y equipo', 100, 'DEBITO', FALSE),
('ACT_NOCORR_DEP', 'BALANCE', 'Activo no corriente', 'Depreciación', 110, 'CREDITO', FALSE),
('ACT_NOCORR_IMP_DIFERIDO', 'BALANCE', 'Activo no corriente', 'Impuesto de renta diferido', 120, 'DEBITO', FALSE),
('ACT_NOCORR_TOTAL', 'BALANCE', 'Activo no corriente', 'Total Activo no corriente', 130, 'DEBITO', TRUE),

('ACT_TOTAL', 'BALANCE', 'TOTAL_ACTIVO', 'Total Activos', 140, 'DEBITO', TRUE),

-- PASIVOS
('PAS_CORR_OBLIG_FIN', 'BALANCE', 'Corrientes', 'Obligaciones Financieras', 200, 'CREDITO', FALSE),
('PAS_CORR_OBLIG_PART', 'BALANCE', 'Corrientes', 'Obligaciones con particulares', 210, 'CREDITO', FALSE),
('PAS_CORR_PROVEEDORES', 'BALANCE', 'Corrientes', 'Proveedores', 220, 'CREDITO', FALSE),
('PAS_CORR_CXP', 'BALANCE', 'Corrientes', 'Cuentas por Pagar', 230, 'CREDITO', FALSE),
('PAS_CORR_BENEF_EMP', 'BALANCE', 'Corrientes', 'Beneficio a empleados', 240, 'CREDITO', FALSE),
('PAS_CORR_PAS_ESTIM', 'BALANCE', 'Corrientes', 'Pasivos estimados y provisiones', 250, 'CREDITO', FALSE),
('PAS_CORR_IMPUESTOS', 'BALANCE', 'Corrientes', 'Impuestos, Gravámenes y Tasas', 260, 'CREDITO', FALSE),
('PAS_CORR_OTROS', 'BALANCE', 'Corrientes', 'Otros pasivos', 270, 'CREDITO', FALSE),
('PAS_CORR_TOTAL', 'BALANCE', 'Corrientes', 'Total Pasivo Corriente', 280, 'CREDITO', TRUE),

('PAS_NOCORR_OBLIG_FIN', 'BALANCE', 'No Corriente', 'Obligaciones financieras', 290, 'CREDITO', FALSE),
('PAS_NOCORR_PROV_PENSION', 'BALANCE', 'No Corriente', 'Provisión Pensión', 300, 'CREDITO', FALSE),
('PAS_NOCORR_DIFERIDOS', 'BALANCE', 'No Corriente', 'Diferidos', 310, 'CREDITO', FALSE),
('PAS_NOCORR_TOTAL', 'BALANCE', 'No Corriente', 'Total Pasivo no corriente', 320, 'CREDITO', TRUE),

('PAS_TOTAL', 'BALANCE', 'TOTAL_PASIVO', 'Total Pasivo', 330, 'CREDITO', TRUE),

-- PATRIMONIO
('PAT_CAPITAL', 'BALANCE', 'PATRIMONIO', 'Capital Social', 400, 'CREDITO', FALSE),
('PAT_RES_EJERCICIO', 'BALANCE', 'PATRIMONIO', 'Resultados del Ejercicio', 410, 'CREDITO', FALSE),
('PAT_RES_ANTERIORES', 'BALANCE', 'PATRIMONIO', 'Resultados de Ejercicios Anteriores', 420, 'CREDITO', FALSE),
('PAT_TOTAL', 'BALANCE', 'PATRIMONIO', 'Total Patrimonio', 430, 'CREDITO', TRUE),
('PAS_PAT_TOTAL', 'BALANCE', 'TOTAL_PASIVO_PATRIMONIO', 'Total Pasivo y Patrimonio', 440, 'CREDITO', TRUE),

-- ESTADO DE RESULTADOS
('RES_ING_VENTA', 'ESTADO_RESULTADOS', 'Ingresos Ordinarios', 'Venta de servicios', 500, 'CREDITO', FALSE),
('RES_ING_COSTO', 'ESTADO_RESULTADOS', 'Ingresos Ordinarios', 'Costo del servicio', 510, 'DEBITO', FALSE),
('RES_UTIL_BRUTA', 'ESTADO_RESULTADOS', 'Ingresos Ordinarios', 'Utilidad Bruta en Ventas', 520, 'CREDITO', TRUE),

('RES_GADMIN_PERSONAL', 'ESTADO_RESULTADOS', 'Gastos ordinarios — Administración', 'Personal (beneficios a empleados)', 600, 'DEBITO', FALSE),
('RES_GADMIN_HONORARIOS', 'ESTADO_RESULTADOS', 'Gastos ordinarios — Administración', 'Honorarios', 610, 'DEBITO', FALSE),
('RES_GADMIN_IMPUESTOS', 'ESTADO_RESULTADOS', 'Gastos ordinarios — Administración', 'Impuestos', 620, 'DEBITO', FALSE),
('RES_GADMIN_ARRENDAMIENTO', 'ESTADO_RESULTADOS', 'Gastos ordinarios — Administración', 'Arrendamiento', 630, 'DEBITO', FALSE),
('RES_GADMIN_SERVICIOS', 'ESTADO_RESULTADOS', 'Gastos ordinarios — Administración', 'Servicios', 640, 'DEBITO', FALSE),
('RES_GADMIN_LEGALES', 'ESTADO_RESULTADOS', 'Gastos ordinarios — Administración', 'Gastos legales', 650, 'DEBITO', FALSE),
('RES_GADMIN_MANTENIMIENTO', 'ESTADO_RESULTADOS', 'Gastos ordinarios — Administración', 'Mantenimiento y reparaciones', 660, 'DEBITO', FALSE),
('RES_GADMIN_VIAJE', 'ESTADO_RESULTADOS', 'Gastos ordinarios — Administración', 'Gastos de viaje', 670, 'DEBITO', FALSE),
('RES_GADMIN_DEP', 'ESTADO_RESULTADOS', 'Gastos ordinarios — Administración', 'Depreciación', 680, 'DEBITO', FALSE),
('RES_GADMIN_DIVERSOS', 'ESTADO_RESULTADOS', 'Gastos ordinarios — Administración', 'Diversos', 690, 'DEBITO', FALSE),
('RES_GADMIN_TOTAL', 'ESTADO_RESULTADOS', 'Gastos ordinarios — Administración', 'Total gastos de administración', 700, 'DEBITO', TRUE),

('RES_GVENTAS_PERSONAL', 'ESTADO_RESULTADOS', 'Gastos ordinarios — Ventas', 'Personal (beneficios a empleados)', 800, 'DEBITO', FALSE),
('RES_GVENTAS_HONORARIOS', 'ESTADO_RESULTADOS', 'Gastos ordinarios — Ventas', 'Honorarios', 810, 'DEBITO', FALSE),
('RES_GVENTAS_IMPUESTOS', 'ESTADO_RESULTADOS', 'Gastos ordinarios — Ventas', 'Impuestos', 820, 'DEBITO', FALSE),
('RES_GVENTAS_ARRENDAMIENTO', 'ESTADO_RESULTADOS', 'Gastos ordinarios — Ventas', 'Arrendamiento', 830, 'DEBITO', FALSE),
('RES_GVENTAS_SERVICIOS', 'ESTADO_RESULTADOS', 'Gastos ordinarios — Ventas', 'Servicios', 840, 'DEBITO', FALSE),
('RES_GVENTAS_DIVERSOS', 'ESTADO_RESULTADOS', 'Gastos ordinarios — Ventas', 'Diversos', 850, 'DEBITO', FALSE),
('RES_GVENTAS_DETERIORO', 'ESTADO_RESULTADOS', 'Gastos ordinarios — Ventas', 'Deterioro', 860, 'DEBITO', FALSE),
('RES_GVENTAS_TOTAL', 'ESTADO_RESULTADOS', 'Gastos ordinarios — Ventas', 'Total gastos de ventas', 870, 'DEBITO', TRUE),

('RES_GOPER_TOTAL', 'ESTADO_RESULTADOS', 'Gastos Operacionales', 'Total gastos Operacionales', 880, 'DEBITO', TRUE),
('RES_UTIL_OPER', 'ESTADO_RESULTADOS', 'UTILIDAD OPERACIONAL', 'UTILIDAD OPERACIONAL', 890, 'CREDITO', TRUE),

('RES_INGFIN', 'ESTADO_RESULTADOS', 'Otros ingresos', 'Ingresos financieros', 900, 'CREDITO', FALSE),
('RES_OTROS_ARRENDAMIENTO', 'ESTADO_RESULTADOS', 'Otros ingresos', 'Arrendamiento', 910, 'CREDITO', FALSE),
('RES_OTROS_ING', 'ESTADO_RESULTADOS', 'Otros ingresos', 'Otros ingresos', 920, 'CREDITO', FALSE),
('RES_OTROS_ING_TOTAL', 'ESTADO_RESULTADOS', 'Otros ingresos', 'Total otros ingresos', 930, 'CREDITO', TRUE),

('RES_GASTOSFIN', 'ESTADO_RESULTADOS', 'Otros gastos', 'Gastos financieros', 940, 'DEBITO', FALSE),
('RES_OTROS_GASTOS', 'ESTADO_RESULTADOS', 'Otros gastos', 'Otros gastos', 950, 'DEBITO', FALSE),
('RES_OTROS_GASTOS_TOTAL', 'ESTADO_RESULTADOS', 'Otros gastos', 'Total otros gastos', 960, 'DEBITO', TRUE),

('RES_UTIL_ANTES_IMP', 'ESTADO_RESULTADOS', 'RESULTADO FINAL', 'Utilidad y/o pérdida antes de impuestos', 970, 'CREDITO', TRUE),
('RES_IMP_GANANCIAS', 'ESTADO_RESULTADOS', 'RESULTADO FINAL', 'Impuesto a las ganancias / renta', 980, 'DEBITO', FALSE),
('RES_RESULTADO_PERIODO', 'ESTADO_RESULTADOS', 'RESULTADO FINAL', 'Resultado del periodo', 990, 'CREDITO', TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- Mapeos sugeridos iniciales
INSERT INTO contabilidad_mapeo_cuentas (cuenta_codigo, rubro_id)
SELECT '5105%', id FROM contabilidad_rubros WHERE codigo = 'RES_GADMIN_PERSONAL' UNION ALL
SELECT '5110%', id FROM contabilidad_rubros WHERE codigo = 'RES_GADMIN_HONORARIOS' UNION ALL
SELECT '5115%', id FROM contabilidad_rubros WHERE codigo = 'RES_GADMIN_IMPUESTOS' UNION ALL
SELECT '5120%', id FROM contabilidad_rubros WHERE codigo = 'RES_GADMIN_ARRENDAMIENTO' UNION ALL
SELECT '5135%', id FROM contabilidad_rubros WHERE codigo = 'RES_GADMIN_SERVICIOS' UNION ALL
SELECT '5140%', id FROM contabilidad_rubros WHERE codigo = 'RES_GADMIN_LEGALES' UNION ALL
SELECT '5145%', id FROM contabilidad_rubros WHERE codigo = 'RES_GADMIN_MANTENIMIENTO' UNION ALL
SELECT '5155%', id FROM contabilidad_rubros WHERE codigo = 'RES_GADMIN_VIAJE' UNION ALL
SELECT '5160%', id FROM contabilidad_rubros WHERE codigo = 'RES_GADMIN_DEP' UNION ALL
SELECT '5195%', id FROM contabilidad_rubros WHERE codigo = 'RES_GADMIN_DIVERSOS' UNION ALL

SELECT '5205%', id FROM contabilidad_rubros WHERE codigo = 'RES_GVENTAS_PERSONAL' UNION ALL
SELECT '5210%', id FROM contabilidad_rubros WHERE codigo = 'RES_GVENTAS_HONORARIOS' UNION ALL
SELECT '5215%', id FROM contabilidad_rubros WHERE codigo = 'RES_GVENTAS_IMPUESTOS' UNION ALL
SELECT '5220%', id FROM contabilidad_rubros WHERE codigo = 'RES_GVENTAS_ARRENDAMIENTO' UNION ALL
SELECT '5235%', id FROM contabilidad_rubros WHERE codigo = 'RES_GVENTAS_SERVICIOS' UNION ALL
SELECT '5295%', id FROM contabilidad_rubros WHERE codigo = 'RES_GVENTAS_DIVERSOS' UNION ALL
SELECT '5299%', id FROM contabilidad_rubros WHERE codigo = 'RES_GVENTAS_DETERIORO'
ON CONFLICT (cuenta_codigo) DO NOTHING;
