---
project: SIGAC
sdb_volume: "08 - Data & API"
version: "0.1.0"
status: "Draft for data/API validation"
date: "2026-08-13"
architecture:
  database: PostgreSQL
  api: REST/OpenAPI
  tenancy: database-per-tenant
---
# DAT-012 — Audit Log

Append-only from application perspective.

Fields:
- id
- actor_ref
- action
- resource_type
- resource_id
- result
- occurred_at
- request_id
- correlation_id
- source_ip_hash/candidate
- source
- change_summary jsonb nullable
- security_context jsonb minimal

No payload clínico completo.
No UPDATE/DELETE desde rol aplicación.

## Application port — Expediente Workspace

`AuditWriter.append(AuditRecord, TenantContext): Promise<void>` es el contrato
append-only consumido por los Use Cases. `AuditRecord` contiene:

- actorRef
- action
- resourceType
- resourceId
- result: `success | denied | not-found`
- occurredAt
- requestId
- correlationId nullable
- source
- metadata de strings nullable, sin datos C3

El puerto no ofrece update/delete. Para `GetExpediente`, `action = EXPEDIENTE_VIEW` y
`resourceType = EXPEDIENTE`.
