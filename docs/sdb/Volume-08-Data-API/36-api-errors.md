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
# API-006 — Error Model

`ApplicationError` usa la taxonomía cerrada mínima:

| Code | HTTP |
|---|---:|
| `PERMISSION_DENIED` | 403 |
| `INSUFFICIENT_ENABLING_SOURCE` | 403 |
| `EXPEDIENTE_NOT_FOUND` | 404 |
| `OPTIMISTIC_LOCK_CONFLICT` | 409 |
| `REQUEST_INVALID_TRANSITION` | 409 |

`AUTHENTICATION_REQUIRED` pertenece a la frontera API/BFF y se traduce a 401; no lo
produce `GetExpediente`. `DomainError` permanece separado y reservado a invariantes y
validaciones de dominio.

```json
{
  "type": "https://sigac/errors/request-invalid-transition",
  "title": "Invalid request transition",
  "status": 409,
  "code": "REQUEST_INVALID_TRANSITION",
  "detail": "The requested operation is not valid for the current state.",
  "traceId": "..."
}
```

Compartir HTTP 409 no implica compartir resultado de audit:

- `OPTIMISTIC_LOCK_CONFLICT` → audit `conflict`;
- `REQUEST_INVALID_TRANSITION` → audit `invalid-transition`.

`conflict` está reservado exclusivamente al mismatch de rowVersion.

No stack trace/SQL/internal DB name.

La capa API mapea el code a RFC7807 y lo conserva como extensión estable:

```json
{
  "status": 403,
  "title": "Forbidden",
  "code": "PERMISSION_DENIED"
}
```

No expone datos sensibles, stack trace, nombres de database ni existencia cross-tenant.
La ausencia tenant-scoped usa `EXPEDIENTE_NOT_FOUND`; no existe code público
`CROSS_TENANT_*`.

Una request no autenticada usa `AUTHENTICATION_REQUIRED`/401 en la frontera API/BFF.
Un actor autenticado sin permission usa `PERMISSION_DENIED`/403. El primero no forma
parte de la taxonomía `ApplicationError`.
