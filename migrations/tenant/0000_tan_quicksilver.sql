CREATE TABLE "expedientes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"expediente_numero" text NOT NULL,
	"expediente_numero_normalizado" text NOT NULL,
	"paciente_id_institucional" text NOT NULL,
	"paciente_curp" text NOT NULL,
	"paciente_nombre_operativo" text NOT NULL,
	"paciente_numero_issste" text NOT NULL,
	"estado_operativo" text NOT NULL,
	"ubicacion_actual_id" uuid,
	"custodio_tipo" text,
	"custodio_ref" text,
	"custodio_servicio" text,
	"custodio_location" text,
	"custodio_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "expedientes_estado_operativo_check" CHECK ("expedientes"."estado_operativo" IN ('DISPONIBLE', 'APARTADO', 'EN_TRASLADO', 'EN_CONSULTA', 'NO_LOCALIZADO', 'EXTRAVIADO'))
);
--> statement-breakpoint
CREATE TABLE "movimientos_expediente" (
	"id" uuid PRIMARY KEY NOT NULL,
	"expediente_id" uuid NOT NULL,
	"movement_type" text NOT NULL,
	"origin_location_id" uuid,
	"destination_location_id" uuid,
	"origin_custodian_ref" text,
	"destination_custodian_ref" text,
	"business_reference_type" text NOT NULL,
	"business_reference_id" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_ref" text NOT NULL,
	"source" text NOT NULL,
	"correlation_id" text,
	CONSTRAINT "movimientos_expediente_source_check" CHECK ("movimientos_expediente"."source" IN ('WEB', 'INTERNAL'))
);
--> statement-breakpoint
CREATE TABLE "ubicaciones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"codigo" text NOT NULL,
	"descripcion" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expedientes" ADD CONSTRAINT "expedientes_ubicacion_actual_id_ubicaciones_id_fk" FOREIGN KEY ("ubicacion_actual_id") REFERENCES "public"."ubicaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_expediente" ADD CONSTRAINT "movimientos_expediente_expediente_id_expedientes_id_fk" FOREIGN KEY ("expediente_id") REFERENCES "public"."expedientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expedientes_numero_normalizado_idx" ON "expedientes" USING btree ("expediente_numero_normalizado");