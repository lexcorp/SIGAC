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
# Validation Decisions — Volume 08

Confirm/adjust:

1. Database-per-tenant physical model.
2. Control DB contains no patient/expediente business data.
3. Table ownership by module.
4. UUID-style internal IDs + institutional expediente number.
5. Optimistic concurrency.
6. Append-oriented movement/audit.
7. Audit != Movement != Outbox.
8. PostgreSQL-only search initially.
9. No universal soft delete.
10. File import staging + reconciliation.
11. `/api/v1` REST/OpenAPI.
12. Command endpoints for transitions.
13. Cursor pagination for histories.
14. Idempotency-Key on risky/retryable commands.
15. Platform admin API separated logically.
16. OpenAPI is source contract for generated client candidate.
