-- ============================================================
-- Migración 025: Módulo Historial del Equipo
-- Fecha: 2026-05-11
-- ============================================================

-- ─── Tabla principal de historial ────────────────────────────
CREATE TABLE IF NOT EXISTS historial_equipo (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id                   UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  orden_trabajo_id            UUID REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
  numero_ot                   VARCHAR(30),                  -- copia denormalizada para referencia rápida

  tipo_mantenimiento          VARCHAR(30) NOT NULL CHECK (tipo_mantenimiento IN (
                                'correctivo',
                                'preventivo_250h',
                                'preventivo_500h',
                                'preventivo_1000h',
                                'inspeccion',
                                'otro'
                              )),

  horometro_al_ingreso        INTEGER NOT NULL DEFAULT 0,   -- horas acumuladas al entrar al taller

  -- Tiempos en taller
  fecha_hora_ingreso_taller   TIMESTAMPTZ,
  fecha_hora_salida_taller    TIMESTAMPTZ,

  -- Periodos en bodega (esperando repuestos / decisiones)
  fecha_inicio_bodega         TIMESTAMPTZ,
  fecha_fin_bodega            TIMESTAMPTZ,

  -- Diagnóstico
  fallas_encontradas          TEXT,
  nivel_criticidad            VARCHAR(20) CHECK (nivel_criticidad IN ('leve', 'moderado', 'critico')),
  causa_raiz                  TEXT,

  -- Intervención
  trabajos_realizados         TEXT,
  observaciones_seguridad     TEXT,

  -- Cierre
  estado_equipo_al_cierre     VARCHAR(40) CHECK (estado_equipo_al_cierre IN (
                                'operativo',
                                'operativo_con_restricciones',
                                'en_espera_repuestos',
                                'fuera_de_servicio'
                              )),
  proxima_fecha_mantenimiento DATE,
  costo_total_mantenimiento   DECIMAL(14, 2) DEFAULT 0,

  supervisor_id               UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Adjuntos (rutas relativas en el servidor)
  adjuntos                    TEXT[],

  -- Control de flujo
  ot_cerrada                  BOOLEAN NOT NULL DEFAULT FALSE,

  created_by                  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Técnicos asignados a la intervención ────────────────────
CREATE TABLE IF NOT EXISTS historial_tecnicos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  historial_id  UUID NOT NULL REFERENCES historial_equipo(id) ON DELETE CASCADE,
  empleado_id   UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  UNIQUE (historial_id, empleado_id)
);

-- ─── Repuestos por intervención ───────────────────────────────
CREATE TABLE IF NOT EXISTS historial_repuestos (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  historial_id            UUID NOT NULL REFERENCES historial_equipo(id) ON DELETE CASCADE,

  -- Repuesto retirado
  retirado_nombre         VARCHAR(255),
  retirado_codigo         VARCHAR(100),
  retirado_numero_serie   VARCHAR(100),
  retirado_motivo         TEXT,
  retirado_estado         VARCHAR(30) CHECK (retirado_estado IN ('desgastado', 'dañado', 'roto', 'funcional')),

  -- Repuesto instalado
  instalado_nombre        VARCHAR(255),
  instalado_codigo        VARCHAR(100),
  instalado_numero_serie  VARCHAR(100),
  instalado_procedencia   VARCHAR(30) CHECK (instalado_procedencia IN ('nuevo', 'reacondicionado', 'reutilizado')),
  instalado_garantia_hasta DATE,
  instalado_costo_unitario DECIMAL(14, 2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_historial_equipo       ON historial_equipo(equipo_id);
CREATE INDEX IF NOT EXISTS idx_historial_ot           ON historial_equipo(orden_trabajo_id);
CREATE INDEX IF NOT EXISTS idx_historial_fecha        ON historial_equipo(fecha_hora_ingreso_taller DESC);
CREATE INDEX IF NOT EXISTS idx_historial_tipo         ON historial_equipo(tipo_mantenimiento);
CREATE INDEX IF NOT EXISTS idx_historial_tecnicos_h   ON historial_tecnicos(historial_id);
CREATE INDEX IF NOT EXISTS idx_historial_repuestos_h  ON historial_repuestos(historial_id);
