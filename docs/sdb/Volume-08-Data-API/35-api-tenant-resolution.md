---
project: SIGAC
sdb_volume: "08 - Data & API"
version: "0.2.0"
status: "Draft for data/API validation"
date: "2026-08-13"
architecture:
  database: PostgreSQL
  api: REST/OpenAPI
  tenancy: database-per-tenant
---
# API-005 — Tenant Resolution

Candidate sources:
- host/subdomain;
- server-maintained user tenant selection;
- trusted session claim validated against control DB.

Never:
`tenant_id` from arbitrary JSON body → database name.

Resolved tenant becomes part of the immutable canonical Application `RequestContext`:

```typescript
type RequestSource = 'WEB' | 'INTERNAL';

interface RequestContext {
  readonly actor: ActorContext;
  readonly tenant: TenantContext;
  readonly requestId: string;
  readonly correlationId: string;
  readonly source: RequestSource;
}
```

The server-side boundary constructs it before Application. `requestId` identifies one
request/execution; `correlationId` relates a logical flow and cannot substitute it.
Actor, tenant and identifiers never come from arbitrary body/query input.

Antes de invocar `ExpedienteCapabilityService`, el backend valida que el actor pertenece
al tenant resuelto. El servicio recibe `ActorContext` y `TenantContext` ya validados y no
resuelve ni selecciona tenant.

Contrato conceptual de `ActorContext`: `actorId`, `roles`, `permissions`, `tenantIds`.
