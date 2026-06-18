-- ============================================================
-- Migración 065: Tabla de control de notificaciones por correo de SOAT
-- Fecha: 2026-06-16
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS soat_email_notifications (
    id              BIGSERIAL PRIMARY KEY,
    equipo_id       UUID NOT NULL REFERENCES equipos(id),
    fecha_vencimiento DATE NOT NULL,
    dias_aviso      SMALLINT NOT NULL,
    dedup_key       VARCHAR(255) NOT NULL UNIQUE,
    recipients      TEXT NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                    CHECK (status IN ('pendiente','enviado','error')),
    attempts        SMALLINT NOT NULL DEFAULT 0,
    last_error      TEXT,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_soat_email_pending
    ON soat_email_notifications (status)
    WHERE status = 'pendiente';

COMMIT;
