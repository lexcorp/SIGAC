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

## DDL canónico

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  actor_ref TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN (
    'success', 'denied', 'not-found', 'conflict', 'invalid-transition'
  )),
  request_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('WEB', 'INTERNAL')),
  occurred_at TIMESTAMPTZ NOT NULL,
  change_summary JSONB NULL,
  security_context JSONB NULL
);
```

El adapter genera id UUID y occurred_at explícitamente; no hay defaults DB para ambos
ni pgcrypto. action/resource_type no tienen CHECK, resource_id no asume UUID y no se
crean FKs ni índices secundarios. `source_ip_hash` queda excluido hasta una decisión de
privacy específica. La tabla no contiene tenant_id.

No payload clínico completo.
No UPDATE/DELETE desde rol aplicación.

## Ownership y storage transaccional

Security / Audit es propietario lógico de `audit_log`. La tabla existe físicamente en
cada tenant database para participar en la misma transacción PostgreSQL que una mutación
operacional exitosa. Archive Operations no ejecuta SQL directo sobre ella. Un binder de
infraestructura Audit produce un AuditWriter ligado a un transaction handle existente;
el port Application no cambia.

La migración de `audit_log` es una migración tenant posterior propiedad de Security /
Audit y no reescribe T-10. `AUD-DB-GAP` queda CLOSED mediante AUD-DB-EW-001..013.

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

Mapping: AuditEntry aporta action/resourceType/resourceId/result/changeSummary;
RequestContext aporta actorRef/requestId/correlationId/source y selecciona la database
tenant sin persistir tenant_id. El adapter aporta UUID, occurredAt y securityContext
opcional. change_summary sólo serializa `Record<string,string>`; security_context no
guarda tokens, cookies, secretos, datos clínicos, connection strings ni stack traces.

Para `GetExpedienteTimeline`, `action = EXPEDIENTE_TIMELINE_VIEW`,
`resourceType = EXPEDIENTE` y `resourceId = expedienteId`. Resultados: `denied` antes de
queries si falta permission; `not-found` si el Repository tenant-scoped no encuentra el
Expediente; `success` para página vacía o no vacía. Este append no crea Movimiento.

## Proyección sanitizada v0.3.21

`ExpedienteAuditQueryPort` filtra `resource_type=EXPEDIENTE` y
`resource_id=expedienteId` dentro de la tenant database. Devuelve `{items,nextCursor}`
cursor-based, sin total. Cada item contiene auditId, action, result, actorRef,
occurredAt, source, requestId y correlationId; no expone change_summary,
security_context ni metadata física. Requiere `EXPEDIENT_AUDIT_VIEW`.
