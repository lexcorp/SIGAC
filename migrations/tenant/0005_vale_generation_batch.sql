-- T-04 / agenda-to-vale-archivo — Identidad de sesión de generación y secuencia diaria
-- ADR-0035: numeración VA-YYYYMMDD-NNN tenant-local y atómica
-- ADR-0040: identidad idempotente (agendaDate + sourceImportacionId + generationSnapshotHash)
-- ADR-0034: sin columna tenant_id; aislamiento por database-per-tenant

CREATE TABLE "vale_daily_sequence" (
  "fecha_solicitud"  date    NOT NULL,
  "last_sequence"    integer NOT NULL DEFAULT 0,
  CONSTRAINT "vale_daily_sequence_pkey" PRIMARY KEY ("fecha_solicitud")
);
--> statement-breakpoint
CREATE TABLE "vale_generation_batch" (
  "id"                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "agenda_date"               date        NOT NULL,
  "source_importacion_id"     text        NOT NULL,
  "source_version"            text        NOT NULL,
  "generation_snapshot_hash"  text        NOT NULL,
  "actor_id"                  text        NOT NULL,
  "generated_at"              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "vale_generation_batch_idempotency_uq"
    UNIQUE ("agenda_date", "source_importacion_id", "generation_snapshot_hash")
);
--> statement-breakpoint
CREATE INDEX "idx_vale_gen_batch_date"
  ON "vale_generation_batch" ("agenda_date");
