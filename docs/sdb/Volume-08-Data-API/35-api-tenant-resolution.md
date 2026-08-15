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

La frontera implementa un resolver server-side conceptualmente equivalente a
`AuthenticatedRequestContextResolver.resolve(HttpRequestContext): Promise<RequestContext>`.
El tipo HTTP queda en infraestructura. El tenant procede sólo de fuentes trusted y
allow-listed, debe estar en `actor.tenantIds` y cualquier selección ambigua se resuelve
antes de Application. No se fijan claims OIDC concretos en este slice.

La frontera garantiza un `requestId` por request. `correlationId` sólo se propaga desde
una fuente trusted aprobada y, si falta, se genera. Nunca se reutilizan entre sí ni se
aceptan desde el body. Para HTTP, `source = WEB`.

Antes de invocar `ExpedienteCapabilityService`, el backend valida que el actor pertenece
al tenant resuelto. El servicio recibe `ActorContext` y `TenantContext` ya validados y no
resuelve ni selecciona tenant.

Contrato conceptual de `ActorContext`: `actorId`, `roles`, `permissions`, `tenantIds`.
