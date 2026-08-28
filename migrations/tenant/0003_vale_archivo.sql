-- T-33 / vale-archivo — Migration: tablas vale_archivo y vale_archivo_items
-- Fuente: design.md §10, ADR-0034 (database-per-tenant sin columna tenant_id)
--
-- Tenant isolation: estas tablas viven en la base de datos del tenant.
-- TenantDatabaseRouter enruta cada conexión al schema correcto.
-- No existe columna tenant_id — el aislamiento es por conexión, no por filtro.

CREATE TABLE "vale_archivo" (
	"id" uuid PRIMARY KEY NOT NULL,
	"numero_vale" text NOT NULL,
	"fecha_solicitud" date NOT NULL,
	"fecha_recepcion" date NOT NULL,
	"unidad_solicitante" text NOT NULL,
	"solicitante_nombre" text NOT NULL,
	"solicitante_cargo" text NOT NULL,
	"autorizador_nombre" text NOT NULL,
	"autorizador_cargo" text NOT NULL,
	"estado" text NOT NULL,
	"creado_por" text NOT NULL,
	"busqueda_iniciada_por" text,
	"busqueda_iniciada_at" timestamp with time zone,
	"entregado_por" text,
	"entregado_at" timestamp with time zone,
	"receptor_entrega" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vale_archivo_estado_check" CHECK (
		"estado" IN (
			'RECIBIDA', 'EN_BUSQUEDA', 'COMPLETA', 'PARCIAL',
			'NO_LOCALIZADA', 'ENTREGADA', 'CERRADA'
		)
	)
);
--> statement-breakpoint
CREATE TABLE "vale_archivo_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"vale_id" uuid NOT NULL,
	"expediente_numero" text NOT NULL,
	"paciente_nombre" text NOT NULL,
	"especialidad" text NOT NULL,
	"estado_busqueda" text DEFAULT 'PENDIENTE' NOT NULL,
	"ubicacion_encontrada" text,
	"observaciones" text,
	CONSTRAINT "vale_archivo_items_vale_id_fk"
		FOREIGN KEY ("vale_id") REFERENCES "vale_archivo"("id") ON DELETE CASCADE,
	CONSTRAINT "vale_archivo_items_estado_busqueda_check" CHECK (
		"estado_busqueda" IN ('PENDIENTE', 'LOCALIZADO', 'NO_LOCALIZADO')
	),
	CONSTRAINT "vale_archivo_items_observaciones_length_check" CHECK (
		"observaciones" IS NULL OR char_length("observaciones") <= 500
	)
);
--> statement-breakpoint
CREATE INDEX "idx_vale_archivo_estado" ON "vale_archivo" ("estado");
--> statement-breakpoint
CREATE INDEX "idx_vale_archivo_fecha_sol" ON "vale_archivo" ("fecha_solicitud");
--> statement-breakpoint
CREATE INDEX "idx_vale_archivo_unidad" ON "vale_archivo" ("unidad_solicitante");
--> statement-breakpoint
CREATE INDEX "idx_vale_archivo_items_vale_id" ON "vale_archivo_items" ("vale_id");
