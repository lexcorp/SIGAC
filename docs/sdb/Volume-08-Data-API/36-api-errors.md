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

`HTTP_VALIDATION_ERROR` pertenece a la frontera y usa HTTP 400 para UUID/decimal bigint
inválidos, campos faltantes, tipos incorrectos y límites fuera de rango cuando exista
regla. Problem Details usa type `https://sigac/errors/http-validation`, title
`Invalid request`, detail estable y `errors` opcional con códigos `REQUIRED`,
`INVALID_FORMAT`, `INVALID_TYPE`, `OUT_OF_RANGE`. Nunca refleja el valor recibido ni
mensajes default de NestJS. Se distingue de `REQUEST_INVALID_TRANSITION`/409.

Agenda import añade: `AGENDA_UPLOAD_TOO_LARGE`/413,
`AGENDA_ARTIFACT_UNSUPPORTED`/415, `AGENDA_LAYOUT_REJECTED`/422,
`IDEMPOTENCY_KEY_REUSED`/409, `AGENDA_IMPORT_TIMEOUT`/504 y
`AGENDA_IMPORT_FAILED`/500. Multipart/key/file malformed usa
`HTTP_VALIDATION_ERROR`/400. No se añaden AuditResult ni outcomes de fila.
