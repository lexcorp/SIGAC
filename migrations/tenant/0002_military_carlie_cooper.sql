CREATE TABLE "agenda_artifact_metadata" (
	"id" uuid PRIMARY KEY NOT NULL,
	"importacion_id" uuid NOT NULL,
	"agenda_date" text NOT NULL,
	"fingerprint" text NOT NULL,
	"imported_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agenda_idempotency_keys" (
	"idempotency_key" text PRIMARY KEY NOT NULL,
	"importacion_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agenda_imports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"agenda_date" text NOT NULL,
	"imported_at" timestamp with time zone NOT NULL,
	"outcome" text NOT NULL,
	"received_records" integer DEFAULT 0 NOT NULL,
	"processed" integer DEFAULT 0 NOT NULL,
	"added" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"unchanged" integer DEFAULT 0 NOT NULL,
	"restored" integer DEFAULT 0 NOT NULL,
	"pending_review" integer DEFAULT 0 NOT NULL,
	"rejected" integer DEFAULT 0 NOT NULL,
	"duplicate_folio" integer DEFAULT 0 NOT NULL,
	"withdrawn_from_agenda" integer DEFAULT 0 NOT NULL,
	"incidents" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "agenda_imports_outcome_check" CHECK ("agenda_imports"."outcome" IN ('IMPORTED', 'ALREADY_IMPORTED', 'RECONCILED'))
);
--> statement-breakpoint
CREATE TABLE "agenda_incidencias" (
	"id" uuid PRIMARY KEY NOT NULL,
	"importacion_id" uuid NOT NULL,
	"registro_id" uuid NOT NULL,
	"source_position" integer NOT NULL,
	"incident_type" text NOT NULL,
	CONSTRAINT "agenda_incidencias_incident_type_check" CHECK ("agenda_incidencias"."incident_type" IN ('PHYSICIAN_NOT_RESOLVED','PHYSICIAN_AMBIGUOUS','SERVICE_NOT_RESOLVED','EXPEDIENT_NOT_RESOLVED','REQUIRED_DATA_MISSING','ROW_INCONSISTENT','DUPLICATE_FOLIO_IN_SNAPSHOT'))
);
--> statement-breakpoint
CREATE TABLE "agenda_registros" (
	"id" uuid PRIMARY KEY NOT NULL,
	"importacion_id" uuid NOT NULL,
	"source_position" integer NOT NULL,
	"processing_result" text NOT NULL,
	"orig_folio" text,
	"orig_patient_name" text,
	"orig_expediente_reference" text,
	"orig_beneficiary_type" text,
	"orig_first_time_marker" text,
	"orig_subsequent_marker" text,
	"orig_agenda_date" text,
	"orig_appointment_time" text,
	"orig_physician_employee_number" text,
	"orig_physician_name" text,
	"orig_service_code" text,
	"orig_service_name" text,
	"interp_folio" text,
	"interp_agenda_date" text,
	"interp_beneficiary_type" text,
	"interp_appointment_kind" text,
	"interp_appointment_time" text,
	"interp_numero_empleado" text,
	"interp_servicio_codigo" text,
	"interp_servicio_nombre" text,
	"resolved_expediente_id" text,
	"resolved_physician_reference" text,
	CONSTRAINT "agenda_registros_source_position_check" CHECK ("agenda_registros"."source_position" > 0),
	CONSTRAINT "agenda_registros_processing_result_check" CHECK ("agenda_registros"."processing_result" IN ('ADDED','UPDATED','UNCHANGED','RESTORED','PENDING_REVIEW','REJECTED','DUPLICATE_FOLIO')),
	CONSTRAINT "agenda_registros_interp_appointment_kind_check" CHECK ("agenda_registros"."interp_appointment_kind" IS NULL OR "agenda_registros"."interp_appointment_kind" IN ('FIRST_TIME','SUBSEQUENT'))
);
--> statement-breakpoint
CREATE TABLE "agendas" (
	"agenda_date" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "citas" (
	"agenda_date" text NOT NULL,
	"folio" text NOT NULL,
	"hora" text NOT NULL,
	"expediente_reference" text,
	"nombre_paciente" text NOT NULL,
	"tipo_derechohabiente" text NOT NULL,
	"tipo_consulta" text NOT NULL,
	"medico_numero_empleado" text NOT NULL,
	"medico_nombre" text NOT NULL,
	"servicio_codigo" text NOT NULL,
	"servicio_nombre" text NOT NULL,
	"lifecycle" text NOT NULL,
	CONSTRAINT "citas_pkey" PRIMARY KEY("agenda_date","folio"),
	CONSTRAINT "citas_tipo_consulta_check" CHECK ("citas"."tipo_consulta" IN ('FIRST_TIME', 'SUBSEQUENT')),
	CONSTRAINT "citas_lifecycle_check" CHECK ("citas"."lifecycle" IN ('ACTIVA', 'RETIRADA_DE_AGENDA'))
);
--> statement-breakpoint
ALTER TABLE "agenda_artifact_metadata" ADD CONSTRAINT "agenda_artifact_metadata_importacion_id_agenda_imports_id_fk" FOREIGN KEY ("importacion_id") REFERENCES "public"."agenda_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_idempotency_keys" ADD CONSTRAINT "agenda_idempotency_keys_importacion_id_agenda_imports_id_fk" FOREIGN KEY ("importacion_id") REFERENCES "public"."agenda_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_incidencias" ADD CONSTRAINT "agenda_incidencias_importacion_id_agenda_imports_id_fk" FOREIGN KEY ("importacion_id") REFERENCES "public"."agenda_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_incidencias" ADD CONSTRAINT "agenda_incidencias_registro_id_agenda_registros_id_fk" FOREIGN KEY ("registro_id") REFERENCES "public"."agenda_registros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_registros" ADD CONSTRAINT "agenda_registros_importacion_id_agenda_imports_id_fk" FOREIGN KEY ("importacion_id") REFERENCES "public"."agenda_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citas" ADD CONSTRAINT "citas_agenda_date_agendas_agenda_date_fk" FOREIGN KEY ("agenda_date") REFERENCES "public"."agendas"("agenda_date") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agenda_artifact_metadata_date_fp_idx" ON "agenda_artifact_metadata" USING btree ("agenda_date","fingerprint","imported_at","importacion_id");--> statement-breakpoint
CREATE INDEX "agenda_imports_imported_at_id_idx" ON "agenda_imports" USING btree ("imported_at","id");--> statement-breakpoint
CREATE INDEX "agenda_imports_agenda_date_idx" ON "agenda_imports" USING btree ("agenda_date");--> statement-breakpoint
CREATE INDEX "agenda_incidencias_importacion_id_idx" ON "agenda_incidencias" USING btree ("importacion_id");--> statement-breakpoint
CREATE INDEX "agenda_incidencias_importacion_source_idx" ON "agenda_incidencias" USING btree ("importacion_id","source_position","id");--> statement-breakpoint
CREATE INDEX "agenda_registros_importacion_id_idx" ON "agenda_registros" USING btree ("importacion_id");--> statement-breakpoint
CREATE INDEX "agenda_registros_importacion_source_idx" ON "agenda_registros" USING btree ("importacion_id","source_position","id");--> statement-breakpoint
CREATE INDEX "citas_agenda_date_lifecycle_idx" ON "citas" USING btree ("agenda_date","lifecycle");--> statement-breakpoint
CREATE INDEX "citas_agenda_date_servicio_idx" ON "citas" USING btree ("agenda_date","lifecycle","servicio_codigo","servicio_nombre","medico_nombre","medico_numero_empleado","hora","folio");