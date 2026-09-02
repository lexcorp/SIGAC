-- T-04 / agenda-to-vale-archivo — Trace snapshot inmutable por Vale generado
-- ADR-0038: conflictos cross-group, resolución humana y alternativas excluidas
-- ADR-0040: snapshot inmutable; items/conflicts en JSONB (no PII)

CREATE TABLE "vale_generation_trace" (
  "id"                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "batch_id"                uuid        NOT NULL,
  "vale_id"                 uuid        NOT NULL,
  "numero_vale"             text        NOT NULL,
  "agenda_date"             date        NOT NULL,
  "servicio_codigo"         text        NOT NULL,
  "servicio_nombre"         text        NOT NULL,
  "medico_numero_empleado"  text        NOT NULL,
  "medico_nombre"           text        NOT NULL,
  -- [{valeItemId, expedienteNumero, appointmentReferences:[{folio,servicioCodigo,medicoNumeroEmpleado}]}]
  "items"                   jsonb       NOT NULL DEFAULT '[]',
  -- [{expedienteNumero, ownerValeItemId, ownerGroup, alternatives:[{group,appointmentReferences}]}]
  "resolved_conflicts"      jsonb       NOT NULL DEFAULT '[]',
  CONSTRAINT "vale_generation_trace_batch_fk"
    FOREIGN KEY ("batch_id")
    REFERENCES "vale_generation_batch"("id") ON DELETE CASCADE,
  CONSTRAINT "vale_generation_trace_vale_fk"
    FOREIGN KEY ("vale_id")
    REFERENCES "vale_archivo"("id") ON DELETE CASCADE,
  CONSTRAINT "vale_generation_trace_vale_uq"
    UNIQUE ("vale_id")
);
--> statement-breakpoint
CREATE INDEX "idx_vale_gen_trace_batch"
  ON "vale_generation_trace" ("batch_id");
