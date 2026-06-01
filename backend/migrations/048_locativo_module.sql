-- ============================================================
-- Migración 048: Módulo de Inventario Locativo
-- Fecha: 2026-05-30
-- Normas: NIIF para PYMES (Sección 17) + NIC 16 + Estatuto Tributario Colombia
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Secuencia para código interno LOC-YYYY-XXXXX
-- ─────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS seq_inventario_locativo START 1;

-- ─────────────────────────────────────────────────────────────
-- 2. Tabla principal: inventario_locativo
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventario_locativo (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_interno          VARCHAR(50) UNIQUE NOT NULL,
  codigo_placa            VARCHAR(50) UNIQUE,
  nombre                  VARCHAR(200) NOT NULL,
  descripcion             TEXT,
  grupo_locativo          VARCHAR(10) NOT NULL CHECK (grupo_locativo IN ('A', 'B', 'C')),
  subcategoria            VARCHAR(50) NOT NULL,
  clasificacion_contable  VARCHAR(10) NOT NULL CHECK (clasificacion_contable IN ('GASTO', 'ACTIVO')),
  tipo_propiedad          VARCHAR(15) DEFAULT 'PROPIA' CHECK (tipo_propiedad IN ('PROPIA', 'ARRENDADA')),
  cuenta_contable         VARCHAR(20),
  costo_historico         DECIMAL(16,2),
  valor_residual          DECIMAL(16,2) DEFAULT 0,
  vida_util_anios         DECIMAL(5,2),
  fecha_adquisicion       DATE,
  fecha_inicio_depreciacion DATE,
  metodo_depreciacion     VARCHAR(20) DEFAULT 'LINEA_RECTA'
    CHECK (metodo_depreciacion IN ('LINEA_RECTA','UNIDADES_PRODUCCION','NO_APLICA')),
  fecha_fin_contrato      DATE,
  incluye_prorrogas       BOOLEAN DEFAULT FALSE,
  sede                    VARCHAR(100),
  piso_nivel              VARCHAR(50),
  area_oficina_bodega     VARCHAR(100),
  ubicacion_detalle       VARCHAR(300),
  direccion_inmueble      VARCHAR(500),
  estado_fisico           VARCHAR(20) DEFAULT 'BUENO'
    CHECK (estado_fisico IN ('NUEVO','BUENO','REGULAR','MALO','DADO_DE_BAJA')),
  fecha_ultimo_mantenimiento DATE,
  responsable_id          UUID REFERENCES employees(id),
  responsable_nombre      VARCHAR(150),
  tipo_documento_soporte  VARCHAR(20)
    CHECK (tipo_documento_soporte IN ('FACTURA_COMPRA','ORDEN_TRABAJO','CONTRATO_OBRA','ACTA_ENTREGA','OTRO')),
  numero_documento_soporte VARCHAR(100),
  proveedor_id            UUID REFERENCES proveedores(id),
  proveedor_nombre        VARCHAR(200),
  documento_adjunto_id    UUID REFERENCES documentos(id),
  especificaciones        JSONB DEFAULT '{}',
  foto_path               VARCHAR(500),
  foto_url                VARCHAR(500),
  foto_thumb_url          VARCHAR(500),
  activo                  BOOLEAN DEFAULT TRUE,
  observaciones           TEXT,
  registrado_por          VARCHAR(150),
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loc_codigo        ON inventario_locativo(codigo_interno);
CREATE INDEX IF NOT EXISTS idx_loc_grupo         ON inventario_locativo(grupo_locativo);
CREATE INDEX IF NOT EXISTS idx_loc_subcategoria  ON inventario_locativo(subcategoria);
CREATE INDEX IF NOT EXISTS idx_loc_clasificacion ON inventario_locativo(clasificacion_contable);
CREATE INDEX IF NOT EXISTS idx_loc_sede          ON inventario_locativo(sede);
CREATE INDEX IF NOT EXISTS idx_loc_estado        ON inventario_locativo(estado_fisico);
CREATE INDEX IF NOT EXISTS idx_loc_responsable   ON inventario_locativo(responsable_id);

-- ─────────────────────────────────────────────────────────────
-- 3. Catálogo: locativo_subcategorias
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locativo_subcategorias (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo           CHAR(1) NOT NULL CHECK (grupo IN ('A','B','C')),
  codigo          VARCHAR(50) UNIQUE NOT NULL,
  nombre          VARCHAR(100) NOT NULL,
  descripcion     TEXT,
  campos_json     JSONB DEFAULT '[]',
  activo          BOOLEAN DEFAULT TRUE,
  orden           INT DEFAULT 0
);

-- Seeds con campos técnicos
INSERT INTO locativo_subcategorias (grupo, codigo, nombre, descripcion, orden, campos_json) VALUES

  -- GRUPO A
  ('A','RED_ELECTRICA','Red Eléctrica','Tableros, plantas, transformadores, acometidas',1,
   '[{"nombre":"tipo_red","label":"Tipo","tipo":"select","opciones":["Tablero principal","Tablero secundario","Planta de emergencia","Transformador","Acometida"],"requerido":true},{"nombre":"voltaje","label":"Voltaje (V)","tipo":"number","requerido":true},{"nombre":"amperaje","label":"Amperaje (A)","tipo":"number","requerido":false},{"nombre":"potencia_kva","label":"Potencia (kVA)","tipo":"number","requerido":false},{"nombre":"num_circuitos","label":"Número de circuitos","tipo":"number","requerido":false},{"nombre":"marca_tablero","label":"Marca","tipo":"text","requerido":false},{"nombre":"tiene_ups","label":"Tiene UPS","tipo":"boolean","requerido":false}]'),

  ('A','RED_HIDRAULICA','Red Hidráulica y Sanitaria','Tanques, motobombas, trampa de grasas, calentadores',2,
   '[{"nombre":"tipo_red","label":"Tipo","tipo":"select","opciones":["Tanque de reserva","Motobomba","Trampa de grasas","Calentador","Tubería principal"],"requerido":true},{"nombre":"capacidad_litros","label":"Capacidad (Litros)","tipo":"number","requerido":false},{"nombre":"material_tuberia","label":"Material tubería","tipo":"select","opciones":["PVC","CPVC","Cobre","Acero inoxidable","Galvanizado"],"requerido":false},{"nombre":"diametro_pulgadas","label":"Diámetro tubería (pulgadas)","tipo":"number","requerido":false}]'),

  ('A','RED_DATOS','Red de Voz y Datos','Racks, bandejas portacables, cableado estructurado',3,
   '[{"nombre":"tipo_elemento","label":"Tipo de elemento","tipo":"select","opciones":["Rack de comunicaciones","Bandeja portacables","Punto de red","Canaleta fija","Switch de red"],"requerido":true},{"nombre":"num_puertos","label":"Número de puertos","tipo":"number","requerido":false},{"nombre":"categoria_cable","label":"Categoría del cableado","tipo":"select","opciones":["Cat 5e","Cat 6","Cat 6A","Cat 7","Fibra óptica"],"requerido":false},{"nombre":"num_puntos_datos","label":"Puntos de datos cubiertos","tipo":"number","requerido":false}]'),

  ('A','CLIMATIZACION','Ventilación y Climatización','Aires acondicionados, ductos, extractores',4,
   '[{"nombre":"tipo_equipo","label":"Tipo de equipo","tipo":"select","opciones":["Aire central","Mini-split","Cassette","Extractor industrial","Ventilador industrial"],"requerido":true},{"nombre":"capacidad_btu","label":"Capacidad (BTU)","tipo":"number","requerido":false},{"nombre":"capacidad_toneladas","label":"Capacidad (Toneladas)","tipo":"number","requerido":false},{"nombre":"tipo_gas","label":"Tipo de gas refrigerante","tipo":"select","opciones":["R-22","R-410A","R-32","R-134A"],"requerido":false},{"nombre":"marca","label":"Marca","tipo":"text","requerido":false},{"nombre":"modelo","label":"Modelo","tipo":"text","requerido":false},{"nombre":"area_cubierta_m2","label":"Área cubierta (m²)","tipo":"number","requerido":false}]'),

  ('A','SEGURIDAD_INCENDIO','Seguridad y Red Contra Incendios','Sensores, gabinetes, aspersores, CCTV, alarmas',5,
   '[{"nombre":"tipo_sistema","label":"Tipo de sistema","tipo":"select","opciones":["Sensor de humo","Gabinete contra incendio","Aspersor","Red CCTV","Alarma","Control de acceso"],"requerido":true},{"nombre":"num_puntos","label":"Número de puntos/sensores","tipo":"number","requerido":false},{"nombre":"zona_cobertura","label":"Zona de cobertura","tipo":"text","requerido":false},{"nombre":"central_marca","label":"Marca de la central","tipo":"text","requerido":false}]'),

  -- GRUPO B
  ('B','DIVISION_MODULAR','Divisiones Modulares','Paneles de aluminio, vidrio, drywall',6,
   '[{"nombre":"material","label":"Material","tipo":"select","opciones":["Aluminio y vidrio templado","Drywall","Panel de yeso","Madera","MDF"],"requerido":true},{"nombre":"area_m2","label":"Área total (m²)","tipo":"number","requerido":true},{"nombre":"altura_m","label":"Altura (m)","tipo":"number","requerido":false},{"nombre":"num_modulos","label":"Número de módulos/paneles","tipo":"number","requerido":false},{"nombre":"incluye_puerta","label":"Incluye puerta","tipo":"boolean","requerido":false}]'),

  ('B','PUERTAS_PORTONES','Puertas y Portones','Cortinas enrollables, puertas de seguridad, peatonales',7,
   '[{"nombre":"tipo_puerta","label":"Tipo","tipo":"select","opciones":["Cortina enrollable","Puerta seguridad electroimán","Puerta peatonal vidrio","Puerta peatonal madera","Portón metálico","Puerta corrediza"],"requerido":true},{"nombre":"material","label":"Material","tipo":"select","opciones":["Acero","Aluminio","Vidrio","Madera","PVC"],"requerido":false},{"nombre":"ancho_m","label":"Ancho (m)","tipo":"number","requerido":false},{"nombre":"alto_m","label":"Alto (m)","tipo":"number","requerido":false},{"nombre":"tiene_control_acceso","label":"Control de acceso","tipo":"boolean","requerido":false},{"nombre":"marca_cerradura","label":"Marca cerradura/motor","tipo":"text","requerido":false}]'),

  ('B','FALSO_TECHO','Falsos Techos y Cielorrasos','Baldosas fibra de vidrio, drywall, PVC',8,
   '[{"nombre":"material","label":"Material","tipo":"select","opciones":["Fibra de vidrio","Drywall","PVC","Madera","Metálico"],"requerido":true},{"nombre":"area_m2","label":"Área (m²)","tipo":"number","requerido":true},{"nombre":"altura_libre_m","label":"Altura libre (m)","tipo":"number","requerido":false},{"nombre":"incluye_iluminacion","label":"Incluye luminarias","tipo":"boolean","requerido":false}]'),

  ('B','PISO_ESPECIAL','Pisos Especiales','Epóxico industrial, alfombra modular, laminado, porcelanato',9,
   '[{"nombre":"tipo_piso","label":"Tipo de piso","tipo":"select","opciones":["Epóxico industrial","Alfombra modular","Laminado","Porcelanato","Vinilo","Adoquín"],"requerido":true},{"nombre":"area_m2","label":"Área (m²)","tipo":"number","requerido":true},{"nombre":"espesor_mm","label":"Espesor (mm)","tipo":"number","requerido":false},{"nombre":"carga_soportada_kg","label":"Carga soportada (kg/m²)","tipo":"number","requerido":false}]'),

  -- GRUPO C
  ('C','CERRAMIENTO','Cerramientos y Fachadas','Rejas, pasamanos, marquesinas, domos policarbonato',10,
   '[{"nombre":"tipo_cerramiento","label":"Tipo","tipo":"select","opciones":["Reja de seguridad","Pasamanos","Marquesina","Domo policarbonato","Malla eslabonada","Cerca eléctrica"],"requerido":true},{"nombre":"material","label":"Material","tipo":"select","opciones":["Hierro forjado","Acero inoxidable","Aluminio","Policarbonato","Malla metálica"],"requerido":false},{"nombre":"longitud_m","label":"Longitud (m)","tipo":"number","requerido":false},{"nombre":"area_m2","label":"Área (m²)","tipo":"number","requerido":false}]'),

  ('C','PELICULA_POLARIZADO','Películas y Polarizados','Películas de seguridad y control solar en ventanales',11,
   '[{"nombre":"tipo_pelicula","label":"Tipo de película","tipo":"select","opciones":["Seguridad","Control solar","Decorativa","Privacidad","Anti-graffiti"],"requerido":true},{"nombre":"area_m2","label":"Área cubierta (m²)","tipo":"number","requerido":true},{"nombre":"factor_solar","label":"Factor solar (%)","tipo":"number","requerido":false},{"nombre":"marca","label":"Marca","tipo":"text","requerido":false},{"nombre":"garantia_anios","label":"Garantía (años)","tipo":"number","requerido":false}]'),

  ('C','APARATO_SANITARIO','Aparatos Sanitarios y Griferías','Sanitarios, lavamanos, fluxómetros, secadores de manos',12,
   '[{"nombre":"tipo_aparato","label":"Tipo de aparato","tipo":"select","opciones":["Sanitario","Lavamanos institucional","Fluxómetro","Secador de manos","Orinal","Ducha","Grifo industrial"],"requerido":true},{"nombre":"marca","label":"Marca","tipo":"text","requerido":false},{"nombre":"modelo","label":"Modelo","tipo":"text","requerido":false},{"nombre":"material","label":"Material","tipo":"select","opciones":["Porcelana","Acero inoxidable","Plástico ABS","Bronce","Cromado"],"requerido":false},{"nombre":"consumo_agua_lpf","label":"Consumo agua (litros/fluxión)","tipo":"number","requerido":false},{"nombre":"es_empotrado","label":"Es empotrado","tipo":"boolean","requerido":false}]')

ON CONFLICT (codigo) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 4. Tabla de bajas: locativo_bajas
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locativo_bajas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locativo_id     UUID NOT NULL REFERENCES inventario_locativo(id) ON DELETE CASCADE,
  fecha_baja      DATE NOT NULL DEFAULT CURRENT_DATE,
  motivo          TEXT NOT NULL,
  autorizado_por  VARCHAR(150),
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loc_bajas_locativo ON locativo_bajas(locativo_id);

-- ─────────────────────────────────────────────────────────────
-- 5. Trigger para updated_at automático
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_locativo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_locativo_updated_at ON inventario_locativo;
CREATE TRIGGER trg_locativo_updated_at
  BEFORE UPDATE ON inventario_locativo
  FOR EACH ROW
  EXECUTE FUNCTION update_locativo_updated_at();

COMMIT;
