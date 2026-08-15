# Audit Physical Model Decision — Expediente Workspace

**Estado:** APPROVED
**Fecha:** 2026-08-15
**Scope:** Expediente Workspace v0.3.17 / T-09

## AUD-DB-EW-001 — Tabla y tenant

La tabla física canónica es `audit_log` dentro de cada tenant database. No contiene
`tenant_id`; `RequestContext.tenant` selecciona la database mediante
`TenantDatabaseRouter`.

## AUD-DB-EW-002 — DDL canónico

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

## AUD-DB-EW-003 — Identidad

Security / Audit adapter genera `id` como UUID antes del INSERT. No existe default
`gen_random_uuid()` ni dependencia de pgcrypto.

## AUD-DB-EW-004 — AuditResult

El único CHECK de `result` admite `success`, `denied`, `not-found`, `conflict` e
`invalid-transition`.

## AUD-DB-EW-005 — RequestSource

`source` es TEXT NOT NULL con CHECK cerrado a `WEB|INTERNAL`.

## AUD-DB-EW-006 — Catálogos abiertos

`action` y `resource_type` permanecen TEXT NOT NULL sin CHECK. Sus catálogos
transversales todavía no están cerrados.

## AUD-DB-EW-007 — Resource y trazabilidad

`resource_id` es TEXT NOT NULL, sin asumir UUID y sin FK. `request_id` y
`correlation_id` son TEXT NOT NULL, provienen de propiedades distintas de
RequestContext y nunca se sustituyen entre sí.

## AUD-DB-EW-008 — Tiempo

`occurred_at` es TIMESTAMPTZ NOT NULL sin default DB. PostgresAuditWriter establece
explícitamente el instante de append; no usa CURRENT_TIMESTAMP como segundo origen
temporal implícito.

## AUD-DB-EW-009 — Metadata JSON

`change_summary JSONB NULL` serializa únicamente el
`Readonly<Record<string,string>>` permitido por AuditEntry y nunca datos C3.
`security_context JSONB NULL` contiene metadata técnica opcional aprobada; NULL indica
ausencia. No se fija un JSON schema obligatorio en este slice.

Está prohibido persistir tokens, cookies, secretos, datos clínicos, connection strings
o stack traces en ambos campos.

## AUD-DB-EW-010 — source_ip_hash excluido

`source_ip_hash` no forma parte del schema actual. Requiere una decisión futura sobre
hashing, salt/pepper, retención y privacidad.

## AUD-DB-EW-011 — FKs, índices y append-only

T-09 no crea FKs ni índices secundarios en `audit_log`; sólo la PK. Security / Audit
expone INSERT append-only: no update, delete ni upsert.

## AUD-DB-EW-012 — Mapping

| Origen | Columna |
|---|---|
| `AuditEntry.action` | `action` |
| `AuditEntry.resourceType` | `resource_type` |
| `AuditEntry.resourceId` | `resource_id` |
| `AuditEntry.result` | `result` |
| `AuditEntry.changeSummary` | `change_summary` |
| `RequestContext.actor.actorId` | `actor_ref` |
| `RequestContext.requestId` | `request_id` |
| `RequestContext.correlationId` | `correlation_id` |
| `RequestContext.source` | `source` |
| UUID generado por adapter | `id` |
| timestamp de append del adapter | `occurred_at` |
| metadata técnica permitida | `security_context` |

## AUD-DB-EW-013 — Migration ownership

Security / Audit es propietario de una migración tenant posterior a T-10 para crear
`audit_log`. `packages/platform/database` puede componer el schema en el migration
registry sin transferir ownership. La migración T-10 permanece intacta.

## Gap cerrado

`AUD-DB-GAP` queda CLOSED. El DDL, mapping, ownership y restricciones de audit_log son
inequívocos para T-09.
