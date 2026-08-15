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
# DAT-018 — Constraints

Database constraints candidates:
- unique expediente_numero;
- FK relationships;
- check states;
- due_at >= opened_at;
- new_due_at > previous_due_at for renewal;
- no blank identifiers;
- item unique within jornada/solicitud;
- file_sha256 unique candidate per relevant import scope.

Complex “one active loan” may be protected with partial unique index if semantics are confirmed.
