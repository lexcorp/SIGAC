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
- request_id (`TEXT`, desde `RequestContext.requestId`)
- correlation_id (`TEXT` nullable, desde `RequestContext.correlationId` cuando aplique)
- source_ip_hash/candidate
- source
- change_summary jsonb nullable
- security_context jsonb minimal

No payload clínico completo.
No UPDATE/DELETE desde rol aplicación.

## Application port — Expediente Workspace

`AuditWriter.append(AuditEntry, RequestContext): Promise<void>` es el contrato
append-only consumido por los Use Cases. `AuditEntry` es la intención semántica de
Application y contiene exclusivamente:

- action
- resourceType
- resourceId
- result: `success | denied | not-found | conflict | invalid-transition`
- changeSummary opcional, sólo cuando esté permitido

`conflict` representa optimistic lock mismatch. Para una mutación fallida se escribe
fuera de la UoW mutante y únicamente después de su rollback.
`invalid-transition` representa un recurso existente y actor autorizado cuya operación
no es válida para el estado actual. También se escribe fuera de la UoW mutante después
del rollback. No se persisten aggregate, Movimiento ni audit success.

`AuditRecord` es el registro persistido completo. `AuditWriter` lo enriquece con:

- actorRef desde `RequestContext.actor`
- tenant/database desde `RequestContext.tenant`
- requestId, correlationId y source desde `RequestContext`
- occurredAt establecido por el writer al hacer append
- los campos semánticos de `AuditEntry`
- metadata técnica mínima permitida por DAT-012, a cargo del adapter

El puerto no ofrece update/delete. Application no construye metadata técnica ni
`occurredAt`; no se exige un `ClockPort` en este slice. Ningún entry/record contiene
datos C3. Para `GetExpediente`, `action = EXPEDIENTE_VIEW` y `resourceType = EXPEDIENTE`.

Para `GetExpedienteTimeline`, `action = EXPEDIENTE_TIMELINE_VIEW`,
`resourceType = EXPEDIENTE` y `resourceId = expedienteId`. Resultados: `denied` antes de
queries si falta permission; `not-found` si el Repository tenant-scoped no encuentra el
Expediente; `success` para página vacía o no vacía. Este append no crea Movimiento.
