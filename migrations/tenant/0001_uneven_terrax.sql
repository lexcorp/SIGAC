CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_ref" text NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"result" text NOT NULL,
	"request_id" text NOT NULL,
	"correlation_id" text NOT NULL,
	"source" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"change_summary" jsonb,
	"security_context" jsonb,
	CONSTRAINT "audit_log_result_check" CHECK ("audit_log"."result" IN ('success', 'denied', 'not-found', 'conflict', 'invalid-transition')),
	CONSTRAINT "audit_log_source_check" CHECK ("audit_log"."source" IN ('WEB', 'INTERNAL'))
);
