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

No stack trace/SQL/internal DB name.
