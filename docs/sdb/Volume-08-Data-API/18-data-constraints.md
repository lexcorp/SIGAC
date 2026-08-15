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
- `expediente_numero` explícitamente no unique para expediente-workspace;
- FK relationships;
- check states;
- due_at >= opened_at;
- new_due_at > previous_due_at for renewal;
- no blank identifiers;
- item unique within jornada/solicitud;
- file_sha256 unique candidate per relevant import scope.

Complex “one active loan” may be protected with partial unique index if semantics are confirmed.

Para Expediente Workspace, DB-EW-001..014 fija únicamente los CHECK de seis estados y
RequestSource `WEB|INTERNAL`, además de las FKs aprobadas. No se inventan otros
constraints.
