---
project: SIGAC
sdb_volume: "06 - Architecture & ADR"
version: "0.1.0"
status: "Draft for architecture validation"
date: "2026-08-13"
methodology:
  - Clean Architecture
  - Modular Monolith
  - C4 Model
  - Architecture Decision Records
  - Spec-Driven Development
---
# ARC-016 — Audit Architecture

Audit is separate from Domain Events and Movements.

Audit record candidate:
- audit_id;
- tenant_id;
- actor_id;
- action;
- resource_type/id;
- timestamp;
- request/correlation id;
- result;
- changed_fields summary;
- source (web/import/contingency);
- security context.

## Write model
Append-oriented. Application users cannot edit audit rows.

## Application context and port

Los Use Cases auditables reciben el `RequestContext` canónico e inmutable con actor,
tenant, `requestId`, `correlationId` y `source: WEB|INTERNAL`. La frontera server-side lo
construye antes de Application.

Application emite un `AuditEntry` semántico (`action`, `resourceType`, `resourceId`,
`result` y `changeSummary` permitido). `AuditWriter.append(entry, context)` lo enriquece
como `AuditRecord` completo: actor y tenant desde el contexto, IDs y source desde el
contexto, y timestamp al hacer append. El puerto no ofrece update/delete.

## Sensitive values
Do not log clinical data, tokens, secrets or full payloads unnecessarily. `AuditEntry`
nunca contiene datos C3.
